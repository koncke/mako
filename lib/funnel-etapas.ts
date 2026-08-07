// =============================================================================
// funnel-etapas — qué etapa del funnel del workspace le toca a un lead
// =============================================================================
// Puro y compartido (sin 'server-only'): lo puede importar el server y el
// cliente, igual que lib/pipeline.ts.
//
// Existe porque el funnel es CONFIGURABLE por workspace y el código seguía
// hablando de las keys canónicas del funnel por defecto ('agenda', 'agendaj2').
// Un workspace cuyo pipeline tiene 'discovery' y 'cierre-call' marcadas como
// reuniones nunca entraba por esas ramas: la feature no fallaba, simplemente no
// existía para él, y en silencio.
//
// Las dos preguntas que responde:
//   · ¿en qué etapa está EFECTIVAMENTE este lead?      → etapaVigenteDe()
//   · ¿esa etapa es una reunión, y cuál (R1/R2)?        → slotDeReunion()
//
// Es la fuente ÚNICA del mapeo índice→R1/R2 (ver "una cosa, un lugar" en
// AGENTS.md): antes estaba copiado en `asist()` de generateFunnel
// (lib/pipeline.ts) y en el filtro `kind === 'reunion'` de funnelReqInfo
// (lib/stage-requirements.ts). Los dos consumen ahora `reunionesDe()` +
// `slotPorIndice()`.
//
// ⚠️ CICLO DE IMPORTS a propósito: pipeline.ts importa este módulo y este módulo
// importa pipeline.ts (necesita DEFAULT_PIPELINE y deriveStageKey). Es inocuo
// PORQUE ninguno de los dos usa lo del otro mientras se evalúa el módulo: solo
// dentro del cuerpo de las funciones. Si algún día alguien pone acá un
// `const X = DEFAULT_PIPELINE...` a nivel de módulo (o pipeline.ts llama a una
// función de acá al cargar), se rompe según quién se importe primero — y falla
// distinto en el server, en el cliente y en los tests. Los dos órdenes de carga
// están cubiertos: tests/pipeline.test.ts importa pipeline primero;
// tests/funnel-etapas.test.ts y tests/reunion-slot-fuente-unica.test.ts importan
// este módulo primero (node --test corre cada archivo en su propio proceso).

import { DEFAULT_PIPELINE, deriveStageKey, type StageDerivable } from './pipeline';

/**
 * Lo mínimo que hace falta para decidir si una etapa es reunión y en qué orden.
 * No ata a `Stage` completo a propósito: así lo puede llamar también
 * stage-requirements, que trabaja con su propia vista liviana del pipeline.
 */
export type EtapaLite = { key: string; kind?: string };

/**
 * A qué par de columnas de `leads` corresponde una etapa de reunión.
 *
 * La tabla tiene SOLO DOS slots de reunión (fecha_junta_1/junta_1_at y
 * fecha_junta_2/junta_2_at). Un funnel con una tercera reunión no tiene dónde
 * guardar su fecha, así que a partir del índice 2 no hay slot. De acá sale
 * también el {} que generateFunnel pone en las transiciones de esa 3ª reunión:
 * no hay columna donde marcar su asistencia.
 */
export type SlotReunion = {
  /** Posición de la etapa entre las reuniones del pipeline (0 = la primera). */
  indice: 0 | 1;
  /** Número visible en el copy ("La Reunión 2 del …"). */
  numero: 1 | 2;
  /** Cuál es, en el vocabulario que viaja al board. */
  cual: 'r1' | 'r2';
  /** Columna con la fecha (YYYY-MM-DD). */
  colFecha: 'fecha_junta_1' | 'fecha_junta_2';
  /** Columna con el timestamp real de Calendly (ISO con hora). */
  colAt: 'junta_1_at' | 'junta_2_at';
};

const SLOTS: readonly SlotReunion[] = [
  { indice: 0, numero: 1, cual: 'r1', colFecha: 'fecha_junta_1', colAt: 'junta_1_at' },
  { indice: 1, numero: 2, cual: 'r2', colFecha: 'fecha_junta_2', colAt: 'junta_2_at' },
];

/**
 * Reuniones del funnel TAL CUAL viene, EN ORDEN y SIN caer al default. Se
 * derivan de `kind: 'reunion'`, que es lo único que marca una reunión (solo las
 * etapas de la banda "Activo" traen `kind`; las de nutrición y salidas se
 * generan sin él, así que filtrar por kind alcanza).
 *
 * Es la versión que necesitan quienes ESTÁN construyendo el funnel
 * (generateFunnel) o midiéndolo (funnelReqInfo): para ellos un pipeline sin
 * reuniones significa exactamente eso, y heredar las del funnel por defecto les
 * inventaría transiciones ("Recupera", "Reagenda") y niveles de requisitos que
 * ese workspace no tiene.
 */
export function reunionesDe(stages: readonly EtapaLite[]): string[] {
  return stages.filter((s) => s.kind === 'reunion').map((s) => s.key);
}

/**
 * Igual que reunionesDe pero para quien CONSULTA un funnel que puede no haber
 * llegado: sin funnel (getPipelineStages falló o el workspace no configuró nada)
 * cae al pipeline por defecto, donde las reuniones son 'agenda' y 'agendaj2'.
 * Así el comportamiento histórico se conserva exactamente.
 */
export function etapasDeReunion(stages?: readonly EtapaLite[] | null): string[] {
  return reunionesDe(stages && stages.length ? stages : DEFAULT_PIPELINE);
}

/**
 * El slot que le toca a la reunión número `i` (0 = la primera), o null si esa
 * reunión no tiene dónde vivir: índice negativo (no es reunión) o de la tercera
 * en adelante (la tabla `leads` solo tiene dos pares de columnas).
 */
export function slotPorIndice(i: number): SlotReunion | null {
  return i < 0 ? null : (SLOTS[i] ?? null);
}

/**
 * Slot de reunión de `stageKey` en ese funnel, o null si esa etapa no es una
 * reunión (o es la tercera en adelante, que no tiene columnas donde vivir).
 */
export function slotDeReunion(stages: readonly EtapaLite[] | null | undefined, stageKey: string | null | undefined): SlotReunion | null {
  if (!stageKey) return null;
  return slotPorIndice(etapasDeReunion(stages).indexOf(stageKey));
}

/**
 * Etapa EFECTIVA del lead: el override manual (`pipeline_stage`) vale SOLO si
 * esa etapa sigue existiendo en el funnel del workspace; si no, se deriva del
 * estado del lead. Misma regla que faltantesDeLead (lib/leads.ts) y que el
 * board, y no es un detalle: en ws1 hay cientos de leads con un override a una
 * etapa que su funnel ya no tiene, y evaluarlos contra esa etapa fantasma los
 * dejaba fuera de todo.
 *
 * Sin funnel a mano no se puede verificar nada, así que se respeta el override
 * (mismo criterio que faltantesDeLead cuando no recibe `pipeline`).
 */
export function etapaVigenteDe(lead: StageDerivable, stages?: readonly EtapaLite[] | null): string {
  const override = lead.pipeline_stage?.trim();
  if (!override) return deriveStageKey(lead);
  if (!stages || stages.length === 0) return override;
  return stages.some((s) => s.key === override) ? override : deriveStageKey(lead);
}
