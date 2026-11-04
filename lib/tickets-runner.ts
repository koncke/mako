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
import { leerTriage } from './tickets-reglas';
import { WS_REVISION } from './cuenta-revision-reglas';
import {
  CEREBRO_SIN_ENTREGAR, ENTREGA_MAX_INTENTOS, ENTREGA_TOMADO_VENCE_MS, ESTADOS_NUEVOS, TICKETS_POR_VUELTA, VERSION_CARTERO_TICKETS, VERSION_CARTERO_TICKETS_NUEVOS,
  esElCerebro, necesitaAvisoDeNuevo, necesitaEntrega, versionAlMenos, type FilaEntrega, type FilaNuevo,
} from './tickets-aviso';

const T = 'tickets';

/** Lo que el Runner entrega: el id del intento (va al acuse), el número del ticket y a qué sesión. */
/** `regla` (27/10/2026): el nombre de la regla de Martín que lo aprobó («Leandro», «Leila»). El cartero 1.20.0 lo usa SÓLO si
 *  está en su propia lista (scripts/operaciones/cartero.mjs → REGLAS_CONOCIDAS): de MaKo no toma texto para el mensaje. */
export type TicketParaEntregar = { id: string; numero: number; destino: string; regla?: string; delegado?: true };
/** ¿Es un PEDIDO DELEGADO desde el grupo (lib/despacho-grupo.ts)? Lo dice su contexto; el cartero 1.24.0 lo lleva con su texto. */
const esDelegado = (contexto: unknown): boolean => !!contexto && typeof contexto === 'object' && (contexto as { delegado?: unknown }).delegado === true;

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
    .select('id, estado, despacho, aviso_id, aviso_estado, aviso_at, aviso_intentos, triage, contexto')
    .eq('despacho', 'runner').eq('estado', 'en_curso').lt('aviso_intentos', ENTREGA_MAX_INTENTOS)
    .neq('workspace_id', WS_REVISION) // la cuenta de revisión de las tiendas no se despacha (lib/tickets-db.ts)
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
    const regla = leerTriage(f.triage)?.regla;
    if (data && data[0]) out.push({ id, numero: Number(f.id), destino: cerebro.local, ...(regla ? { regla } : {}), ...(esDelegado(f.contexto) ? { delegado: true as const } : {}) });
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
    .neq('workspace_id', WS_REVISION)
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

// ── Los tickets NUEVOS (cartero 1.23.0, 29/10/2026) ─────────────────────────────────────────────────────────────────────────
// Los que esperan la decisión de Martín, con su propia marca (`cerebro_*`, mig 0343) y su texto fijo (`mensajeTicketNuevo`):
// lib/tickets-aviso.ts dice por qué van aparte. El molde es el de arriba: compare-and-set sobre el intento anterior.

/** Lo que el Runner entrega de un ticket nuevo: el id del intento (va al acuse), el número y a qué sesión. Nada más: el texto es fijo.
 *  ⚠️ Sin `delegado` (la revisión de privacidad de 85a0d9ead, A2): esta cola es la de lo que ESPERA LA DECISIÓN de Martín, y un pedido
 *  delegado ahí (plata, envíos, borrados, algo nuevo) viaja con el texto de ticket nuevo, nunca con el «hazlo» del delegado. */
export type TicketNuevoParaEntregar = { id: string; numero: number; destino: string };

/** Los que esperan a Martín y no le llegaron al Cerebro, los más viejos primero. Sin la migración, tira (la vuelta lo dice). */
async function nuevosSinEntregar(): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await getSupabaseServer().from(T)
    .select('id, estado, despacho, cerebro_id, cerebro_estado, cerebro_at, cerebro_intentos')
    .is('despacho', null).in('estado', [...ESTADOS_NUEVOS]).in('cerebro_estado', [...CEREBRO_SIN_ENTREGAR])
    .neq('workspace_id', WS_REVISION) // la cuenta de revisión de las tiendas no le llega al Cerebro (lib/tickets-db.ts)
    .lt('cerebro_intentos', ENTREGA_MAX_INTENTOS).order('created_at', { ascending: true }).limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const filaNuevo = (f: Record<string, unknown>): FilaNuevo => ({
  estado: f.estado as string, despacho: (f.despacho as string | null) ?? null, cerebroEstado: String(f.cerebro_estado ?? 'pendiente'),
  cerebroAt: (f.cerebro_at as string | null) ?? null, cerebroIntentos: Number(f.cerebro_intentos) || 0,
});

/** Los tickets nuevos que ESTE Runner le entrega al Cerebro ahora: con el chat «Cerebro» abierto en SU cuenta, y sólo si lo entiende. */
export async function ticketsNuevosParaElCartero(
  version: string | null, chatsDeEste: readonly ChatCartero[], entregables: ReadonlySet<string>, ahoraIso: string,
): Promise<TicketNuevoParaEntregar[]> {
  if (!versionAlMenos(version, VERSION_CARTERO_TICKETS_NUEVOS)) return [];
  const cerebro = chatsDeEste.find((c) => c.vivo && esElCerebro(c.titulo) && entregables.has(c.local));
  if (!cerebro) return [];
  const db = getSupabaseServer();
  const ahora = Date.parse(ahoraIso);
  const out: TicketNuevoParaEntregar[] = [];
  for (const f of await nuevosSinEntregar()) {
    const fila = filaNuevo(f);
    if (!necesitaAvisoDeNuevo(fila, ahora)) continue;
    const id = randomUUID();
    let q = db.from(T).update({
      cerebro_id: id, cerebro_estado: 'tomado', cerebro_at: ahoraIso, cerebro_intentos: fila.cerebroIntentos + 1, cerebro_motivo: null,
    }).eq('id', f.id).is('despacho', null).in('estado', [...ESTADOS_NUEVOS]);
    q = f.cerebro_id ? q.eq('cerebro_id', f.cerebro_id as string) : q.is('cerebro_id', null);
    const { data, error: eUp } = await q.select('id');
    if (eUp) throw new Error(eUp.message);
    if (data && data[0]) out.push({ id, numero: Number(f.id), destino: cerebro.local });
    if (out.length >= TICKETS_POR_VUELTA) break;
  }
  return out;
}

/** Cuántos tickets nuevos esperan un Runner (para `hayParaElCartero`): el MISMO criterio, sobre la misma consulta. */
export async function ticketsNuevosSinEntregar(ahora = Date.now()): Promise<number> {
  return (await nuevosSinEntregar()).filter((f) => necesitaAvisoDeNuevo(filaNuevo(f), ahora)).length;
}

/** El acuse de un ticket nuevo (por el id del intento): queda su renglón en el historial. Devuelve cuántos tocó. */
export async function acusarTicketNuevo(a: { id: string; estado: 'entregado' | 'no_entregado' | 'incierto'; motivo: string | null }, ahoraIso: string): Promise<number> {
  const db = getSupabaseServer();
  const { data } = await db.from(T).update({ cerebro_estado: a.estado, cerebro_motivo: a.motivo, cerebro_at: ahoraIso })
    .eq('cerebro_id', a.id).eq('cerebro_estado', 'tomado').select('id');
  for (const f of data ?? []) {
    await db.from('ticket_eventos').insert({ ticket_id: f.id, actor: 'sistema', tipo: a.estado === 'entregado' ? 'llegó al Cerebro' : 'no llegó al Cerebro', texto: a.motivo, datos: null });
  }
  return (data ?? []).length;
}
