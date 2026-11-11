// =============================================================================
// le-pide-al-equipo — «Dile a Claude que…»: un pedido para el equipo de MaKo, nunca un mensaje para otra persona (11/11/2026)
// =============================================================================
// Martín, 11/11 00:07, en su grupo: «Dile a Claude que me de un archivo con todas las transcripciones del curso de ads que bajamos.
// Y pasamelo por aqui». El clasificador lo leyó como NO_REPLY («le pide a alguien del grupo (Claude)») y MaKo le puso 👍 y se calló.
// Claude, el Cerebro o el equipo no son otra persona del grupo: son a quien MaKo le delega. lib/mako-intencion-ia.ts
// (`veredictoDeClase`) vuelve TICKET un NO_REPLY que le pide algo a ellos.
//
// Reconoce lo que ESCRIBE la persona, en tú y en vos («dile», «decile», «pedile»…): por eso vive en su propio archivo, fuera del
// guard de voseo (tests/puente-panel-copy.test.ts, `FUERA_DE_ALCANCE`). Lo que MaKo dice va en tú; esto no le habla a nadie.
// SIN `server-only`: puro, con test (tests/mako-intencion-ia.test.ts 5).
// =============================================================================

/** ¿Le pide algo a CLAUDE, al Cerebro o al equipo de MaKo («dile a Claude que…», «que Claude me pase…»)? */
export function lePideAlEquipoDeMaKo(texto: string): boolean {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return /\b(?:dile|decile|digale|pedile|pidele|avisale|preguntale|contale|cuentale|pasale|mandale)\s+(?:al?\s+)?(?:claude|(?:el\s+)?cerebro|(?:el\s+)?equipo(?:\s+de\s+mako)?|(?:el\s+)?desarrollador)\b/.test(t)
    || /\bque\s+(?:claude|el\s+cerebro)\s+(?:me|nos|le|les|haga|vea|revise|arregle|investigue|pase|mande|de|arme)\b/.test(t);
}
