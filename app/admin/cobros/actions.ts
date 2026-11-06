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
import { getWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { venderPlan, type VentaPlan, type ResultadoVenta } from '@/lib/vender-plan';
import { anularCobro, atarCobroASuCuenta, cancelarSuscripcionCobro, getCobro, linkDelCobro, listarCobros, pasarelasConectadas, reembolsarCobro } from '@/lib/cobros';
import type { Cobro, EstadoAlta, EstadoCobro, ModoCobro, Pasarela, TipoCobro } from '@/lib/cobros-tipos';
import { capaDef } from '@/lib/capas';
import { guardarPrecioClienteDeAgencia, precioClienteDeAgencia } from '@/lib/agencia-cobro';
import type { PrecioClienteAgencia } from '@/lib/agencia-cobro-reglas';
import { guardarPrecioLocal, monedaDeMercadoPagoDeMako, planesMako } from '@/lib/compra-plan';

const NO_ADMIN = 'Sólo el super admin vende planes de MaKo.';
/** Tope de la lista: es lo que devuelve `listarCobros` como máximo. Llegar a él se DICE en pantalla. */
const TOPE_LISTA = 200;

const mensaje = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);
const autorDe = (s: { nombre?: string; email?: string }) => s.nombre?.trim() || s.email?.trim() || 'Super admin';

/**
 * «Vender un plan»: busca al comprador entre los leads de la plataforma (o lo crea) y le arma el
 * link de pago. Al pagarse, el alta de su cuenta la hace lib/cobros.ts (`altaSiCorresponde`).
 *
 * Desde el 23/10/2026 el camino vive en lib/vender-plan.ts (`venderPlan`), que usa también la API de MaKo
 * (vender_plan_mako): la capa en positivo, el email, el workspace de la plataforma y el lead del comprador.
 * Acá quedan el super admin primero y el `revalidatePath`.
 */
export async function venderPlanAction(v: VentaPlan): Promise<ResultadoVenta> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  const r = await venderPlan(v, autorDe(admin));
  if (r.ok) revalidatePath('/admin/cobros');
  return r;
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
  /** La capa que da de alta al pagarse (y si lo armó «Vender un plan» o el checkout de /planes: `creado_por`). */
  alta_capa: string | null;
  /** Quién lo armó: la persona («Vender un plan»), «planes:…» (el checkout público de /planes), o null. */
  creado_por: string | null;
  created_at: string;
  pagado_at: string | null;
  /** /pagar/<token>, sólo mientras se puede pagar (pendiente o rechazado). */
  link: string | null;
  /**
   * Una suscripción que la pasarela SIGUE cobrando todos los meses (pagada o con el primer pago devuelto, y no cancelada).
   * Es lo que habilita «Cortar la suscripción»: reembolsar no la corta (revisión del 23/10/2026).
   */
  suscripcionViva: boolean;
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
    alta_capa: c.alta_capa ?? null, creado_por: c.creado_por ?? null,
    created_at: c.created_at, pagado_at: c.pagado_at,
    link: c.estado === 'pendiente' || c.estado === 'fallido' ? linkDelCobro(c.token) : null,
    suscripcionViva: suscripcionViva(c),
  };
}

/**
 * ¿La pasarela le sigue cobrando todos los meses? La misma lectura del id que `cancelarSuscripcionCobro` (en Mercado Pago
 * el id del preapproval es el `proveedor_ref` del cobro). Un primer pago devuelto NO la corta: la pasarela sigue cobrando.
 */
