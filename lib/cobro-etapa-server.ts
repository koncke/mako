// =============================================================================
// cobro-etapa-server — los vínculos etapa ↔ producto, los productos del modal, y el trato de un pago (mig 0326)
// =============================================================================
// Lo de la base de «Vincular cobro» (lib/cobro-etapa.ts tiene los tipos y las reglas). Dos consumidores:
//   · app/crm/cobro-etapa-actions.ts, el modal del ⋯ de Ganado (leer, vincular, cambiar cuentas, quitar, productos);
//   · lib/cobros.ts, `aplicarPagoAprobado`: antes de asentar el pago, `prepararTratoDelPago` dice a qué trato va y en
//     qué CRM se gana.
//
// Lo que no se ve en el código y muerde:
//   · UN PRODUCTO, UN CRM (el índice único de la 0326). Un pago tiene que saber a qué trato va sin elegir entre dos.
//   · NUNCA SE PISA UNA VENTA. El trato se escribe sólo si no tenía venta (escritura condicional): un reintento del aviso,
//     o alguien que vuelve a comprar, no reemplaza lo vendido ni rehace el plan. El pago entra igual en ese trato.
//   · EL REINTENTO ENCUENTRA LA CUOTA. Si el plan se armó y el asiento se cortó, el próximo aviso salda la MISMA cuota 0
//     (la impaga del primer pago, por su monto), en vez de entrar como un pago nuevo al lado de una cuota impaga.
//   · UNA SUSCRIPCIÓN SE QUEDA EN LA CASA. Un CRM agregado no tiene suscripción (lib/pagos-crm.ts): la mensualidad, el MRR
//     y la casa ganada siguen como siempre, y además el lead pasa a Ganado en el CRM del vínculo.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getLead } from './leads';
import { listarFunnels } from './funnels';
import { etapaDeGanado } from './pipeline';
import { agregarAProducto, etapasDeProducto, moverEtapaEnProducto } from './lead-funnel';
import { nombreVisible } from './lead-funnel-reglas';
import { ajustarPlanPagos, casaDelLead, filaDelTrato, getPagosByLead } from './pagos';
import {
  congelarPlan, cuentasValidas, patchDeEdicion, planCongeladoDe, planDelCobro, planDelProducto, productoDeFila, productoValido, vinculoDelPago,
  type CuentaPago, type PlanCongelado, type PlanDelProducto, type ProductoCobro, type ProductoCobroInput, type ResCobro, type VinculoCobro,
} from './cobro-etapa';
import type { Cobro } from './cobros-tipos';

export const FALTA_0326 = 'Falta aplicar la migración 0326 (vincular cobro). Avísale al administrador.';
const falta0326 = (m: string | null | undefined): boolean => /cobro_etapa_vinculos|cuotas/i.test(m ?? '') && /exist|schema cache|column/i.test(m ?? '');

const COLS_VINCULO = 'id, funnel_id, etapa, producto_id, cuentas';
const vinculoDeFila = (f: Record<string, unknown>): VinculoCobro => ({
  id: Number(f.id), funnelId: Number(f.funnel_id), etapa: String(f.etapa ?? ''), productoId: Number(f.producto_id),
  cuentas: Array.isArray(f.cuentas) ? (f.cuentas as unknown[]).map(String) : [],
});

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

