// =============================================================================
// grabadores/tldv — tl;dv en la forma común (https://doc.tldv.io, API v1alpha1: «alpha», puede cambiar)
// =============================================================================
// Clave en el header `x-api-key` (Settings → Personal Settings → API Keys). Sólo ve las reuniones de organizadores con
// plan Pro o Business. Listado por PÁGINA (desde 1, hasta 100 por página) con filtro `from` por la fecha de la reunión.
// La transcripción «sólo se devuelve si está completa»: una reunión de hace un rato sin transcripción todavía es
// «no contestó» (se reintenta), no «no hay» — si no, el aviso de MeetingReady la cerraba vacía para siempre.
// =============================================================================

import 'server-only';
import { credDelCliente } from '../credenciales';
import { pedirAlGrabador } from './http';
import { deTldv, turnosDeTldv } from './formas';
import { GrabadorSinConectarError, GrabadorSinRespuestaError } from './errores';
import type { Lector } from './lector';
import type { Reunion, TurnoReunion } from './reunion';

const BASE = 'https://pasta.tldv.io/v1alpha1';
/** Una transcripción que falta en una reunión más nueva que esto se espera (no está lista); más vieja, no hay. */
const ESPERA_TRANSCRIPCION_MS = 24 * 3600_000;

async function clave(): Promise<string> {
  const k = await credDelCliente('TLDV_API_KEY');
  if (!k) throw new GrabadorSinConectarError('tldv', 'TLDV_API_KEY no configurada');
  return k;
}

async function get<T>(ruta: string): Promise<T> {
  return pedirAlGrabador<T>({ grabador: 'tldv', url: `${BASE}${ruta}`, init: { headers: { 'x-api-key': await clave(), accept: 'application/json' } } });
}

type Pagina = { page?: number; pages?: number; results?: Array<Record<string, unknown>> };

async function transcripcion(id: string, inicio: string | null): Promise<TurnoReunion[]> {
  try {
    return turnosDeTldv(await get<unknown>(`/meetings/${encodeURIComponent(id)}/transcript`));
  } catch (e) {
    const reciente = !inicio || Date.now() - Date.parse(inicio) < ESPERA_TRANSCRIPCION_MS;
    if (e instanceof Error && /\btl;dv 404\b/.test(e.message)) {
      if (reciente) throw new GrabadorSinRespuestaError('tldv', `tl;dv todavía no tiene lista la transcripción de ${id}`);
      return [];
    }
    throw e;
  }
}

export const lectorTldv: Lector = {
  grabador: 'tldv',

  async listar({ desde, limite, cursor }) {
    const pagina = Math.max(1, Number(cursor) || 1);
    const q = new URLSearchParams({ page: String(pagina), limit: String(Math.min(100, Math.max(1, limite ?? 15))) });
    if (desde) q.set('from', desde);
    const r = await get<Pagina>(`/meetings?${q}`);
    if (!Array.isArray(r?.results)) throw new Error(`tl;dv devolvió una lista que MaKo no conoce (${Object.keys(r ?? {}).join(', ')})`);
    return { reuniones: r.results.map(deTldv).filter((x) => x.id), cursor: (r.pages ?? 0) > pagina ? String(pagina + 1) : null };
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
    const base = meta ?? deTldv(await get<Record<string, unknown>>(`/meetings/${encodeURIComponent(id)}`));
    const [turnos, notas] = await Promise.all([
      transcripcion(id, base.inicio),
      get<{ markdownContent?: string }>(`/meetings/${encodeURIComponent(id)}/notes`).catch(() => null),
    ]);
    return { ...base, transcripcion: turnos, resumen: notas?.markdownContent?.trim() || null };
  },

  async leerTranscripcion(id) {
    return transcripcion(id, null);
  },

  async meta(id) {
    return deTldv(await get<Record<string, unknown>>(`/meetings/${encodeURIComponent(id)}`));
  },
};
