'use server';

// =============================================================================
// /tickets — lo que hace el CLIENTE con sus tickets: levantarlo, leerlo y contestarlo
// =============================================================================
// Quién es sale de la SESIÓN, en el servidor (nunca de lo que mande el navegador): workspace, email y, con eso, la foto
// de su rol y su plan (lib/tickets-db.ts, `identidadDe`). Todo filtra por SU workspace y SU email: un usuario ve sólo
// sus tickets. Lo fija tests/tickets.test.ts.

import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { comentarComoCliente, crearTicket, identidadDe, misTickets, miTicket } from '@/lib/tickets-db';
import { paraElCliente, sanearAlta, type TicketCliente } from '@/lib/tickets-reglas';
import { contextoDeSoporte } from '@/lib/soporte-chat';

type Yo = { ws: number; email: string; nombre: string };
async function yo(): Promise<Yo | null> {
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s || !ws || !s.email?.includes('@')) return null;
  return { ws, email: s.email.trim().toLowerCase(), nombre: s.nombre ?? '' };
}

const SIN_SESION = 'Vuelve a entrar a MaKo para mandarlo';

/**
 * Levanta el ticket que armó el chat de Soporte de su Ticketera (23/10/2026, lib/soporte-chat.ts): lo que contó, con el título
 * de su primera oración. El tipo vale sólo si la persona lo eligió en la tarjeta (`elegido`); si no, lo lee el triage de sus
 * palabras, como en el servidor de siempre. Quién es, de la sesión; `movil` sólo dice por dónde (el canal que ve).
 * ⚠️ El contexto lo arma el SERVIDOR (`contextoDeSoporte`): del navegador, sólo lo que sabe de sí. Un `chat.hilo` de afuera
 *    hacía que la respuesta de Martín se escribiera en el chat de MaKo de OTRA persona (la revisión de Integración, 23/10/2026).
 */
export async function levantarDesdeSoporteAction(entrada: {
  tipo: string | null; elegido: boolean; titulo: string; descripcion: string; movil: boolean; contexto?: unknown; ref?: string;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const quien = await yo();
  if (!quien) return { ok: false, error: SIN_SESION };
  const a = sanearAlta({ tipo: entrada.elegido ? entrada.tipo : null, titulo: entrada.titulo, descripcion: entrada.descripcion });
  if (!a.ok) return { ok: false, error: a.motivo };
  const ref = typeof entrada.ref === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(entrada.ref) ? `soporte-chat:${entrada.ref}` : null;
  const r = await crearTicket({
    identidad: await identidadDe(quien.ws, quien.email, quien.nombre),
    tipo: a.alta.tipo, declaradoPor: a.alta.tipo ? 'persona' : null,
    titulo: a.alta.titulo, descripcion: a.alta.descripcion, canal: entrada.movil ? 'chat_movil' : 'chat_app', contexto: contextoDeSoporte(entrada.contexto, entrada.movil), ref,
  });
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}

/**
 * SUS tickets, para la Ticketera de su Ops Center (22/10/2026): la misma lectura que /tickets (lib/tickets-db.ts → misTickets),
 * con su workspace y su email de la SESIÓN. Nunca los de otra persona ni los de otro negocio, y sólo lo que ve el cliente
 * (`paraElCliente`: nada del triage, de la nota de Martín ni del Runner).
 */
export async function misTicketsAction(): Promise<{ ok: true; tickets: TicketCliente[] } | { ok: false; error: string; fueraDelPlan?: true }> {
  const quien = await yo();
  if (!quien) return { ok: false, error: 'Vuelve a entrar a MaKo para ver tus tickets' };
  // La puerta de /tickets (`requireRolWs(…, { nav: 'tickets' })`): un plan sin la tab no tiene Ticketera (la revisión, 22/10/2026).
  if (!tabEnCapa('tickets', await getCapaActual())) return { ok: false, error: 'Tu plan no incluye la Ticketera.', fueraDelPlan: true };
  const r = await misTickets(quien.ws, quien.email);
  if (!r.ok) return { ok: false, error: 'No pude leer tus tickets ahora: prueba en un rato.' };
  return { ok: true, tickets: r.datos.map((t) => paraElCliente(t)) };
}

/** Un ticket suyo, para el detalle (con la conversación). null = no es suyo o no existe. */
export async function verMiTicketAction(id: number): Promise<TicketCliente | null> {
  const quien = await yo();
  if (!quien || !Number.isInteger(id) || id <= 0) return null;
  const r = await miTicket(quien.ws, quien.email, id);
  return r ? paraElCliente(r.ticket, r.eventos) : null;
}

/** Contestar su ticket (cuando el equipo le preguntó algo, o para sumar un dato). */
export async function contestarTicketAction(id: number, texto: string): Promise<{ ok: true; ticket: TicketCliente | null } | { ok: false; error: string }> {
  const quien = await yo();
  if (!quien) return { ok: false, error: SIN_SESION };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'No encuentro ese ticket' };
  const r = await comentarComoCliente(quien.ws, quien.email, id, texto);
  if (!r.ok) return r;
  const t = await miTicket(quien.ws, quien.email, id);
  return { ok: true, ticket: t ? paraElCliente(t.ticket, t.eventos) : null };
}
