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
//
// Lo que sumó la revisión adversarial del mismo día (wf_fbeb8485-d3c), y vale para la pantalla Y la API:
//   · lo que va a cobrar el link (la pasarela, la moneda y el valor en dólares) se decide ANTES de crear el lead
//     (`previaDeLaVenta`): antes una venta en otra moneda sin dólares creaba el lead y fallaba después;
//   · Mercado Pago cobra en la moneda de SU cuenta: otra moneda se rechaza antes, en vez de mandar un cobro raro;
//   · el comprador se busca sin mayúsculas (`compradorEnContexto`, la vara de lib/compra-plan.ts): con el email exacto, un
//     lead guardado con mayúsculas no se veía y la venta chocaba con «más de un lead» teniendo uno solo;
//   · un link PENDIENTE de ese plan para esa persona no se duplica (`cobroAbiertoDelPlan`): dos pedidos dejaban dos links
//     vivos, y pagar los dos creaba dos cuentas.
// =============================================================================

import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { createLead } from './leads';
import { LeadDuplicadoError } from './leads-duplicados';
import { crearCobro, linkDelCobro, listarCobros, pasarelasConectadas } from './cobros';
import { decidirCobro, montoUsdDelCobro } from './cobros-reglas';
import { NOMBRE_PASARELA, type Cobro, type Pasarela } from './cobros-tipos';
import { monedaDeMercadoPagoDeMako } from './compra-plan';
import { leadPorEmail } from './editor-landing/pago-pedido';
import { buscarUsuarioPorEmail } from './usuarios';
import { capaDef } from './capas';
import { ventaValida, type VentaPlan, type VentaValida } from './vender-plan-reglas';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';

export { ventaValida };
export type { VentaPlan, VentaValida };

export type ResultadoVenta =
  | { ok: true; link: string; cobroId: number; monto: number; moneda: string; yaEstaba?: true }
  | { ok: false; error: string; faltan?: string[] };

/** Lo que va a cobrar el link, como lo decide `crearCobro`. */
export type PreviaVenta = { pasarela: Pasarela; monto: number; moneda: string; montoUsd: number };

/**
 * Lo que va a cobrar el link —la pasarela, la moneda y el valor en dólares—, SIN escribir nada, con las mismas reglas que
 * `crearCobro` (`decidirCobro` y `montoUsdDelCobro`, lib/cobros-reglas.ts). La usan `venderPlan` antes de crear el lead y
 * el `preparar()` de la API para que el resumen diga lo que de verdad se cobra.
 *
 * ⚠️ MERCADO PAGO COBRA EN LA MONEDA DE SU CUENTA (lib/compra-plan.ts, `monedaDeMercadoPagoDeMako`). Otra moneda se rechaza
 * acá: la pantalla ya la ignoraba, y la API mandaba un cobro en una moneda que esa cuenta no cobra.
 */
