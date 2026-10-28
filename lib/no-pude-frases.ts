// =============================================================================
// no-pude-frases — el DETECTOR de las negativas legítimas del ticket automático (27/10/2026)
// =============================================================================
// Lo usa lib/no-pude.ts (`causaDelNoPude`): un «no» que es una REGLA de MaKo (confirmar en la tarjeta, el rol, una clave, lo que
// va en su pantalla) o una opinión («no puedo asegurarte…») no abre ticket. Corre sobre el texto SIN tildes de lo que dice el
// modelo o la persona: «confírmalo» del tuteo queda «confirmalo», y la persona puede escribir de vos («no tenés permiso»).
// Son palabras de lo que se RECONOCE, no copy: nada de acá se le muestra a nadie. Por eso este archivo está fuera de la guarda
// de voseo (tests/puente-panel-copy.test.ts, FUERA_DE_ALCANCE), como lib/onboarding-frases.ts, sin aflojarla para el resto.
//
// PURO y sin `server-only`.
// =============================================================================

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Las reglas de MaKo que dicen «no» sin que nada falle. */
const ES_REGLA = /\b(?:toca(?:r)? (?:la|su) tarjeta|en (?:la|su) tarjeta|lo confirmas?|confirmalo|confirmala|solo (?:el|la|un) (?:administrador|admin|duen[oa])|tu rol|su rol|no (?:tenes|tienes) permiso|por seguridad|en su pantalla|en tu pantalla|pantalla de revision|clave|token|contrasena|password)\b/;
/** La opinión: no es algo que MaKo intentó hacer. */
const ES_OPINION = /\bno (?:te )?(?:puedo|podria) (?:asegurar|garantizar|prometer|dejar pasar|recomendar|afirmar|confirmar que)\w*|^(?:asegurar|garantizar|prometer|dejar pasar|afirmar)\w*/;

/** ¿El «no» es una REGLA de MaKo o una opinión, no una falla? */
export const esReglaUOpinion = (texto: string): boolean => { const n = norm(texto); return ES_REGLA.test(n) || ES_OPINION.test(n); };
