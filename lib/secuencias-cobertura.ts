// =============================================================================
// Qué etapas del embudo CUBRE cada automatización, contando TODOS sus CRON
// =============================================================================
// Lo pregunta `huecosDeSecuencias` (lib/secuencias-huecos.ts), que contesta la operación
// `huecos_secuencias` de la API de MaKo («qué parte de mi funnel está sin nutrir»).
//
// ⚠️ CONTABA SÓLO EL PRIMER CRON (restos de versiones anteriores, 10/10/2026). Leía `etapa` y
// `trigger_tipo` de la fila —las columnas del PRIMER disparador— e ignoraba las otras etapas del mismo
// CRON (`etapas`, mig 0230) y los demás CRON de la automatización (`disparadores`, mig 0241). Una
// automatización que arranca en «No Show R1» por su segundo CRON contaba como un hueco. La lista de CRON
// sale de `disparadoresDe` (lib/disparadores.ts), la MISMA que lee el motor (`vistasPorDisparador`).
//
// Puro y sin `server-only`, a propósito: `lib/secuencias-huecos.ts` tiene `server-only` y ningún test lo
// puede importar. El test es tests/secuencias-cobertura.test.ts.

import { disparadoresDe, type FilaDisparadores } from './disparadores';
import { TRIGGER_ETAPA } from './nutricion-etapa';

/** La fila de `nutricion_secuencias` que hace falta: la de los CRON y si está archivada. */
export type FilaCobertura = FilaDisparadores & { archivada_at?: string | null };

/**
 * Las etapas cubiertas por alguna automatización NO archivada (una pausada cuenta: existe y está
 * escrita, sólo falta prenderla). Cuenta, de cada uno de sus CRON: las etapas de un CRON «Producto»
 * (`etapa` y `etapas`) y lo que cubre un disparador de antes (`legacy`, por trigger). Y la columna
 * `etapa` de la fila, como contaba antes: así ninguna etapa que antes salía cubierta pasa a ser un hueco.
 */
export function etapasCubiertas(
  filas: readonly FilaCobertura[],
  legacy: Readonly<Record<string, readonly string[]>>,
): Set<string> {
  const cubiertas = new Set<string>();
  for (const f of filas) {
    if (f.archivada_at) continue; // archivada = el dueño la sacó de en medio; su etapa vuelve a ser un hueco
    if (f.etapa) cubiertas.add(f.etapa);
    for (const d of disparadoresDe(f)) {
      if (d.trigger_tipo === TRIGGER_ETAPA) for (const k of [d.etapa, ...(d.etapas ?? [])]) if (k) cubiertas.add(k);
      for (const k of legacy[d.trigger_tipo] ?? []) cubiertas.add(k);
    }
  }
  return cubiertas;
}
