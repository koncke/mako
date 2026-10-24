// =============================================================================
// ¿Es la RESPUESTA AUTOMÁTICA de su WhatsApp? (24/10/2026, la #289 del ws1: el lead #2502)
// =============================================================================
// Medido en producción: lo que «contestó» el #2502 (inscripción 327) era la bienvenida automática de su WhatsApp
// Business («Gracias por comunicarte con…», 199 caracteres). M1 son 3 partes con pausas de 5 s; la bienvenida llegó a los
// 4,4 s de la primera. No es una respuesta: contarla corta la secuencia y le avisa al equipo por nada. Hasta hoy no
// contaban por accidente (la carrera del avance le pisaba el 'respondio', docs/hallazgos-chatbot.md); al arreglar la
// carrera, contarían todas. Por eso van juntas.
//
// La regla (por el Cerebro): un entrante que llega a `UMBRAL_RESPUESTA_AUTOMATICA_MS` o menos de la PRIMERA parte del
// PRIMER WhatsApp que una automatización le manda a ese lead en esa inscripción NO cuenta como respuesta. El mensaje se
// guarda como siempre; lo que no corre es `pausarPorRespuesta` (ni «Contestó», ni el AI Step, ni el borrador de MaKo,
// ni avisos, para NINGUNA automatización del lead), y se DICE en la ficha (`textoRespuestaAutomatica`). Esto decide,
// puro; la lectura vive donde entra el mensaje (`esRespuestaAutomaticaDelEntrante`, lib/evolution-mensajes.ts).
//
// ⚠️ ES UNA LECTURA POR LA HORA, NO UN HECHO. El costo, escrito: una PERSONA que contesta en 15 s o menos al primer
// mensaje tampoco cuenta (no se le corta la secuencia ni le contesta el AI Step). Medido el 24/10/2026 en todos los ws
// (45 días): 30 primeros WhatsApp de una inscripción, todos en el ws1; un solo entrante a menos de 60 s de la primera
// parte (esa bienvenida) y ninguna persona. Y al revés: una automática que llega DESPUÉS de los 15 s (con mala señal)
// sigue contando como respuesta.
//
// ⚠️ SÓLO EL WHATSAPP NO OFICIAL. El oficial no tiene entrante (el webhook de Chatwoot se borró el 09/10/2026) ni
// manda (`SIN_CANAL_OFICIAL`). Instagram y Messenger, no: el motor nunca escribe primero por ahí (un DM sale dentro de las
// 24 h del último mensaje de la PERSONA, lib/canal-zernio.ts), así que el primer mensaje de una automatización no es un
// primer contacto que dispare una bienvenida, y sus partes no quedan espejadas con su hora para medirlas.
// =============================================================================

import { PAUSA_MAX_S, PAUSA_TOTAL_MAX_S, TOPE_PARTES } from './mensaje-partes';

/**
 * 15 s desde la PRIMERA parte. ⚠️ SALE DE UNA SOLA MEDICIÓN (24/10/2026): la bienvenida del #2502, a los 4,4 s. Que una
 * persona tarde más en leer y contestar es lo esperable, no lo medido: en 45 días no hubo ninguna a menos de 60 s.
 * Re-medirlo: por cada primer `nutricion_envios` 'enviado' de WhatsApp de una inscripción, la primera parte en el espejo
 * (`wa_mensajes` con `from_me`, caminando hacia atrás con `HUECO_ENTRE_PARTES_MS`) y los entrantes reales (`from_me`
 * false, sin 'evento' ni 'otro') hasta 60 s después; por ws, con `runWithWorkspace` (cada uno tiene su base).
 * El borde se mide desde la primera parte y no desde la última: la bienvenida la dispara la primera burbuja, y un mensaje
 * de varias partes dura hasta 20 s de pausas (`PAUSA_TOTAL_MAX_S`) más el «escribiendo…» de cada una (medido: la fila
 * del envío se escribe a los 19 s de la primera parte, mediana, y 24 s como máximo).
 */
export const UMBRAL_RESPUESTA_AUTOMATICA_MS = 15_000;

/**
 * El «escribiendo…» más largo de una parte: `enviarTexto` (lib/evolution.ts) le pide a Evolution hasta 9 s ±20 % antes de
 * soltar el texto (un audio, hasta 9,6; un archivo, 7,2), y la fila del espejo se escribe cuando VUELVE: es la hora en que
 * le llegó, la que dispara la bienvenida.
 */
export const TIPEO_MAX_S = 11;

