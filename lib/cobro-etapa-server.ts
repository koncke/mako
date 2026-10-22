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
  cuentasValidas, planDelProducto, productoDeFila, productoValido, vinculoDelPago,
  type CuentaPago, type ProductoCobro, type ProductoCobroInput, type ResCobro, type VinculoCobro,
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
  const p = await productoPorId(id);
  return p ? planDelProducto(p, 1).primerPagoUsd : null;
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
    const { data, error } = await db.from('productos').update(v.fila).eq('id', id).select(cols).maybeSingle();
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
 *   · `ganaEnCrm`: el CRM del vínculo donde pasa a Ganado.
 */
export type TratoDelPago = {
  pagoEn: number | null;
  pagoId: number | null;
  ganaEnCasa: boolean;
  montoVenta: number | null;
  ganaEnCrm: { crm: number; etapa: string } | null;
};

/** La cuota impaga del primer pago en ese trato: número 0, sin pasarela, del monto del cobro. */
async function cuotaDelPrimerPago(leadId: number, crm: number | null, montoUsd: number | null): Promise<number | null> {
  if (montoUsd == null) return null;
  const q = (await getPagosByLead(leadId, crm)).find((x) => x.numero === 0 && !x.pagado && !x.proveedor_pago_id && Math.abs(Number(x.monto_usd) - montoUsd) < 0.01);
  return q ? Number(q.id) : null;
}

/**
 * Prepara el trato de un pago de producto y dice dónde va (`TratoDelPago`). null = el camino de siempre (el producto
 * no está vinculado por esa cuenta y no va en cuotas). Tira si no puede leer o escribir: el pago queda sin asentar con
 * el motivo, y el próximo aviso lo completa (todo esto se puede repetir).
 */
export async function prepararTratoDelPago(c: Cobro, opts: { renovacion: boolean; fecha: string }): Promise<TratoDelPago | null> {
  if (!c.lead_id || opts.renovacion || c.producto_id == null || c.pago_id != null) return null;
  const leadId = c.lead_id;
  let vinculos: VinculoCobro[] = [];
  {
    const { data, error } = await (await getTenantDb()).from('cobro_etapa_vinculos').select(COLS_VINCULO).eq('producto_id', c.producto_id);
    // Sin la 0326 no hay vínculos: el camino de siempre. Otro error tira (no se asienta en el trato equivocado).
    if (error && !falta0326(error.message)) throw new Error(`No pude leer el vínculo del producto ${c.producto_id}: ${error.message}`);
    vinculos = ((data ?? []) as Record<string, unknown>[]).map(vinculoDeFila);
  }
  const v = vinculoDelPago(c, vinculos, { renovacion: opts.renovacion });
  const producto = await productoPorId(Number(c.producto_id));
  if (!producto) return null;
  const { plan } = planDelProducto(producto, Number(opts.fecha.slice(8, 10)));
  if (!v && !plan) return null;

  const casa = await casaDelLead(leadId);
  const crm = v && v.funnelId !== casa ? v.funnelId : null;
  const ganaEnCrm = crm != null && v ? { crm, etapa: v.etapa } : null;

  // UNA SUSCRIPCIÓN SE QUEDA EN LA CASA (la cabecera): el pago y la venta como siempre; además, Ganado en el CRM.
  if (producto.tipo === 'suscripcion') {
    if (ganaEnCrm) await agregarAProducto(leadId, ganaEnCrm.crm, { autor: 'Pasarela' });
    return { pagoEn: null, pagoId: null, ganaEnCasa: true, montoVenta: null, ganaEnCrm };
  }

  if (crm != null) {
    // EL TRATO DE UN CRM AGREGADO: el lead entra al CRM (si no estaba), la venta y el plan se escriben si no había venta.
    await agregarAProducto(leadId, crm, { autor: 'Pasarela' });
    const fila = await filaDelTrato(leadId, crm);
    if (!fila) throw new Error('El lead no quedó en el CRM del vínculo.');
    if (fila.monto_cierre_usd == null && fila.venta_tipo !== 'sin_cobro') {
      const { data: escrita, error } = await (await getTenantDb()).from('lead_funnel')
        .update({ venta_tipo: 'unico', monto_cierre_usd: producto.montoUsd, fecha_cierre: opts.fecha, updated_at: new Date().toISOString() })
        .eq('id', fila.id).is('monto_cierre_usd', null).select('id');
      if (error) throw new Error(`No pude escribir la venta en el CRM del vínculo: ${error.message}`);
      if (escrita?.length && plan) await ajustarPlanPagos(leadId, plan, opts.fecha, { crm });
    }
    return { pagoEn: crm, pagoId: await cuotaDelPrimerPago(leadId, crm, c.monto_usd), ganaEnCasa: false, montoVenta: producto.montoUsd, ganaEnCrm };
  }

  // LA CASA: como siempre (`ganarLead`), con el precio del producto como venta. Si va en cuotas y la casa no tiene
  // ninguna cuota ni plan, se arma su plan y el pago salda la cuota 0. Con plata o un plan de antes, no se toca nada.
  if (plan) {
    const lead = await getLead(leadId);
    const cuotas = await getPagosByLead(leadId);
    if (lead && lead.estado_lead !== 'ganado' && lead.total_cuotas == null && lead.monto_cierre_usd == null && cuotas.length === 0) {
      await ajustarPlanPagos(leadId, plan, opts.fecha);
    }
  }
  return { pagoEn: null, pagoId: await cuotaDelPrimerPago(leadId, null, c.monto_usd), ganaEnCasa: true, montoVenta: producto.montoUsd, ganaEnCrm: null };
}

/** Pasa al lead a la etapa del vínculo en ese CRM. Tira si no puede: el que llama lo deja dicho sin deshacer el pago. */
export async function ganarEnElCrm(leadId: number, g: { crm: number; etapa: string }, autor: string): Promise<void> {
  await moverEtapaEnProducto(leadId, g.crm, g.etapa, { autor });
}
