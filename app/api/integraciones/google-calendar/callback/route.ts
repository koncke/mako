// =============================================================================
// Google Calendar — paso 2: callback → guarda el refresh_token del workspace
// =============================================================================
// El workspace destino sale de la COOKIE que escribió el paso 1, no de la
// sesión: en la vuelta de Google no hay `?ws=` ni pestaña que leer (el
// redirect_uri está registrado fijo), así que resolver el ws acá le guardaría
// la agenda al workspace de quien tiene la sesión — un admin de agencia
// conectando parado adentro de un cliente se la guardaba a sí mismo.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { destinoGcal, leerEstadoGcal, puedeEscribirAgenda } from '@/lib/gcal-estado';
import { emailDelCalendario, guardarRefreshTokenGoogle, googleRedirectUri } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // La cookie se limpia en TODOS los caminos, no solo en el feliz: ahora lleva
  // el workspace destino adentro, y dejarla colgada 10 minutos es dejar un
  // destino de escritura viejo en el navegador.
  //
  // Y vuelve a la pantalla DE LA QUE SALIÓ (cookie `gcal_volver`, 14/10/2026): conectar Google desde el Calendario
  // vuelve al Calendario, no a /integraciones. `destinoGcal` la vuelve a sanear (la cookie la escribió el paso 1, pero
  // es lo único de este flujo que el navegador podría haber tocado).
  const volver = req.cookies.get('gcal_volver')?.value ?? null;
  const salir = (motivo: string, ws?: number | null) => {
    const destino = destinoGcal(volver, motivo);
    const href = ws ? conWs(destino, ws) : destino;
    const res = NextResponse.redirect(new URL(href, url.origin));
    res.cookies.set({ name: 'gcal_state', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'gcal_volver', value: '', maxAge: 0, path: '/' });
    return res;
  };

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  // Cookie vacía, del formato viejo (sin `.ws`) o manoseada: sin destino no se
  // escribe. Lo viejo le pasa a quien arrancó el OAuth en los 10 min previos a un
  // deploy; reintentar desde el botón lo arregla.
  const estado = leerEstadoGcal(req.cookies.get('gcal_state')?.value);
  if (!code || !state || !estado || state !== estado.nonce) return salir(estado ? 'csrf' : 'reintentar');
  const wsDestino = estado.ws;

  // El permiso se re-chequea contra la SESIÓN, no se hereda de la cookie sola.
  const esSuperAdmin = (await getSesionAdmin()) != null;
  if (!puedeEscribirAgenda(esSuperAdmin, await adminDeWorkspaceActual(), wsDestino)) return salir('no-permitido');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return salir('config', wsDestino);

  const redirectUri = googleRedirectUri(url.origin);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
    if (!tokens.refresh_token) {
      // Sin refresh_token (ya había consentido antes sin revocar): pedir de nuevo con prompt=consent ya lo fuerza.
      return salir('sin-refresh', wsDestino);
    }
    // Acá pisar SÍ es lo esperado (alguien apretó "Conectar" a propósito), a
    // diferencia del login, donde guardar la agenda es un efecto de costado.
    // Registramos de quién es para poder mostrarlo y para que el login no la pise
    // — y ahora también porque el email es la ÚNICA señal de que la agenda que
    // quedó conectada es la del cliente y no la de quien lo estaba configurando.
    const email = tokens.access_token ? await emailDelCalendario(tokens.access_token) : null;
    await runWithWorkspace(wsDestino, () => guardarRefreshTokenGoogle(tokens.refresh_token!, email));
    return salir('ok', wsDestino);
  } catch (e) {
    console.error('[gcal] callback:', e);
    return salir('exchange', wsDestino);
  }
}
