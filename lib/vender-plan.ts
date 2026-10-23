import 'server-only';

// =============================================================================
// vender-plan — Martín vendiendo un plan de MaKo: el link de pago que da de alta la cuenta al pagarse
// =============================================================================
// «Vender un plan» de /admin/cobros (pedido de Martín del 11/10/2026: «Lo voy a utilizar yo como superadmin para
// vender MaKo»). Vivía adentro de `venderPlanAction` (app/admin/cobros/actions.ts) y se mudó acá el 23/10/2026
// para que lo use también la API de MaKo (`vender_plan_mako`, P0-8 de la auditoría): un runner no llama server
// actions, y un segundo camino para crear un cobro con `altaCapa` es el que se queda viejo (Cobros pidió copiar
// el de la pantalla tal cual). La action sigue haciendo lo suyo —el super admin primero, el `revalidatePath`— y
// delega acá.
//
// ⚠️ EL WORKSPACE ES EL DE LA PLATAFORMA (`wsSuperAdmin()`), resuelto acá adentro y nunca de un parámetro:
// OWNER_WS (1) es Mauricio, un CLIENTE, y la cookie del super admin puede estar mirando a cualquiera. Un plan de
// MaKo cobrado en otro workspace entra al CRM de otro, con SU Stripe.
// ⚠️ LA CAPA se valida en positivo contra lo que SE VENDE (`esCapaVendible`) ANTES de crear un lead o un cobro:
// la capa de la plataforma no es un plan, es cómo se identifica MaKo (lib/capas.ts).
// =============================================================================

import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { createLead, findLeadByContacto } from './leads';
import { LeadDuplicadoError } from './leads-duplicados';
import { esCapaVendible } from './alta-cliente';
import { crearCobro } from './cobros';
import { esPasarela, type Pasarela, type TipoCobro } from './cobros-tipos';
import { normalizarMoneda } from './pasarela-moneda';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VentaPlan = {
  /** Una capa VENDIBLE (lib/capas.ts, CAPAS_VENDIBLES). `superadmin` se rechaza. */
  capa: string;
  monto: number;
  /** null = la moneda de la cuenta de la pasarela (Mercado Pago cobra en la de su sitio). */
  moneda: string | null;
  /** El valor en dólares, cuando la moneda no es USD: sin él el cobro no entra al cash del CRM. */
  montoUsd?: number | null;
  tipo: TipoCobro;
  email: string;
  nombre: string;
  /** Sólo hace falta si hay DOS pasarelas conectadas; con una, lib/cobros.ts la elige. */
  pasarela?: Pasarela | null;
};

export type ResultadoVenta =
  | { ok: true; link: string; cobroId: number; monto: number; moneda: string }
  | { ok: false; error: string };

/** La venta ya saneada: lo que se valida antes de tocar nada. */
export type VentaValida = {
  capa: string; monto: number; moneda: string | null; montoUsd: number | null;
  tipo: TipoCobro; email: string; nombre: string; pasarela: Pasarela | null;
};

/**
 * Lo que se puede saber SIN escribir: la capa (en positivo), el email (normalizado: el alta lo usa para crear al
 * admin), el nombre, el monto, la moneda y la pasarela. La usan la pantalla y el `preparar()` de la API, para que
 * la propuesta falle antes del «sí» y no al confirmar.
 */
