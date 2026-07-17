// =============================================================================
// Google Calendar — paso 2: callback → guarda el refresh_token del dueño
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { esDuenoAdmin } from '@/lib/workspace';
import { emailDelCalendario, guardarRefreshTokenGoogle, googleRedirectUri } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const destino = new URL('/integraciones', url.origin);
  const fail = (motivo: string) => { destino.searchParams.set('gcal', motivo); return NextResponse.redirect(destino); };

  if (!(await esDuenoAdmin())) return fail('no-permitido');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = req.cookies.get('gcal_state')?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) return fail('csrf');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('config');

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
      return fail('sin-refresh');
    }
    // Acá pisar SÍ es lo esperado (el dueño apretó "Conectar" a propósito), a
    // diferencia del login, donde guardar la agenda es un efecto de costado.
    // Registramos de quién es para poder mostrarlo y para que el login no la pise.
    const email = tokens.access_token ? await emailDelCalendario(tokens.access_token) : null;
    await guardarRefreshTokenGoogle(tokens.refresh_token, email);
    const res = NextResponse.redirect((() => { destino.searchParams.set('gcal', 'ok'); return destino; })());
    res.cookies.set({ name: 'gcal_state', value: '', maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    console.error('[gcal] callback:', e);
    return fail('exchange');
  }
}
