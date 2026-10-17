// =============================================================================
// doer-ticket — lo que el doer de WhatsApp le pone a un ticket al equipo de MaKo (puro)
// =============================================================================
// La Ticketera (17/10/2026) sumó `levantar_ticket` al registro, con canal WhatsApp. El doer le pasa dos cosas que el
// modelo NO escribe (lib/api-mako/areas/tickets.def.ts): QUIÉN escribe (`ctx.actor`) y el contexto del turno
// (`ctx.contextoTicket`, con el error que registró el código). Acá vive lo primero, para poder probarlo.
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/mako-en-whatsapp-pablo.test.ts.
// =============================================================================

/**
 * Quién escribió en el grupo, como lo lee `preparar()` de la Ticketera: `whatsapp:+<teléfono>` cuando el remitente es un
 * teléfono, y `whatsapp:<nombre>` (el pushName) cuando no lo es. Lo acordado el 17/10: el doer no sabe el EMAIL de quien
 * escribe (`mako_doer_conv` no guarda autor, mig 0086), y la Ticketera busca un usuario con ese teléfono o se queda con él.
 *
 * ⚠️ Un `@lid` NO es un teléfono: es el identificador anónimo que WhatsApp usa en algunos grupos. Leerlo como número
 * le pondría al ticket un teléfono que no existe; ahí va el nombre.
 */
export function actorDeWhatsApp(participant: string | null | undefined, pushName: string | null | undefined): string | undefined {
  const jid = (participant ?? '').trim();
  const tel = /^(\d{8,15})(?::\d+)?@(?:s\.whatsapp\.net|c\.us)$/.exec(jid)?.[1];
  if (tel) return `whatsapp:+${tel}`;
  const nombre = (pushName ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return nombre ? `whatsapp:${nombre}` : undefined;
}

/**
 * Lo que el CÓDIGO le agrega a la respuesta cuando una herramienta de MaKo falló y dejó propuesto el ticket. El ticket es
 * una pendiente («sí» la manda, lib/mako-pendientes.ts), y el modelo no sabe que existe: si no se dice, nadie la ve.
 * Termina pidiendo el «sí» para que el saneo de la salida no la lea como promesa (lib/doer-salida.ts).
 */
export const LINEA_TICKET_PROPUESTO = 'Esto falló de nuestro lado. ¿Se lo aviso al equipo de MaKo para que lo arreglen? Responde «sí» y lo mando.';
