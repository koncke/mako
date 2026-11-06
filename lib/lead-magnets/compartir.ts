// =============================================================================
// lead-magnets/compartir — qué página deja LEER un link de un lead magnet (PURO)
// =============================================================================
// El link público de un lead magnet (recurso `lead-magnet` de `shares`, lib/share-nombre.ts) lo abre cualquiera, sin cuenta:
// es lo que recibe el lead. En POSITIVO (AGENTS.md, «Un guard sobre algo destructivo se escribe en POSITIVO»): es de ese
// recurso, de un workspace válido, apunta a UNA página del Copywriter y es de LECTURA. El id sale de la FILA, nunca del pedido.
// Un link de este recurso nunca edita: aunque una fila dijera `permiso: 'editar'`, no se sirve (eso es el recurso `copywriter`).
// =============================================================================

import { RECURSO_LEAD_MAGNET } from '../share-nombre';
import { esIdPagina } from '../copywriter/tipos';

/** Lo mínimo de una fila de `shares` que mira la puerta. */
export type ShareLM = { recurso: string; workspace_id: number | string; alcance: string; recurso_id: string | null; permiso?: string | null };

/** La página (y su workspace) que este link deja leer, o null = 404. */
export function paginaDelShareLM(share: ShareLM): { ws: number; id: string } | null {
  if (share.recurso !== RECURSO_LEAD_MAGNET) return null;
  const ws = Number(share.workspace_id);
  if (!Number.isInteger(ws) || ws <= 0) return null;
  if (share.alcance !== 'item') return null;
  if ((share.permiso ?? 'ver') !== 'ver') return null;
  const id = share.recurso_id;
  return esIdPagina(id) ? { ws, id } : null;
}