function suscripcionViva(c: Cobro): boolean {
  const susId = c.proveedor_suscripcion_id ?? (c.proveedor === 'mercadopago' && c.tipo === 'suscripcion' ? c.proveedor_ref : null);
  return c.tipo === 'suscripcion' && !!susId && c.suscripcion_estado !== 'cancelada' && (c.estado === 'pagado' || c.estado === 'reembolsado');
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
 *
 * ⚠️ REEMBOLSAR UNA SUSCRIPCIÓN NO LA CORTA (revisión del 23/10/2026): la pasarela devuelve el pago y sigue cobrando cada
 * mes, y la renovación entra como plata nueva. Con `cortarSuscripcion` se corta ANTES de devolver: si la pasarela no la
 * corta, no se devuelve nada y se dice por qué (un reembolso hecho con la suscripción viva es justo lo que hay que evitar).
 */
export async function reembolsarCobroMakoAction(
  id: number,
  motivo?: string | null,
  opts: { cortarSuscripcion?: boolean } = {},
): Promise<{ ok: boolean; resumen: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, resumen: NO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, resumen: 'Ese cobro no existe.' };
  try {
    const ws = await wsSuperAdmin();
    let cortada = false;
    if (opts.cortarSuscripcion === true) {
      const c = await getCobro(ws, id);
      if (c && suscripcionViva(c)) {
        const corte = await cancelarSuscripcionCobro(ws, id, autorDe(admin));
        if (!corte.ok) return { ok: false, resumen: `No devolví nada: ${corte.resumen}` };
        cortada = true;
      }
    }
    const r = await reembolsarCobro(ws, id, autorDe(admin), (motivo ?? '').trim().slice(0, 300) || null);
    revalidatePath('/admin/cobros');
    // Cortada y sin devolver: que se sepa que el corte SÍ quedó (no se le vuelve a cobrar), y que la plata falta devolverla.
    if (cortada && !r.ok) return { ok: false, resumen: `La suscripción quedó cortada, pero el reembolso no: ${r.resumen}` };
    return cortada && r.ok ? { ok: true, resumen: `${r.resumen} La suscripción quedó cortada.` } : r;
  } catch (e) {
    return { ok: false, resumen: mensaje(e, 'No pude hacer el reembolso.') };
  }
}

/** «Darle el plan a su cuenta»: un cobro «Ya tenía cuenta» queda atado a la cuenta de ese email, con el plan que pagó. */
export async function atarCobroMakoAction(id: number): Promise<{ ok: boolean; resumen: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, resumen: NO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, resumen: 'Ese cobro no existe.' };
  try {
    const r = await atarCobroASuCuenta(await wsSuperAdmin(), id, autorDe(admin));
    if (r.ok) revalidatePath('/admin/cobros');
    return r;
  } catch (e) {
    return { ok: false, resumen: mensaje(e, 'No pude atar el cobro a su cuenta.') };
  }
}

/** «Cortar la suscripción»: la pasarela deja de cobrar en el acto. Irreversible en Mercado Pago. No devuelve nada. */
export async function cancelarSuscripcionMakoAction(id: number): Promise<{ ok: boolean; resumen: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, resumen: NO_ADMIN };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, resumen: 'Ese cobro no existe.' };
  try {
    const r = await cancelarSuscripcionCobro(await wsSuperAdmin(), id, autorDe(admin));
    if (r.ok) revalidatePath('/admin/cobros');
    return r;
  } catch (e) {
    return { ok: false, resumen: mensaje(e, 'No pude cortar la suscripción.') };
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

// ── El precio de cada plan en la moneda de la Mercado Pago de MaKo (revisión del 23/10/2026) ─────────────────────
// Sin él, /planes no ofrece Mercado Pago (nunca se inventa una tasa). Lo pone Martín: precio y cobros son decisión suya.

export type PrecioLocalPlan = { id: string; nombre: string; precioUsd: number; local: number | null; activo: boolean };

/** La moneda de la Mercado Pago de MaKo (null = no está conectada) y cada plan con su precio en esa moneda. */
export async function preciosLocalesAction(): Promise<{ ok: true; moneda: string | null; planes: PrecioLocalPlan[] } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const [moneda, planes] = await Promise.all([monedaDeMercadoPagoDeMako(), planesMako()]);
    return {
      ok: true, moneda,
      planes: planes.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd, local: moneda ? p.preciosLocales[moneda] ?? null : null, activo: p.activo })),
    };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude leer los planes.') };
  }
}

/** Guarda (o saca, con null) el precio de un plan en la moneda de la Mercado Pago de MaKo. */
export async function guardarPrecioLocalAction(planId: string, monto: number | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const moneda = await monedaDeMercadoPagoDeMako();
    if (!moneda) return { ok: false, error: 'Conecta la Mercado Pago de MaKo primero: el precio va en su moneda.' };
    const r = await guardarPrecioLocal(String(planId ?? ''), moneda, monto == null ? null : Number(monto));
    if (!r.ok) return r;
    revalidatePath('/admin/cobros');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensaje(e, 'No pude guardar el precio.') };
  }
}
