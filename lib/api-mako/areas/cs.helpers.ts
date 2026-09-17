// =============================================================================
// api-mako/areas/cs.helpers — lo que el área cs necesita y ninguna lib exporta
// =============================================================================
// DEUDA, escrita a propósito: cada pieza de aquí vive hoy INLINE en
// app/customer-success/actions.ts y debería mudarse a una lib (lib/cs-links.ts,
// lib/cs-clientes.ts) que usen también las server actions. Mientras tanto se copia
// con el MISMO criterio:
//   · clienteDelWorkspace → el lead tiene que ser `ganado` en ESTE workspace
//     (getTenantDb scopea). Fail-closed.
//   · linksVivosDe → listarShares(ws, 'tarea-cs') filtrado por recurso_id y sin
//     revocado_at. A diferencia de la action, además dice cuáles ya vencieron
//     (expira_at en el pasado): listarShares no lo mira y la pantalla los cuenta
//     como vivos.
//   · marcarEstadoCliente → el upsert de marcarEstadoAction, con UNA diferencia
//     deliberada: si no llega motivo NO se pisa el anterior (la action escribe
//     null y una baja pierde su porqué al reactivar).
//
// Y tres lecturas que SÍ existen en una lib pero se tragan el error (DEUDA de esas
// libs: se copian aquí para que «no pude leer» no salga como un hecho):
//   · bloqueDe / bloquesDe → getBloque y bloquesDeCliente (lib/cs-respuestas.ts)
//     ignoran `error`: con la base caída, «nunca tocó este bloque» y «no tiene bloques
//     esperando su ok» salían como dato.
//   · mapaLeccionesEstricto → getMapaLecciones (lib/cs-avance.ts) lee con getSetting,
//     que ante un 5xx devuelve null, y eso se vuelve {}: «0 lecciones mapeadas».
//   · borradoresMakoDelLead → listBorradores (lib/evolution-envio.ts) trae los 200
//     pendientes MÁS VIEJOS y se traga el error: con la cola de nutrición llena, la
//     deduplicación no veía el aviso de hoy.
//
// Solo `marcarEstadoCliente` escribe, y la llama únicamente ejecutar().
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSettingEstricto } from '@/lib/settings';
import { listarShares } from '@/lib/shares';
import { RECURSO_TAREA, type EstadoCliente } from '@/lib/cs-cartera';
import type { Bloque } from '@/lib/cs-respuestas';

export type ClienteCs = { id: number; nombre: string; telefono: string | null; email: string | null };

/** ¿Este lead es un cliente ganado DE ESTE workspace? null si no. */
export async function clienteDelWorkspace(leadId: number | null): Promise<ClienteCs | null> {
  if (leadId == null || !Number.isInteger(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('leads')
    .select('id, nombre, telefono, email').eq('id', leadId).eq('estado_lead', 'ganado').maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer el lead ${leadId}: ${error.message}`);
  return (data as ClienteCs | null) ?? null;
}

export type LinkTarea = {
  id: number; etiqueta: string | null; token_prefijo: string | null; created_at: string | null;
  expira_at: string | null; revocado_at: string | null; visitas: number | null; ultima_visita: string | null;
};

/** Los links de la tarea de un lead que NO están revocados (vencidos incluidos, marcados). */
export async function linksVivosDe(ws: number, leadId: number): Promise<Array<LinkTarea & { vencido: boolean }>> {
  const todos = (await listarShares(ws, RECURSO_TAREA)) as Array<LinkTarea & { recurso_id?: unknown }>;
  const ahora = Date.now();
  return todos
    .filter((s) => String(s.recurso_id ?? '') === String(leadId) && !s.revocado_at)
    .map((s) => ({ ...s, vencido: Boolean(s.expira_at && Date.parse(s.expira_at) < ahora) }));
}

export type EstadoGuardado = { estado: EstadoCliente; motivo: string | null; estado_at: string | null };

/** La fila de cs_clientes del lead. Sin fila = 'activo' (así lo lee la cartera). */
export async function estadoGuardadoDe(leadId: number): Promise<EstadoGuardado> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cs_clientes').select('estado, motivo, estado_at').eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer el estado del cliente ${leadId}: ${error.message}`);
  const f = data as EstadoGuardado | null;
  return f ?? { estado: 'activo', motivo: null, estado_at: null };
}

/** Upsert del estado. `motivo` null = no se toca el que había. */
export async function marcarEstadoCliente(leadId: number, estado: EstadoCliente, motivo: string | null): Promise<string | null> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const fila: Record<string, unknown> = {
    lead_id: leadId, estado, estado_at: estado === 'activo' ? null : ahora, updated_at: ahora,
  };
  if (motivo) fila.motivo = motivo;
  const { error } = await db.from('cs_clientes').upsert(fila, { onConflict: 'workspace_id,lead_id' });
  return error ? error.message : null;
}

