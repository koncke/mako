// =============================================================================
// dictado-error — lo que lee la persona cuando una nota de voz no se pudo transcribir (22/10/2026)
// =============================================================================
// /api/plan-dictado devolvía el error de la cascada tal cual. Desde el 21/10 la nota es un dato de un cliente (`pii`: la
// red gratis no la escucha) y la lee también el CLIENTE en el chat del teléfono: la prueba de los chats lo encontró
// diciendo «transcribirAudio — ninguna IA pudo: red gratis salteada…». Puro (tests/chats-fallas-2210.test.ts); aparte de
// la ruta porque un route.ts de Next sólo exporta sus métodos y su configuración.
// =============================================================================

import { MARCA_EL_DE_MAKO } from './nota-de-voz-de-mako';

/** Sin ninguna IA que pueda escucharla (la red gratis no escucha datos de clientes): lo mismo que dice el chat sin IA. */
export const SIN_OIDO = 'Para escuchar tu nota de voz necesito una IA conectada. Conecta la tuya o escríbemelo.';
/** Cualquier otra falla al transcribir: qué hacer, sin el detalle de la cascada (ese va al log). */
export const NO_PUDE_ESCUCHAR = 'No pude escuchar la nota de voz. Grábala de nuevo o escríbemelo.';

/**
 * Lo que LEE la persona cuando la nota no se pudo transcribir. El error de la cascada viajaba tal cual («transcribirAudio —
 * ninguna IA pudo: red gratis salteada: el audio es de un cliente…»), y desde el 21/10 lo lee también el CLIENTE en el
 * chat del teléfono (22/10/2026, la prueba de los chats). «ninguna IA pudo» es que no hay con quién escuchar: se le dice
 * como el chat («Conecta la tuya»; el botón ya está en la caja: «Conectar tu Claude», app/second-brain/PiezasCliente.tsx);
 * lo demás, que lo grabe de nuevo.
 * Desde el 20/11/2026, sin IA propia la escucha el Whisper de MaKo (lib/nota-de-voz-de-mako.ts): SIN_OIDO queda para cuando no
 * hubo NI ésa. Si la de MaKo probó y falló (sus errores van con `MARCA_EL_DE_MAKO`), que la grabe de nuevo; y sin MaKo Tokens, lo
 * que dice el medidor (lib/mako-tokens-medidor.ts), con sus dos salidas.
 */
export function errorDeDictado(msg: string): string {
  const sinSaldo = /Te quedaste sin MaKo Tokens[^]*$/.exec(msg);
  if (sinSaldo) return sinSaldo[0];
  return /ninguna IA pudo/i.test(msg) && !msg.includes(MARCA_EL_DE_MAKO) ? SIN_OIDO : NO_PUDE_ESCUCHAR;
}
