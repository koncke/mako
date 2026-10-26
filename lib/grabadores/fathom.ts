// =============================================================================
// grabadores/fathom — Fathom en la forma común (lib/grabadores/reunion.ts)
// =============================================================================
// El cliente HTTP sigue siendo lib/fathom-api.ts (sus reintentos y su `FathomSinRespuestaError` no cambian); acá sólo
// se traduce a `Reunion`. Lo único propio de Fathom que se conserva: la ventana va por `created_after`, porque
// `recorded_after` su API LO IGNORA (probado: devuelve las mismas reuniones con y sin el parámetro).
// =============================================================================

import 'server-only';
import { listMeetingsPage, fetchAllMeetings, fetchRecordingTranscript, fetchRecordingSummary } from '../fathom-api';
import { deFathom, type Reunion } from './reunion';
import type { Lector } from './lector';

export const lectorFathom: Lector = {
  grabador: 'fathom',

  async listar({ desde, limite, cursor, conAcciones }) {
    const page = await listMeetingsPage({ limit: limite ?? 15, cursor: cursor ?? undefined, createdAfter: desde, includeActionItems: conAcciones });
    return { reuniones: (page.items ?? []).map(deFathom).filter((r) => Number.isFinite(r.clave)), cursor: page.next_cursor ?? null };
  },

  async listarTodas({ maxPaginas } = {}) {
    const todas = await fetchAllMeetings({ includeSummary: false, maxPages: maxPaginas });
    return todas.map(deFathom).filter((r) => Number.isFinite(r.clave));
  },

  async leer(id, meta) {
    const rid = Number(id);
    // El transcript NO se traga (si falla tras los reintentos, propaga: el que llama marca la fila «error» o la reintenta);
    // el resumen sí es opcional. Es el contrato de `fetchMeetingContent`, que el Closing ya usaba.
    const [items, summary] = await Promise.all([
      fetchRecordingTranscript(rid),
      fetchRecordingSummary(rid).catch(() => null),
    ]);
    const base: Reunion = meta ?? deFathom({ recording_id: rid });
    const contenido = deFathom({ recording_id: rid, transcript: items, default_summary: summary });
    return { ...base, transcripcion: contenido.transcripcion ?? [], resumen: contenido.resumen ?? null };
  },

  async leerTranscripcion(id) {
    return deFathom({ recording_id: Number(id), transcript: await fetchRecordingTranscript(Number(id)) }).transcripcion ?? [];
  },
};
