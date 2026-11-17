// =============================================================================
// lead-respuestas — lo PURO de cómo se escribe y se lee `lead_respuestas`
// =============================================================================
// Sin `server-only`, a propósito: `lib/leads.ts` (que escribe la tabla) y `lib/lead-resumen.ts`
// (que la muestra) lo tienen, así que ningún test podría importar estas decisiones si vivieran
// allá. Las dos se equivocaron sin dar un solo error (09/10/2026), y por eso tienen red.
// =============================================================================

import type { Lead, RespuestaQA } from './leads';

/** Una pregunta del formulario con su respuesta, como la muestra el resumen del lead. */
export type RespuestaFormulario = { pregunta: string; respuesta: string };

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

/**
 * Lo que el resumen del lead muestra en «Lo que contestó al agendar».
 *
 * `legado` son las seis columnas `respuesta_*` de Calendly con sus rótulos CURADOS (`PREGUNTAS` en
 * lib/lead-resumen.ts): si hay alguna, se muestran ésas y nada más, así el ws1 no cambia.
 *
 * Si no hay ninguna, salen las de `lead_respuestas` (`getLeadRespuestas`: el último set de cada
 * reunión). Hasta el 09/10/2026 el resumen sólo leía las columnas, y Cal.com guarda sus respuestas
 * ÚNICAMENTE en `lead_respuestas`: para un lead de Cal.com la sección no salía nunca, aunque el
 * aviso «Nuevo agendado» manda a esta pantalla a ver «el resto» («+N en el resumen») y el
 * recordatorio previo a la llamada también. Las de la R2 llevan el rótulo prefijado: las dos
 * reuniones pueden repetir la misma pregunta (por eso la pantalla las lleva con un `key` con índice).
 */
export function respuestasDelResumen(
  legado: ReadonlyArray<RespuestaFormulario>,
  porReunion: { R1: ReadonlyArray<RespuestaQA>; R2: ReadonlyArray<RespuestaQA> } | null,
): RespuestaFormulario[] {
  if (legado.length) return [...legado];
  if (!porReunion) return [];
  const conTexto = (x: RespuestaQA) => typeof x?.q === 'string' && typeof x?.a === 'string' && !!x.q.trim() && !!x.a.trim();
  return [
    ...porReunion.R1.filter(conTexto).map(({ q, a }) => ({ pregunta: q, respuesta: a })),
    ...porReunion.R2.filter(conTexto).map(({ q, a }) => ({ pregunta: `R2 · ${q}`, respuesta: a })),
  ];
}

/**
 * Las respuestas del formulario, con la PREGUNTA que las originó.
 *
 * Las columnas se llaman `respuesta_facturacion`, `respuesta_decisor`… y solas
 * no dicen nada: leídas en el celular treinta segundos antes de entrar a la
 * llamada, «Sí» sin la pregunta es ruido.
 *
 * ⚠️ EL NOMBRE DE LA COLUMNA NO ES LA PREGUNTA, y confundirlos acá miente en la
 * pantalla. Dos casos medidos contra el formulario real:
 *
 *  · `respuesta_facturacion` NO guarda cuánto factura: guarda el SÍ/NO a
 *    «este programa está enfocado en negocios que facturan +$20M MXN al año,
 *    ¿es tu caso?». Rotulada «¿Cuánto factura al año?» se leía «Si», que no es
 *    una facturación.
 *  · `respuesta_decisor` guarda el SÍ/NO a «¿alguien MÁS participa en la
 *    decisión?». Rotulada «¿Decide solo?» invertía el sentido: un «No» —que
 *    significa que decide él— se leía como que NO decide él. Esa es la que
 *    manda a la llamada con la estrategia al revés.
 *
 * Vivía en lib/lead-resumen.ts (`server-only`). El export de leads (app/crm/leads-exportar.ts) tenía SU lista, con los dos
 * rótulos que este comentario dice que mentían («Facturación mensual actual», «¿Es el decisor?»): ticket 106, 17/11/2026.
 *
 * La verdad de qué pregunta llena cada columna vive en el webhook
 * (`extractRespuestaPorFrase` en app/api/webhooks/calendly/route.ts): si ahí
 * cambian las frases que se matchean, estos rótulos se tocan en el mismo commit.
 */
export const PREGUNTAS_CALENDLY: ReadonlyArray<{ campo: keyof Lead & `respuesta_${string}`; pregunta: string }> = [
  { campo: 'respuesta_objetivo', pregunta: '¿Qué quiere lograr?' },
  { campo: 'respuesta_colaboradores', pregunta: '¿Cuántos colaboradores tiene?' },
  { campo: 'respuesta_facturacion', pregunta: '¿Factura más de $20M MXN al año?' },
  { campo: 'respuesta_inversion', pregunta: '¿Tiene posibilidad de invertir?' },
  { campo: 'respuesta_decisor', pregunta: '¿Alguien más participa en la decisión?' },
  { campo: 'respuesta_cuando_empezar', pregunta: '¿Cuándo quiere empezar?' },
];
