// =============================================================================
// Login con Google — paso 2: callback
// =============================================================================
// Verifica state (CSRF), intercambia el code por tokens, lee el email y lo
// resuelve contra la tabla USUARIOS (migración 0053):
//   · existe y no está suspendido → sesión firmada con SU rol; se registra el
//     login (invitado → activo, nombre/foto de Google).
//   · no existe pero está en AUTH_ALLOWED_EMAILS → se auto-crea como ADMIN
//     activo (bootstrap: esos emails son los dueños actuales del deploy).
//   · no existe, sin allowlist y la tabla está VACÍA → primer login se vuelve
//     admin (bootstrap de una instancia nueva).
//   · cualquier otro caso → no-autorizado. Los usuarios nuevos se agregan
//     desde /admin.
//
// Además, si Google devuelve un refresh_token (el login pide el scope de
// Calendar), se guarda en el workspace del usuario — best-effort: eso NUNCA
// puede impedir que el login se complete.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { EMAIL_COOKIE, SESSION_COOKIE, SESSION_DIAS, crearToken, destinoSeguro } from '@/lib/auth-session';
import { buscarUsuarioPorEmail, contarUsuarios, crearUsuario, registrarLogin, type Usuario } from '@/lib/usuarios';
import { googleCalendarDueno, guardarRefreshTokenGoogle } from '@/lib/google-calendar';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

