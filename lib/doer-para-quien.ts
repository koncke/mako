// =============================================================================
// doer-para-quien — ¿el mensaje del grupo es PARA MaKo? (27/10/2026, P8 de la lectura del Cerebro)
// =============================================================================
// ~16 de 58 turnos contestaban un acuse o una charla entre personas; a «Esto habla solo ? @joan» MaKo dio una descripción
// falsa, y a la persona que escribía la llamó por otro nombre. En el modo «libre» MaKo contesta TODO mensaje del grupo.
// Lo que no es para MaKo no dispara un turno (el 👍 de recibido ya salió):
//   · un ACUSE PURO («ok», «gracias», «genial», «jaja», «👍»), si MaKo no acaba de preguntar nada ni hay nada pendiente;
//   · una @MENCIÓN a otra persona, si el mensaje no nombra a MaKo.
// Un «ok» después de «¿Quieres que la pause?» ES un sí: con una pregunta de MaKo o una pendiente, el turno corre.
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-para-quien.test.ts.
// =============================================================================

/** Lo que sólo acusa recibo o agradece: el mensaje entero, sin nada más. */
const ACUSE_PURO = /^(?:ok(?:ey|is)?|oka|dale|listo|genial|perfecto|gracias|muchas gracias|mil gracias|buen[ií]simo|b[aá]rbaro|joya|de una|(?:ja)+j?|(?:je)+j?|👍|🙏|👌|🙌|❤️|💪)(?:[\s,.!¡]+(?:ok|dale|listo|genial|perfecto|gracias|mako|crack|(?:ja)+|👍|🙏|👌))*[\s.!¡]*$/iu;

export function esAcusePuro(texto: string): boolean {
  return ACUSE_PURO.test((texto || '').trim());
}

/** Las @menciones del mensaje de WhatsApp (los jid de `contextInfo.mentionedJid`). */
export function mencionesDe(message: Record<string, unknown> | undefined): string[] {
  const ctx = ((message?.extendedTextMessage as { contextInfo?: { mentionedJid?: unknown } } | undefined)?.contextInfo
    ?? (message?.contextInfo as { mentionedJid?: unknown } | undefined));
  return Array.isArray(ctx?.mentionedJid) ? (ctx!.mentionedJid as unknown[]).filter((j): j is string => typeof j === 'string') : [];
}

/** A quién mencionan: `aMaKo`, si una mención es la línea que recibe; `aOtros`, las que seguro son de otra persona. */
export type Mencionados = { aMaKo: boolean; aOtros: string[] };

const ult10 = (d: string): string => d.slice(-10);
/** Los dígitos de un jid de TELÉFONO (`549…@s.whatsapp.net`, con `:device` o sin él); null si no lo es (un `@lid`, un grupo). */
function telefonoDelJid(jid: string): string | null {
  const m = /^(\d{8,15})(?::\d+)?@(?:s\.whatsapp\.net|c\.us)$/.exec(jid.trim());
  return m ? m[1] : null;
}

/**
 * Las menciones contra el número de la línea que RECIBE (la de MaKo en ese grupo, su `ownerJid`). Elegir a MaKo con la @ manda
 * su jid, no la palabra «mako»: sin esto, «@MaKo ¿cuántos leads entraron?» se leía como «a otro» y quedaba callado (la
 * revisión adversarial de 92d23e11d). Un `@lid` no se compara con un teléfono, y sin el número de la línea no se sabe: esas
 * menciones no cuentan como «a otro», y MaKo contesta como antes de P8. Se compara por los últimos 10 dígitos (el 9 de AR).
 */
export function quienesMencionados(menciones: readonly string[], numeroLinea: string | null): Mencionados {
  const linea = numeroLinea ? ult10(numeroLinea.replace(/\D/g, '')) : '';
  const aMaKo = !!linea && menciones.some((j) => { const t = telefonoDelJid(j); return !!t && ult10(t) === linea; });
  const aOtros = linea ? menciones.filter((j) => { const t = telefonoDelJid(j); return !!t && ult10(t) !== linea; }) : [];
  return { aMaKo, aOtros: aMaKo || aOtros.length < menciones.length ? [] : aOtros };
}

/** Para quién es UN mensaje: 'mako' (lo nombra, lo menciona, o trae un audio o un adjunto: es deliberado), 'acuse' o 'a-otro'
 *  (no es para MaKo), o null (un pedido que no lo nombra: en «libre» es para MaKo). */
