'use server';

// =============================================================================
// /admin/cobros — las acciones del SUPER ADMIN vendiendo MaKo
// =============================================================================
// Pedido de Martín (11/10/2026): «Lo voy a utilizar yo como superadmin para vender MaKo». Vender un
// plan es crear un COBRO en el workspace de la plataforma con `altaCapa`: al pagarse, lib/cobros.ts
// da de alta la cuenta sola (decisión suya del mismo día: «alta automática»). Esta pantalla no tiene
// máquina propia: busca o crea el lead del comprador y llama a `crearCobro`, igual que la ficha de un
// lead de cualquier cliente. Lo que es de la plataforma (crear inquilinos) lo decide lib/cobros.ts
// por el WORKSPACE, no esta pantalla.
//
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA DE CADA UNA. El id de una server action viaja en el
//    bundle y Next la ejecuta por cualquier puerta que lo tenga: que la página sea de admin no
//    protege nada (molde: app/conocimientos/ajustes-actions.ts). Lo fija tests/admin-cobros.test.ts.
// ⚠️ EL WORKSPACE ES `wsSuperAdmin()`, NUNCA OWNER_WS NI EL DE LA COOKIE. OWNER_WS (1) es Mauricio,
//    un CLIENTE: un plan de MaKo cobrado ahí entraría a su CRM, con SU Stripe. Y la cookie del super
//    admin puede estar mirando a cualquier cliente (`?ws=`). Por eso el ws se resuelve acá adentro y
//    nunca viaja desde la pantalla.
// ⚠️ REEMBOLSAR MUEVE PLATA REAL y no se reintenta solo (AGENTS.md: «lo que gasta plata ajena NO se
//    reintenta por default»): lo pide una persona con una confirmación, y la clave de idempotencia la
//    pone lib/cobros.ts por cobro.

import { revalidatePath } from 'next/cache';
import { getSesionAdmin } from '@/lib/auth';
import { getTenantDb, getWorkspace, runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { createLead, findLeadByContacto } from '@/lib/leads';
import { LeadDuplicadoError } from '@/lib/leads-duplicados';
import { esCapaVendible } from '@/lib/alta-cliente';
import { anularCobro, crearCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro } from '@/lib/cobros';
import { esPasarela, type Cobro, type EstadoAlta, type EstadoCobro, type ModoCobro, type Pasarela, type TipoCobro } from '@/lib/cobros-tipos';
import { normalizarMoneda } from '@/lib/pasarela-moneda';
import { capaDef } from '@/lib/capas';
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';
import { guardarPrecioClienteDeAgencia, precioClienteDeAgencia } from '@/lib/agencia-cobro';
import type { PrecioClienteAgencia } from '@/lib/agencia-cobro-reglas';

const NO_ADMIN = 'Sólo el super admin vende planes de MaKo.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Tope de la lista: es lo que devuelve `listarCobros` como máximo. Llegar a él se DICE en pantalla. */
const TOPE_LISTA = 200;

const mensaje = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);
const autorDe = (s: { nombre?: string; email?: string }) => s.nombre?.trim() || s.email?.trim() || 'Super admin';

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

/**
 * «Vender un plan»: busca al comprador entre los leads de la plataforma (o lo crea) y le arma el
 * link de pago. Al pagarse, el alta de su cuenta la hace lib/cobros.ts (`altaSiCorresponde`).
 */
export async function venderPlanAction(v: VentaPlan): Promise<ResultadoVenta> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };

  const capa = String(v?.capa ?? '').trim();
  // En positivo, contra la lista de lo que SE VENDE: la capa de la plataforma no es un plan, es cómo
  // se identifica MaKo (lib/capas.ts). lib/cobros.ts vuelve a preguntarlo; acá se corta antes de
  // crear un lead para nada.
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
  const montoUsd = Number(v?.montoUsd);
  const elegida = v?.pasarela;
  const pasarela = esPasarela(elegida) ? elegida : null;

  try {
    const ws = await wsSuperAdmin();
    const lead = await runWithWorkspace(ws, () => leadDelComprador(email, nombre));
    if (!lead.ok) return lead;
    const r = await crearCobro(ws, {
      leadId: lead.id,
      altaCapa: capa,
      monto,
      moneda,
      montoUsd: Number.isFinite(montoUsd) && montoUsd > 0 ? montoUsd : null,
      tipo,
      email,
      nombre,
      pasarela,
      creadoPor: autorDe(admin),
    });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath('/admin/cobros');
    // El monto y la moneda COMO QUEDARON: con Mercado Pago la moneda la decide su cuenta, no la pantalla.
    return { ok: true, link: r.link, cobroId: r.cobro.id, monto: r.cobro.monto, moneda: r.cobro.moneda };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude crear el link.') };
  }
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