/**
 * Dos salientes más cerca que esto son el MISMO mensaje (sus partes): la pausa más larga entre dos partes (`PAUSA_MAX_S`),
 * el «escribiendo…» de la siguiente (`TIPEO_MAX_S`) y aire. Sirve para encontrar la PRIMERA parte caminando hacia atrás
 * desde el entrante: con la última parte a 4 s y la primera a 14, cuenta 14.
 * ⚠️ Con sólo la pausa (15 s), dos partes a 18 s una de otra (5 s de pausa y 11 de «escribiendo…») se partían en dos
 * mensajes y la primera se perdía: a quien contestaba a los 20 s se lo medía desde la segunda y se lo daba por automático.
 */
export const HUECO_ENTRE_PARTES_MS = (PAUSA_MAX_S + TIPEO_MAX_S + 4) * 1000;

/**
 * Los relojes no son el mismo: el entrante trae la hora de WhatsApp en SEGUNDOS (truncada), el espejo de nuestra parte la
 * hora del servidor al volver de Evolution, y la fila del envío la de la base. Un segundo de holgura en cada comparación.
 */
export const TOLERANCIA_RELOJ_MS = 1000;

/**
 * Lo más que puede haber entre el RECLAMO del motor (`reclamarAntesDeMandar`, lib/nutricion.ts: el `updated_at` que
 * escribe con compare-and-set justo antes de despachar) y la primera parte en el espejo: los datos del «{ }», el texto de
 * un paso con IA, bajar el audio o el archivo, y el «escribiendo…» de la primera parte (`TIPEO_MAX_S`). Con un reclamo
 * más viejo no se espera nada (un paso con IA que tarda más pierde el filtro y su bienvenida cuenta: lo de siempre).
 */
export const RECLAMO_ANTES_DE_LA_PRIMERA_MS = 60_000;

/**
 * La bienvenida de WhatsApp Business sale en el PRIMER contacto o después de 14 días sin actividad (lo dice WhatsApp; no
 * medido). Si el lead nos escribió en los 14 días de antes de la ráfaga, lo que llega no es una bienvenida: cuenta.
 */
export const SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS = 14 * 86_400_000;

/**
 * Lo más que tarda la fila del envío después de la PRIMERA parte: las demás partes (`TOPE_PARTES` − 1) con su
 * «escribiendo…», las pausas (`PAUSA_TOTAL_MAX_S`) y aire. Medido el 24/10/2026: 19 s de mediana y 24 como máximo (30
 * primeros mensajes del ws1). Es lo que espera el lector a que aparezca la fila de la inscripción que se reclamó.
 */
export const FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS = (PAUSA_TOTAL_MAX_S + (TOPE_PARTES - 1) * TIPEO_MAX_S + 10) * 1000;

/** Hasta dónde hacia atrás hay que leer salientes para saber dónde empezó el mensaje (el umbral, un hueco y aire). */
export const VENTANA_LECTURA_MS = UMBRAL_RESPUESTA_AUTOMATICA_MS + HUECO_ENTRE_PARTES_MS + 30_000;

/** Lo que hace falta de cada inscripción del lead para saber si está en su PRIMER WhatsApp. */
export type InscripcionAlEntrar = {
  id: number;
  secuenciaId: number;
  /**
   * 'activa', 'respondio' o 'completada'. Una 'completada' SIN desenlace es la que `pausarPorRespuesta` toma como respuesta
   * tardía (la «Bienvenida» de un solo mensaje: el avance la cierra a los milisegundos de mandarlo, antes de que llegue la
   * bienvenida); con desenlace, o cancelada, ya no escucha.
   */
  estado: string;
  desenlace?: string | null;
  /** `inscripto_at`: el alta de ESTA pasada (una reinscripción lo pone en ahora y reusa la fila). */
  inscriptoMs: number | null;
  /** `proximo_envio_at`. */
  proximoMs: number | null;
  /**
   * `updated_at`: el RECLAMO del motor justo antes de despachar (`reclamarAntesDeMandar`). Con la fila vencida, sin nada
   * enviado y el reclamo a menos de `RECLAMO_ANTES_DE_LA_PRIMERA_MS` antes de la ráfaga, el motor PUEDE estar mandándole
   * su primer mensaje ahora (la fila del envío se escribe después de la última parte). ⚠️ Sólo eso: `updated_at` lo
   * escribe cualquier escritura (una condición que la movió, la reactivación de una pausada), así que no atribuye la
   * ráfaga; dice que hay que esperar su fila.
   */
  reclamoMs: number | null;
  /**
   * La hora de SALIDA de cada WhatsApp suyo: la fila del envío ('enviado'/'simulado', escrita después de la última
   * parte), o, si salió como borrador aprobado, `wa_borradores.enviado_at` (la fila del envío conserva el `created_at` del
   * borrador, de antes de que nadie lo apruebe).
   */
  enviosMs: readonly number[];
};

