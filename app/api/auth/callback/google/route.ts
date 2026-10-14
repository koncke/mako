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
//   · no está en usuarios pero lo INVITARON a un curso con ese email → entra
//     como ALUMNO: cookie `mako_alumno` y a /mi-curso. NUNCA una sesión de MaKo
//     (el porqué, medido, en lib/alumno-sesion.ts).
//   · cualquier otro caso → no-autorizado. Los usuarios nuevos se agregan
//     desde /admin.
//
// Además, si Google devuelve un refresh_token (el login pide el scope de
// Calendar), se guarda en el workspace del usuario — best-effort: eso NUNCA
// puede impedir que el login se complete.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { DISPOSITIVO_COOKIE, crearPreauth, destinoSeguro } from '@/lib/auth-session';
import { ponerPreauth, ponerSesion } from '@/lib/sesion-cookies';
import { decidirTrasGoogle, requiereSegundoFactor } from '@/lib/mfa-reglas';
import { dispositivoValido } from '@/lib/mfa';
import { buscarUsuarioPorEmail, contarUsuarios, crearUsuario, registrarLogin, type Usuario } from '@/lib/usuarios';
import { googleCalendarDueno, guardarRefreshTokenGoogle } from '@/lib/google-calendar';
import { runWithWorkspace } from '@/lib/workspace';
import { accesoInvitadoPorEmail, ponerCookieAlumno } from '@/lib/alumno-acceso';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';

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
    return { id: 0, email, nombre: '', rol: 'admin', estado: 'activo', foto_url: null, invitado_por: 'allowlist-fallback', ultimo_login: null, created_at: '', workspace_id: null, rol_ws: null, invitacion_enviada_at: null, mfa_activo: false };
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
    if (!usuario) {
      // ── El alumno de un curso ──────────────────────────────────────────────
      // Sólo llega acá quien NO es usuario de MaKo: `usuarios` gana siempre, y
      // `accesoInvitadoPorEmail` lo vuelve a preguntar (un suspendido también cae en
      // este `null` y no se puede colar como alumno). Lo que entra es la cookie del
      // alumno y NADA más: ni `mako_session`, ni `mako_email`, ni `registrarLogin`.
      //
      // ⚠️ Va a /mi-curso IGNORANDO `oauth_next`: el destino lo pidió una pantalla
      // interna (el `?next=` de un rebote del proxy) y el alumno no tiene ninguna.
      // El state ya se validó arriba, igual que para cualquier login.
      const alumno = await accesoInvitadoPorEmail(email);
      if (!alumno) return fail('no-autorizado');
      const res = NextResponse.redirect(new URL(RUTA_ALUMNO, url.origin));
      if (!ponerCookieAlumno(res, alumno)) return fail('config');
      res.cookies.set({ name: 'oauth_state', value: '', maxAge: 0, path: '/' });
      res.cookies.set({ name: 'oauth_next', value: '', maxAge: 0, path: '/' });
      return res;
    }

    // usuario.id === 0 es el admin de fallback (DB no disponible): no persiste
    // login y su sesión no se re-chequea contra la base (sub break-glass).
    // El calendario se guarda ANTES del segundo paso a propósito: el refresh_token sólo
    // existe en esta respuesta de Google y no se lo pasea por una cookie. No abre nada:
    // conecta la agenda de ESTA misma cuenta de Google a SU propio workspace, y sólo si
    // no tenía ninguna — quien ya tiene la cuenta de Google ya tenía esa agenda.
    await guardarCalendarBestEffort(usuario, tokens.refresh_token);

    const nombre = (ui.name ?? usuario.nombre ?? '').trim();
    const sub = usuario.id > 0 ? String(usuario.id) : 'password';

    // ── El segundo factor ──────────────────────────────────────────────────────
    // `decidirTrasGoogle` (lib/mfa-reglas.ts, con test) decide entre tres salidas. El
    // dispositivo de confianza se consulta sólo si hace falta: es una consulta a la base.
    const requiere = requiereSegundoFactor(usuario.rol, !!usuario.mfa_activo);
    let dispositivo = false;
    if (requiere && usuario.id > 0) {
      try { dispositivo = await dispositivoValido(usuario.id, req.cookies.get(DISPOSITIVO_COOKIE)?.value); }
      catch { dispositivo = false; }
    }
    const decision = decidirTrasGoogle({
      rol: usuario.rol, mfaActivo: !!usuario.mfa_activo, tieneFila: usuario.id > 0, dispositivoValido: dispositivo,
    });

    // Sin base no hay con qué comprobar el segundo factor: antes este usuario de
    // emergencia entraba como admin directo. Ya no.
    if (decision === 'bloquear') return fail('mfa-sin-base');

    if (decision === 'segundo-factor') {
      const pre = crearPreauth({ sub, email, nombre, rol: usuario.rol, next: destinoSeguro(next), foto: ui.picture });
      if (!pre) return fail('config');
      const res = NextResponse.redirect(new URL('/login/2fa', url.origin));
      ponerPreauth(res, pre);
      res.cookies.set({ name: 'oauth_state', value: '', maxAge: 0, path: '/' });
      res.cookies.set({ name: 'oauth_next', value: '', maxAge: 0, path: '/' });
      return res;
    }

    // Entra directo: no necesita segundo factor, o el dispositivo es de confianza.
    if (usuario.id > 0) await registrarLogin(email, { nombre: ui.name, foto_url: ui.picture });
    const res = NextResponse.redirect(new URL(destinoSeguro(next), url.origin));
    if (!ponerSesion(res, { sub, email, nombre, rol: usuario.rol, mfa: requiere ? 'dispositivo' : undefined })) {
      return fail('config');
    }
    res.cookies.set({ name: 'oauth_state', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'oauth_next', value: '', maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('[auth] callback google:', e);
    return fail('exchange');
  }
}
