// =============================================================================
// «Conectar con Meta» — paso 1: redirige al diálogo de Facebook Login for Business
// =============================================================================
// Reemplaza pegar un token a mano: el cliente aprieta un botón, elige en Meta qué
// páginas y cuentas publicitarias le da a MaKo, y vuelve con un token de USUARIO
// DEL SISTEMA de la app MaKo que no vence (la configuración vive en lib/meta-login).
//
// Mismo molde que Google Calendar (app/api/integraciones/google-calendar), y por
// las mismas razones, que están escritas ahí:
//   · el workspace destino viaja en una COOKIE httpOnly, no en el redirect_uri
//     (registrado fijo, en modo estricto) ni en el state;
//   · el permiso se resuelve acá y se RE-chequea en el callback contra la sesión;
//   · un fallo vuelve a la pantalla con su motivo, nunca a un JSON pelado: esto es
//     el href de un botón, no una API.

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { conWs } from '@/lib/ws-tab';
import { armarEstadoGcal } from '@/lib/gcal-estado';
import { conectarMetaDisponible } from '@/lib/meta-conexion';
import { destinoDeVuelta, metaRedirectUri, urlDialogoMeta, volverSeguro, type ResultadoConexionMeta } from '@/lib/meta-login';

export const dynamic = 'force-dynamic';

const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const volver = volverSeguro(url.searchParams.get('volver'));

  const fail = (motivo: ResultadoConexionMeta, ws?: number | null) => {
    const destino = destinoDeVuelta(volver);
    const res = NextResponse.redirect(new URL(ws ? conWs(destino, ws) : destino, url.origin));
    res.cookies.set({ ...COOKIE, name: 'meta_resultado', value: motivo, maxAge: 120 });
    return res;
  };

  const ws = await adminDeWorkspaceActual();
  if (ws == null) return fail('no-permitido');
  if (!(await conectarMetaDisponible())) return fail('no-disponible', ws);

  const version = process.env.META_API_VERSION || 'v24.0';
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(urlDialogoMeta({ version, redirectUri: metaRedirectUri(url.origin), state }));
  // El mismo formato de cookie que Google Calendar (nonce + ws): `leerEstadoGcal`
  // ya rechaza el formato viejo y el workspace manoseado, y no hace falta otra copia.
  res.cookies.set({ ...COOKIE, name: 'meta_state', value: armarEstadoGcal(state, ws) });
  res.cookies.set({ ...COOKIE, name: 'meta_volver', value: volver });
  return res;
}
