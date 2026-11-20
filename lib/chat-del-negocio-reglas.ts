// =============================================================================
// LOS CHATS DEL NEGOCIO, MIRANDO COMO ADMINISTRADOR (20/11/2026, decidido por el Cerebro con la D7: «mirando como administrador se ve
// LO MISMO que ve el cliente»)
// =============================================================================
// Mirando un negocio, la lista de chats y su lectura son las del DUEÑO (su `chart_key`), no las del administrador: antes, mirando el ws 3
// o el ws 11, la lista era la del administrador y el chat «Onboarding» del dueño no estaba. Para ESCRIBIR, `escribeComoElCliente(ws)`:
// en los negocios de prueba (ws 3 y 9) se escribe como el dueño; en el negocio de un cliente la caja queda en lectura, con
// `AVISO_SOLO_LECTURA`. Nunca se escribe como el administrador dentro de la lista del cliente.
// Puro: lo usa lib/chat-del-negocio.ts y lo fija tests/chat-del-negocio.test.ts.
// =============================================================================

export const AVISO_SOLO_LECTURA = 'Estás mirando como administrador: aquí sólo lees.';

export type ChatDelNegocio = {
  /** De quién son los chats que se listan y se leen: de quien mira (su cuenta, o un negocio de prueba sin dueño) o del dueño. */
  de: 'quien-mira' | 'dueno';
  /** La caja en lectura: no se escribe, ni se crea, renombra o confirma nada. */
  soloLectura: boolean;
};

/**
 * Sin mirar, los de quien mira y se escribe. Mirando, los del dueño (si el negocio tiene), y se escribe sólo si
 * `escribeComoElCliente` (los negocios de prueba). Un negocio de prueba sin dueño: los de quien mira, que hace de cliente.
 */
export function chatDelNegocio(o: { mirando: boolean; hayDueno: boolean; escribeComoElCliente: boolean }): ChatDelNegocio {
  if (!o.mirando) return { de: 'quien-mira', soloLectura: false };
  return { de: o.hayDueno ? 'dueno' : 'quien-mira', soloLectura: !o.escribeComoElCliente };
}
