// =============================================================================
// oferta-de-mako — ¿lo último que dijo MaKo OFRECE hacer algo? (11/11/2026, Joan, Código Inmobiliario)
// =============================================================================
// Joan preguntó por audio si MaKo ve las campañas de sus clientes; MaKo explicó y cerró con «¿Querés que revise si Marcela conectó
// sus anuncios?». Joan contestó «Si» y el clasificador lo marcó CHARLA («confirma que entendió»): 👍 y nada más. Martín: «MaKo no
// responde nada». Un «sí» a una OFERTA de MaKo es el pedido de hacerla; a una pregunta por un hecho («Entró EDEST_OFICIAL, ¿lo
// contactaron?») no: ahí sí es charla. Esto separa las dos (lib/mako-intencion-ia.ts, `veredictoDeClase`).
//
// Lee lo que ESCRIBIÓ MaKo, en tú o en vos (el modelo a veces vosea): vive fuera del guard de voseo
// (tests/puente-panel-copy.test.ts, `FUERA_DE_ALCANCE`). No le habla a nadie. SIN `server-only`: puro, con test
// (tests/mako-intencion-ia.test.ts 6).
// =============================================================================

const VERBOS = '(?:hago|reviso|cargo|agendo|anoto|armo|busco|paso|mando|muevo|creo|marco|actualizo|confirmo|preparo)';

/** ¿El mensaje de MaKo termina ofreciendo HACER algo («¿Querés que revise…?», «¿Te lo agendo?», «¿Lo reviso?»)? */
export function esOfrecimientoDeMaKo(texto: string | null | undefined): boolean {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(-400);
  return /¿\s*(?:queres|quieres|preferis|prefieres)\s+que\b/.test(t)
    || new RegExp(`¿\\s*(?:te\\s+(?:lo|la|los|las)\\s+\\w+|(?:lo|la|los|las)\\s+${VERBOS}|${VERBOS})\\b`).test(t);
}