function enAllowlist(email: string): boolean {
  const raw = process.env.AUTH_ALLOWED_EMAILS;
  if (!raw) return false;
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Resuelve (o crea, si corresponde) el usuario para este email. null = negado.
async function resolverUsuario(email: string): Promise<Usuario | null> {
  const existente = await buscarUsuarioPorEmail(email);
  if (existente) return existente.estado === 'suspendido' ? null : existente;

  if (enAllowlist(email)) {
    return crearUsuario({ email, rol: 'admin', estado: 'activo', invitado_por: 'allowlist' });
  }
  if (!process.env.AUTH_ALLOWED_EMAILS && (await contarUsuarios()) === 0) {
    return crearUsuario({ email, rol: 'admin', estado: 'activo', invitado_por: 'bootstrap' });
  }
  return null;
}

// Degradación si la tabla usuarios no está disponible (deploy antes de la
// migración 0053, o Supabase caída): un email en la allowlist entra igual como
// admin, para no dejar afuera a los dueños por un problema de base.
async function resolverConFallback(email: string): Promise<Usuario | null> {
  try {
    return await resolverUsuario(email);
  } catch (e) {
    console.error('[auth] resolverUsuario falló, evaluando allowlist:', e);
    if (!enAllowlist(email)) return null;
    return { id: 0, email, nombre: '', rol: 'admin', estado: 'activo', foto_url: null, invitado_por: 'allowlist-fallback', ultimo_login: null, created_at: '', workspace_id: null, rol_ws: null, invitacion_enviada_at: null };
  }
}

/**
 * Guarda el refresh_token de Google Calendar en el workspace DEL USUARIO que se
 * está logueando. Todo acá es BEST-EFFORT: no lanza nunca (el caller está dentro
 * del try que haría fallar el login, así que se traga todo y solo loguea).
 *
 * Por qué el workspace va EXPLÍCITO (runWithWorkspace) y no por cookies:
 * setSetting resuelve el ws con getWorkspaceActual(), que lee la cookie de
 * sesión — pero acá esa cookie recién se está seteando en la RESPUESTA, así que
 * todavía no existe para este request y el resolver caería al dueño (OWNER_WS).
 * Eso metería el token de un usuario en el workspace de otro.
 *
 * Sin workspace propio NO se guarda nada (jamás OWNER_WS de fallback). Pasa con
 * el admin de agencia (workspace_id null: cruza workspaces impersonando) y con
 * el admin de fallback de la base caída (id 0). Es el mismo criterio del flujo
 * manual de /api/integraciones/google-calendar, que exige esWorkspaceDueno().
 *
 * Y solo conecta la agenda si el workspace no tiene ninguna, porque acá guardarla
 * es un efecto de costado de loguearse, no una decisión. Cambiar de agenda se
 * hace a propósito desde /integraciones (desconectar + conectar).
 */
async function guardarCalendarBestEffort(usuario: Usuario, refreshToken: string | undefined): Promise<void> {
  // Sin refresh_token no hay nada que hacer y NO es error: Google solo lo manda
  // en la primera autorización de este set de scopes. En los logins siguientes
  // ya quedó guardado el de aquella vez.
  if (!refreshToken) return;
  try {
    const ws = usuario.workspace_id;
    if (ws == null || !Number.isInteger(ws) || ws <= 0) {
      console.warn(`[auth] ${usuario.email}: refresh_token de Google pero el usuario no tiene workspace propio — no se guarda.`);
      return;
    }
    // Un closer/setter nunca fija la agenda del workspace. (null = admin por
    // backfill: misma convención que getRolWsEfectivo en lib/workspace.ts.)
    const rolWs = usuario.rol_ws ?? 'admin';
    if (rolWs !== 'admin') {
      console.log(`[auth] ${usuario.email}: rol_ws=${rolWs} → no fija la agenda del workspace ${ws} (solo el admin).`);
      return;
    }
    // El rol no alcanza: un workspace puede tener VARIOS admins (ws1 tiene 3), y
    // el token de Calendar es UNO solo. Sin esto, el último en loguearse pisaba
    // al anterior en silencio y el buscador de reuniones se mudaba a la agenda
    // equivocada. Solo se guarda si no hay ninguna conectada, o si es la MISMA
    // persona re-consintiendo. Para cambiar de agenda hay que desconectar primero.
    await runWithWorkspace(ws, async () => {
      const dueno = await googleCalendarDueno();
      if (dueno && dueno.toLowerCase() !== usuario.email.toLowerCase()) {
        console.log(`[auth] ${usuario.email}: el workspace ${ws} ya usa la agenda de ${dueno} — no se pisa.`);
        return;
      }
      await guardarRefreshTokenGoogle(refreshToken, usuario.email);
      console.log(`[auth] Google Calendar conectado para el workspace ${ws} (${usuario.email}).`);
    });
  } catch (e) {
    console.error('[auth] no se pudo guardar el refresh_token de Google Calendar (el login sigue igual):', e);
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const loginUrl = new URL('/login', url.origin);
  const fail = (motivo: string) => {
    loginUrl.searchParams.set('error', motivo);
    return NextResponse.redirect(loginUrl);
  };

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = req.cookies.get('oauth_state')?.value;
  const next = req.cookies.get('oauth_next')?.value || '/';

  if (!code || !state || !stateCookie || state !== stateCookie) return fail('oauth');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('config');

  const redirectUri = `${url.origin}/api/auth/callback/google`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token) return fail('token');

    const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const ui = (await uiRes.json()) as { email?: string; email_verified?: boolean; name?: string; picture?: string };
    const email = typeof ui.email === 'string' ? ui.email.toLowerCase() : '';
    if (!email || ui.email_verified === false) return fail('no-autorizado');

    const usuario = await resolverConFallback(email);
    if (!usuario) return fail('no-autorizado');

    // usuario.id === 0 es el admin de fallback (DB no disponible): no persiste
    // login y su sesión no se re-chequea contra la base (sub break-glass).
    if (usuario.id > 0) await registrarLogin(email, { nombre: ui.name, foto_url: ui.picture });

    // Google Calendar: el login ya NO pide el scope de la agenda (un scope sensible
    // acá deja la app restringida a testers y nadie puede entrar), así que en el
    // login normal esto no recibe refresh_token y sale de una. Se conserva porque
    // el mismo callback atiende el consentimiento incremental: si el usuario vuelve
    // habiendo aceptado la agenda, el token se guarda igual. Nunca tumba el login.
    await guardarCalendarBestEffort(usuario, tokens.refresh_token);

    const token = crearToken({
      sub: usuario.id > 0 ? String(usuario.id) : 'password',
      email,
      nombre: (ui.name ?? usuario.nombre ?? '').trim(),
      rol: usuario.rol,
    });
    if (!token) return fail('config');

    const res = NextResponse.redirect(new URL(destinoSeguro(next), url.origin));
    const base = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    res.cookies.set({ name: SESSION_COOKIE, value: token, httpOnly: true, maxAge: 60 * 60 * 24 * SESSION_DIAS, ...base });
    res.cookies.set({ name: EMAIL_COOKIE, value: email, httpOnly: false, maxAge: 60 * 60 * 24 * SESSION_DIAS, ...base });
    res.cookies.set({ name: 'oauth_state', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'oauth_next', value: '', maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('[auth] callback google:', e);
    return fail('exchange');
  }
}
