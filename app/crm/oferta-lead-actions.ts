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
// La lógica vive en lib/oferta-lead.ts, que también usa la API de MaKo: acá van la sesión, el rol
// y la caché.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { TAG } from '@/lib/cache';
import { ofertasDelLead, asignarOfertaAlLead, crearOfertaParaLead } from '@/lib/oferta-lead';
import type { OfertaParaLead } from '@/lib/oferta-modelo';

function bust() {
  try { updateTag(TAG.leads); } catch { /* la caché vence sola por su TTL */ }
}

async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}

/** Las ofertas del negocio, la del lead, y si quien mira puede crear una. */
export async function ofertasDelLeadAction(leadId: number): Promise<
  { ok: true; ofertas: OfertaParaLead[]; actual: number | null; puedeCrear: boolean } | { ok: false; error: string }
> {
  try {
    const [r, rol] = await Promise.all([ofertasDelLead(leadId), getRolWsEfectivo().catch(() => null)]);
    if (!r) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
    // Crear una oferta es del admin, como la tab Offer. Elegir una que ya existe, de cualquiera
    // que trabaje el lead.
    return { ok: true, ofertas: r.ofertas, actual: r.actual, puedeCrear: rol === 'admin' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudieron leer las ofertas.' };
  }
}

/** Le asigna una oferta al lead (o se la saca, con `null`). */
export async function asignarOfertaLeadAction(leadId: number, ofertaId: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await asignarOfertaAlLead(leadId, ofertaId, await autor());
    if (!r.ok) return r;
    bust();
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/** Crea una oferta desde la ficha con lo mínimo y se la asigna al lead. Sólo el admin. */
export async function crearOfertaDesdeLeadAction(leadId: number, datos: { nombre: string; modelo: string; ticket: number | null }): Promise<
  { ok: true; oferta: OfertaParaLead; funnelId: number | null } | { ok: false; error: string }
> {
  try {
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede crear una oferta.' };
    const r = await crearOfertaParaLead(leadId, datos, await autor());
    if (!r.ok) return r;
    bust();
    revalidatePath('/crm');
    revalidatePath('/offer');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear la oferta.' };
  }
}
