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
