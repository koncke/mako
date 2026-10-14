import 'server-only';

// =============================================================================
// oferta-lead — la OFERTA de un lead: leerla, asignarla y crear una desde la ficha
// =============================================================================
// Pedido de Martín (13/10/2026, Pagos punto 1): un desplegable para asignarle al lead una
// oferta, o crear una nueva ahí mismo con lo mínimo (nombre, modelo y ticket), y desde ahí
// «analizar oferta» en Offer. Las ofertas son las de la tab Offer (tabla `ofertas`,
// lib/ofertas.ts): no hay un catálogo aparte para el CRM.
//
// UNA implementación, dos puertas: las server actions de la ficha
// (app/crm/oferta-lead-actions.ts, que ponen la sesión y el rol) y la API de MaKo
// (`oferta_del_lead`, `asignar_oferta_lead`, `crear_oferta_lead` en lib/api-mako/areas/crm.*).
// =============================================================================

import { getTenantDb } from './workspace';
import { logLeadEvent } from './leads';
import { listarOfertas, upsertOferta, ligarOfertaAFunnel } from './ofertas';
import { idDelFunnelDefault } from './funnels';
import { validarOfertaNueva, type OfertaParaLead } from './oferta-modelo';

/** El lead, sólo lo que esto necesita. null = no es de este workspace. */
async function filaDelLead(leadId: number): Promise<{ oferta_id: number | null; funnel_id: number | null } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('oferta_id, funnel_id').eq('id', leadId).limit(1);
  if (error) throw new Error('No se pudo leer el lead.');
  const f = ((data ?? []) as Array<{ oferta_id: number | null; funnel_id: number | null }>)[0];
  return f ? { oferta_id: f.oferta_id != null ? Number(f.oferta_id) : null, funnel_id: f.funnel_id != null ? Number(f.funnel_id) : null } : null;
}

/** Las ofertas del negocio y la del lead. null = el lead no es de este workspace. */
export async function ofertasDelLead(leadId: number): Promise<{ ofertas: OfertaParaLead[]; actual: number | null } | null> {
  const [lead, ofertas] = await Promise.all([filaDelLead(leadId), listarOfertas(true)]);
  if (!lead) return null;
  return {
    ofertas: ofertas.map((o) => ({ id: o.id, nombre: o.nombre, precio_usd: o.precio_usd, modelo: o.modelo ?? null })),
    actual: lead.oferta_id,
  };
}

/**
 * Le asigna una oferta al lead (o se la saca, con `null`).
 *
 * ⚠️ LA OFERTA TIENE QUE SER DE ESTE WORKSPACE, y eso no lo cubre la FK: sólo mira que exista. Se
 * busca en `listarOfertas`, que ya viene scopeada (la misma razón que `esDelWorkspace` en lib/ofertas.ts).
 */
export async function asignarOfertaAlLead(leadId: number, ofertaId: number | null, autor: string):
  Promise<{ ok: true; nombre: string } | { ok: false; error: string }> {
  const lead = await filaDelLead(leadId);
  if (!lead) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
  let nombre = 'sin oferta';
  if (ofertaId != null) {
    const o = (await listarOfertas()).find((x) => x.id === ofertaId);
    if (!o) return { ok: false, error: 'Esa oferta no existe.' };
    nombre = o.nombre;
  }
  if (lead.oferta_id === ofertaId) return { ok: true, nombre };
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ oferta_id: ofertaId }).eq('id', leadId);
  if (error) return { ok: false, error: 'No se pudo guardar.' };
  await logLeadEvent(leadId, 'Oferta', nombre, autor).catch(() => {});
  return { ok: true, nombre };
}

/**
 * Crea una oferta con lo mínimo —nombre, modelo y ticket— y se la asigna al lead. Queda ligada al
 * CRM del lead (o al del negocio): sin esa liga no aparece en el árbol de Offer y el «Analizar
 * oferta →» abriría otra cosa (docs/hallazgos-crm.md). El resto de la oferta se completa en Offer.
 * El rol lo mira quien llama: crear una oferta es del admin.
 */
export async function crearOfertaParaLead(leadId: number, datos: { nombre: unknown; modelo: unknown; ticket: unknown }, autor: string):
  Promise<{ ok: true; oferta: OfertaParaLead; funnelId: number | null } | { ok: false; error: string }> {
  const v = validarOfertaNueva(datos);
  if (!v.ok) return v;
  const lead = await filaDelLead(leadId);
  if (!lead) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
  const id = await upsertOferta({ nombre: v.nombre, modelo: v.modelo, precio_usd: v.ticket, origen: 'crm' });
  // Si ligarla falla, la oferta existe igual y se asigna: se liga después desde Offer.
  const funnelId = lead.funnel_id ?? (await idDelFunnelDefault().catch(() => null));
  if (funnelId != null) await ligarOfertaAFunnel(funnelId, id, false).catch((e) => console.warn('[oferta-lead] no se pudo ligar al CRM:', e instanceof Error ? e.message : e));
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ oferta_id: id }).eq('id', leadId);
  if (error) return { ok: false, error: 'La oferta se creó, pero no se pudo asignar al lead.' };
  await logLeadEvent(leadId, 'Oferta', `${v.nombre} (nueva)`, autor).catch(() => {});
  return { ok: true, oferta: { id, nombre: v.nombre, precio_usd: v.ticket, modelo: v.modelo }, funnelId };
}