export type ParaQuien = 'mako' | 'acuse' | 'a-otro' | null;
/** Lo que el lote decidió, mensaje por mensaje: si alguno nombra a MaKo, o por qué ninguno es para MaKo (null: alguno lo es). */
export type ParaQuienDelLote = { nombra: boolean; noEs: 'acuse' | 'a-otro' | null };
/** Un mensaje de la cola: su texto, para quién es solo, y quién lo escribió (el `participant`; sin él, no se sabe). */
type ConAutor = { texto: string; para: ParaQuien; autor?: string | null };

/**
 * ⚠️ LA RESPUESTA A UN MENSAJE PARA OTRO TAMBIÉN ES PARA OTRO (la verificación de bb41ede4a): Ana «@Pedro ¿lo confirmo?» y Pedro
 * «sí». Sacar sólo el de Ana dejaba el «sí» solo, que con una pendiente se leía como confirmar y la EJECUTABA, aunque fuera de
 * plata. Una respuesta corta (`esRespuestaCorta`) que sigue a uno «a otro», sin uno para MaKo en el medio, va con él.
 * Y nadie se contesta a sí mismo (la verificación de 8cb034a18): Ana «@Leila mirá, ya lo encontró» y después Ana «sí», ese «sí»
 * es para MaKo. Lo que sigue a una RESPUESTA sí va con ella aunque sea del mismo: Pedro «sí» y Pedro «dale» le contestan los dos
 * a Ana. Sin el autor de alguno de los dos, se toma como respuesta: es lo que no ejecuta nada.
 * La usan el lote y el 👍 (que se decide mensaje por mensaje, antes del lote).
 */
export function conLasRespuestas<T extends ConAutor>(entrada: readonly T[]): T[] {
  let previo: { autor?: string | null; aOtro: boolean; respuesta: boolean } = { aOtro: false, respuesta: false };
  return entrada.map((m) => {
    const otraPersona = previo.respuesta || !previo.autor || !m.autor || previo.autor !== m.autor;
    const respuesta = m.para !== 'mako' && previo.aOtro && otraPersona && esRespuestaCorta(m.texto);
    previo = { autor: m.autor, aOtro: respuesta || m.para === 'a-otro', respuesta };
    return respuesta && m.para !== 'a-otro' ? { ...m, para: 'a-otro' as const } : m;
  });
}

/**
 * EL LOTE SE DECIDE MENSAJE POR MENSAJE (la verificación de 4d1d0a010). Con las menciones de todos juntas, una @mención a
 * Pedro callaba un «mako, ¿cuántos leads?» que ya tenía su 👍 (regresión contra producción), y una @mención a MaKo hacía
 * contestar en ventana cerrada también lo que era para Pedro. Ahora, si algún mensaje no es para otra persona, los que sí lo
 * son no entran al turno; y el lote lleva la decisión en vez de las menciones.
 */
export function paraQuienDelLote<T extends ConAutor>(entrada: readonly T[]): { quedan: T[]; decision: ParaQuienDelLote } {
  const mensajes = conLasRespuestas(entrada);
  const quedan = mensajes.some((m) => m.para !== 'a-otro') ? mensajes.filter((m) => m.para !== 'a-otro') : [...mensajes];
  const ningunoEs = quedan.every((m) => m.para === 'acuse' || m.para === 'a-otro');
  return {
    quedan,
    decision: {
      nombra: quedan.some((m) => m.para === 'mako'),
      noEs: ningunoEs ? (quedan.some((m) => m.para === 'a-otro') ? 'a-otro' : 'acuse') : null,
    },
  };
}

/** Por qué el mensaje NO es para MaKo, o null si lo es. */
export function noEsParaMaKo(p: { texto: string; menciones: readonly string[]; nombraAMaKo: boolean; makoPregunto: boolean; hayPendientes: boolean }): 'acuse' | 'a-otro' | null {
  if (p.nombraAMaKo) return null;
  // Una @mención a otra persona no es para MaKo AUNQUE haya algo pendiente (la verificación de bb41ede4a): «@Pedro sí,
  // confirmalo vos» no es el «sí» de la pendiente. Lo pendiente o la pregunta de MaKo convierten en «sí» sólo un acuse.
  // Salvo el «sí» a MaKo que nombra a otro como parte del pedido (la verificación de 8cb034a18): «sí, y avísale a @Pedro», con
  // una pendiente o una pregunta de MaKo. «@Pedro sí» o «sí @Pedro» siguen siendo para Pedro.
  if (p.menciones.length) return (p.hayPendientes || p.makoPregunto) && confirmaYNombraAOtro(p.texto) ? null : 'a-otro';
  if (p.hayPendientes || p.makoPregunto) return null;
  return esAcusePuro(p.texto) ? 'acuse' : null;
}