export async function previaDeLaVenta(v: VentaValida, ws: number): Promise<{ ok: true; previa: PreviaVenta } | { ok: false; error: string; faltan?: string[] }> {
  const conectadas = await pasarelasConectadas(ws).catch(() => null);
  if (!conectadas) return { ok: false, error: 'No pude leer las pasarelas de la plataforma. Intenta de nuevo en un rato.' };
  if (!conectadas.length) return { ok: false, error: 'La plataforma no tiene Stripe ni Mercado Pago conectado: se conecta en Integraciones.' };
  if (v.pasarela && !conectadas.includes(v.pasarela)) return { ok: false, error: `${NOMBRE_PASARELA[v.pasarela]} no está conectada en la plataforma.` };
  const elegida: Pasarela | null = v.pasarela ?? (conectadas.length === 1 ? conectadas[0] : null);
  if (!elegida) return { ok: false, error: '¿Por Stripe o por Mercado Pago? La plataforma tiene las dos conectadas.', faltan: ['pasarela'] };
  let monedaDeLaCuenta: string | null = null;
  if (elegida === 'mercadopago') {
    monedaDeLaCuenta = await monedaDeMercadoPagoDeMako();
    if (!monedaDeLaCuenta) return { ok: false, error: 'No pude leer en qué moneda cobra la Mercado Pago de MaKo. Intenta de nuevo en un rato.' };
    if (v.moneda && v.moneda !== monedaDeLaCuenta) {
      return { ok: false, error: `Mercado Pago cobra en la moneda de su cuenta (${monedaDeLaCuenta}): el monto va en ${monedaDeLaCuenta}.`, faltan: ['moneda'] };
    }
  }
  const d = decidirCobro({ pasarela: elegida, conectadas, monto: v.monto, moneda: v.moneda, productoMontoUsd: null, monedaDeLaCuenta, tipo: v.tipo, email: v.email });
  if (!d.ok) return { ok: false, error: d.error, faltan: d.faltan };
  const montoUsd = montoUsdDelCobro({ monto: d.monto, moneda: d.moneda, montoUsdDeclarado: v.montoUsd, productoMontoUsd: null });
  if (montoUsd == null) return { ok: false, error: `¿Cuánto es en dólares? Hace falta para crear el link (se cobra en ${d.moneda}).`, faltan: ['montoUsd'] };
  return { ok: true, previa: { pasarela: d.pasarela, monto: d.monto, moneda: d.moneda, montoUsd } };
}

/**
 * El comprador entre los leads de la plataforma, por su email comparado EXACTO pero sin mayúsculas: un patrón trae los
 * candidatos (con `\`, `%` y `_` escapados) y `leadPorEmail` decide (la vara de lib/compra-plan.ts). `ambiguo` = dos o más
 * leads con ese email: no se elige uno a ciegas. Corre ADENTRO de runWithWorkspace(wsSuperAdmin()). Tira si no pudo leer.
 */
async function compradorEnContexto(email: string): Promise<{ id: number } | { ambiguo: true } | null> {
  const db = await getTenantDb();
  const patron = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await db.from('leads').select('id, email').ilike('email', patron).limit(20);
  if (error) throw new Error(`No pude buscar el lead: ${error.message}`);
  const r = leadPorEmail((data ?? []) as Array<{ id: number; email: string | null }>, email);
  return r == null ? null : r.ambiguo ? { ambiguo: true } : { id: r.id };
}

/** Lo mismo, desde afuera del contexto (el `preparar()` de la API, para decir antes del «sí» lo que pasaría). */
export async function compradorEnLaPlataforma(email: string): Promise<{ id: number } | { ambiguo: true } | null> {
  return runWithWorkspace(await wsSuperAdmin(), () => compradorEnContexto(email));
}

/**
 * Un cobro de ESTE plan que ya está abierto para ese lead: pendiente (su link sigue cobrando) o pagado con el alta sin
 * terminar. Dos links vivos del mismo plan se pueden pagar los dos y crear dos cuentas. Tira si no pudo leer.
 */
export async function cobroAbiertoDelPlan(ws: number, leadId: number, capa: string): Promise<{ pendiente: Cobro } | { pagado: Cobro } | null> {
  const delPlan = (await listarCobros(ws, { leadId, limite: 50 })).filter((c) => c.alta_capa === capa);
  const pendiente = delPlan.find((c) => c.estado === 'pendiente');
  if (pendiente) return { pendiente };
  const pagado = delPlan.find((c) => c.estado === 'pagado' && (c.alta_estado == null || c.alta_estado === 'pendiente' || c.alta_estado === 'error'));
  return pagado ? { pagado } : null;
}

/**
 * Si ese email ya tiene cuenta de MaKo. Al pagarse, el alta de una cuenta que ya existe queda «Ya tenía cuenta» y el plan
 * se le da a mano («Darle el plan a su cuenta», `atarCobroASuCuenta`), que se niega con la plataforma y con quien no es el
 * dueño de su negocio: esos dos se rechazan antes del link. Tira si no pudo leer.
 */
export async function cuentaDelComprador(email: string): Promise<'ninguna' | 'duena' | 'plataforma' | 'equipo'> {
  const u = await buscarUsuarioPorEmail(email);
  if (!u || u.workspace_id == null) return 'ninguna';
  if (u.workspace_id === (await wsSuperAdmin())) return 'plataforma';
  return u.rol_ws === 'admin' ? 'duena' : 'equipo';
}

