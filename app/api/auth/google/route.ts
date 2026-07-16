// =============================================================================
// Login con Google — paso 1: redirige al consentimiento de Google
// =============================================================================
// OAuth 2.0 Authorization Code (a mano, sin next-auth). Guarda state (CSRF) y
// el destino (next) en cookies httpOnly antes de mandar al usuario a Google.
//
// El login pide TAMBIÉN el scope de Google Calendar: entrar con Google conecta
// la agenda de una (el callback guarda el refresh_token en el workspace del
// usuario). Es el MISMO scope que el OAuth aparte de /api/integraciones/
// google-calendar — ese sigue existiendo para re-consentir sin desloguearse.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { destinoSeguro } from '@/lib/auth-session';
import { GCAL_SCOPE } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ ok: false, error: 'GOOGLE_CLIENT_ID no configurado' }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/callback/google`;
  const state = crypto.randomBytes(16).toString('hex');
  const next = destinoSeguro(req.nextUrl.searchParams.get('next'));

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', `openid email profile ${GCAL_SCOPE}`);
  auth.searchParams.set('state', state);
  // offline → Google devuelve refresh_token (el que guarda el callback) en la
  // PRIMERA autorización de este set de scopes. Sin esto solo llega access_token.
  auth.searchParams.set('access_type', 'offline');
  // Auth incremental: conserva los permisos ya otorgados en vez de pisarlos.
  auth.searchParams.set('include_granted_scopes', 'true');
  // select_account (no consent): deja elegir cuenta sin forzar la pantalla de
  // permisos en CADA login. Google la muestra solo cuando cambia el set de
  // scopes — justo cuando necesitamos que devuelva el refresh_token.
  auth.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(auth.toString());
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set({ name: 'oauth_state', value: state, ...cookieOpts });
  res.cookies.set({ name: 'oauth_next', value: next, ...cookieOpts });
  return res;
}