/** Lo que confirma, acusa o niega, solo: «sí», «dale», «ok», «listo», «no». */
const CONFIRMA = String.raw`(?:s[ií]+|sip|sep|no|nop|dale|ok(?:ey|is)?|oka|listo|claro(?:\s+que\s+s[ií])?|bueno|perfecto|de una|obvio|joya|va|vale|ya(?:\s+est[aá])?|hecho|confirmado|de acuerdo|genial|buen[ií]simo|b[aá]rbaro|(?:muchas\s+)?gracias|enseguida|ya mismo|ah[ií] va|todav[ií]a no|mejor no)`;
/** Lo que agrega el que contesta a quien le pidió algo: «ya te lo mando», «ahora lo veo», «en un rato te lo paso». */
const DEL_QUE_CONTESTA = String.raw`(?:(?:ya|ahora|ah[ií]|enseguida|en un rato|despu[eé]s|ma[nñ]ana)\s+)?(?:(?:te|se|les?)\s+)?(?:(?:lo|la|los|las)\s+)?(?:mando|paso|env[ií]o|hago|confirmo|reviso|miro|veo|subo|cargo|llamo|escribo)`;
const RESPUESTA_CORTA = new RegExp(String.raw`^${CONFIRMA}(?:[\s,.!¡;:]+(?:${CONFIRMA}|${DEL_QUE_CONTESTA}))*[\s,.!¡]*(?:\p{Extended_Pictographic}\uFE0F?\s*)*$`, 'iu');
/**
 * Una RESPUESTA corta: pegada a un mensaje para otra persona, le contesta a esa persona. Es un acuse o una confirmación ENTERA
 * («sí», «sí, dale», «dale, ya te lo mando», «ok 👍»), sin nombrar a MaKo ni preguntar (la verificación de 8cb034a18: con sólo
 * el arranque, «listo, agenda a Juan el lunes», «bueno, pásame los leads» o «si entra un lead nuevo avísame» se volvían «a otro»
 * detrás de una mención, y quedaban con 👍 y sin respuesta).
 */
export function esRespuestaCorta(texto: string): boolean {
  const t = (texto || '').trim();
  return t.length <= 60 && !t.includes('?') && !/mako/i.test(t) && (esAcusePuro(t) || RESPUESTA_CORTA.test(t));
}

/** El arranque de un «sí» a MaKo («sí», «dale», «ok», «listo», «confirmo», «adelante»). */
const EMPIEZA_CONFIRMANDO = /^(?:s[ií]+|dale|ok(?:ey)?|listo|confirm\p{L}*|adelante|de una|perfecto|bueno)(?!\p{L})/iu;
/** ¿Confirma y nombra a otro como PARTE del pedido? Antes de la primera @ hay más que la confirmación, y la @ es el objeto
 *  («… avísale a @Pedro», «… agéndalo con @Ana», «… mándalo para @Juan»): no le habla a esa persona. */
export function confirmaYNombraAOtro(texto: string): boolean {
  const antes = (texto || '').trim().split('@')[0].trim();
  return EMPIEZA_CONFIRMANDO.test(antes) && /^\S+[\s,]+\S.*\s(?:a|al|con|para)$/iu.test(antes);
}

/** Quién escribe, para el system: el nombre de WhatsApp. Sin nombre (o uno que es un número), nada. */
export function bloqueQuienEscribe(pushName: string | null | undefined): string {
  const n = (pushName ?? '').trim();
  if (!n || /^\+?\d[\d\s-]*$/.test(n)) return '';
  return `QUIÉN TE ESCRIBE AHORA: ${n.slice(0, 60)} (su nombre de WhatsApp). Si lo nombras, con ese nombre: no lo confundas con el dueño ni con otra persona del grupo.`;
}
