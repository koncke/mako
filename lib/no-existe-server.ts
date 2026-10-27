// =============================================================================
// no-existe-server — el pedido de lo que no existe, a la Ticketera, sin preguntar (27/10/2026)
// =============================================================================
// La regla y la marca: lib/no-existe.ts. Acá, lo que escribe: un PEDIDO (`tipo: 'pedido'`, `noExiste`) que MaKo declaró, con
// lo que la persona pidió y lo que contestó MaKo, el chat y la pantalla. Lo hace el código, no el modelo: no se le pide un
// «sí» porque no hay nada que confirmar, y el mismo pedido en el mismo chat es UN ticket (`refDeNoExiste`).
// Nunca tira: un pedido que no se pudo levantar no le rompe la respuesta a nadie (queda en el log).
// =============================================================================

import 'server-only';
import { crearTicket, identidadDe, identidadDelActor } from './tickets-db';
import type { Canal } from './tickets-reglas';
import { lineaDelPedido, refDeNoExiste, sacarNoExiste } from './no-existe';

export type DondeNoExiste = {
  ws: number;
  /** Quién habla: un email (la app) o `whatsapp:…` (el grupo), como lo lee la Ticketera. */
  actor: string;
  nombre?: string;
  /** El chat, para el ticket y la idempotencia: 'ops-center', 'automations', 'offer', 'web-generator'… */
  chat: string;
  /** La pantalla donde estaba (la ruta), si se sabe. */
  ruta?: string;
  canal?: Canal;
  /** Lo que la persona escribió en ese turno. */
  pedido: string;
};

/** Levanta el pedido de `falta`. El número del ticket, o null si no se pudo (sin tirar). */
export async function ticketDeNoExiste(falta: string, d: DondeNoExiste): Promise<number | null> {
  try {
    const identidad = d.actor.includes('@') ? await identidadDe(d.ws, d.actor, d.nombre ?? '') : await identidadDelActor(d.ws, d.actor);
    if (!identidad) return null;
    const creado = await crearTicket({
      identidad, tipo: 'pedido', declaradoPor: 'mako',
      titulo: falta,
      descripcion: [`Lo pidió en el chat de MaKo (${d.chat}) y MaKo le dijo que todavía no existe.`, d.pedido.trim() ? `Pidió: «${d.pedido.trim().slice(0, 1200)}»` : ''].filter(Boolean).join('\n'),
      canal: d.canal ?? 'chat_app',
      contexto: { pedido: d.pedido.slice(0, 2000), noExiste: true, chat: { donde: d.chat }, ...(d.ruta ? { ruta: d.ruta } : {}) },
      ref: refDeNoExiste(d.ws, d.chat, falta),
    });
    if (!creado.ok) { console.error(`[no-existe] ws=${d.ws} ${d.chat}: no pude levantar «${falta}»: ${creado.error}`); return null; }
    return creado.id;
  } catch (e) {
    console.error(`[no-existe] ws=${d.ws} ${d.chat}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Lo mismo, para un chat que no tiene a mano quién habla: el workspace y la persona salen de la SESIÓN del pedido. Sin sesión
 * (o sin workspace), la marca se saca igual y no se levanta nada.
 */
export async function conPedidoDeNoExisteDeLaSesion(respuesta: string, d: Omit<DondeNoExiste, 'ws' | 'actor' | 'nombre'>): Promise<{ texto: string; falta: string | null; linea: string | null }> {
  const { getWorkspaceActual } = await import('./workspace');
  const { getUsuarioActual } = await import('./auth');
  const [ws, sesion] = await Promise.all([getWorkspaceActual().catch(() => null), getUsuarioActual().catch(() => null)]);
  if (ws == null || !sesion?.email) return { ...sacarNoExiste(respuesta), linea: null };
  return conPedidoDeNoExiste(respuesta, { ...d, ws, actor: sesion.email, nombre: sesion.nombre ?? '' });
}

/**
 * Lo que sale de un chat: el texto sin la marca y, si marcó algo que no existe, el pedido ya levantado y la línea que lo dice
 * (la escribe el código). `linea` es null si no hubo marca o no se pudo levantar.
 */
export async function conPedidoDeNoExiste(respuesta: string, d: DondeNoExiste): Promise<{ texto: string; falta: string | null; linea: string | null }> {
  const { texto, falta } = sacarNoExiste(respuesta);
  if (!falta) return { texto, falta: null, linea: null };
  const id = await ticketDeNoExiste(falta, d);
  return { texto, falta, linea: id ? lineaDelPedido(id) : null };
}
