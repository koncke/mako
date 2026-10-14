'use server';

// =============================================================================
// oferta-lead-actions — la OFERTA de un lead, en su tab Pagos
// =============================================================================
// Pedido de Martín (13/10/2026, feedback del detalle del lead, Pagos punto 1): «Tienes que hacer
// la pestaña de pagos mucho más sencilla... dentro de un FUNNEL el usuario podría elegir como
// "Ganado" y asignar una OFERTA de las que haya analizado... un desplegable para asignar una
// oferta, o agregar una nueva que se haga desde allí mismo, con unas preguntas mínimas como nombre
// de la oferta, modelo (pago unico, suscripción) y el ticket... Y que una vez creada en el
// desplegable te de la opción de analizar oferta, que ahí, redirija a la tab de offer».
//
// Las ofertas son las de la tab Offer (tabla `ofertas`, lib/ofertas.ts): no hay un catálogo aparte
// para el CRM. Una oferta creada acá queda ligada al CRM del lead (`funnel_ofertas`), así aparece
// en Offer debajo de ese CRM y se puede analizar.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getTenantDb, getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { logLeadEvent } from '@/lib/leads';
import { TAG } from '@/lib/cache';
import { listarOfertas, upsertOferta, ligarOfertaAFunnel } from '@/lib/ofertas';
import { idDelFunnelDefault } from '@/lib/funnels';
import { esModeloOferta, type ModeloOferta } from '@/lib/oferta-modelo';

export type OfertaParaLead = { id: number; nombre: string; precio_usd: number | null; modelo: ModeloOferta | null };

function bust() {
  try { updateTag(TAG.leads); } catch { /* la caché vence sola por su TTL */ }
}

async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}

/** El lead, sólo lo que esto necesita. null = no es de este workspace. */
async function filaDelLead(leadId: number): Promise<{ oferta_id: number | null; funnel_id: number | null } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('oferta_id, funnel_id').eq('id', leadId).limit(1);
  if (error) throw new Error('No se pudo leer el lead.');
  const f = ((data ?? []) as Array<{ oferta_id: number | null; funnel_id: number | null }>)[0];
  return f ? { oferta_id: f.oferta_id != null ? Number(f.oferta_id) : null, funnel_id: f.funnel_id != null ? Number(f.funnel_id) : null } : null;
}

/** Las ofertas del negocio, la del lead, y si quien mira puede crear una. */
export async function ofertasDelLeadAction(leadId: number): Promise<
  { ok: true; ofertas: OfertaParaLead[]; actual: number | null; puedeCrear: boolean } | { ok: false; error: string }
> {
  try {
    const [lead, ofertas, rol] = await Promise.all([filaDelLead(leadId), listarOfertas(true), getRolWsEfectivo().catch(() => null)]);
    if (!lead) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
    return {
      ok: true,
      ofertas: ofertas.map((o) => ({ id: o.id, nombre: o.nombre, precio_usd: o.precio_usd, modelo: o.modelo ?? null })),
      actual: lead.oferta_id,
      // Crear una oferta es del admin, como la tab Offer. Elegir una que ya existe, de cualquiera
      // que trabaje el lead.
      puedeCrear: rol === 'admin',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudieron leer las ofertas.' };
  }
}

/**
 * Le asigna una oferta al lead (o se la saca, con `null`).
 *
 * ⚠️ LA OFERTA TIENE QUE SER DE ESTE WORKSPACE, y eso no lo cubre la FK: sólo mira que exista. Se
 * busca en `listarOfertas`, que ya viene scopeada (la misma razón que `esDelWorkspace` en lib/ofertas.ts).
 */
export async function asignarOfertaLeadAction(leadId: number, ofertaId: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const lead = await filaDelLead(leadId);
    if (!lead) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
    let nombre = 'sin oferta';
    if (ofertaId != null) {
      const o = (await listarOfertas()).find((x) => x.id === ofertaId);
      if (!o) return { ok: false, error: 'Esa oferta no existe.' };
      nombre = o.nombre;
    }
    if (lead.oferta_id === ofertaId) return { ok: true };
    const db = await getTenantDb();
    const { error } = await db.from('leads').update({ oferta_id: ofertaId }).eq('id', leadId);
    if (error) return { ok: false, error: 'No se pudo guardar.' };
    await logLeadEvent(leadId, 'Oferta', nombre, await autor()).catch(() => {});
    bust();
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Crea una oferta desde la ficha con lo mínimo —nombre, modelo y ticket— y se la asigna al lead.
 * Queda ligada al CRM del lead, así aparece en Offer para analizarla. El resto de la oferta
 * (promesa, bonos, garantía) se completa en Offer: acá no se pregunta.
 */
export async function crearOfertaDesdeLeadAction(leadId: number, datos: { nombre: string; modelo: string; ticket: number | null }): Promise<
  { ok: true; oferta: OfertaParaLead; funnelId: number | null } | { ok: false; error: string }
> {
  try {
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede crear una oferta.' };
    const nombre = String(datos?.nombre ?? '').trim().replace(/\s+/g, ' ');
    if (!nombre) return { ok: false, error: 'La oferta necesita un nombre.' };
    if (nombre.length > 80) return { ok: false, error: 'El nombre no puede pasar de 80 caracteres.' };
    const modelo = datos?.modelo;
    if (!esModeloOferta(modelo)) return { ok: false, error: 'Elige cómo se cobra.' };
    const ticket = datos.ticket == null ? null : Number(datos.ticket);
    if (ticket != null && (!Number.isFinite(ticket) || ticket < 0)) return { ok: false, error: 'El ticket tiene que ser un número.' };
    const lead = await filaDelLead(leadId);
    if (!lead) return { ok: false, error: 'Ese lead no es de esta cuenta.' };

    const id = await upsertOferta({ nombre, modelo, precio_usd: ticket, origen: 'crm' });
    // Ligada al CRM del lead (o al del negocio): es lo que la hace aparecer en Offer debajo de ese
    // CRM. Si falla, la oferta existe igual y se asigna: se liga después desde Offer.
    const funnelId = lead.funnel_id ?? (await idDelFunnelDefault().catch(() => null));
    if (funnelId != null) await ligarOfertaAFunnel(funnelId, id, false).catch((e) => console.warn('[oferta-lead] no se pudo ligar al CRM:', e instanceof Error ? e.message : e));

    const db = await getTenantDb();
    const { error } = await db.from('leads').update({ oferta_id: id }).eq('id', leadId);
    if (error) return { ok: false, error: 'La oferta se creó, pero no se pudo asignar al lead.' };
    await logLeadEvent(leadId, 'Oferta', `${nombre} (nueva)`, await autor()).catch(() => {});
    bust();
    revalidatePath('/crm');
    revalidatePath('/offer');
    return { ok: true, oferta: { id, nombre, precio_usd: ticket, modelo }, funnelId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear la oferta.' };
  }
}
