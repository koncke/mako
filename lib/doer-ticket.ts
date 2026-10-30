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
 * El TELÉFONO de quien escribió en el grupo, como lo manda WhatsApp (`participant`), o null. Un `@lid` no es un teléfono (ver
 * abajo). Lo usan el ticket y la computadora del dueño (25/10/2026: el grupo del dueño contesta con su PC si el que escribe es
 * quien la conectó, y la prueba es este teléfono contra su perfil, en la puerta: `encolarTurno` con `delGrupo`, lib/ia-pc.ts).
 */
export function telefonoDelParticipante(participant: string | null | undefined): string | null {
  return /^(\d{8,15})(?::\d+)?@(?:s\.whatsapp\.net|c\.us)$/.exec((participant ?? '').trim())?.[1] ?? null;
}

/**
 * Quién escribió en el grupo, como lo lee `preparar()` de la Ticketera: `whatsapp:+<teléfono>` cuando el remitente es un
 * teléfono, y `whatsapp:<nombre>` (el pushName) cuando no lo es. Lo acordado el 17/10: el doer no sabe el EMAIL de quien
 * escribe (`mako_doer_conv` no guarda autor, mig 0086), y la Ticketera busca un usuario con ese teléfono o se queda con él.
 *
 * ⚠️ Un `@lid` NO es un teléfono: es el identificador anónimo que WhatsApp usa en algunos grupos. Leerlo como número
 * le pondría al ticket un teléfono que no existe; ahí va el nombre.
 */
export function actorDeWhatsApp(participant: string | null | undefined, pushName: string | null | undefined): string | undefined {
  const tel = telefonoDelParticipante(participant);
  if (tel) return `whatsapp:+${tel}`;
  const nombre = (pushName ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return nombre ? `whatsapp:${nombre}` : undefined;
}

// Lo que el CÓDIGO le agrega a la respuesta cuando algo falló y quedó un ticket vive desde el 27/10/2026 en lib/no-pude.ts
// (`lineaDelTicket`, `LINEA_YA_AVISADO`): la misma línea en todos los chats, con el número. El aviso de arreglado sigue
// llegando solo, firmado por el Desarrollador (lib/aviso-arreglo.ts).