/** Una fila de la lista, sin lo que no hace falta en el navegador (ni la URL del proveedor). */
export type CobroMako = {
  id: number;
  nombre: string | null;
  email: string | null;
  /** El nombre del plan (capaDef), o null si el cobro no da de alta una cuenta. */
  plan: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  monto_usd: number | null;
  tipo: TipoCobro;
  modo: ModoCobro;
  proveedor: Pasarela;
  estado: EstadoCobro;
  motivo: string | null;
  alta_estado: EstadoAlta | null;
  alta_motivo: string | null;
  alta_ws: number | null;
  /** El nombre del workspace que se creó al pagar. */
  alta_ws_nombre: string | null;
  created_at: string;
  pagado_at: string | null;
  /** /pagar/<token>, sólo mientras se puede pagar (pendiente o rechazado). */
  link: string | null;
};

export type DatosCobrosMako =
  | { ok: true; ws: number; pasarelas: Pasarela[]; cobros: CobroMako[]; truncado: boolean }
  | { ok: false; error: string };

/** Los cobros de la plataforma, las pasarelas con las que puede cobrar y la cuenta creada por cada alta. */
export async function cobrosDeMakoAction(): Promise<DatosCobrosMako> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const ws = await wsSuperAdmin();
    const [pasarelas, cobros] = await Promise.all([pasarelasConectadas(ws), listarCobros(ws, { limite: TOPE_LISTA })]);
    const idsAlta = [...new Set(cobros.map((c) => c.alta_ws).filter((x): x is number => x != null))];
    const nombres = new Map<number, string>();
    await Promise.all(idsAlta.map(async (id) => {
      const w = await getWorkspace(id).catch(() => null);
      if (w) nombres.set(id, w.nombre);
    }));
    return { ok: true, ws, pasarelas, cobros: cobros.map((c) => fila(c, nombres)), truncado: cobros.length >= TOPE_LISTA };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude leer los cobros.') };
  }
}

function fila(c: Cobro, nombres: Map<number, string>): CobroMako {
  return {
    id: c.id, nombre: c.nombre, email: c.email,
    plan: c.alta_capa ? capaDef(c.alta_capa).nombre : null,
    concepto: c.concepto, monto: c.monto, moneda: c.moneda, monto_usd: c.monto_usd,
    tipo: c.tipo, modo: c.modo, proveedor: c.proveedor, estado: c.estado, motivo: c.motivo,
    alta_estado: c.alta_estado, alta_motivo: c.alta_motivo, alta_ws: c.alta_ws,
    alta_ws_nombre: c.alta_ws != null ? nombres.get(c.alta_ws) ?? null : null,
    created_at: c.created_at, pagado_at: c.pagado_at,
    link: c.estado === 'pendiente' || c.estado === 'fallido' ? linkDelCobro(c.token) : null,
  };
}

/** Anula un link que todavía no se pagó (Stripe expira la sesión; Mercado Pago no tiene cómo). */
export async function anularCobroMakoAction(id: number): Promise<{ ok: boolean; error?: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Ese cobro no existe.' };
  try {
    const r = await anularCobro(await wsSuperAdmin(), id, autorDe(admin));
    if (r.ok) revalidatePath('/admin/cobros');
    return r;
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude anular el link.') };
  }
}

/**
 * Devuelve el pago ENTERO por la pasarela. Una sola vez por pedido: si falla, lo dice y no reintenta.
 * La cuenta que se creó al pagar NO se toca: darla de baja es otra decisión.
 */
export async function reembolsarCobroMakoAction(id: number, motivo?: string | null): Promise<{ ok: boolean; resumen: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, resumen: NO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, resumen: 'Ese cobro no existe.' };
  try {
    const r = await reembolsarCobro(await wsSuperAdmin(), id, autorDe(admin), (motivo ?? '').trim().slice(0, 300) || null);
    if (r.ok) revalidatePath('/admin/cobros');
    return r;
  } catch (e) {
    return { ok: false, resumen: mensaje(e, 'No pude hacer el reembolso.') };
  }
}

// ── El precio de un cliente de agencia (#866, 17/10/2026) ─────────────────────────────────────
// Lo que MaKo le cobra a una agencia por cada cliente: US$ 47 (la llamada con Código Inmobiliario) y lo que eso es en la
// moneda de la Mercado Pago de MaKo, que cobra en pesos. Sin el monto en pesos no sale el link del primer mes: MaKo no
// inventa una tasa de cambio. Las reglas, en lib/agencia-cobro-reglas.ts.

export async function precioClienteAgenciaAction(): Promise<{ ok: true; precio: PrecioClienteAgencia } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: 'Sólo el super admin.' };
  try { return { ok: true, precio: await precioClienteDeAgencia() }; } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

export async function guardarPrecioClienteAgenciaAction(p: { usd: number; moneda: string; monto: number | null }): Promise<{ ok: true; precio: PrecioClienteAgencia } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: 'Sólo el super admin.' };
  try {
    const precio = await guardarPrecioClienteDeAgencia({ usd: p.usd, mp: p.monto ? { moneda: p.moneda, monto: p.monto } : null });
    revalidatePath('/admin/cobros');
    return { ok: true, precio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
