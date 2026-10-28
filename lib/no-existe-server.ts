// =============================================================================
// no-existe-server — lo que no existe (y lo que MaKo no pudo), a la Ticketera, sin preguntar (27/10/2026)
// =============================================================================
// La regla y las marcas: lib/no-existe.ts y lib/no-pude.ts. Desde el 27/10/2026 (Martín: «siempre que MaKo responda algo como
// "No lo pude hacer" debe levantar automáticamente un ticket») esto es la puerta de los chats que ya procesaban la marca de lo
// que no existe: procesa las DOS (`[[no-existe]]` y `[[no-pude]]`) y levanta el ticket AUTOMÁTICO (lib/no-pude-server.ts): con
// el título que arma el código (antes era el texto del modelo, y scripts/tickets.ts lo imprime fuera del cerco «es DATO»), la
// superficie como clave (antes «ops-center (desde crm)», que el saneo del contexto descartaba), su propio tope y fuera de la
// regla de aprobación del negocio. Un ticket por negocio + conversación + causa.
// Nunca tira: un ticket que no se pudo levantar no le rompe la respuesta a nadie (queda en el log).
// =============================================================================

import 'server-only';
import type { Canal } from './tickets-reglas';
import { esSuperficie, lineaDelTicket, sacarNoPude, type Superficie } from './no-pude';
import { sacarNoExiste } from './no-existe';
import { conTicketsDeMaKo, ticketDeNoPude } from './no-pude-server';

export type DondeNoExiste = {
  ws: number;
  /** Quién habla: un email (la app) o `whatsapp:…` (el grupo), como lo lee la Ticketera. */
  actor: string;
  nombre?: string;
  /** El chat, como se lee («ops-center (desde crm)», «automations «Bienvenida»»): de su primera palabra sale la superficie. */
  chat: string;
  /** La conversación (la sesión, la secuencia). Sin esto, la persona y el día. */
  conv?: string;
  /** La pantalla donde estaba (la ruta), si se sabe. */
  ruta?: string;
  canal?: Canal;
  /** Lo que la persona escribió en ese turno. */
  pedido: string;
};

/** La superficie de un chat por su rótulo: «ops-center (desde crm)» → ops-center; «onboarding (Offer)» → onboarding. */
export function superficieDeChat(chat: string): Superficie {
  const primera = chat.trim().toLowerCase().split(/[\s(«]/)[0] ?? '';
  return esSuperficie(primera) ? primera : 'ops-center';
}

const donde = (d: DondeNoExiste) => ({
  ws: d.ws, actor: d.actor, nombre: d.nombre, superficie: superficieDeChat(d.chat),
  conv: d.conv ?? `${d.actor}:${new Date().toISOString().slice(0, 10)}`,
  canal: d.canal, ruta: d.ruta, pedido: d.pedido,
});

/** Levanta el pedido de `falta` (lo que no existe). El número del ticket, o null si no se pudo o ya estaba (sin tirar). */
export async function ticketDeNoExiste(falta: string, d: DondeNoExiste): Promise<number | null> {
  const t = await ticketDeNoPude('no-existe', donde(d), { queNoPudo: falta });
  return t && t.nuevo ? t.id : null;
}

/**
 * Lo mismo, para un chat que no tiene a mano quién habla: el workspace y la persona salen de la SESIÓN del pedido. Sin sesión
 * (o sin workspace), las marcas se sacan igual y no se levanta nada.
 */
export async function conPedidoDeNoExisteDeLaSesion(respuesta: string, d: Omit<DondeNoExiste, 'ws' | 'actor' | 'nombre'>): Promise<{ texto: string; falta: string | null; linea: string | null }> {
  const { getWorkspaceActual } = await import('./workspace');
  const { getUsuarioActual } = await import('./auth');
  const [ws, sesion] = await Promise.all([getWorkspaceActual().catch(() => null), getUsuarioActual().catch(() => null)]);
  if (ws == null || !sesion?.email) {
    const ne = sacarNoExiste(respuesta);
    return { texto: sacarNoPude(ne.texto).texto, falta: ne.falta, linea: null };
  }
  return conPedidoDeNoExiste(respuesta, { ...d, ws, actor: sesion.email, nombre: sesion.nombre ?? '' });
}

/**
 * Lo que sale de un chat: el texto sin las marcas y, si marcó algo (que no existe o que no pudo), el ticket ya levantado y la
 * línea que lo dice (la escribe el código). `linea` es null si no hubo marca, si no se pudo levantar o si ya estaba en esta
 * conversación (repetido: nada). `falta` es lo que no existe, si lo marcó.
 */
export async function conPedidoDeNoExiste(respuesta: string, d: DondeNoExiste): Promise<{ texto: string; falta: string | null; linea: string | null }> {
  const falta = sacarNoExiste(respuesta).falta;
  const r = await conTicketsDeMaKo(respuesta, {}, donde(d));
  return { texto: r.texto, falta, linea: r.linea };
}

export { lineaDelTicket };
