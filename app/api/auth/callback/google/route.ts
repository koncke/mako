// =============================================================================
// Login con Google — paso 2: callback
// =============================================================================
// Verifica state (CSRF), intercambia el code por tokens, lee el email del
// usuario, lo valida contra AUTH_ALLOWED_EMAILS (si está seteado) y, si pasa,
// setea la misma cookie de sesión que el gate de contraseña (mako_auth).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function emailPermitido(email: string): boolean {
  const raw = process.env.AUTH_ALLOWED_EMAILS;
  if (!raw) return true; // sin allowlist → se confía en los test users de Google
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
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
  const cookieVal = process.env.AUTH_COOKIE_VALUE;
  if (!clientId || !clientSecret || !cookieVal) return fail('config');

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
    const ui = (await uiRes.json()) as { email?: string; email_verified?: boolean };
    const email = typeof ui.email === 'string' ? ui.email : '';
    if (!email || ui.email_verified === false || !emailPermitido(email)) return fail('no-autorizado');

    const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', url.origin));
    const base = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
    res.cookies.set({ name: 'mako_auth', value: cookieVal, httpOnly: true, maxAge: 60 * 60 * 24 * 30, ...base });
    res.cookies.set({ name: 'mako_email', value: email, httpOnly: false, maxAge: 60 * 60 * 24 * 30, ...base });
    res.cookies.set({ name: 'oauth_state', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'oauth_next', value: '', maxAge: 0, path: '/' });
    return res;
  } catch {
    return fail('exchange');
  }
}
