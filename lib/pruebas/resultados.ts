// =============================================================================
// pruebas/resultados — el resultado de UNA persona en una prueba de una automatización (PURO, 25/10/2026)
// =============================================================================
// Lo usan los medidores de Automations (lib/pruebas/medidores-automatizacion.ts). Las tres reglas de la crítica (B.5 y B.6):
//   · «Respondió» sale del ESTADO de la inscripción, que se reescribe al volver a entrar (#789): manda el PRIMER resultado
//     congelado en la asignación. Su hora es `desenlace_at` o, si falta, `updated_at` (`horasHastaResponder`).
//   · «Agendó» y «pagó» son ESTADOS sin hora propia (`junta_1_at` es la hora de la reunión, no de la reserva): cuentan sólo
//     si al asignar NO estaba (`previo`, congelado al asignar; sin `previo` no se sabe y NO cuenta), y su hora es la de la
//     lectura que lo vio por primera vez (una por día).
//   · Nunca se congela un «no»: puede pasar mañana. Uno que pasa después de la ventana tiene una hora después de la ventana,
//     y `conteosPorRama` no lo cuenta.
// =============================================================================

import { ESTADOS_RESPONDIO } from '../graficos-datos-puro';
import { agendoLead, pagoLead } from '../nutricion-grafo-motor';
import { metricaDe, type Resultado } from './metricas';

export type Congelado = { resultado: boolean; resultadoAt: string | null };
export type InscripcionParaMedir = { estado: string | null; desenlace_at?: string | null; updated_at?: string | null } | null | undefined;

/** «Respondió»: la inscripción terminó contestando; la hora, la de su desenlace (o su último cambio). */
export function respondio(insc: InscripcionParaMedir): Resultado {
  if (!insc || !ESTADOS_RESPONDIO.has(String(insc.estado ?? ''))) return { logro: false };
  return { logro: true, at: insc.desenlace_at ?? insc.updated_at ?? null };
}

/** Un estado del lead («agendó», «pagó»): cuenta sólo si al asignar no estaba; la hora, la de esta lectura. */
export function pasoA(previo: Readonly<Record<string, boolean>> | undefined, metrica: string, ahora: boolean, horaDeLaLectura: string): Resultado {
  if (previo?.[metrica] !== false || !ahora) return { logro: false };
  return { logro: true, at: horaDeLaLectura };
}

/** El PRIMER resultado manda: si ya hay uno congelado, ése. Si no, el nuevo, y se congela sólo un «sí». */
export function conElPrimero(c: Congelado | undefined, nuevo: Resultado): { resultado: Resultado; congelar: boolean } {
  if (c?.resultado === true) return { resultado: { logro: true, at: c.resultadoAt }, congelar: false };
  return { resultado: nuevo, congelar: nuevo.logro };
}

/** Cómo estaba el lead al asignar, en cada métrica de ESTADO de la prueba (la que decide y sus guardrails). */
export function previoDe(p: { metrica: string; guardrails: ReadonlyArray<{ metrica: string }> }, lead: Record<string, unknown> | null | undefined): Record<string, boolean> | undefined {
  if (!lead) return undefined;
  const out: Record<string, boolean> = {};
  for (const m of [p.metrica, ...p.guardrails.map((g) => g.metrica)]) {
    if (metricaDe(m)?.congela !== 'estado_previo') continue;
    if (m === 'agendo') out.agendo = agendoLead(lead);
    if (m === 'pago') out.pago = pagoLead(lead);
  }
  return Object.keys(out).length ? out : undefined;
}