/** Los clientes ganados del workspace, por email en minúsculas (cruce EXACTO, sin ilike). */
export async function ganadosPorEmail(): Promise<Map<string, { id: number; nombre: string }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, email').eq('estado_lead', 'ganado').not('email', 'is', null).limit(1000);
  if (error) throw new Error(`api-mako: no pude leer los clientes: ${error.message}`);
  const m = new Map<string, { id: number; nombre: string }>();
  for (const l of (data ?? []) as Array<{ id: number; nombre: string; email: string | null }>) {
    const e = (l.email ?? '').trim().toLowerCase();
    if (e && !m.has(e)) m.set(e, { id: l.id, nombre: l.nombre });
  }
  return m;
}

const COLS_BLOQUE = 'id, lead_id, clase_id, area, respuesta, valores, respuesta_ia, fuente_reunion, estado, visto_at, contestada_at, revisada_at, aprobada_at, updated_at';

/** Un bloque del cliente. null = no existe la fila; un error de lectura LANZA. */
export async function bloqueDe(leadId: number, claseId: string, area: string): Promise<Bloque | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cs_respuestas').select(COLS_BLOQUE)
    .eq('lead_id', leadId).eq('clase_id', claseId).eq('area', area.trim()).maybeSingle();
  if (error) throw new Error(`api-mako: no pude leer el bloque ${claseId} del cliente ${leadId}: ${error.message}`);
  return (data as Bloque | null) ?? null;
}

/** Todos los bloques del cliente (a lo sumo 44 × áreas: sin paginar). Un error LANZA. */
export async function bloquesDe(leadId: number): Promise<Bloque[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cs_respuestas').select(COLS_BLOQUE)
    .eq('lead_id', leadId).order('clase_id', { ascending: true }).limit(1000);
  if (error) throw new Error(`api-mako: no pude leer los bloques del cliente ${leadId}: ${error.message}`);
  return (data as Bloque[] | null) ?? [];
}

/** El mapa lección→clase. Sin setting = {}; lectura fallida o JSON roto LANZA. */
export async function mapaLeccionesEstricto(): Promise<Record<string, string>> {
  const raw = await getSettingEstricto('mako.whop.lecciones');
  if (!raw) return {};
  const j = JSON.parse(raw) as unknown;
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('api-mako: el mapa de lecciones guardado no es un objeto');
  return j as Record<string, string>;
}

/** Los borradores PENDIENTES que MaKo dejó para este lead, del más nuevo al más viejo. Un error LANZA. */
export async function borradoresMakoDelLead(leadId: number): Promise<Array<{ id: number; texto: string }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('wa_borradores').select('id, texto')
    .eq('lead_id', leadId).eq('estado', 'pendiente').eq('origen', 'mako')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(`api-mako: no pude leer la cola de borradores: ${error.message}`);
  return ((data ?? []) as Array<{ id: number; texto: string | null }>).map((r) => ({ id: r.id, texto: r.texto ?? '' }));
}