export type VeredictoEntrante =
  | { automatica: true; ms: number; inscripcionId: number; secuenciaId: number }
  | { automatica: false; porque: 'sin-salientes' | 'tarde' | 'ya-hablaban' | 'no-es-el-primero'; ms?: number }
  /**
   * TODAVÍA NO SE SABE: el motor reclamó esa inscripción justo antes de la ráfaga y su fila del envío no está. Quien lee
   * espera esa fila hasta `hastaMs` y vuelve a preguntar con `sinEsperar` (con la fila, es suya; sin ella, cuenta).
   */
  | { automatica: false; porque: 'esperar-su-fila'; ms: number; inscripcionId: number; secuenciaId: number; hastaMs: number };

/**
 * LA HORA DE SALIDA de cada WhatsApp de una inscripción (revisión del 24/10/2026, el modo asistido). Una fila del envío
 * 'enviado'/'simulado' salió cuando se escribió (después de la última parte). Pero la de un borrador APROBADO conserva el
 * `created_at` del borrador —`anotarPasoEnviado` (lib/evolution-envio.ts) sólo le cambia el estado—, de horas antes de
 * que alguien lo apruebe: su hora es `wa_borradores.enviado_at` (el mismo `inscripcion_id` y `paso`, y de después de
 * creada la fila). Un 'borrador' sin aprobar no salió. ⚠️ Sin esto, en asistido el primer mensaje que se aprobaba se
 * leía como «ya le había salido algo antes» y la bienvenida volvía a cortar.
 */
export function horasDeSalida(
  envios: ReadonlyArray<{ inscripcionId: number; paso: number | null; estado: string; creadoMs: number }>,
  aprobados: ReadonlyArray<{ inscripcionId: number; paso: number | null; enviadoMs: number | null }>,
): Map<number, number[]> {
  const aprobado = new Map(aprobados.filter((b) => b.enviadoMs != null && Number.isFinite(b.enviadoMs)).map((b) => [`${b.inscripcionId}:${b.paso}`, b.enviadoMs as number]));
  const out = new Map<number, number[]>();
  for (const e of envios) {
    const a = aprobado.get(`${e.inscripcionId}:${e.paso}`);
    const t = a != null && a >= e.creadoMs - TOLERANCIA_RELOJ_MS ? a : e.estado === 'borrador' ? Number.NaN : e.creadoMs;
    if (!Number.isFinite(t)) continue;
    out.set(e.inscripcionId, [...(out.get(e.inscripcionId) ?? []), t]);
  }
  return out;
}

/**
 * LA PRIMERA PARTE de la ráfaga que el lead tenía delante: de los salientes hasta el entrante, el último y, hacia atrás,
 * los que están a menos de `HUECO_ENTRE_PARTES_MS` uno del otro (las partes del mismo mensaje). Sin ninguno, null.
 */
export function inicioDeLaRafaga(recibidoMs: number, salientesMs: readonly number[]): number | null {
  if (!Number.isFinite(recibidoMs)) return null;
  const antes = salientesMs.filter((t) => Number.isFinite(t) && t <= recibidoMs + TOLERANCIA_RELOJ_MS).sort((a, b) => a - b);
  if (!antes.length) return null;
  let inicio = antes[antes.length - 1];
  for (let k = antes.length - 2; k >= 0 && inicio - antes[k] <= HUECO_ENTRE_PARTES_MS; k--) inicio = antes[k];
  return inicio;
}

/**
 * ¿Este entrante es la respuesta automática al primer WhatsApp de una automatización?
 *
 * 1. LA PRIMERA PARTE (`inicioDeLaRafaga`). Sin ningún saliente antes, NO es automática: le escribió antes de recibir nada.
 * 2. A más de `UMBRAL_RESPUESTA_AUTOMATICA_MS` de esa primera parte, cuenta.
 * 3. Si el lead nos escribió en los 14 días de antes (`entrantesMs`), cuenta: con actividad en el chat no hay bienvenida, y
 *    lo rápido es una charla (le contesta el AI Step, le escribe una persona desde Chats, sigue la conversación).
 * 4. Y la ráfaga tiene que ser el PRIMER WhatsApp de alguna inscripción: entró antes de que empezara a salir, en esta
 *    pasada no le había salido nada antes, y su envío salió DENTRO de la ráfaga (su fila, o su borrador aprobado). Si
 *    todavía no hay fila pero el motor la reclamó para mandarle justo antes (`reclamoMs`, con la fila vencida), no se
 *    sabe todavía: 'esperar-su-fila' (la fila se escribe después de la última parte).
 *
 * ⚠️ HASTA LA REVISIÓN DEL 24/10 EL PASO 4 DABA POR SUYA LA RÁFAGA DE CUALQUIER INSCRIPCIÓN VENCIDA SIN ENVÍOS: el espejo
 * no dice QUIÉN mandó cada saliente, y una vencida sin mandar puede quedar así horas o días (pausada, cerrada por su
 * horario, con el cupo lleno, o frenada por el anti-ban de la corrida porque OTRA automatización le acababa de escribir).
 * Así, la respuesta de una persona al M3 de otra automatización, o a un mensaje desde Chats, se tomaba como automática.
 * Ahora la ráfaga es de una inscripción sólo con SU fila del envío; el reclamo dice nada más cuándo vale la pena
 * esperarla (`updated_at` lo escribe cualquier escritura de la fila: no prueba que se esté mandando).
 */
