'use server';

// =============================================================================
// cobro-etapa-actions — «Vincular cobro» en el ⋯ de la etapa Ganado (22/10/2026, mig 0326)
// =============================================================================
// Las puertas del modal que dibuja el CRM (el ⋯ de la columna Ganado, como «Asignar evento»). El contrato es el de
// contrato-cobro-en-ganado.md (las notas del Cerebro): estas firmas no cambian sin avisar. Las reglas viven en
// lib/cobro-etapa.ts y la base en lib/cobro-etapa-server.ts. Acá sólo: quién puede (leer, cualquiera con sesión;
// escribir, el admin del negocio, el mismo corte que `editarEtapaAction`) y qué se devuelve.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos). Ver AGENTS.md.
// =============================================================================

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo, wsObligatorio } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { exigirSesion } from '@/lib/sesion-accion';
import { cuentasDePago } from '@/lib/cuentas-pago-server';
import { type CuentaPago, type FotoCobroEtapa, type ProductoCobro, type ProductoCobroInput, type ResCobro, type VinculoCobro } from '@/lib/cobro-etapa';
import { cambiarCuentas, desvincular, ganadoDelCrm, guardarProducto, productosParaCobrar, vincular, vinculosDeEtapa, vinculosDelNegocio } from '@/lib/cobro-etapa-server';
import { listarFunnels } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { importarPrecioDeStripe, preciosDeStripe, type AvisoDeCuentaStripe, type PrecioDeStripe } from '@/lib/stripe-catalogo';

export type { CuentaPago, FotoCobroEtapa, ProductoCobro, ProductoCobroInput, ResCobro, VinculoCobro } from '@/lib/cobro-etapa';
export type { AvisoDeCuentaStripe, PrecioDeStripe } from '@/lib/stripe-catalogo';

const SOLO_ADMIN = 'Solo el administrador del negocio puede vincular cobros.';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function esAdmin(): Promise<boolean> {
  return (await getRolWsEfectivo()) === 'admin';
}

async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

/**
 * Las cuentas que cobran del negocio en curso, cada una con su nombre (varias por proveedor, 22/10/2026): las que el
 * modal deja elegir. Una a la que le falta el aviso de pagos no está: su pago nunca volvería al CRM.
 */
async function cuentasConectadas(): Promise<CuentaPago[]> {
  const cs = await cuentasDePago(await wsObligatorio());
  return cs.filter((c) => c.conectada).map(({ id, proveedor, nombre, principal }) => ({ id, proveedor, nombre, principal }));
}

/** Lo que el modal necesita de una vez: las cuentas, los productos activos, los vínculos de ESTA etapa y si puede editar. */
export async function leerCobroDeEtapaAction(funnelId: number, etapa: string): Promise<ResCobro<{ foto: FotoCobroEtapa }>> {
  await exigirSesion();
  try {
    const [cuentas, productos, vinculos, puedeEditar] = await Promise.all([
      cuentasConectadas(), productosParaCobrar(), vinculosDeEtapa(Number(funnelId), String(etapa)), esAdmin(),
    ]);
    return { ok: true, foto: { cuentas, productos, vinculos, puedeEditar } };
  } catch (e) {
    console.error('[cobro-etapa] leer:', msg(e));
    return { ok: false, error: `No pude leer los cobros de esta etapa: ${msg(e)}` };
  }
}

/** Vincula un producto a la etapa Ganado de un CRM, cobrable por esas cuentas. Un producto cobra en UN CRM. */
export async function vincularProductoAEtapaAction(p: { funnelId: number; etapa: string; productoId: number; cuentas: string[] }): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await vincular(p, await cuentasConectadas(), await autorActual());
    if (r.ok) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[cobro-etapa] vincular:', msg(e));
    return { ok: false, error: `No se pudo vincular: ${msg(e)}` };
  }
}

/**
 * Los precios activos de las cuentas de Stripe conectadas, EN VIVO (23/10/2026, llamada con Mauricio: su producto de
 * Stripe no aparecía y «Volver a leer» no traía nada). Aparte de la foto para que el modal abra sin esperar a Stripe.
 */
export async function preciosDeStripeAction(): Promise<ResCobro<{ precios: PrecioDeStripe[]; errores: AvisoDeCuentaStripe[] }>> {
  await exigirSesion();
  try {
    return { ok: true, ...(await preciosDeStripe(await wsObligatorio())) };
  } catch (e) {
    console.error('[cobro-etapa] precios de Stripe:', msg(e));
    return { ok: false, error: `No pude leer los productos de Stripe: ${msg(e)}` };
  }
}

/**
 * Trae un precio de Stripe al catálogo (lo crea, o le pone ese precio al producto de MaKo con el mismo nombre) y lo
 * vincula a Ganado. El monto se vuelve a leer en Stripe: del navegador viene sólo QUÉ precio. Sin `cuentas`, cobra por
 * la cuenta de Stripe donde está. Si lo trajo y no se pudo vincular, el error lleva el producto (el modal lo pone).
 */
export async function vincularPrecioDeStripeAction(p: { funnelId: number; etapa: string; cuenta: string; precio: string; cuentas?: string[] }): Promise<
  ResCobro<{ producto: ProductoCobro; vinculo: VinculoCobro; cambio: 'creado' | 'precio' | 'igual' }> | { ok: false; error: string; producto: ProductoCobro }
> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  let imp: Awaited<ReturnType<typeof importarPrecioDeStripe>> = { ok: false, error: 'No se pudo traer de Stripe.' };
  let conectadas: CuentaPago[] = [];
  const funnelId = Number(p.funnelId);
  try {
    // LO QUE PUEDE FRENAR EL VÍNCULO, ANTES DE TOCAR EL CATÁLOGO (revisión adversarial del 23/10/2026): el CRM y su
    // Ganado, las cuentas, y que el producto de MaKo no cobre ya en otro CRM (uno solo). Si no, el producto quedaba
    // creado o con su precio cambiado para todo el negocio, y el vínculo fallaba después.
    conectadas = await cuentasConectadas();
    const g = await ganadoDelCrm(funnelId);
    if (!g) return { ok: false, error: 'Ese CRM no existe en este negocio.' };
    if (g.etapa !== String(p.etapa)) return { ok: false, error: 'Un cobro se vincula a la etapa de Ganado.' };
    imp = await importarPrecioDeStripe(await wsObligatorio(), p.cuenta, p.precio, async (productoId) => {
      if (productoId == null) return null;
      const ya = (await vinculosDelNegocio()).find((v) => v.productoId === productoId);
      if (!ya || ya.funnelId === funnelId) return null;
      const f = (await listarFunnels()).find((x) => x.id === ya.funnelId);
      return `Ese producto ya cobra en ${f ? `«${nombreVisible(f)}»` : 'otro CRM'}: quítalo de ahí primero.`;
    });
    if (!imp.ok) return imp;
  } catch (e) {
    console.error('[cobro-etapa] traer de Stripe:', msg(e));
    return { ok: false, error: `No se pudo traer de Stripe: ${msg(e)}` };
  }
  if (!imp.ok) return imp;
  const traido = imp;
  if (traido.cambio !== 'igual') revalidatePath('/crm');
  // Ya está en el catálogo: si vincular se cae, se dice eso (y el modal recibe el producto), no «no se pudo traer».
  const hecho = traido.cambio === 'creado' ? `Traje «${traido.producto.nombre}» al catálogo` : traido.cambio === 'precio' ? `Le puse el precio de Stripe a «${traido.producto.nombre}»` : null;
  const noSeVinculo = (error: string) => ({ ok: false as const, error: hecho ? `${hecho}, pero no se vinculó: ${error}` : error, producto: traido.producto });
  try {
    const pedidas = Array.isArray(p.cuentas) && p.cuentas.length ? p.cuentas : [String(p.cuenta)];
    const v = await vincular({ funnelId, etapa: String(p.etapa), productoId: traido.producto.id, cuentas: pedidas }, conectadas, await autorActual());
    if (!v.ok) return noSeVinculo(v.error);
    revalidatePath('/crm');
    return { ok: true, producto: traido.producto, vinculo: v.vinculo, cambio: traido.cambio };
  } catch (e) {
    console.error('[cobro-etapa] vincular lo traído de Stripe:', msg(e));
    return noSeVinculo(msg(e));
  }
}

/** Cambia las cuentas por las que se cobra un vínculo (al menos una). */
export async function cambiarCuentasDelVinculoAction(vinculoId: number, cuentas: string[]): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return await cambiarCuentas(Number(vinculoId), Array.isArray(cuentas) ? cuentas : [], await cuentasConectadas());
  } catch (e) {
    console.error('[cobro-etapa] cuentas:', msg(e));
    return { ok: false, error: `No se pudieron cambiar las cuentas: ${msg(e)}` };
  }
}

/** Quita un vínculo; devuelve con qué volver a vincularlo (el Deshacer). */
export async function desvincularProductoAction(vinculoId: number): Promise<ResCobro<{ deshacer: { funnelId: number; etapa: string; productoId: number; cuentas: string[] } }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    const r = await desvincular(Number(vinculoId));
    if (r.ok) revalidatePath('/crm');
    return r;
  } catch (e) {
    console.error('[cobro-etapa] desvincular:', msg(e));
    return { ok: false, error: `No se pudo quitar: ${msg(e)}` };
  }
}

/** Crea un producto (sin `id`) o edita el nombre, el tipo, el precio, el plazo y las cuotas de uno (con `id`). */
export async function guardarProductoCobroAction(input: ProductoCobroInput, id?: number): Promise<ResCobro<{ producto: ProductoCobro }>> {
  await exigirSesion();
  if (!(await esAdmin())) return { ok: false, error: SOLO_ADMIN };
  try {
    return await guardarProducto(input, id == null ? undefined : Number(id));
  } catch (e) {
    console.error('[cobro-etapa] producto:', msg(e));
    return { ok: false, error: `No se pudo guardar el producto: ${msg(e)}` };
  }
}

/**
 * El link para pegar en una landing o un mensaje. TODAVÍA NO (22/10/2026): un link sin lead necesita su propia página de
 * pago (la de la landing pide nombre y email antes de cobrar). Mientras, el producto se cobra con el Botón de pago de una
 * landing o con un link desde la ficha del lead, y al pagarse pasa a Ganado igual.
 */
export async function linkDelVinculoAction(vinculoId: number, cuentaId: string): Promise<ResCobro<{ url: string }>> {
  await exigirSesion();
  void vinculoId; void cuentaId;
  return { ok: false, error: 'Cóbralo con el Botón de pago de una landing o con un link desde la ficha del lead: al pagarse, pasa a Ganado aquí.' };
}
