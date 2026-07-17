// =============================================================================
// Login con Google — paso 1: redirige al consentimiento de Google
// =============================================================================
// OAuth 2.0 Authorization Code (a mano, sin next-auth). Guarda state (CSRF) y
// el destino (next) en cookies httpOnly antes de mandar al usuario a Google.
//
// EL LOGIN PIDE SOLO SCOPES DE IDENTIDAD, Y ES A PROPÓSITO. openid/email/profile
// son "no sensibles": Google los deja usar sin verificar la app. Apenas se le suma
// uno SENSIBLE (calendar.readonly lo es), Google exige verificación y hasta que la
// tengas la app queda restringida a los testers de la lista → todo el resto recibe
// "Access blocked: … has not completed the Google verification process" (403
// access_denied) y NO PUEDE ENTRAR. O sea: un scope sensible acá cierra la puerta
// de calle. La agenda se conecta aparte, desde /api/integraciones/google-calendar,
// donde es opt-in y su bloqueo solo afecta a esa integración, no al login.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { destinoSeguro } from '@/lib/auth-session';

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
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('state', state);
  // SIN access_type=offline: acá no hay nada que refrescar (identidad se usa una
  // vez y listo) y pedirlo devolvería un refresh_token SIN permiso de agenda que
  // el callback guardaría como si fuera el de Calendar — la integración quedaría
  // "conectada" y reventaría al primer uso. El offline vive donde corresponde, en
  // /api/integraciones/google-calendar, que sí pide el scope.
  // Auth incremental: conserva los permisos ya otorgados en vez de pisarlos.
  auth.searchParams.set('include_granted_scopes', 'true');
  // select_account (no consent): deja elegir cuenta sin forzar la pantalla de
  // permisos en CADA login. Con scopes de identidad Google ni la muestra.
  auth.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(auth.toString());
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };
  res.cookies.set({ name: 'oauth_state', value: state, ...cookieOpts });
  res.cookies.set({ name: 'oauth_next', value: next, ...cookieOpts });
  return res;
}
