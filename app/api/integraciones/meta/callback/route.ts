// =============================================================================
// «Conectar con Meta» — paso 2: callback → canjea el code y guarda la conexión
// =============================================================================
// El workspace destino sale de la COOKIE que escribió el paso 1, no de la sesión:
// en la vuelta de Meta no hay `?ws=` ni pestaña que leer, y resolverlo acá le
// guardaría la conexión al workspace de quien tiene la sesión (el mismo bug que
// ya pasó con Google Calendar; ver app/api/integraciones/google-calendar/callback).
//
// Lo que se guarda —el token y todo lo que sale de él, incluida la regla de los
// dos tokens— es lo mismo que guarda pegar un token: vive en lib/meta-conexion.
//
// El resultado vuelve en la cookie `meta_resultado` (un uso, 2 minutos) y lo lee
// el formulario de Meta donde sea que esté montado.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { leerEstadoGcal, puedeEscribirAgenda } from '@/lib/gcal-estado';
import { guardarConexionMeta } from '@/lib/meta-conexion';
import { destinoDeVuelta, ENV_SECRETO_APP, META_APP_ID, metaRedirectUri, volverSeguro, type ResultadoConexionMeta } from '@/lib/meta-login';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const volver = volverSeguro(req.cookies.get('meta_volver')?.value);

  // Las cookies del intento se limpian en TODOS los caminos: llevan el workspace
  // destino adentro, y dejarlas colgadas es dejar un destino de escritura viejo.
  const salir = (motivo: ResultadoConexionMeta, ws?: number | null) => {
    const destino = destinoDeVuelta(volver);
    const res = NextResponse.redirect(new URL(ws ? conWs(destino, ws) : destino, url.origin));
    res.cookies.set({ name: 'meta_state', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'meta_volver', value: '', maxAge: 0, path: '/' });
    res.cookies.set({ name: 'meta_resultado', value: motivo, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 120 });
    return res;
  };

  const estado = leerEstadoGcal(req.cookies.get('meta_state')?.value);
  const state = url.searchParams.get('state');
  if (!estado || !state || state !== estado.nonce) return salir('vencido');
  const ws = estado.ws;

  // Cerrar el diálogo o apretar «Cancelar» vuelve con `error=access_denied` y sin
  // code. No es una falla: es una decisión de la persona, y se dice así.
  if (url.searchParams.get('error')) return salir('cancelado', ws);
  const code = url.searchParams.get('code');
  if (!code) return salir('meta-fallo', ws);

  // El permiso se re-chequea contra la SESIÓN, no se hereda de la cookie sola.
  const esSuperAdmin = (await getSesionAdmin()) != null;
  if (!puedeEscribirAgenda(esSuperAdmin, await adminDeWorkspaceActual(), ws)) return salir('no-permitido');

  const secreto = process.env[ENV_SECRETO_APP]?.trim();
  if (!secreto) return salir('no-disponible', ws);

  const version = process.env.META_API_VERSION || 'v24.0';
  try {
    const canje = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    canje.searchParams.set('client_id', META_APP_ID);
    canje.searchParams.set('client_secret', secreto);
    // El MISMO redirect_uri del paso 1: Meta lo compara al canjear.
    canje.searchParams.set('redirect_uri', metaRedirectUri(url.origin));
    canje.searchParams.set('code', code);
    const r = await fetch(canje.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    // Meta manda el fallo ADENTRO del cuerpo (a veces con 200): se mira el campo.
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (!j.access_token) {
      console.error('[meta-oauth] canje sin token:', j.error?.message ?? r.status);
      return salir('meta-fallo', ws);
    }

    const usuario = await getUsuarioActual();
    const autor = usuario ? (usuario.legacy ? usuario.sub : (usuario.email || usuario.sub)) : null;
    const g = await guardarConexionMeta(ws, j.access_token, autor, { guardarToken: true });
    if ('error' in g) {
      console.error('[meta-oauth] el token canjeado no sirvió para leer la cuenta:', g.error);
      return salir('meta-fallo', ws);
    }
    return salir('ok', ws);
  } catch (e) {
    console.error('[meta-oauth] callback:', e instanceof Error ? e.message : String(e));
    return salir('meta-fallo', ws);
  }
}
