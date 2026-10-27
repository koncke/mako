// =============================================================================
// grabadores/otter — Otter.ai en la forma común (artículo «Otter.ai Public API», sólo plan Enterprise)
// =============================================================================
// `Authorization: Bearer <API key>` (Integrations → Developer → Create key; se ve UNA vez, hasta 2 por persona). Listado
// por cursor, de la más nueva a la más vieja y SIN filtro de fecha: la ventana se corta acá mirando `created_at`.
// La transcripción viene como TEXTO («Nombre  mm:ss» por bloque, `turnosDeTextoOtter`). Su aviso (webhook) no trae
// firma documentada: no se usa; las reuniones entran en la vuelta de cada hora.
// ⚠️ La forma de la LISTA no se pudo medir sin una cuenta Enterprise: si no es la que se espera, TIRA diciendo qué vino
// (nunca «no hay reuniones» sobre una forma que no se entendió).
// =============================================================================

import 'server-only';
import { credDelCliente } from '../credenciales';
import { pedirAlGrabador } from './http';
import { deOtter } from './formas';
import { GrabadorSinConectarError } from './errores';
import type { Lector } from './lector';
import type { Reunion } from './reunion';

const BASE = 'https://api.otter.ai/v1';

async function get<T>(ruta: string): Promise<T> {
  const k = await credDelCliente('OTTER_API_KEY');
  if (!k) throw new GrabadorSinConectarError('otter', 'OTTER_API_KEY no configurada');
  return pedirAlGrabador<T>({ grabador: 'otter', url: `${BASE}${ruta}`, init: { headers: { Authorization: `Bearer ${k}`, accept: 'application/json' } } });
}

/** Las conversaciones y el cursor siguiente de una página. Tira si la forma no es ninguna de las conocidas. */
export function paginaDeOtter(r: unknown): { items: Array<Record<string, unknown>>; cursor: string | null } {
  const o = (r ?? {}) as Record<string, unknown>;
  const items = Array.isArray(o.data) ? o.data : Array.isArray(o.conversations) ? o.conversations : null;
  if (!items) throw new Error(`Otter devolvió una lista que MaKo no conoce (${Object.keys(o).join(', ') || 'vacía'})`);
  const meta = (o.meta ?? {}) as Record<string, unknown>;
  const cursor = [meta.next_cursor, o.next_cursor, meta.cursor].find((c) => typeof c === 'string' && c) as string | undefined;
  return { items: items.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object'), cursor: cursor ?? null };
}

export const lectorOtter: Lector = {
  grabador: 'otter',

  async listar({ desde, limite, cursor }) {
    const q = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limite ?? 15))) });
    if (cursor) q.set('cursor', cursor);
    const p = paginaDeOtter(await get<unknown>(`/conversations?${q}`));
    const todas = p.items.map(deOtter).filter((x) => x.id);
    // Vienen de la más nueva a la más vieja: la primera más vieja que la ventana corta la lista y el cursor.
    const dentro = desde ? todas.filter((x) => (x.aparecio ?? '') >= desde) : todas;
    return { reuniones: dentro, cursor: dentro.length < todas.length ? null : p.cursor };
  },

  async listarTodas({ maxPaginas } = {}) {
    const out: Reunion[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < (maxPaginas ?? 40); i++) {
      const p = await this.listar({ limite: 100, cursor });
      out.push(...p.reuniones);
      cursor = p.cursor;
      if (!cursor) break;
    }
    return out;
  },

  async leer(id, meta) {
    const r = await get<Record<string, unknown>>(`/conversations/${encodeURIComponent(id)}?include=transcript`);
    const conv = (r && typeof r.data === 'object' && r.data ? r.data : r) as Record<string, unknown>;
    const x = deOtter(conv);
    return { ...(meta ?? x), transcripcion: x.transcripcion ?? [], resumen: x.resumen ?? null };
  },

  async leerTranscripcion(id) {
    return (await this.leer(id)).transcripcion ?? [];
  },
};