const mismoCentavo = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

/**
 * Busca al comprador entre los leads de la plataforma (o lo crea) y le arma el link de pago. Al pagarse, el alta de
 * su cuenta la hace lib/cobros.ts (`altaSiCorresponde`). `creadoPor` firma el cobro.
 */
export async function venderPlan(v: Partial<VentaPlan> | null | undefined, creadoPor: string): Promise<ResultadoVenta> {
  const val = ventaValida(v);
  if (!val.ok) return val;
  const venta = val.venta;
  try {
    const ws = await wsSuperAdmin();
    // Lo que se puede saber sin escribir, ANTES de crear el lead.
    const p = await previaDeLaVenta(venta, ws);
    if (!p.ok) return p;
    const lead = await runWithWorkspace(ws, () => leadDelComprador(venta.email, venta.nombre));
    if (!lead.ok) return lead;
    const abierto = await cobroAbiertoDelPlan(ws, lead.id, venta.capa);
    if (abierto && 'pendiente' in abierto) {
      const c = abierto.pendiente;
      // El MISMO pedido (monto, moneda, tipo y pasarela): es el link que ya existe. Otro precio no pisa el de antes.
      if (mismoCentavo(c.monto, p.previa.monto) && c.moneda === p.previa.moneda && c.tipo === venta.tipo && c.proveedor === p.previa.pasarela) {
        return { ok: true, link: linkDelCobro(c.token), cobroId: c.id, monto: c.monto, moneda: c.moneda, yaEstaba: true };
      }
      return { ok: false, error: `Ya tiene un link pendiente de ese plan por otro monto (cobro #${c.id}): anúlalo primero para crear otro.` };
    }
    if (abierto) return { ok: false, error: `Ya pagó el plan ${capaDef(venta.capa).nombre} (cobro #${abierto.pagado.id}) y su cuenta todavía no quedó dada de alta: se revisa en Cobros.` };
    const r = await crearCobro(ws, {
      leadId: lead.id, altaCapa: venta.capa, monto: p.previa.monto, moneda: p.previa.moneda, montoUsd: p.previa.montoUsd,
      tipo: venta.tipo, email: venta.email, nombre: venta.nombre, pasarela: p.previa.pasarela, creadoPor,
    });
    if (!r.ok) return { ok: false, error: r.error };
    // El monto y la moneda COMO QUEDARON en el cobro.
    return { ok: true, link: r.link, cobroId: r.cobro.id, monto: r.cobro.monto, moneda: r.cobro.moneda };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'No pude crear el link.' };
  }
}

/**
 * El lead del comprador en el CRM de la plataforma, por su email (sin mayúsculas, `compradorEnContexto`). Corre ADENTRO
 * de runWithWorkspace(wsSuperAdmin()): getTenantDb y createLead escriben en el workspace del contexto.
 *
 * ⚠️ CON DOS LEADS DEL MISMO EMAIL NO SE ELIGE: un cobro atado al lead equivocado deja el alta y el historial en la ficha
 * de otra persona.
 */
async function leadDelComprador(email: string, nombre: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const ya = await compradorEnContexto(email);
  if (ya && 'ambiguo' in ya) return { ok: false, error: 'Hay más de un lead con ese email: no elijo uno a ciegas.' };
  if (ya) return { ok: true, id: ya.id };
  try {
    // `carga_manual`, como el alta del CRM y la de Customer Success: alguien lo tipeó.
    const nuevo = await createLead({ nombre, email, origen_lead: ORIGEN_LEAD.carga_manual.id });
    return { ok: true, id: nuevo.id };
  } catch (e) {
    // El email no lo tiene nadie (se acaba de buscar): lo que choca es otro dato (el nombre, el teléfono). No se elige solo.
    if (e instanceof LeadDuplicadoError) return { ok: false, error: `No creé el lead del comprador: ${e.message}` };
    throw e;
  }
}
