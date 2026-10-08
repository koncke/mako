// =============================================================================
// Etiquetas de WhatsApp (no oficial) ↔ etapa del funnel.
// El catálogo de etiquetas se sincroniza desde Evolution (findLabels) y por el
// webhook labels.edit. El mapeo etapa→etiqueta se configura en /configuraciones.
// Al cambiar de etapa un lead, se le pone/saca la etiqueta en WhatsApp.
//
// ⚠️ DESDE LA MIG 0224 HAY OTRO CAMINO, Y ES EL QUE VALE PARA LO NUEVO: las etiquetas
// del CRM (`crm_etiquetas`, lib/etiquetas.ts) se mapean UNA A UNA a una etiqueta del
// celular (`wa_instance` + `wa_label_id`) y se ponen en el chat al ponerlas en MaKo. El
// mapeo de abajo (`evolution_stage_labels`) habla de las 9 etapas FIJAS del inbox
// (`derivarEtapa`), no de las etapas del CRM, y tiene 0 filas en todos los workspaces
// (medido el 08/10/2026): queda por compatibilidad hasta que alguien lo retire.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { listarLabelsEvolutionEstricto, asignarLabel } from '@/lib/evolution';
import { derivarEtapa, type LeadEtapaFields } from '@/lib/wa-etapas';
import { planSincronizarCatalogo, catalogoCelular, type LabelCelular } from '@/lib/etiquetas-reglas';

export type LabelCat = { labelId: string; name: string | null; color: number | null };

export type ResultadoSyncCatalogo = { total: number; nuevas: number; podadas: number };

/**
 * Sincroniza el catálogo de labels de Evolution → evolution_labels SIN PISAR NOMBRES.
 *
 * ⚠️ HASTA EL 08/10/2026 ESTO ERA UN UPSERT POR label_id, y destruía: `findLabels` devuelve
 * los nombres sin acentos ni emojis (Evolution los guarda así), así que «Huayacán», «Lac
 * interés» o «Hablar en cámara 📷» —que llegaron bien por el webhook `labels.edit`— volvían
 * «Huayacn», «Lac inters», «Hablar en cmara ». Ahora `findLabels` sólo dice qué ids siguen
 * vivos: agrega los nuevos, actualiza el color y PODA los que ya no están (ws1 arrastraba 7
 * del 11/09 que no existen en el celular). La decisión es pura y tiene test
 * (`planSincronizarCatalogo`).
 *
 * TIRA si no pudo leer el celular o escribir la base: podar sobre una lectura caída
 * borraría el catálogo entero.
 */
export async function sincronizarCatalogoEstricto(): Promise<ResultadoSyncCatalogo> {
  const vivas = await listarLabelsEvolutionEstricto();
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('evolution_labels').select('label_id, name, color');
  if (error) throw new Error(`No pude leer el catálogo guardado: ${error.message}`);
  const guardadas = (data ?? []) as Array<{ label_id: string; name: string | null; color: number | null }>;
  const plan = planSincronizarCatalogo(guardadas, vivas);
  const ahora = new Date().toISOString();
  if (plan.nuevas.length) {
    const { error: e1 } = await supabase.from('evolution_labels').upsert(
      plan.nuevas.map((l) => ({ ...l, updated_at: ahora })),
      { onConflict: 'workspace_id,label_id', ignoreDuplicates: true },
    );
    if (e1) throw new Error(`No pude agregar las etiquetas nuevas: ${e1.message}`);
  }
  for (const c of plan.colores) {
    const { error: e2 } = await supabase.from('evolution_labels').update({ color: c.color, updated_at: ahora }).eq('label_id', c.label_id);
    if (e2) throw new Error(`No pude actualizar el color de una etiqueta: ${e2.message}`);
  }
  if (plan.podar.length) {
    const { error: e3 } = await supabase.from('evolution_labels').delete().in('label_id', plan.podar);
    if (e3) throw new Error(`No pude sacar las etiquetas que ya no están en el celular: ${e3.message}`);
  }
  return { total: vivas.length, nuevas: plan.nuevas.length, podadas: plan.podar.length };
}

// Lo mismo, best-effort (lo usa el panel viejo de /configuraciones): nunca tira y devuelve el
// catálogo guardado después de sincronizar, como antes.
export async function sincronizarCatalogoLabels(): Promise<LabelCat[]> {
  try { await sincronizarCatalogoEstricto(); } catch (e) {
    console.error('[evolution-labels] sincronizar:', e instanceof Error ? e.message : String(e));
  }
  return getCatalogoLabels().catch(() => []);
}

