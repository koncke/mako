// =============================================================================
// chats-links — las formas de abrir UNA conversación de la tab Chats desde afuera
// =============================================================================
// Los links profundos de docs/diseno-chats.md §4, escritos en un lugar: los arma quien manda a
// /chats (el aviso de mensaje nuevo, la ficha del lead, MaKo) y los resuelve ChatsApp contra la
// lista. Un link que no matchea NO abre otra conversación: espera a la próxima lectura y, si no
// aparece, no selecciona nada (la trampa del `?lead=` de la bandeja vieja de /whatsapp, que abría
// el primer chat de la lista).
//
// Son RUTAS, sin el `?ws=`: lo pone quien navega (app/_ui/Link, el router de app/_ui/Link, o
// `linkApp` si el link sale en un mensaje). AGENTS.md «cinco formas de navegar».
//
// Puro: sin server-only, lo importan el cliente (NotificationsProvider) y el server.
// =============================================================================

export const RUTA_CHATS = '/chats';

/** Los parámetros que lee ChatsApp. */
export const PARAM_CHATS = { clave: 'c', lead: 'lead', linea: 'linea', chat: 'chat', vista: 'vista' } as const;

/** La conversación de un lead (`lead:<id>`): junta todos sus canales. */
export const rutaChatsDeLead = (leadId: number): string => `${RUTA_CHATS}?${PARAM_CHATS.lead}=${leadId}`;

/**
 * UNA BANDEJA (`?vista=`), hoy sólo «Borradores»: a donde lleva «N mensajes esperando que los apruebes» de una
 * automatización (lib/mensajes-por-aprobar.ts, 20/10/2026). ChatsApp la pone en el filtro, con «Mostrar: Todas» (un
 * borrador de una conversación cerrada también espera), y saca el parámetro de la URL: después el filtro es de quien
 * lo toca. Una vista que no está acá no hace nada.
 */
export const VISTAS_CON_LINK = ['borradores'] as const;
export type VistaConLink = (typeof VISTAS_CON_LINK)[number];
export const rutaChatsDeVista = (v: VistaConLink): string => `${RUTA_CHATS}?${PARAM_CHATS.vista}=${v}`;
export const vistaDeLink = (raw: string | null | undefined): VistaConLink | null =>
  VISTAS_CON_LINK.find((v) => v === raw?.trim()) ?? null;

/** Una conversación por su clave (`lead:12`, `wa:<linea>:<tel>`, `ig:<id>`, `fb:<id>`). */
export const rutaChatsDeClave = (clave: string): string => `${RUTA_CHATS}?${PARAM_CHATS.clave}=${encodeURIComponent(clave)}`;

/**
 * El chat de WhatsApp de una línea: el contacto cuya identidad tiene ese jid en esa línea. Sin la
 * línea (una sola conectada) busca el jid en cualquiera. `n` cambia la URL aunque ya estés en ese
 * chat, para que el clic en un aviso se note.
 */
export function rutaChatsDeWhatsapp(linea: string | null, chatJid: string, n?: number): string {
  const q = new URLSearchParams();
  if (linea) q.set(PARAM_CHATS.linea, linea);
  q.set(PARAM_CHATS.chat, chatJid);
  if (n != null) q.set('n', String(n));
  return `${RUTA_CHATS}?${q.toString()}`;
}
