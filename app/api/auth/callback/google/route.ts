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
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { EMAIL_COOKIE, SESSION_COOKIE, SESSION_DIAS, crearToken, destinoSeguro } from '@/lib/auth-session';
import { buscarUsuarioPorEmail, contarUsuarios, crearUsuario, registrarLogin, type Usuario } from '@/lib/usuarios';

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
    return { id: 0, email, nombre: '', rol: 'admin', estado: 'activo', foto_url: null, invitado_por: 'allowlist-fallback', ultimo_login: null, created_at: '' };
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
    const tokens = (await tokenRes.json()) as { access_token?: string };
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
