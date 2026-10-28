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

/**
 * EL LOTE SE DECIDE MENSAJE POR MENSAJE (la verificación de 4d1d0a010). Con las menciones de todos juntas, una @mención a
 * Pedro callaba un «mako, ¿cuántos leads?» que ya tenía su 👍 (regresión contra producción), y una @mención a MaKo hacía
 * contestar en ventana cerrada también lo que era para Pedro. Ahora, si algún mensaje no es para otra persona, los que sí lo
 * son no entran al turno; y el lote lleva la decisión en vez de las menciones.
 */
export function paraQuienDelLote<T extends { texto: string; para: ParaQuien }>(mensajes: readonly T[]): { quedan: T[]; decision: ParaQuienDelLote } {
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
  if (p.nombraAMaKo || p.hayPendientes || p.makoPregunto) return null;
  if (p.menciones.length) return 'a-otro';
  return esAcusePuro(p.texto) ? 'acuse' : null;
}

/** Quién escribe, para el system: el nombre de WhatsApp. Sin nombre (o uno que es un número), nada. */
export function bloqueQuienEscribe(pushName: string | null | undefined): string {
  const n = (pushName ?? '').trim();
  if (!n || /^\+?\d[\d\s-]*$/.test(n)) return '';
  return `QUIÉN TE ESCRIBE AHORA: ${n.slice(0, 60)} (su nombre de WhatsApp). Si lo nombras, con ese nombre: no lo confundas con el dueño ni con otra persona del grupo.`;
}