/**
 * Las etiquetas del celular que se pueden MAPEAR a una etiqueta del CRM: sin las listas del
 * sistema (Favoritos, Grupos, No leídos, que llegan por el mismo evento y a veces con un
 * U+200E delante), con el nombre limpio. Del catálogo guardado: no le pega a Evolution.
 */
export async function catalogoParaMapear(): Promise<LabelCelular[]> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('evolution_labels').select('label_id, name, color');
  if (error) throw new Error(`No pude leer las etiquetas de WhatsApp: ${error.message}`);
  return catalogoCelular((data ?? []) as Array<{ label_id: string; name: string | null; color: number | null }>);
}

// Catálogo cacheado (evolution_labels), sin llamar a Evolution.
export async function getCatalogoLabels(): Promise<LabelCat[]> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('evolution_labels').select('label_id, name, color').order('name');
  return ((data ?? []) as Array<{ label_id: string; name: string | null; color: number | null }>).map((r) => ({ labelId: r.label_id, name: r.name, color: r.color }));
}

// Webhook labels.edit: alta/edición/borrado de una etiqueta en el celular.
export async function upsertLabelCatalogo(labelId: string, name: string | null, color: number | null): Promise<void> {
  if (!labelId) return;
  await (await getTenantDb()).from('evolution_labels').upsert(
    { label_id: labelId, name, color, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,label_id' },
  );
}
export async function borrarLabelCatalogo(labelId: string): Promise<void> {
  if (!labelId) return;
  await (await getTenantDb()).from('evolution_labels').delete().eq('label_id', labelId);
}

// Mapeo etapa → labelId (configuración).
export async function getMapeoEtapaLabels(): Promise<Record<string, string>> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('evolution_stage_labels').select('etapa, label_id');
  const map: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ etapa: string; label_id: string }>) map[r.etapa] = r.label_id;
  return map;
}
export async function setMapeoEtapaLabel(etapa: string, labelId: string | null): Promise<void> {
  const supabase = await getTenantDb();
  if (!labelId) { await supabase.from('evolution_stage_labels').delete().eq('etapa', etapa); return; }
  await supabase.from('evolution_stage_labels').upsert(
    { etapa, label_id: labelId, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,etapa' },
  );
}

// Deja en el número EXACTAMENTE la etiqueta de su etapa actual: saca las otras
// etiquetas mapeadas y pone la de la etapa. Idempotente (no necesita la anterior).
export async function aplicarEtiquetaActual(telefono: string, etapaKey: string, mapa: Record<string, string>): Promise<void> {
  const tel = (telefono || '').replace(/\D/g, '');
  if (!tel || !Object.keys(mapa).length) return;
  const target = mapa[etapaKey] || null;
  const otros = [...new Set(Object.values(mapa))].filter((id) => id && id !== target);
  for (const labelId of otros) await asignarLabel(tel, labelId, 'remove').catch(() => {});
  if (target) await asignarLabel(tel, target, 'add').catch(() => {});
}

// Recomputa la etapa de un lead y aplica su etiqueta en WhatsApp. Fire-and-forget
// desde los call-sites de cambio de etapa. No lanza (best-effort).
export async function actualizarEtiquetaLead(leadId: number): Promise<void> {
  try {
    const mapa = await getMapeoEtapaLabels();
    if (!Object.keys(mapa).length) return; // sin mapeo → nada que hacer
    const supabase = await getTenantDb();
    const { data } = await supabase.from('leads')
      .select('id, telefono_normalizado, pipeline_stage, fecha_primer_pago, fecha_confirmacion, cerro, asistio_j1, asistio_j2, fecha_junta_2, fecha_agenda, visitor_id, meta_lead_id')
      .eq('id', leadId).maybeSingle();
    const l = data as ({ telefono_normalizado: string | null; pipeline_stage: string | null } & LeadEtapaFields) | null;
    if (!l?.telefono_normalizado) return;
    const etapa = l.pipeline_stage === 'manual' ? 'manual' : derivarEtapa(l).key;
    await aplicarEtiquetaActual(l.telefono_normalizado, etapa, mapa);
  } catch { /* best-effort */ }
}
