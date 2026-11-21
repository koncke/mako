// =============================================================================
// LA NOTA DE VOZ DE UN CLIENTE SIN IA PROPIA LA ESCUCHA EL WHISPER DE MAKO (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción: «el usuario debería poder enviar audios independientemente de si tiene la IA
// conectada o no, porque para eso ya usamos los MaKo Tokens». Una nota de voz es un dato de un cliente (`pii`), así que
// `transcribirAudio` (lib/ai-cheap.ts) salta la red GRATIS (el Gemini gratis entrena con lo que recibe). Sin una clave del negocio
// no quedaba nadie: «Para escuchar tu nota de voz necesito una IA conectada» en todas las cajas con micrófono.
// Decidido por el Cerebro: sin IA propia, la escucha el Whisper de MaKo (el Groq de la plataforma, el de las notas de WhatsApp: no
// entrena con lo que recibe) y la paga el cupo de MaKo Tokens, como el texto (el medidor cobra lo que no paga una clave del negocio).
// Puro, para probarlo sin la cascada (tests/nota-de-voz-con-mako.test.ts).
// =============================================================================

/** La marca de los errores del Whisper de MaKo: con ella, «ninguna IA pudo» es que FALLÓ, no que no había con quién (lib/dictado-error.ts). */
export const MARCA_EL_DE_MAKO = 'el de MaKo · ';

/**
 * ¿La nota la escucha el Whisper de MaKo? Sólo cuando el negocio NO TIENE NINGUNA clave (`sinClavesDelNegocio`): con una suya, sólo
 * la suya, y si falla se le dice que no se pudo escuchar (el Cerebro, 20/11: «el Whisper de MaKo entra únicamente cuando el negocio
 * no tiene ninguna, nunca además»; mezclarlas lo marcó tests/ia16-cada-uno-su-ia.test.ts). Y sólo una nota de voz de un cliente
 * (`pii`), nunca un audio que no es nota (`sinGroq`: el de un anuncio), ni la del grupo (ésa lo escucha PRIMERO, `notaDeVozDelGrupo`),
 * ni con D6b (`soloSuIA`: el negocio corre con su Claude o su GPT, y eso es una regla de privacidad suya).
 */
export function escuchaElDeMaKoAlFinal(o: { pii?: boolean; sinGroq?: boolean; notaDeVozDelGrupo?: boolean; soloSuIA: boolean; sinClavesDelNegocio: boolean }): boolean {
  return !!o.pii && o.sinClavesDelNegocio && !o.sinGroq && !o.notaDeVozDelGrupo && !o.soloSuIA;
}