export function ventaValida(v: Partial<VentaPlan> | null | undefined): { ok: true; venta: VentaValida } | { ok: false; error: string } {
  const capa = String(v?.capa ?? '').trim();
  if (!esCapaVendible(capa)) return { ok: false, error: 'Ese plan no se vende.' };
  const email = String(v?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Revisa el email: por ahí le llega el acceso.' };
  const nombre = String(v?.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre de quien paga.' };
  const monto = Number(v?.monto);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'Falta el monto.' };
  const tipo: TipoCobro = v?.tipo === 'suscripcion' ? 'suscripcion' : 'unico';
  const moneda = v?.moneda == null ? null : normalizarMoneda(v.moneda);
  if (v?.moneda != null && !moneda) return { ok: false, error: 'Esa moneda no existe.' };
  const usd = Number(v?.montoUsd);
  const pasarela = esPasarela(v?.pasarela) ? v.pasarela : null;
  return { ok: true, venta: { capa, monto, moneda, montoUsd: Number.isFinite(usd) && usd > 0 ? usd : null, tipo, email, nombre, pasarela } };
}

/**
 * Busca al comprador entre los leads de la plataforma (o lo crea) y le arma el link de pago. Al pagarse, el alta de
 * su cuenta la hace lib/cobros.ts (`altaSiCorresponde`). `creadoPor` firma el cobro.
 */
export async function venderPlan(v: Partial<VentaPlan> | null | undefined, creadoPor: string): Promise<ResultadoVenta> {
  const val = ventaValida(v);
  if (!val.ok) return val;
  const { capa, monto, moneda, montoUsd, tipo, email, nombre, pasarela } = val.venta;
  try {
    const ws = await wsSuperAdmin();
    const lead = await runWithWorkspace(ws, () => leadDelComprador(email, nombre));
    if (!lead.ok) return lead;
    const r = await crearCobro(ws, { leadId: lead.id, altaCapa: capa, monto, moneda, montoUsd, tipo, email, nombre, pasarela, creadoPor });
    if (!r.ok) return { ok: false, error: r.error };
    // El monto y la moneda COMO QUEDARON: con Mercado Pago la moneda la decide su cuenta, no la pantalla.
    return { ok: true, link: r.link, cobroId: r.cobro.id, monto: r.cobro.monto, moneda: r.cobro.moneda };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude crear el link.' };
  }
}

/**
 * ¿Cuántos leads de la plataforma tienen ese email? Para que la API diga ANTES del «sí» que no va a elegir a
 * ciegas. Tira si no pudo leer.
 */
export async function leadsDelComprador(email: string): Promise<number> {
  return runWithWorkspace(await wsSuperAdmin(), async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id').eq('email', email).limit(2);
    if (error) throw new Error(`No pude buscar el lead: ${error.message}`);
    return (data ?? []).length;
  });
}

/**
 * El lead del comprador en el CRM de la plataforma, por su email. Corre ADENTRO de
 * runWithWorkspace(wsSuperAdmin()): getTenantDb y createLead escriben en el workspace del contexto.
 *
 * ⚠️ CON DOS LEADS DEL MISMO EMAIL NO SE ELIGE: `findLeadByContacto` se queda con el más viejo y lo
 * avisa sólo en un console.warn, y un cobro atado al lead equivocado deja el alta y el historial en
 * la ficha de otra persona. Se cuenta antes y se corta con un error que lo dice.
 */
async function leadDelComprador(email: string, nombre: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id').eq('email', email).limit(2);
  if (error) throw new Error(`No pude buscar el lead: ${error.message}`);
  if ((data ?? []).length > 1) return { ok: false, error: 'Hay más de un lead con ese email: no elijo uno a ciegas.' };

  const existente = await findLeadByContacto(email, null);
  if (existente) return { ok: true, id: existente.id };
  try {
    // `carga_manual`, como el alta del CRM y la de Customer Success: alguien lo tipeó.
    const nuevo = await createLead({ nombre, email, origen_lead: ORIGEN_LEAD.carga_manual.id });
    return { ok: true, id: nuevo.id };
  } catch (e) {
    // El duplicado que `findLeadByContacto` no ve: el mismo email guardado con otra caja (createLead
    // no lo pasa a minúsculas y la búsqueda compara exacto). Tampoco se elige solo.
    if (e instanceof LeadDuplicadoError) return { ok: false, error: `Hay más de un lead con ese email. ${e.message}` };
    throw e;
  }
}
