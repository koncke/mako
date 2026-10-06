// =============================================================================
// api-mako/areas/cs.helpers — lo que el área cs necesita y ninguna lib exporta
// =============================================================================
// DEUDA, escrita a propósito: cada pieza de aquí vive hoy INLINE en
// app/customer-success/actions.ts y debería mudarse a una lib (lib/cs-clientes.ts)
// que usen también las server actions. Mientras tanto se copia con el MISMO
// criterio:
//   · clienteDelWorkspace → el lead tiene que ser `ganado` en ESTE workspace
//     (getTenantDb scopea). Fail-closed.
//   · marcarEstadoCliente → el upsert de marcarEstadoAction, con UNA diferencia
//     deliberada: si no llega motivo NO se pisa el anterior (la action escribe
//     null y una baja pierde su porqué al reactivar).
//
// ⚠️ SE FUERON SEIS EL 26/09/2026, con el programa de 44 clases: linksVivosDe
// (los shares `tarea-cs`, que ya no abren nada), bloqueDe / bloquesDe (la tabla
// cs_respuestas), mapaLeccionesEstricto (el mapa lección→clase de la plataforma de
// cursos externa), ganadosPorEmail (cruzaba sus alumnos contra el CRM) y borradoresMakoDelLead
// (deduplicaba los avisos de la tarea). Ninguna tenía otro consumidor.
//
// Solo `marcarEstadoCliente` escribe, y la llama únicamente ejecutar().
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { type EstadoCliente } from '@/lib/cs-cartera';

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
