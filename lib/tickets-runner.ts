import 'server-only';

// =============================================================================
// El bug del triage le llega SOLO al Cerebro — lo que el servidor le da al Runner en su vuelta, y el acuse
// =============================================================================
// Las reglas, en lib/tickets-aviso.ts. Esto lo llama la vuelta del cartero (lib/operaciones.ts → cicloCartero), igual
// que los avisos de la Ticketera vieja: el Runner de la cuenta donde está ABIERTO el chat «Cerebro» reclama los bugs del
// triage que no se entregaron, y le escribe al Cerebro un texto fijo con el número (scripts/operaciones/cartero.mjs).
// Cada uno se reclama con compare-and-set sobre el intento anterior: dos vueltas (o dos Runners) no lo entregan dos veces.

import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import type { ChatCartero } from './operaciones-reglas';
import { ENTREGA_MAX_INTENTOS, ENTREGA_TOMADO_VENCE_MS, TICKETS_POR_VUELTA, VERSION_CARTERO_TICKETS, esElCerebro, necesitaEntrega, versionAlMenos, type FilaEntrega } from './tickets-aviso';

const T = 'tickets';

/** Lo que el Runner entrega: el id del intento (va al acuse), el número del ticket y a qué sesión. */
export type TicketParaEntregar = { id: string; numero: number; destino: string };

/**
 * Los bugs del triage que ESTE Runner tiene que entregarle al Cerebro ahora. Sólo si el chat «Cerebro» está abierto en
 * SU cuenta y lo alcanza (`entregables`), y sólo si el Runner es de una versión que los entiende: uno de antes los
 * dejaría tomados sin entregar y se quemarían los intentos.
 */
export async function ticketsParaElCartero(
  version: string | null, chatsDeEste: readonly ChatCartero[], entregables: ReadonlySet<string>, ahoraIso: string,
): Promise<TicketParaEntregar[]> {
  if (!versionAlMenos(version, VERSION_CARTERO_TICKETS)) return [];
  const cerebro = chatsDeEste.find((c) => c.vivo && esElCerebro(c.titulo) && entregables.has(c.local));
  if (!cerebro) return [];
  const db = getSupabaseServer();
  const { data: filas, error } = await db.from(T)
    .select('id, estado, despacho, aviso_id, aviso_estado, aviso_at, aviso_intentos')
    .eq('despacho', 'runner').eq('estado', 'en_curso').lt('aviso_intentos', ENTREGA_MAX_INTENTOS)
    .order('created_at', { ascending: true }).limit(50);
  if (error) throw new Error(error.message);
  const ahora = Date.parse(ahoraIso);
  const out: TicketParaEntregar[] = [];
  for (const f of filas ?? []) {
    const fila: FilaEntrega = {
      estado: f.estado as string, despacho: f.despacho as string | null, avisoEstado: (f.aviso_estado as FilaEntrega['avisoEstado']) ?? null,
      avisoAt: (f.aviso_at as string | null) ?? null, avisoIntentos: Number(f.aviso_intentos) || 0,
    };
    if (!necesitaEntrega(fila, ahora)) continue;
    const id = randomUUID();
    let q = db.from(T).update({
      aviso_id: id, aviso_estado: 'tomado', aviso_at: ahoraIso, aviso_intentos: fila.avisoIntentos + 1, aviso_motivo: null,
    }).eq('id', f.id).eq('estado', 'en_curso');
    q = f.aviso_id ? q.eq('aviso_id', f.aviso_id as string) : q.is('aviso_id', null);
    const { data, error: eUp } = await q.select('id');
    if (eUp) throw new Error(eUp.message);
    if (data && data[0]) out.push({ id, numero: Number(f.id), destino: cerebro.local });
    if (out.length >= TICKETS_POR_VUELTA) break;
  }
  return out;
}

/**
 * Cuántos bugs del triage esperan que un Runner se los lleve al Cerebro: el MISMO criterio de `necesitaEntrega`, en una
 * consulta (lo pide `hayParaElCartero` cada pocos segundos). Lo tomado hace menos de 2 h no cuenta: ya está en camino.
 */
export async function ticketsSinEntregar(ahora = Date.now()): Promise<number> {
  const vence = new Date(ahora - ENTREGA_TOMADO_VENCE_MS).toISOString();
  const { count, error } = await getSupabaseServer().from(T).select('id', { count: 'exact', head: true })
    .eq('despacho', 'runner').eq('estado', 'en_curso').lt('aviso_intentos', ENTREGA_MAX_INTENTOS)
    .or(`aviso_estado.is.null,aviso_estado.in.(no_entregado,incierto),and(aviso_estado.eq.tomado,aviso_at.lt.${vence})`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** El acuse de una entrega (por el id del intento). Devuelve cuántos tocó: 0 = no era de un ticket. */
export async function acusarTicket(a: { id: string; estado: 'entregado' | 'no_entregado' | 'incierto'; motivo: string | null }, ahoraIso: string): Promise<number> {
  const db = getSupabaseServer();
  const { data } = await db.from(T).update({
    aviso_estado: a.estado, aviso_motivo: a.motivo, aviso_at: ahoraIso,
    ...(a.estado === 'entregado' ? { despachado_at: ahoraIso } : {}),
  }).eq('aviso_id', a.id).eq('aviso_estado', 'tomado').select('id');
  for (const f of data ?? []) {
    await db.from('ticket_eventos').insert({ ticket_id: f.id, actor: 'sistema', tipo: a.estado === 'entregado' ? 'entregado' : 'no_entregado', texto: a.motivo, datos: null });
  }
  return (data ?? []).length;
}