/** Los vínculos de una etapa de un CRM. Tira si no puede leer (el modal dice el error, no «no hay»). */
export async function vinculosDeEtapa(funnelId: number, etapa: string): Promise<VinculoCobro[]> {
  const { data, error } = await (await getTenantDb()).from('cobro_etapa_vinculos').select(COLS_VINCULO).eq('funnel_id', funnelId).eq('etapa', etapa).order('id');
  if (error) throw new Error(falta0326(error.message) ? FALTA_0326 : `No pude leer los cobros de esta etapa: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(vinculoDeFila);
}

/** Un vínculo por id (de este negocio: `getTenantDb`). null = no existe. */
async function vinculoPorId(id: number): Promise<VinculoCobro | null> {
  const { data, error } = await (await getTenantDb()).from('cobro_etapa_vinculos').select(COLS_VINCULO).eq('id', id).maybeSingle();
  if (error) throw new Error(falta0326(error.message) ? FALTA_0326 : `No pude leer el vínculo: ${error.message}`);
  return data ? vinculoDeFila(data as Record<string, unknown>) : null;
}

/** Los productos ACTIVOS del catálogo, con sus cuotas. Sin la 0326, sin cuotas (un pago cada uno). */
export async function productosParaCobrar(): Promise<ProductoCobro[]> {
  const db = await getTenantDb();
  const pedir = (cols: string) => db.from('productos').select(cols).eq('activo', true).order('orden').order('id');
  let r = await pedir('id, nombre, tipo, monto_usd, suscripcion_meses, cuotas, activo');
  if (r.error && falta0326(r.error.message)) r = await pedir('id, nombre, tipo, monto_usd, suscripcion_meses, activo');
  if (r.error) throw new Error(`No pude leer el catálogo: ${r.error.message}`);
  return ((r.data ?? []) as unknown as Record<string, unknown>[]).map(productoDeFila);
}

/** Un producto por id, activo o no (un pago de un producto que después se desactivó sigue siendo de ese producto). */
async function productoPorId(id: number): Promise<ProductoCobro | null> {
  const db = await getTenantDb();
  const pedir = (cols: string) => db.from('productos').select(cols).eq('id', id).maybeSingle();
  let r = await pedir('id, nombre, tipo, monto_usd, suscripcion_meses, cuotas, activo');
  if (r.error && falta0326(r.error.message)) r = await pedir('id, nombre, tipo, monto_usd, suscripcion_meses, activo');
  if (r.error) throw new Error(`No pude leer el producto ${id}: ${r.error.message}`);
  return r.data ? productoDeFila(r.data as unknown as Record<string, unknown>) : null;
}

/**
 * Lo que cobra el PRIMER pago de un producto (`planDelProducto`): el inicial si va en cuotas, el precio si no. Lo usa
 * `crearCobro` para el monto de un link con producto. null = el producto no está o no tiene precio.
 */
export async function primerPagoDelProducto(id: number): Promise<number | null> {
  return (await cobroDelProducto(id))?.primerPagoUsd ?? null;
}

/**
 * Lo que cobra un link de ese producto y lo que se congela en el cobro (`plan_producto`, mig 0326): el primer pago, el plan
 * con su precio y sus cuotas, y en cuántos pagos va (para decirlo antes de cobrar). null = el producto no está.
 */
export async function cobroDelProducto(id: number): Promise<{ primerPagoUsd: number | null; congelado: PlanCongelado | null; cuotas: number | null } | null> {
  const p = await productoPorId(id);
  if (!p) return null;
  return { primerPagoUsd: planDelProducto(p, 1).primerPagoUsd, congelado: congelarPlan(p), cuotas: p.tipo === 'unico' ? p.cuotas : null };
}

/** La etapa de Ganado de un CRM de este negocio; null si el CRM no existe o no tiene una. */
async function ganadoDelCrm(funnelId: number): Promise<{ etapa: string; nombre: string } | null> {
  const f = (await listarFunnels()).find((x) => x.id === funnelId);
  if (!f) return null;
  const etapa = etapaDeGanado((await etapasDeProducto(funnelId)) as Parameters<typeof etapaDeGanado>[0]);
  return etapa ? { etapa, nombre: nombreVisible(f) } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escrituras del modal
// ─────────────────────────────────────────────────────────────────────────────

/** Vincula un producto a la etapa Ganado de un CRM, cobrable por esas cuentas (de las conectadas). */
export async function vincular(p: { funnelId: number; etapa: string; productoId: number; cuentas: readonly unknown[] }, conectadas: readonly CuentaPago[], autor: string): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  const g = await ganadoDelCrm(Number(p.funnelId));
  if (!g) return { ok: false, error: 'Ese CRM no existe en este negocio.' };
  if (g.etapa !== p.etapa) return { ok: false, error: 'Un cobro se vincula a la etapa de Ganado.' };
  const producto = await productoPorId(Number(p.productoId));
  if (!producto || !producto.activo) return { ok: false, error: 'Ese producto no está activo en el catálogo.' };
  if (producto.montoUsd == null) return { ok: false, error: 'Ese producto no tiene precio: ponle uno primero.' };
  const cuentas = cuentasValidas(p.cuentas, conectadas);
  if (!cuentas.length) return { ok: false, error: 'Elige al menos una cuenta por la que se cobra.' };
  const db = await getTenantDb();
  const { data, error } = await db.from('cobro_etapa_vinculos')
    .insert({ funnel_id: Number(p.funnelId), etapa: g.etapa, producto_id: producto.id, cuentas, creado_por: autor })
    .select(COLS_VINCULO).single();
  if (error?.code === '23505') {
    // Un producto, un CRM: se dice DÓNDE cobra hoy, para que la persona decida.
    const { data: otro } = await db.from('cobro_etapa_vinculos').select('funnel_id').eq('producto_id', producto.id).maybeSingle();
    const donde = otro ? (await listarFunnels()).find((f) => f.id === Number((otro as { funnel_id: number }).funnel_id)) : null;
    return { ok: false, error: `«${producto.nombre}» ya cobra en ${donde ? `«${nombreVisible(donde)}»` : 'otro CRM'}: quítalo de ahí primero.` };
  }
  if (error || !data) return { ok: false, error: falta0326(error?.message) ? FALTA_0326 : `No pude vincularlo: ${error?.message ?? 'sin respuesta'}` };
  return { ok: true, vinculo: vinculoDeFila(data as Record<string, unknown>) };
}

/** Cambia las cuentas por las que se cobra un vínculo (al menos una, de las conectadas). */
export async function cambiarCuentas(vinculoId: number, pedidas: readonly unknown[], conectadas: readonly CuentaPago[]): Promise<ResCobro<{ vinculo: VinculoCobro }>> {
  const cuentas = cuentasValidas(pedidas, conectadas);
  if (!cuentas.length) return { ok: false, error: 'Elige al menos una cuenta. Para dejar de cobrarlo, quita el producto.' };
  const { data, error } = await (await getTenantDb()).from('cobro_etapa_vinculos')
    .update({ cuentas, updated_at: new Date().toISOString() }).eq('id', vinculoId).select(COLS_VINCULO).maybeSingle();
  if (error) return { ok: false, error: falta0326(error.message) ? FALTA_0326 : `No pude cambiar las cuentas: ${error.message}` };
  if (!data) return { ok: false, error: 'Ese vínculo ya no existe. Recarga.' };
  return { ok: true, vinculo: vinculoDeFila(data as Record<string, unknown>) };
}

/** Quita un vínculo. Devuelve con qué volver a vincularlo (el Deshacer del modal). */
export async function desvincular(vinculoId: number): Promise<ResCobro<{ deshacer: { funnelId: number; etapa: string; productoId: number; cuentas: string[] } }>> {
  const v = await vinculoPorId(vinculoId);
  if (!v) return { ok: false, error: 'Ese vínculo ya no existe. Recarga.' };
  const { error } = await (await getTenantDb()).from('cobro_etapa_vinculos').delete().eq('id', vinculoId);
  if (error) return { ok: false, error: `No pude quitarlo: ${error.message}` };
  return { ok: true, deshacer: { funnelId: v.funnelId, etapa: v.etapa, productoId: v.productoId, cuentas: v.cuentas } };
}

/**
 * Crea o edita un producto desde el modal: nombre, tipo, precio, plazo y cuotas. Editar toca SÓLO eso (la promesa, lo
 * que incluye y la garantía del catálogo no se borran: `upsertProducto` los pisa con null si no vienen).
 */
export async function guardarProducto(input: ProductoCobroInput, id?: number): Promise<ResCobro<{ producto: ProductoCobro }>> {
  const v = productoValido(input);
  if (!v.ok) return v;
  const db = await getTenantDb();
  const cols = 'id, nombre, tipo, monto_usd, suscripcion_meses, cuotas, activo';
  if (id != null) {
    // Sólo lo que vino (revisión adversarial, media 6): el plazo o las cuotas que no se mandan no se borran.
    const { data, error } = await db.from('productos').update(patchDeEdicion(input, v.fila)).eq('id', id).select(cols).maybeSingle();
    if (error) return { ok: false, error: falta0326(error.message) ? FALTA_0326 : `No pude guardar el producto: ${error.message}` };
    if (!data) return { ok: false, error: 'Ese producto ya no existe. Recarga.' };
    return { ok: true, producto: productoDeFila(data as Record<string, unknown>) };
  }
  // El alta va al final del catálogo, como `upsertProducto`.
  const { data: ult } = await db.from('productos').select('orden').order('orden', { ascending: false }).limit(1);
  const max = (ult as Array<{ orden: number }> | null)?.[0]?.orden;
  const orden = typeof max === 'number' && Number.isFinite(max) ? max + 1 : 0;
  const { data, error } = await db.from('productos').insert({ ...v.fila, activo: true, orden }).select(cols).single();
  if (error || !data) return { ok: false, error: falta0326(error?.message) ? FALTA_0326 : `No pude crear el producto: ${error?.message ?? 'sin respuesta'}` };
  return { ok: true, producto: productoDeFila(data as Record<string, unknown>) };
}

// ─────────────────────────────────────────────────────────────────────────────
// El trato de un pago (lo llama `aplicarPagoAprobado`, lib/cobros.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A qué trato va el pago y dónde se gana:
 *   · `pagoEn`: el CRM agregado donde se asienta (null = la casa);
 *   · `pagoId`: la cuota que salda (la 0 del plan que se acaba de armar, o la que quedó de un intento cortado);
 *   · `ganaEnCasa`: si se gana la casa como siempre (`ganarLead`), con `montoVenta` (el precio del producto: el pago
 *     es sólo el primero si va en cuotas);
 *   · `ganaEnCrm`: el CRM del vínculo donde pasa a Ganado (con la etapa de Ganado de HOY, no la guardada en el vínculo);
 *   · `armoPlan`: si este pago armó un plan (un reembolso total lo da de baja); `aviso`: lo que hay que dejar dicho en el
 *     historial (un CRM archivado, una venta que ya estaba); `nuevo`: si se armó ahora (el aviso se dice una vez).
 */
export type TratoDelPago = {
  pagoEn: number | null;
  pagoId: number | null;
  ganaEnCasa: boolean;
  montoVenta: number | null;
  ganaEnCrm: { crm: number; etapa: string } | null;
  armoPlan: boolean;
  aviso: string | null;
  nuevo: boolean;
};

/** La cuota impaga del primer pago en ese trato: número 0, sin pasarela, del monto del cobro. */
async function cuotaDelPrimerPago(leadId: number, crm: number | null, montoUsd: number | null): Promise<number | null> {
  if (montoUsd == null) return null;
  const q = (await getPagosByLead(leadId, crm)).find((x) => x.numero === 0 && !x.pagado && !x.proveedor_pago_id && Math.abs(Number(x.monto_usd) - montoUsd) < 0.01);
  return q ? Number(q.id) : null;
}

/** Lo que dice el cobro de su trato: el reclamo, el trato ya armado y el plan congelado. 'sin-0326' = la base no tiene las columnas. */
async function marcaDelCobro(id: number): Promise<{ estado: string | null; trato: Record<string, unknown> | null; congelado: PlanCongelado | null } | 'sin-0326'> {
  const { data, error } = await (await getTenantDb()).from('cobros').select('trato_estado, trato, plan_producto').eq('id', id).maybeSingle();
  if (error) {
    if (falta0326(error.message) || /trato|plan_producto/.test(error.message)) return 'sin-0326';
    throw new Error(`No pude leer el trato del cobro ${id}: ${error.message}`);
  }
  const f = (data ?? {}) as { trato_estado?: string | null; trato?: Record<string, unknown> | null; plan_producto?: unknown };
  return { estado: f.trato_estado ?? null, trato: f.trato ?? null, congelado: planCongeladoDe(f.plan_producto) };
}

const tratoGuardado = (t: Record<string, unknown>): TratoDelPago => {
  const g = t.ganaEnCrm as { crm?: unknown; etapa?: unknown } | null | undefined;
  return {
    pagoEn: t.pagoEn == null ? null : Number(t.pagoEn), pagoId: t.pagoId == null ? null : Number(t.pagoId),
    ganaEnCasa: t.ganaEnCasa === true, montoVenta: t.montoVenta == null ? null : Number(t.montoVenta),
    ganaEnCrm: g && g.crm != null && typeof g.etapa === 'string' ? { crm: Number(g.crm), etapa: g.etapa } : null,
    armoPlan: t.armoPlan === true, aviso: null, nuevo: false,
  };
};

/** Lo que el trato de un cobro dice de su plan: para el reembolso total del primer pago. null = no se armó ninguno. */
export async function planArmadoPorElCobro(cobroId: number): Promise<{ pagoEn: number | null } | null> {
  const m = await marcaDelCobro(cobroId);
  if (m === 'sin-0326' || m.estado !== 'listo' || !m.trato) return null;
  const t = tratoGuardado(m.trato);
  return t.armoPlan ? { pagoEn: t.pagoEn } : null;
}

/** El reclamo del trato vence a los 2 minutos: un aviso que se cortó armándolo no lo deja tomado para siempre. */
const RECLAMO_VENCE_MS = 2 * 60_000;

/**
 * Prepara el trato de un pago de producto y dice dónde va (`TratoDelPago`). null = el camino de siempre (el producto no
 * está vinculado por esa cuenta y el cobro no armó un plan).
 *
 * ⚠️ SE RECLAMA ANTES DE ARMARSE (revisión adversarial, medias 3 y 4): Mercado Pago reentrega en paralelo y el cron se
 * cruza con el aviso. Sin reclamo, el segundo no encontraba la cuota 0 (el primero la estaba armando) y asentaba el pago
 * suelto: la cuota quedaba impaga para siempre. El que pierde relee el trato; si todavía se está armando, tira y lo completa
 * el próximo intento. Y todo lo que se escribe acá se puede repetir: la venta con una condición, y el plan si la venta es
 * la de este pago (su precio y su fecha) y no hay nada cobrado en ese trato.
 */
export async function prepararTratoDelPago(c: Cobro, opts: { renovacion: boolean; fecha: string }): Promise<TratoDelPago | null> {
  if (!c.lead_id || opts.renovacion || c.producto_id == null || c.pago_id != null) return null;
  const leadId = c.lead_id;
  const db = await getTenantDb();

  const marca = await marcaDelCobro(c.id);
  if (marca === 'sin-0326') return null; // sin la 0326 no hay vínculos ni planes congelados: el camino de siempre
  if (marca.estado === 'listo' && marca.trato) return tratoGuardado(marca.trato);

  let vinculos: VinculoCobro[] = [];
  {
    const { data, error } = await db.from('cobro_etapa_vinculos').select(COLS_VINCULO).eq('producto_id', c.producto_id);
    // Otro error tira: no se asienta en el trato equivocado.
    if (error && !falta0326(error.message)) throw new Error(`No pude leer el vínculo del producto ${c.producto_id}: ${error.message}`);
    vinculos = ((data ?? []) as Record<string, unknown>[]).map(vinculoDeFila);
  }
  const v = vinculoDelPago(c, vinculos, { renovacion: opts.renovacion });
  const { plan, montoVenta } = planDelCobro({ tipo: c.tipo, monto_usd: c.monto_usd }, marca.congelado, Number(opts.fecha.slice(8, 10)));
  if (!v && !plan) return null;

  // EL RECLAMO: compare-and-set, como el del alta (`altaSiCorresponde`, lib/cobros.ts).
  const ahora = new Date();
  const vencido = new Date(ahora.getTime() - RECLAMO_VENCE_MS).toISOString();
  const { data: reclamo, error: eR } = await db.from('cobros')
    .update({ trato_estado: 'armando', trato_at: ahora.toISOString() })
    .eq('id', c.id).or(`trato_estado.is.null,and(trato_estado.eq.armando,trato_at.lt.${vencido})`)
    .select('id').maybeSingle();
  if (eR) throw new Error(`No pude reclamar el trato del cobro ${c.id}: ${eR.message}`);
  if (!reclamo) {
    const otra = await marcaDelCobro(c.id);
    if (otra !== 'sin-0326' && otra.estado === 'listo' && otra.trato) return tratoGuardado(otra.trato);
    throw new Error('Otro aviso está armando el trato de este pago: se completa en el próximo intento.');
  }

  const t = await armarTrato(c, leadId, v, plan, montoVenta, opts.fecha);
  const guardar = { pagoEn: t.pagoEn, pagoId: t.pagoId, ganaEnCasa: t.ganaEnCasa, montoVenta: t.montoVenta, ganaEnCrm: t.ganaEnCrm, armoPlan: t.armoPlan };
  const { error: eG } = await db.from('cobros').update({ trato_estado: 'listo', trato: guardar }).eq('id', c.id);
  if (eG) throw new Error(`No pude guardar el trato del cobro ${c.id}: ${eG.message}`);
  return { ...t, nuevo: true };
}

/** Arma el trato (con el reclamo tomado). Ver `prepararTratoDelPago`. */
async function armarTrato(c: Cobro, leadId: number, v: VinculoCobro | null, plan: PlanDelProducto | null, montoVenta: number | null, fecha: string): Promise<TratoDelPago> {
  const casa = await casaDelLead(leadId);
  let aviso: string | null = null;
  let ganaEnCrm: { crm: number; etapa: string } | null = null;
  if (v && v.funnelId !== casa) {
    // ⚠️ UN CRM QUE YA NO SE PUEDE USAR (revisión adversarial, alta 2): archivado, o sin etapa de Ganado. Antes,
    // `agregarAProducto` tiraba «Ese funnel no existe» y el pago no se asentaba en ningún lado (ni cash, ni Ganado, ni
    // aviso) durante los 14 días del cron. Ahora entra en la casa y queda dicho. La etapa es la de Ganado de HOY.
    const g = await ganadoDelCrm(v.funnelId);
    if (g) ganaEnCrm = { crm: v.funnelId, etapa: g.etapa };
    else aviso = 'El producto está vinculado a un CRM que ya no está activo (o no tiene etapa de Ganado): el pago entró en su CRM principal.';
  }
  const base = { ganaEnCrm, aviso, nuevo: true };

  // UNA SUSCRIPCIÓN SE QUEDA EN LA CASA (la cabecera): el pago y la venta como siempre; además, Ganado en el CRM.
  if (c.tipo === 'suscripcion') {
    if (ganaEnCrm) await agregarAProducto(leadId, ganaEnCrm.crm, { autor: 'Pasarela' });
    return { ...base, pagoEn: null, pagoId: null, ganaEnCasa: true, montoVenta: null, armoPlan: false };
  }

  if (ganaEnCrm) {
    // EL TRATO DE UN CRM AGREGADO: el lead entra al CRM (si no estaba), y la venta y el plan se escriben si son de este pago.
    const crm = ganaEnCrm.crm;
    await agregarAProducto(leadId, crm, { autor: 'Pasarela' });
    const fila = await filaDelTrato(leadId, crm);
    if (!fila) throw new Error('El lead no quedó en el CRM del vínculo.');
    let nuestra = fila.venta_tipo === 'unico' && montoVenta != null && fila.monto_cierre_usd != null
      && Math.abs(fila.monto_cierre_usd - montoVenta) < 0.01 && fila.fecha_cierre === fecha;
    if (fila.monto_cierre_usd == null && fila.venta_tipo !== 'sin_cobro' && montoVenta != null) {
      const { data: escrita, error } = await (await getTenantDb()).from('lead_funnel')
        .update({ venta_tipo: 'unico', monto_cierre_usd: montoVenta, fecha_cierre: fecha, updated_at: new Date().toISOString() })
        .eq('id', fila.id).is('monto_cierre_usd', null).select('id');
      if (error) throw new Error(`No pude escribir la venta en el CRM del vínculo: ${error.message}`);
      nuestra = nuestra || !!escrita?.length;
    }
    let armoPlan = false;
    if (plan && nuestra && !(await getPagosByLead(leadId, crm)).some((q) => q.pagado)) {
      await ajustarPlanPagos(leadId, plan, fecha, { crm });
      armoPlan = true;
    } else if (!nuestra) {
      // Una recompra, o un trato «sin cobro» (revisión adversarial, baja 9): el pago entra en ese trato sin tocar su venta.
      base.aviso = fila.venta_tipo === 'sin_cobro'
        ? 'Su trato en ese CRM estaba marcado «sin cobro»: el pago entró igual, sin cambiar la venta.'
        : 'Ya tenía una venta en ese CRM: el pago entró ahí sin armar el plan del producto.';
    }
    return { ...base, pagoEn: crm, pagoId: await cuotaDelPrimerPago(leadId, crm, c.monto_usd), ganaEnCasa: false, montoVenta, armoPlan };
  }

  // LA CASA: como siempre (`ganarLead`), con el precio del producto como venta. Si el cobro armó un plan y la casa no tiene
  // venta ni nada cobrado, se arma su plan (o se completa, si un intento anterior lo dejó a medias) y el pago salda la cuota 0.
  let armoPlan = false;
  if (plan) {
    const lead = await getLead(leadId);
    const cuotas = await getPagosByLead(leadId);
    const mismoPlan = lead?.total_cuotas == null || (lead.total_cuotas === plan.total_cuotas && Number(lead.monto_cuota_usd) === plan.monto_cuota_usd);
    if (lead && lead.estado_lead !== 'ganado' && lead.monto_cierre_usd == null && mismoPlan && !cuotas.some((q) => q.pagado)) {
      await ajustarPlanPagos(leadId, plan, fecha);
      armoPlan = true;
    }
  }
  return { ...base, pagoEn: null, pagoId: await cuotaDelPrimerPago(leadId, null, c.monto_usd), ganaEnCasa: true, montoVenta, armoPlan };
}

/** Pasa al lead a la etapa del vínculo en ese CRM. Tira si no puede: el que llama lo deja dicho sin deshacer el pago. */
export async function ganarEnElCrm(leadId: number, g: { crm: number; etapa: string }, autor: string): Promise<void> {
  await moverEtapaEnProducto(leadId, g.crm, g.etapa, { autor });
}
