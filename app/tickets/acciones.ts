'use server';

// =============================================================================
// /tickets — lo que hace el CLIENTE con sus tickets: levantarlo, leerlo y contestarlo
// =============================================================================
// Quién es sale de la SESIÓN, en el servidor (nunca de lo que mande el navegador): workspace, email y, con eso, la foto
// de su rol y su plan (lib/tickets-db.ts, `identidadDe`). Todo filtra por SU workspace y SU email: un usuario ve sólo
// sus tickets. Lo fija tests/tickets.test.ts.

import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { comentarComoCliente, crearTicket, identidadDe, miTicket } from '@/lib/tickets-db';
import { paraElCliente, sanearAlta, type TicketCliente } from '@/lib/tickets-reglas';

type Yo = { ws: number; email: string; nombre: string };
async function yo(): Promise<Yo | null> {
  const s = await getUsuarioActual();
  const ws = await getWorkspaceActual();
  if (!s || !ws || !s.email?.includes('@')) return null;
  return { ws, email: s.email.trim().toLowerCase(), nombre: s.nombre ?? '' };
}

const SIN_SESION = 'Vuelve a entrar a MaKo para mandarlo';

/** Levanta un ticket desde «Reportar problema». `ref` es la clave de idempotencia del navegador (un doble clic). */
export async function levantarTicketAction(entrada: { tipo: string | null; texto: string; contexto?: unknown; ref?: string }): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const quien = await yo();
  if (!quien) return { ok: false, error: SIN_SESION };
  const a = sanearAlta({ tipo: entrada.tipo, descripcion: entrada.texto });
  if (!a.ok) return { ok: false, error: a.motivo };
  const ref = typeof entrada.ref === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(entrada.ref) ? `form:${entrada.ref}` : null;
  const r = await crearTicket({
    identidad: await identidadDe(quien.ws, quien.email, quien.nombre),
    tipo: a.alta.tipo, declaradoPor: a.alta.tipo ? 'persona' : null,
    titulo: a.alta.titulo, descripcion: a.alta.descripcion, canal: 'formulario', contexto: entrada.contexto, ref,
  });
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
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
