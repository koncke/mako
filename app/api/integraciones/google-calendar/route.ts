// =============================================================================
// Google Calendar — paso 1: redirige al consentimiento (offline + lectura y eventos)
// =============================================================================
// Aparte del login: acá pedimos acceso al calendario con access_type=offline
// para recibir un refresh_token del dueño. Solo el workspace dueño puede conectar.
//
// El scope incluye escritura de eventos (ver GCAL_SCOPE): es lo que permite que
// "Reagendar" mueva la reunión de verdad. Quien ya había conectado con el scope
// viejo (solo lectura) tiene que pasar de nuevo por acá — su refresh_token
// conserva los permisos con los que se emitió.

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { esDuenoAdmin } from '@/lib/workspace';
import { GCAL_SCOPE, googleRedirectUri } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await esDuenoAdmin())) {
    return NextResponse.json({ ok: false, error: 'Solo el workspace principal puede conectar Google Calendar.' }, { status: 403 });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ ok: false, error: 'GOOGLE_CLIENT_ID no configurado' }, { status: 500 });

  const redirectUri = googleRedirectUri(new URL(req.url).origin);
  const state = crypto.randomBytes(16).toString('hex');

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', `openid email ${GCAL_SCOPE}`);
  auth.searchParams.set('state', state);
  auth.searchParams.set('access_type', 'offline');
  // Conserva lo ya otorgado en vez de pisarlo: quien vuelve a autorizar para
  // sumar la escritura no pierde permisos previos de esta misma app.
  auth.searchParams.set('include_granted_scopes', 'true');
  // consent (no select_account): sin esto Google NO reemite refresh_token para
  // quien ya había aceptado, y el token viejo —el de solo lectura— seguiría
  // vigente. O sea: sin esta línea, "Reconectar para mover reuniones" no haría nada.
  auth.searchParams.set('prompt', 'consent');

  const res = NextResponse.redirect(auth.toString());
  res.cookies.set({ name: 'gcal_state', value: state, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
