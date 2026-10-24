// =============================================================================
// ruteo-hash — el identificador de ruteo de un webhook que sólo trae un SECRETO
// =============================================================================
// `webhook_routing` (lib/webhook-routing.ts) mapea un identificador EN CLARO → workspace, y la
// regla es que un secreto jamás se espeja ahí en claro. Hotmart y Skool (por Zapier) no traen
// ningún identificador público de la cuenta: lo único que llega con cada aviso es un SECRETO
// (el `hottok` de Hotmart en `X-HOTMART-HOTTOK`; la clave que el negocio inventa para Skool).
//
// Así que la fila guarda el HASH del secreto, no el secreto. Es el mismo camino de los tokens
// de la API de MaKo (lib/api-mako/tokens.ts: `upsertRouting(SERVICIO_API, hash, ws)`):
//   1. al guardar la credencial, `identificadorDeRuteo` devuelve sha256(valor) → la fila;
//   2. el webhook calcula sha256 del header → `wsPorIdentificadorEstricto` → el workspace;
//   3. y COMPARA el header contra la credencial de ESE workspace (`igualesSeguro`), que es lo
//      que prueba que el aviso es de quien dice.
//
// SIN `server-only`, a propósito: lo importan los tests.

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Las credenciales cuyo valor es un SECRETO y además decide de quién es el aviso. Para éstas la
 * fila de ruteo guarda el hash. Las demás de `ROUTING_CREDS` son identificadores públicos (un id
 * de página, un tipo de evento) y van tal cual.
 */
export const RUTEO_POR_HASH: ReadonlySet<string> = new Set(['HOTMART_HOTTOK', 'SKOOL_WEBHOOK_CLAVE']);

/** sha256 en hex del valor SIN espacios a los lados (como lo guarda y lo manda cada lado). */
export function hashDeRuteo(valor: string): string {
  return createHash('sha256').update(valor.trim(), 'utf8').digest('hex');
}

/** Lo que va a `webhook_routing` para esta credencial: el hash si es un secreto, el valor si no. */
export function identificadorDeRuteo(clave: string, valor: string): string {
  return RUTEO_POR_HASH.has(clave) ? hashDeRuteo(valor) : valor;
}

/**
 * ¿Son el mismo secreto? En tiempo constante y sin revelar el largo: se comparan los hashes, que
 * miden siempre lo mismo. Un null o un vacío de cualquier lado es «no».
 */
export function igualesSeguro(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = typeof a === 'string' ? a.trim() : '';
  const y = typeof b === 'string' ? b.trim() : '';
  if (!x || !y) return false;
  return timingSafeEqual(Buffer.from(hashDeRuteo(x), 'hex'), Buffer.from(hashDeRuteo(y), 'hex'));
}

/**
 * El secreto que llega en un header, saneado: sin espacios y con tope de largo. Un header gigante
 * no se hashea (sería una consulta a la base por cada pedido basura): vuelve null.
 */
export function secretoDelHeader(v: string | null | undefined, tope = 200): string | null {
  const t = typeof v === 'string' ? v.trim() : '';
  return t && t.length <= tope ? t : null;
}
