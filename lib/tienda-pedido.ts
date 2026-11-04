// =============================================================================
// tienda-pedido — ¿este pedido viene de la app de iPhone? (la pregunta del lado del servidor)
// =============================================================================
// La regla vive en lib/tienda.ts, pura y con test. Esto sólo le pasa el user agent del pedido en curso.

import 'server-only';
import { headers } from 'next/headers';
import { esAppIos } from './tienda';

/** Fuera de un pedido (un cron, un script) `headers()` tira: ahí no hay ninguna app, así que es «no». */
export async function esAppIosDelPedido(): Promise<boolean> {
  try {
    return esAppIos((await headers()).get('user-agent'));
  } catch {
    return false;
  }
}
