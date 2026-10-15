// =============================================================================
// reentrada — si un lead vuelve a entrar a una automatización (la «Reentrada» del CRON)
// =============================================================================
// docs/diseno-mako-nada-por-detras.md §1-B y §2.4-a (14/10/2026). Hasta ese día lo decidía una regla escondida:
// `reusaInscripciones` = `preparaReunion(s)` (lib/nutricion.ts). Un flujo «que prepara una reunión» (por su CRON o por
// un DELAY «antes de la reunión») volvía a correr cuando el lead agendaba OTRA reunión; cualquier otro, una sola vez
// en la vida del lead (`unique (lead_id, secuencia_id)`), y nada en la pantalla lo decía. Ahora es una opción del CRON:
//
//   · «Una sola vez»: el lead entra una vez y no vuelve.
//   · «Otra vez si es otra reunión»: la regla de antes (`inscripcionReusable`, lib/nutricion-reinscripcion.ts).
//   · «Cada vez que vuelve a entrar»: si la vez anterior TERMINÓ, el evento que lo vuelve a traer (otra vez a la
//     etapa, otra etiqueta, otro DM) lo hace entrar de nuevo.
//
// ⚠️ «VUELVE A ENTRAR» ES UN EVENTO, NUNCA EL BARRIDO. El barrido del CRON (la cohorte) mira quién ESTÁ en la etapa,
// no quién acaba de llegar: un lead que sigue parado ahí volvería a recibir todo en cada corrida. Por eso el barrido
// sólo reusa con «Otra vez si es otra reunión» (la reunión dice que es otra), y «Cada vez» corre por el evento
// (`enrolarPorEvento`) y por un «Ir a» / ⚡ inscribir (`inscribirEnSecuencia`).
// ⚠️ UNA CANCELADA NO VUELVE NUNCA, con ninguna opción: ahí caen la baja del email y el archivado (protección legal,
// `ESTADOS_TERMINADOS`). Y mientras la anterior está corriendo, no se reinicia: sería cortarle la secuencia a mitad.
//
// Módulo PURO y sin `server-only`: lo leen el motor, el panel del CRON y los tests.

import { inscripcionReusable, ESTADOS_TERMINADOS, soloQuedaElCarril, type FilaPrevia, type MarcasInscripcion } from './nutricion-reinscripcion';

export const REENTRADAS = ['una_vez', 'otra_reunion', 'siempre'] as const;
export type Reentrada = (typeof REENTRADAS)[number];

export const ROTULO_REENTRADA: Readonly<Record<Reentrada, string>> = {
  una_vez: 'Una sola vez',
  otra_reunion: 'Otra vez si es otra reunión',
  siempre: 'Cada vez que vuelve a entrar',
};

export const esReentrada = (x: unknown): x is Reentrada => (REENTRADAS as readonly unknown[]).includes(x);

/**
 * LA REENTRADA DE UNA AUTOMATIZACIÓN. La guardada, y sin guardar (la columna en null: las de antes de la 0279, o las que
 * crea la galería mientras sus plantillas no la escriban) ⚠️ LA REGLA DE HOY, TRANSITORIA: «Otra vez si es otra reunión»
 * si el flujo prepara una reunión, «Una sola vez» si no. Leer null como «Una sola vez» le sacaría el reuso a «Un Lead
 * Agendó Llamada» sin que nadie lo decidiera. El panel del CRON la muestra como la elegida, así que no queda escondida.
 * Cuando las plantillas la escriban y scripts/reentrada-explicita.mts la haya puesto en todas, el respaldo se va.
 */
export function reentradaDe(guardada: unknown, preparaReunion: boolean): Reentrada {
  if (esReentrada(guardada)) return guardada;
  return preparaReunion ? 'otra_reunion' : 'una_vez';
}

export type VeredictoReentrada =
  | { entra: true; porque: 'nada_le_llego' | 'reunion_nueva' | 'vuelve_a_entrar' }
  | { entra: false; porque: 'una_sola_vez' | 'cancelada' | 'no_termino' | 'sin_reunion_futura' | 'misma_reunion' | 'no_se_que_reunion_preparaba' | 'solo_por_evento' };

/**
 * ¿Esta inscripción vieja vuelve a correr? `porEvento`: lo trae un evento (o una persona / un «Ir a»), no el barrido.
 * «Otra vez si es otra reunión» es `inscripcionReusable` tal cual (sus cinco reglas, con sus porqués).
 */
export function puedeReentrar(modo: Reentrada, p: {
  fila: FilaPrevia;
  marcas: MarcasInscripcion;
  reunionNuevaMs: number | null;
  porEvento: boolean;
}): VeredictoReentrada {
  if (modo === 'una_vez') return { entra: false, porque: 'una_sola_vez' };
  if (modo === 'otra_reunion') {
    const v = inscripcionReusable(p);
    return v.reusable ? { entra: true, porque: v.porque } : { entra: false, porque: v.porque };
  }
  if (p.fila.estado === 'cancelada' || p.fila.desenlace === 'cancelado') return { entra: false, porque: 'cancelada' };
  if (!ESTADOS_TERMINADOS.includes(p.fila.estado) && !soloQuedaElCarril(p.fila)) return { entra: false, porque: 'no_termino' };
  if (!p.porEvento) return { entra: false, porque: 'solo_por_evento' };
  return { entra: true, porque: 'vuelve_a_entrar' };
}
