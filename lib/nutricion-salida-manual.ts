// =============================================================================
// nutricion-salida-manual — sacar a UN lead de UNA secuencia (el espejo de inscribirEnSecuencia)
// =============================================================================
// La decisión es pura y vive en lib/nutricion-inscripcion-manual.ts (`decidirSalidaDeSecuencia`, con su test); acá
// la lectura y la escritura, las dos con getTenantDb: el id de una secuencia o de un lead que llega de afuera (la
// API, un paso de un flujo) sólo existe si es de ESTE negocio, y se carga ANTES de escribir algo que lo nombre.
//
// ⚠️ Cancela con compare-and-set sobre el estado leído: si otra corrida (el motor, una respuesta del lead, otra
// persona) movió la inscripción entre la lectura y la escritura, no se toca nada y se dice (`carrera`).
// ⚠️ `proximo_envio_at` queda en null: archivar una secuencia no lo limpia, pero ahí la secuencia entera ya no corre;
// acá la secuencia sigue viva para otros leads y una fila cancelada con fecha de envío es una fila que miente.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { decidirSalidaDeSecuencia, type PorQueNoSale } from '@/lib/nutricion-inscripcion-manual';

export type SalidaManual =
  | { sale: true; secuencia: { id: number; nombre: string }; lead: { id: number; nombre: string }; estadoAntes: string }
  | { sale: false; porque: PorQueNoSale; secuencia: { id: number; nombre: string } | null; lead: { id: number; nombre: string } | null };

export async function sacarDeSecuencia(leadId: number, secuenciaId: number, opts?: { soloVer?: boolean }): Promise<SalidaManual> {
  const db = await getTenantDb();
  const { data: filaSec, error: eSec } = await db.from('nutricion_secuencias').select('id, nombre').eq('id', secuenciaId).maybeSingle();
  if (eSec) throw new Error(`sacarDeSecuencia (secuencia): ${eSec.message}`);
  const { data: filaLead, error: eLead } = await db.from('leads').select('id, nombre').eq('id', leadId).maybeSingle();
  if (eLead) throw new Error(`sacarDeSecuencia (lead): ${eLead.message}`);
  const sec = filaSec as { id: number; nombre: string | null } | null;
  const l = filaLead as { id: number; nombre: string | null } | null;
  const secuencia = sec ? { id: Number(sec.id), nombre: sec.nombre?.trim() || `la secuencia #${sec.id}` } : null;
  const lead = l ? { id: Number(l.id), nombre: l.nombre?.trim() || `el lead #${l.id}` } : null;
  if (!secuencia) return { sale: false, porque: 'secuencia_no_existe', secuencia: null, lead };
  if (!lead) return { sale: false, porque: 'lead_no_existe', secuencia, lead: null };

  const { data: filaInsc, error: eInsc } = await db.from('nutricion_inscripciones')
    .select('id, estado, desenlace').eq('lead_id', lead.id).eq('secuencia_id', secuencia.id).maybeSingle();
  if (eInsc) throw new Error(`sacarDeSecuencia (inscripción): ${eInsc.message}`);
  const insc = filaInsc as { id: number; estado: string; desenlace: string | null } | null;
  const v = decidirSalidaDeSecuencia(insc ? { estado: insc.estado, desenlace: insc.desenlace } : null);
  if (!v.sale) return { sale: false, porque: v.porque, secuencia, lead };
  const hecho = { sale: true as const, secuencia, lead, estadoAntes: v.estadoAntes };
  if (opts?.soloVer || !insc) return hecho;

  const { data, error } = await db.from('nutricion_inscripciones')
    .update({ estado: 'cancelada', proximo_envio_at: null, updated_at: new Date().toISOString() })
    .eq('id', insc.id).eq('estado', insc.estado).select('id');
  if (error) throw new Error(`sacarDeSecuencia: ${error.message}`);
  if (!(data ?? []).length) return { sale: false, porque: 'carrera', secuencia, lead };
  // ⚠️ Y SUS BORRADORES PENDIENTES (22/10/2026, «Frenar» desde el CRM): con una automatización que deja los mensajes para
  // aprobar, el borrador ya escrito se podía aprobar igual y salía. «No le sale nada más» incluye lo que esperaba aprobación.
  const { error: eBorr } = await db.from('wa_borradores').update({ estado: 'descartado' })
    .eq('lead_id', lead.id).eq('secuencia_id', secuencia.id).eq('estado', 'pendiente');
  if (eBorr) console.error(`[nutricion] lead ${lead.id}: no pude descartar sus borradores de la secuencia ${secuencia.id}: ${eBorr.message}`);
  console.log(`[nutricion] lead ${lead.id}: sale de la secuencia ${secuencia.id} (${v.estadoAntes} → cancelada)`);
  return hecho;
}
