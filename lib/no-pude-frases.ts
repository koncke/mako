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

/**
 * Las reglas de MaKo que dicen «no» sin que nada falle. Con su forma de REGLA, no con la palabra suelta (la verificación del
 * 28/10/2026): «se confirma/se hace en tu pantalla» sí, «la puedes crear en tu pantalla» no; «pega tu clave» sí, «Meta devolvió un
 * error al leer el token» no.
 */
const ES_REGLA = /\b(?:toca(?:r)? (?:la|su|tu) tarjeta|(?:se|la|lo|las|los) (?:hace|hacen|confirma|confirman|cobra|cobran|borra|borran|aprueba|aprueban|revisa|revisan) (?:en|desde) (?:la|su|tu) (?:pantalla|tarjeta)|pantalla de revision|lo confirmas?|confirmalo|confirmala|solo (?:el|la|un) (?:administrador|admin|duen[oa])|(?:tu|su) rol no|no (?:tenes|tienes) permiso|(?:pega|pegá|carga|conecta|ingresa)\w* (?:tu|su) (?:clave|token|contrasena)|(?:mostrar|decir|compartir|pasar)\w* (?:la|tu|su) (?:clave|token|contrasena))\b/;
/** La opinión: no es algo que MaKo intentó hacer. */
const ES_OPINION = /\bno (?:te )?(?:puedo|podria) (?:asegurar|garantizar|prometer|dejar pasar|recomendar|afirmar|confirmar que)\w*|^(?:asegurar|garantizar|prometer|dejar pasar|afirmar)\w*/;

/** ¿El «no» es una REGLA de MaKo o una opinión, no una falla? */
export const esReglaUOpinion = (texto: string): boolean => { const n = norm(texto); return ES_REGLA.test(n) || ES_OPINION.test(n); };

/**
 * ¿El runner se TRAGÓ una excepción y la devolvió como ok:false? (la verificación del 28/10/2026). Los `sinLanzar` de las áreas, el
 * catch general de las acciones de WhatsApp (`ejecutarAccion`) o agendar dicen «No se pudo aplicar (Error guardando setting …).» o
 * «No pude ejecutarlo (… fetch failed).»: el error entre paréntesis. Una negativa de estado o de configuración no lo lleva («Esa
 * decisión ya no estaba abierta.», «El email dejó de estar conectado…»).
 */
const FALLA_TRAGADA = /^\s*(?:❌\s*)?no (?:se )?pud[oe] [^()]{0,80}\((?!\s*\))[^)]{2,}\)\.?\s*$/;
export const esFallaTragada = (resumen: string): boolean => { const n = norm(resumen); return FALLA_TRAGADA.test(n) && !esReglaUOpinion(n); };
