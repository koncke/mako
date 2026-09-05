// =============================================================================
// Google Calendar — paso 1: redirige al consentimiento (offline + lectura y eventos)
// =============================================================================
// Aparte del login: acá pedimos acceso al calendario con access_type=offline
// para recibir un refresh_token. CADA WORKSPACE conecta SU propia agenda — esto
// nació owner-only ("solo el workspace principal") y le devolvía un 403 a todo
// cliente que apretaba el botón. La app OAuth (GOOGLE_CLIENT_ID/SECRET) sí es
// una sola, de la agencia, y se comparte por diseño: lo único que se produce
// per-cliente es el consentimiento de esa persona sobre su propia cuenta.
//
// El scope incluye escritura de eventos (ver GCAL_SCOPE): es lo que permite que
// "Reagendar" mueva la reunión de verdad. Quien ya había conectado con el scope
// viejo (solo lectura) tiene que pasar de nuevo por acá — su refresh_token
// conserva los permisos con los que se emitió.

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { armarEstadoGcal } from '@/lib/gcal-estado';
import { GCAL_SCOPE, googleRedirectUri } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Un fallo acá vuelve A LA PANTALLA, no a un JSON pelado: esto no es una API
  // que alguien llame, es el href de un botón adentro de un modal. El 403 crudo
  // que veía el cliente ("Solo el workspace principal…") era una pared sin
  // vuelta atrás; GCAL_MSG ya sabe traducir estos motivos en /integraciones.
  const fail = (motivo: string, ws?: number) => {
    const d = new URL('/integraciones', url.origin);
    d.searchParams.set('gcal', motivo);
    return NextResponse.redirect(ws ? new URL(conWs(`${d.pathname}${d.search}`, ws), url.origin) : d);
  };

  const ws = await adminDeWorkspaceActual();
  if (ws == null) return fail('no-permitido');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return fail('config', ws);

  const redirectUri = googleRedirectUri(url.origin);
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
  // EL WORKSPACE VIAJA EN LA COOKIE, no en el redirect_uri ni en el state.
  //   · el redirect_uri está registrado FIJO en Google Cloud: cualquier
  //     parámetro extra da redirect_uri_mismatch;
  //   · y en la vuelta NO hay `?ws=` ni pestaña que leer, así que el callback
  //     resolvería el workspace de quien tiene la sesión. Un admin de agencia
  //     conectando parado adentro de un cliente terminaría guardando la agenda
  //     en SU workspace, sin error: tile verde en el lugar equivocado.
  // La cookie es httpOnly y la escribe este paso, que ya autorizó el ws.
  res.cookies.set({ name: 'gcal_state', value: armarEstadoGcal(state, ws), httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
