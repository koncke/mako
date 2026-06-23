// =============================================================================
// Login con Google — paso 1: redirige al consentimiento de Google
// =============================================================================
// OAuth 2.0 Authorization Code (a mano, sin next-auth). Guarda state (CSRF) y
// el destino (next) en cookies httpOnly antes de mandar al usuario a Google.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'GOOGLE_CLIENT_ID no configurado' }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/callback/google`;
  const state = crypto.randomBytes(16).toString('hex');
  const nextRaw = req.nextUrl.searchParams.get('next') || '/';
  const next = nextRaw.startsWith('/') ? nextRaw : '/';

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('state', state);
  auth.searchParams.set('access_type', 'online');
  auth.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(auth.toString());
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set({ name: 'oauth_state', value: state, ...cookieOpts });
  res.cookies.set({ name: 'oauth_next', value: next, ...cookieOpts });
  return res;
}
