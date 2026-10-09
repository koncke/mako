// =============================================================================
// lead-respuestas — lo PURO de cómo se escribe y se lee `lead_respuestas`
// =============================================================================
// Sin `server-only`, a propósito: `lib/leads.ts` (que escribe la tabla) lo tiene, así que ningún
// test podría importar estas decisiones si vivieran allá. Se equivocaron sin dar un solo error
// (09/10/2026), y por eso tienen red.
// =============================================================================

import type { RespuestaQA } from './leads';

/**
 * ¿Alguna de las filas YA guardadas para el mismo (lead, reunión, día) tiene EXACTAMENTE este set?
 *
 * La idempotencia de `saveLeadRespuestas` era por FECHA: con una fila del mismo día no guardaba
 * nada. `evento_inicio` es un `date`, así que pasar la R1 de las 10 a las 15 del mismo día (o
 * cancelar y volver a reservar) dejaba la ficha con el set VIEJO mientras el aviso mostraba el
 * nuevo, «Motivo del cambio» incluido. Lo que de verdad hay que no duplicar es el MISMO contenido:
 * el reintento de un webhook y el backfill de Calendly mandan el set idéntico.
 *
 * ⚠️ SE COMPARA CAMPO POR CAMPO, NUNCA CON `JSON.stringify` DE LOS DOS LADOS. Un `jsonb` NO
 * conserva el orden de las claves: guardado `{ q, a }`, Postgres lo devuelve `{ a, q }` (medido el
 * 09/10/2026 contra prod sobre un literal: `[{"a": "Respuesta", "q": "Pregunta"}]`). Comparado como
 * texto, ningún set guardado se parecería nunca al que llega, y CADA reintento del webhook
 * insertaría una fila más. El orden del ARRAY sí se conserva, así que ése se compara tal cual.
 */
export function yaGuardado(filas: ReadonlyArray<{ respuestas: unknown }>, respuestas: ReadonlyArray<RespuestaQA>): boolean {
  return filas.some((f) => {
    const guardadas = f.respuestas;
    if (!Array.isArray(guardadas) || guardadas.length !== respuestas.length) return false;
    return guardadas.every((g, i) => {
      const r = g as Partial<RespuestaQA> | null;
      return !!r && typeof r === 'object' && r.q === respuestas[i].q && r.a === respuestas[i].a;
    });
  });
}