export function esRespuestaAutomatica(p: {
  recibidoMs: number;
  salientesMs: readonly number[];
  /** Los entrantes REALES del lead (sin 'evento' ni 'otro') de los 14 días de antes; los de después de la ráfaga no cuentan. */
  entrantesMs?: readonly number[];
  inscripciones: readonly InscripcionAlEntrar[];
  /** Ya se esperó la fila del envío: lo que siga sin fila no es suyo. */
  sinEsperar?: boolean;
}): VeredictoEntrante {
  const inicio = inicioDeLaRafaga(p.recibidoMs, p.salientesMs);
  if (inicio == null) return { automatica: false, porque: 'sin-salientes' };
  const ms = Math.max(0, p.recibidoMs - inicio);
  if (ms > UMBRAL_RESPUESTA_AUTOMATICA_MS) return { automatica: false, porque: 'tarde', ms };
  const yaHablaban = (p.entrantesMs ?? []).some((t) => Number.isFinite(t) && t < inicio - TOLERANCIA_RELOJ_MS && t >= inicio - SIN_ACTIVIDAD_PARA_LA_BIENVENIDA_MS);
  if (yaHablaban) return { automatica: false, porque: 'ya-hablaban', ms };
  let esperar: Extract<VeredictoEntrante, { porque: 'esperar-su-fila' }> | null = null;
  for (const i of p.inscripciones) {
    const viva = i.estado === 'activa' || i.estado === 'respondio';
    if (!viva && !(i.estado === 'completada' && i.desenlace == null)) continue;
    // Entró DESPUÉS de que empezara a salir: ese mensaje no es suyo.
    if (i.inscriptoMs != null && i.inscriptoMs > inicio + TOLERANCIA_RELOJ_MS) continue;
    const deEstaPasada = i.enviosMs.filter((t) => Number.isFinite(t) && (i.inscriptoMs == null || t >= i.inscriptoMs - TOLERANCIA_RELOJ_MS));
    // Ya le había salido algo ANTES de esta ráfaga: no es el primero.
    if (deEstaPasada.some((t) => t < inicio - TOLERANCIA_RELOJ_MS)) continue;
    // Su envío salió DENTRO de la ráfaga (su fila, o su borrador aprobado): es suya.
    if (deEstaPasada.length > 0) return { automatica: true, ms, inscripcionId: i.id, secuenciaId: i.secuenciaId };
    // Sin fila todavía: si el motor la reclamó para mandarle justo antes de la primera parte, se espera su fila.
    const reclamada = viva && !p.sinEsperar
      && i.proximoMs != null && i.proximoMs <= p.recibidoMs + TOLERANCIA_RELOJ_MS
      && i.reclamoMs != null && i.reclamoMs <= inicio + TOLERANCIA_RELOJ_MS && i.reclamoMs >= inicio - RECLAMO_ANTES_DE_LA_PRIMERA_MS;
    if (reclamada && !esperar) esperar = { automatica: false, porque: 'esperar-su-fila', ms, inscripcionId: i.id, secuenciaId: i.secuenciaId, hastaMs: inicio + FILA_DEL_ENVIO_TRAS_LA_PRIMERA_MAX_MS };
  }
  // (Una con SU fila gana a una reclamada: por eso se espera recién después de mirarlas todas.)
  return esperar ?? { automatica: false, porque: 'no-es-el-primero', ms };
}

/**
 * La línea de la ficha («nada por detrás»): cuándo llegó, de qué automatización, y que es una LECTURA por la hora (no
 * sabemos si del otro lado había una persona: lo decide el tiempo).
 */
export function textoRespuestaAutomatica(ms: number, automatizacion: string | null): string {
  const s = Math.round(Math.max(0, ms) / 1000);
  const cuando = s < 1 ? 'en el mismo segundo que el' : `a los ${s} s del`;
  const de = automatizacion?.trim() ? `«${automatizacion.trim()}»` : 'una automatización';
  return `Su mensaje llegó ${cuando} primer mensaje de ${de}: tan rápido se toma como la respuesta automática de su WhatsApp y no cuenta como respuesta.`;
}
