// =============================================================================
// grabadores/fireflies — Fireflies.ai en la forma común (https://docs.fireflies.ai, GraphQL)
// =============================================================================
// Un solo endpoint (POST api.fireflies.ai/graphql) con `Authorization: Bearer <api key>` (Integrations → Fireflies API).
// Anda en todos los planes (el Free con 500 pedidos por día). Listado por OFFSET (`limit` hasta 50, `skip`).
// ⚠️ UNA CLAVE MALA CONTESTA 500, NO 401 (medido el 26/10/2026: `errors[].code = "auth_failed"`). Leída como un 5xx, se
// reintentaría para siempre; `esAuth` la convierte en «la clave no sirve». Y un error de GraphQL viene ADENTRO de un 200
// (`errors`): `res.ok` no es «salió bien» (AGENTS.md).
// =============================================================================

import 'server-only';
import { credDelCliente } from '../credenciales';
import { pedirAlGrabador } from './http';
import { CAMPOS_FIREFLIES, deFireflies } from './formas';
import { GrabadorSinConectarError } from './errores';
import type { Lector } from './lector';
import type { Reunion } from './reunion';

const URL_API = 'https://api.fireflies.ai/graphql';

/** ¿La respuesta dice «la clave no sirve»? (500 con auth_failed, o un 401/403 de verdad). */
export function esAuthFireflies(status: number, cuerpo: unknown): boolean {
  if (status === 401 || status === 403) return true;
  const errores = (cuerpo as { errors?: Array<{ code?: string; extensions?: { code?: string } }> } | null)?.errors ?? [];
  return errores.some((e) => e?.code === 'auth_failed' || e?.extensions?.code === 'auth_failed');
}

async function consulta<T>(query: string, variables: Record<string, unknown>, apiKey?: string): Promise<T> {
  const key = apiKey ?? await credDelCliente('FIREFLIES_API_KEY');
  if (!key) throw new GrabadorSinConectarError('fireflies', 'FIREFLIES_API_KEY no configurada');
  const r = await pedirAlGrabador<{ data?: T; errors?: Array<{ message?: string }> }>({
    grabador: 'fireflies', url: URL_API, esAuth: esAuthFireflies,
    init: { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables }) },
  });
  if (r?.errors?.length) throw new Error(`Fireflies 400 en /graphql: ${r.errors.map((e) => e.message).join(' · ').slice(0, 200)}`);
  if (!r?.data) throw new Error('Fireflies devolvió una respuesta sin datos');
  return r.data;
}

const LISTAR = `query Reuniones($limit: Int, $skip: Int, $fromDate: DateTime) { transcripts(limit: $limit, skip: $skip, fromDate: $fromDate) { ${CAMPOS_FIREFLIES} } }`;
const LEER = `query Reunion($id: String!) { transcript(id: $id) { ${CAMPOS_FIREFLIES} sentences { text raw_text speaker_name start_time } summary { overview short_summary action_items } } }`;
const SOLO_FICHA = `query Ficha($id: String!) { transcript(id: $id) { ${CAMPOS_FIREFLIES} } }`;
const SOLO_TEXTO = `query Texto($id: String!) { transcript(id: $id) { id sentences { text raw_text speaker_name start_time } } }`;

export const lectorFireflies: Lector = {
  grabador: 'fireflies',

  async listar({ desde, limite, cursor }) {
    const limit = Math.min(50, Math.max(1, limite ?? 15));
    const skip = Math.max(0, Number(cursor) || 0);
    const d = await consulta<{ transcripts?: Array<Record<string, unknown>> | null }>(LISTAR, { limit, skip, ...(desde ? { fromDate: desde } : {}) });
    if (!Array.isArray(d.transcripts)) throw new Error('Fireflies devolvió una lista que MaKo no conoce');
    return { reuniones: d.transcripts.map(deFireflies).filter((x) => x.id), cursor: d.transcripts.length === limit ? String(skip + limit) : null };
  },

  async listarTodas({ maxPaginas } = {}) {
    const out: Reunion[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < (maxPaginas ?? 40); i++) {
      const p = await this.listar({ limite: 50, cursor });
      out.push(...p.reuniones);
      cursor = p.cursor;
      if (!cursor) break;
    }
    return out;
  },

  async leer(id, meta) {
    const d = await consulta<{ transcript?: Record<string, unknown> | null }>(LEER, { id });
    if (!d.transcript) throw new Error(`Fireflies 404 en /graphql: no hay una reunión ${id} para esta clave`);
    const r = deFireflies(d.transcript);
    return { ...(meta ?? r), transcripcion: r.transcripcion ?? [], resumen: r.resumen ?? null, ...(r.acciones ? { acciones: r.acciones } : {}) };
  },

  async leerTranscripcion(id) {
    const d = await consulta<{ transcript?: Record<string, unknown> | null }>(SOLO_TEXTO, { id });
    if (!d.transcript) throw new Error(`Fireflies 404 en /graphql: no hay una reunión ${id} para esta clave`);
    return deFireflies(d.transcript).transcripcion ?? [];
  },

  async meta(id) {
    const d = await consulta<{ transcript?: Record<string, unknown> | null }>(SOLO_FICHA, { id });
    if (!d.transcript) throw new Error(`Fireflies 404 en /graphql: no hay una reunión ${id} para esta clave`);
    return deFireflies(d.transcript);
  },
};
