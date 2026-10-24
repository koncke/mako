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

/**
 * ¿ESTE BARRIDO CUENTA COMO EVENTO? Sí cuando el CRON tiene HORARIO, un Recurrente (20/10/2026). Su barrido corre UNA vez
 * por ocurrencia —la reclama el compare-and-set de `cron_proxima_at` (lib/nutricion.ts, `comprometerInscripciones`)—, así
 * que cada ocurrencia es «otra vez», como un evento, y no «cada corrida». Sin esto, «todos los martes a todos los del
 * funnel» le llegaba UNA vez a cada lead: con el unique (lead, secuencia), la segunda ocurrencia caía en `solo_por_evento`
 * y sólo le llegaba a los nuevos, sin error (#284 de ws11, el único Recurrente de prod al 20/10).
 * Un barrido SIN horario (una etapa) sigue sin serlo: mira quién ESTÁ, y corre cada tick.
 */
export const barridoEsEvento = (d: { cron?: unknown }): boolean => d.cron != null;

/** Por qué no volvió a entrar a una automatización en la que ya tenía su inscripción (`motivoNoVuelve`). */
export type PorQueNoVuelve = 'una_sola_vez' | 'cancelada' | 'respondio' | 'en_curso' | 'no_le_toca';

/** Una automatización de la etapa a la que el lead NO volvió a entrar, dicha a la persona que lo movió. */
export type NoEntro = {
  secuenciaId: number;
  nombre: string;
  at: string;
  porque: PorQueNoVuelve;
  /** El motivo SIN el nombre («ya entró una vez y su reentrada es «Una sola vez»»). */
  texto: string;
  /** Quién lo movió (el email de la sesión). */
  quien: string | null;
};

/** Lo que pasó con las automatizaciones de la etapa cuando una PERSONA movió al lead (lo llena `enrolarPorEvento`). */
export type InformeMovimiento = { entro: Array<{ secuenciaId: number; nombre: string }>; noEntro: NoEntro[] };

const TEXTO_NO_VUELVE: Readonly<Record<Exclude<PorQueNoVuelve, 'no_le_toca'>, string>> = {
  una_sola_vez: `ya entró una vez y su reentrada es «${ROTULO_REENTRADA.una_vez}»`,
  cancelada: 'la habían frenado, y una automatización frenada no vuelve a empezar',
  respondio: 'ya contestó en esta automatización',
  en_curso: 'todavía la está haciendo',
};
const NO_LE_TOCA = 'no le toca volver a entrar';

/**
 * ⚠️ POR QUÉ NO VOLVIÓ A ENTRAR, en palabras, para la PERSONA que lo movió (23/10/2026, #289 del ws1). Martín llevó su lead
 * a la etapa del CRON de «Sprint · apertura» y no pasó nada: ya tenía una inscripción (reentrada «Una sola vez», y
 * además viva), `enrolarPorEvento` la salteaba con un `continue` y no lo decía en ningún lado. Con esto, una línea en el
 * historial (`lineaNoVolvio`) y el informe del movimiento. Las razones van en el orden en que cortan en el motor: la
 * reentrada primero (`reusaInscripciones` deja afuera «Una sola vez» antes de mirar la fila), después la fila.
 */
export function motivoNoVuelve(modo: Reentrada, fila: Pick<FilaPrevia, 'estado' | 'desenlace' | 'proximo_envio_at'>): { porque: PorQueNoVuelve; texto: string } {
  const de = (porque: Exclude<PorQueNoVuelve, 'no_le_toca'>) => ({ porque, texto: TEXTO_NO_VUELVE[porque] });
  if (modo === 'una_vez') return de('una_sola_vez');
  if (fila.estado === 'cancelada' || fila.desenlace === 'cancelado') return de('cancelada');
  if (fila.estado === 'respondio' && !soloQuedaElCarril(fila)) return de('respondio');
  if (!ESTADOS_TERMINADOS.includes(fila.estado) && !soloQuedaElCarril(fila)) return de('en_curso');
  return { porque: 'no_le_toca', texto: `${NO_LE_TOCA} (reentrada «${ROTULO_REENTRADA[modo]}»)` };
}

const PREFIJO_NO_VOLVIO = 'No volvió a entrar a «';

/** La línea del historial del lead (`lead_audit`, campo 'Automatización'). La lee de vuelta `leerNoVolvio`. */
export const lineaNoVolvio = (nombre: string, texto: string): string => `${PREFIJO_NO_VOLVIO}${nombre}»: ${texto}.`;

/** Una línea del historial → el nombre de la automatización y el porqué; null si no es una de «no volvió». */
export function leerNoVolvio(linea: string | null | undefined): { nombre: string; porque: PorQueNoVuelve; texto: string } | null {
  if (typeof linea !== 'string' || !linea.startsWith(PREFIJO_NO_VOLVIO)) return null;
  const m = /^No volvió a entrar a «(.+)»: (.+)\.$/.exec(linea);
  if (!m) return null;
  const texto = m[2];
  const porque = (Object.keys(TEXTO_NO_VUELVE) as Array<keyof typeof TEXTO_NO_VUELVE>).find((k) => TEXTO_NO_VUELVE[k] === texto)
    ?? (texto.startsWith(NO_LE_TOCA) ? 'no_le_toca' : null);
  return porque ? { nombre: m[1], porque, texto } : null;
}
