'use server';

// =============================================================================
// La bandeja de Martín (Linear Triage): leer, decidir, corregir el triage, y el interruptor del arreglo automático
// =============================================================================
// ⚠️ TODA acción pasa por `puedeOperar` (lib/operaciones-reglas.ts): admin global + workspace de la plataforma + sesión
// con fila + segundo factor. Es la misma puerta que Ops Center, donde vive esta bandeja (AGENTS.md, «El Centro de
// Operaciones es una puerta a la PC de Martín»). Lo fija tests/tickets.test.ts.
// ⚠️ Lo que va al Cerebro NO sale de acá: lo firma el navegador de Martín (`useFirma`, app/admin/operaciones/mandar.ts)
// y acá sólo se anota el id del trabajo firmado (`anotarDespachoAction`).

import { after } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { puedeOperar } from '@/lib/operaciones-reglas';
import {
  autoArregloApagado, bandeja, cambiarPrioridad, conChatDeLosTickets, corregirTipo, cuantosEsperan, decidir, ponerAutoArreglo, ticketEntero,
  type EntradaDecision, type Evento, type FilaTicket,
} from '@/lib/tickets-db';
import { avisarTicket } from '@/lib/tickets-cierre';
import type { Prioridad, TipoTicket } from '@/lib/tickets-reglas';
import { getSupabaseServer } from '@/lib/supabase';
import { getVistaTicketera, setVistaTicketera, type VistaTicketera } from '@/lib/perfil';

const NO_PUEDE = 'Entra con tu segundo factor para usar la Ticketera.';
async function opera(): Promise<boolean> {
  return puedeOperar(await getSesionAdmin(), await wsSuperAdmin());
}

export type LecturaBandeja = { ok: true; tickets: FilaTicket[]; autoArreglo: boolean; vista: VistaTicketera } | { ok: false; error: string; faltaTabla?: boolean };

/** `conVista`: la primera lectura trae también la vista que eligió la persona (mazo o tabla); los refrescos, no. */
export async function leerBandejaAction(conVista = false): Promise<LecturaBandeja> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  const [r, apagado, vista] = await Promise.all([bandeja(), autoArregloApagado(), conVista ? getVistaTicketera() : Promise.resolve<VistaTicketera>('mazo')]);
  if (!r.ok) return { ok: false, error: r.faltaTabla ? 'Falta aplicar la migración 0311 (la tabla de tickets).' : r.error, faltaTabla: r.faltaTabla };
  // Con el chat donde falló MaKo (DÓNDE, 23/10/2026).
  return { ok: true, tickets: await conChatDeLosTickets(r.datos), autoArreglo: !apagado, vista };
}

/** La vista que eligió (mazo o tabla), en SU perfil: la misma en la computadora y en el teléfono. */
export async function guardarVistaAction(v: VistaTicketera): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  try { await setVistaTicketera(v); return { ok: true }; } catch { return { ok: false, error: 'No pude recordar la vista' }; }
}

export async function verTicketBandejaAction(id: number): Promise<{ ok: true; ticket: FilaTicket; eventos: Evento[] } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  const r = await ticketEntero(id);
  return r ? { ok: true, ...r } : { ok: false, error: 'No encuentro ese ticket' };
}

/** Martín decide. Si la decisión le cambia algo al cliente (lo cierra o le pregunta), el aviso sale después de responder. */
export async function decidirTicketAction(id: number, d: EntradaDecision): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  const r = await decidir(id, { ...d, pedidoId: null }, 'martin');
  if (!r.ok) return r;
  if (r.estado !== 'en_curso') after(() => avisarTicket(id).then(() => undefined).catch(() => undefined));
  return { ok: true };
}

/** El trabajo firmado que salió al Cerebro: se anota en el ticket (y su historial) para que se vea que llegó. */
export async function anotarDespachoAction(id: number, pedidoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return { ok: false, error: 'Trabajo inválido' };
  const ahora = new Date().toISOString();
  const db = getSupabaseServer();
  const { data, error } = await db.from('tickets').update({ despacho: 'firmado', pedido_id: pedidoId, despachado_at: ahora, updated_at: ahora })
    .eq('id', id).eq('estado', 'en_curso').select('id');
  if (error || !data?.length) return { ok: false, error: 'No pude anotarlo en el ticket' };
  await db.from('ticket_eventos').insert({ ticket_id: id, actor: 'martin', tipo: 'despachado', texto: null, datos: { pedido: pedidoId } });
  return { ok: true };
}

export async function corregirTipoAction(id: number, tipo: TipoTicket): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  return corregirTipo(id, tipo, 'martin');
}

export async function cambiarPrioridadAction(id: number, prioridad: Prioridad): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  return cambiarPrioridad(id, prioridad, 'martin');
}

/** El interruptor «Arreglar solos los bugs evidentes» (AGENTS.md: lo que decide solo se tiene que poder apagar). */
export async function autoArregloAction(prendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await opera())) return { ok: false, error: NO_PUEDE };
  try { await ponerAutoArreglo(prendido); return { ok: true }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo' }; }
}

/** Cuántos tickets esperan a Martín: el número del botón «Ticketera» de Ops Center. null = no se pudo contar. */
export async function cuantosEsperanAction(): Promise<number | null> {
  if (!(await opera())) return null;
  return cuantosEsperan();
}
