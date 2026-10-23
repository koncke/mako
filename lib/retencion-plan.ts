// =============================================================================
// retencion-plan — antes de darse de baja, una oferta según el plan (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si te querés dar de baja en la suscripción debería habilitarte un descuento como lo
// tienen todas las aplicaciones». Las ofertas del Cerebro (docs/ofertas-mako.md, «Baja»): el de 97 ve «2 meses al 50%»
// o pasar al de 47; el de 47 ve «pausar un mes gratis»; nunca se borran sus datos. Lo de cada plan está en
// lib/planes-mako.ts (`retencion`). Una oferta por negocio: quien ya usó una, la próxima vez va directo a la baja.
//
//   · DESCUENTO — Stripe: un cupón `repeating` (vuelve solo). Mercado Pago: el monto a la mitad y el cron lo restaura
//     cuando se cobraron las cuotas con descuento (`restaurarRetencionesMp`).
//   · PAUSA — Stripe: `pause_collection` con `resumes_at` (vuelve solo). Mercado Pago: `paused` y el cron la reanuda al
//     cumplirse el mes. El mes pausado CUENTA como cubierto (lib/plan-acceso.ts lee esta marca): no es una deuda.
//   · BAJAR DE PLAN — el precio nuevo desde el PRÓXIMO período (lo de este mes ya está pago) y la capa del plan nuevo.
//
// ⚠️ La oferta se reclama con compare-and-set (`plan.retencion` de null a «aplicando») ANTES de tocar la pasarela.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { cambiarSettingSi, getSetting, setSetting } from './settings';
import { credDelCliente } from './credenciales';
import { logLeadEvent } from './leads';
import { suscripcionDeMakoDe } from './cobros';
import { esBajaPedida } from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import { cambiarPrecioStripe, descuentoStripe, estadoSuscripcionMp, montoSuscripcionMp, pausarStripe } from './pasarela-plan-api';
import { planesMako } from './compra-plan';
import { conceptoDelPlan, precioEn, type PlanMako } from './planes-mako';
import type { Cobro } from './cobros-tipos';
import { CLAVE_RETENCION, leerRetencion, type Guardada, type OpcionRetencion } from './retencion-reglas';

export { CLAVE_RETENCION, leerRetencion, mesesDePausa, type OpcionRetencion } from './retencion-reglas';

/** Si el plan no dice nada (un plan vendido a mano), la oferta de siempre. */
export const RETENCION = { pct: 50, meses: 2 } as const;
const DIA = 86_400_000;

export type OfertaRetencion = {
  descuento?: { pct: number; meses: number; monto: string; montoConDescuento: string };
  pausa?: { meses: number };
  bajar?: { nombre: string; monto: string };
} | null;

type Contexto = { c: Cobro; plan: PlanMako | null; destino: PlanMako | null; retencion: NonNullable<PlanMako['retencion']> };

/** La suscripción que se sigue cobrando, su plan y lo que su plan ofrece. null si no hay nada que ofrecer. */
async function contexto(ws: number): Promise<Contexto | null> {
  const c = await suscripcionDeMakoDe(ws).catch(() => null);
  if (!c || c.suscripcion_estado === 'cancelada' || esBajaPedida(c.motivo)) return null;
  if (c.proveedor === 'stripe' ? !c.proveedor_suscripcion_id : !(c.proveedor_suscripcion_id ?? c.proveedor_ref)) return null;
  const { data } = await getSupabaseServer().from('cobros').select('plan_mako').eq('id', c.id).maybeSingle();
  const planId = (data as { plan_mako?: string | null } | null)?.plan_mako ?? null;
  const planes = await planesMako();
  const plan = planId ? planes.find((p) => p.id === planId) ?? null : null;
  const retencion = plan?.retencion ?? { descuento: { pct: RETENCION.pct, meses: RETENCION.meses } };
  const destino = retencion.bajarA ? planes.find((p) => p.id === retencion.bajarA) ?? null : null;
  return { c, plan, destino, retencion };
}

/** ¿Qué se le ofrece a este negocio antes de la baja? null = nada (sin suscripción viva, o ya usó una oferta). */
export async function ofertaDeRetencion(ws: number): Promise<OfertaRetencion> {
  const x = await contexto(ws);
  if (!x) return null;
  const usada = await runWithWorkspace(ws, () => getSetting(CLAVE_RETENCION)).catch(() => 'x');
  if (usada) return null;
  const { c, retencion, destino } = x;
  const out: NonNullable<OfertaRetencion> = {};
  if (retencion.descuento) {
    const con = Math.round(c.monto * (100 - retencion.descuento.pct)) / 100;
    out.descuento = { ...retencion.descuento, monto: formatoMonto(c.monto, c.moneda), montoConDescuento: formatoMonto(con, c.moneda) };
  }
  if (retencion.pausa) out.pausa = { ...retencion.pausa };
  const precioDestino = destino ? precioEn(destino, c.moneda) : null;
  if (destino && precioDestino != null && precioDestino < c.monto) out.bajar = { nombre: destino.nombre, monto: formatoMonto(precioDestino, c.moneda) };
  return Object.keys(out).length ? out : null;
}

/** Aceptar una opción. Cambia lo que se cobra (o pausa): sólo desde la pantalla, por el admin, una vez por negocio. */
export async function aplicarRetencion(ws: number, autor: string, opcion: OpcionRetencion = 'descuento'): Promise<{ ok: boolean; resumen: string }> {
  const x = await contexto(ws);
  if (!x) return { ok: false, resumen: 'Tu plan no tiene una suscripción activa.' };
  const { c, retencion, destino } = x;
  if (opcion === 'descuento' && !retencion.descuento) return { ok: false, resumen: 'Esa oferta no es de tu plan.' };
  if (opcion === 'pausa' && !retencion.pausa) return { ok: false, resumen: 'Esa oferta no es de tu plan.' };
  const precioDestino = destino ? precioEn(destino, c.moneda) : null;
  if (opcion === 'bajar' && (!destino || precioDestino == null || precioDestino >= c.monto)) return { ok: false, resumen: 'No hay un plan más barato para pasar.' };

  const ahora = Date.now();
  const meses = opcion === 'descuento' ? retencion.descuento!.meses : opcion === 'pausa' ? retencion.pausa!.meses : undefined;
  const marca: Guardada = {
    estado: 'aplicando', opcion, cobroId: c.id, pasarela: c.proveedor, aplicadaAt: new Date(ahora).toISOString(), montoOriginal: c.monto, moneda: c.moneda,
    ...(opcion === 'descuento' ? { pct: retencion.descuento!.pct, meses } : {}),
    ...(opcion === 'pausa' ? { meses, hasta: new Date(ahora + (meses ?? 1) * 30 * DIA).toISOString() } : {}),
  };
  // El reclamo: de null a «aplicando». Si ya había algo, la oferta ya se usó (o se está usando en otra pestaña).
  const gano = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_RETENCION, null, JSON.stringify(marca)));
  if (!gano) return { ok: false, resumen: 'Ya usaste una oferta de tu plan.' };

  const plataforma = await wsSuperAdmin();
  const idem = `mako-retencion-${c.id}-${opcion}`;
  const subMp = c.proveedor_suscripcion_id ?? c.proveedor_ref;
  let error: string | null = null;
  if (c.proveedor === 'stripe') {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const sub = c.proveedor_suscripcion_id;
    if (!key || !sub) error = 'Stripe no está conectado';
    else {
      const r = opcion === 'descuento' ? await descuentoStripe(key, sub, { pct: retencion.descuento!.pct, meses: meses!, idem })
        : opcion === 'pausa' ? await pausarStripe(key, sub, { hastaMs: Date.parse(marca.hasta!), idem })
          : await cambiarPrecioStripe(key, sub, { monto: precioDestino!, moneda: c.moneda, idem });
      if (!r.ok) error = r.error;
    }
  } else {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    if (!token || !subMp) error = 'Mercado Pago no está conectado';
    else {
      const r = opcion === 'descuento' ? await montoSuscripcionMp(token, subMp, Math.round(c.monto * (100 - retencion.descuento!.pct)) / 100, idem)
        : opcion === 'pausa' ? await estadoSuscripcionMp(token, subMp, 'paused', idem)
          : await montoSuscripcionMp(token, subMp, precioDestino!, idem);
      if (!r.ok) error = r.error;
    }
  }
  if (error) {
    // Lo que falló se deja dicho (no se devuelve la oferta sola: si la pasarela sí la tomó, reintentar la aplicaría dos veces).
    await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...marca, estado: 'error', error: error!.slice(0, 200) })));
    console.error(`[retencion] ws=${ws} cobro ${c.id} (${opcion}): ${error}`);
    return { ok: false, resumen: 'No pudimos aplicarlo. Escríbenos y lo resolvemos.' };
  }
  // Stripe vuelve solo (cupón repeating, resumes_at); MP necesita al cron. Bajar de plan no se restaura nunca.
  const restaurada = c.proveedor === 'stripe' || opcion === 'bajar';
  await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...marca, estado: 'aplicada', restaurada })));
  let resumen = '';
  if (opcion === 'bajar' && destino) {
    // El cobro recuerda el plan y la mensualidad nuevos (la deuda y la próxima cuota se cuentan con esto), y el negocio
    // pasa a la capa del plan nuevo.
    const db = getSupabaseServer();
    const { error: e1 } = await db.from('cobros').update({ plan_mako: destino.id, monto: precioDestino, monto_usd: destino.precioUsd, concepto: conceptoDelPlan(destino) }).eq('id', c.id).eq('workspace_id', plataforma);
    if (e1) console.error(`[retencion] ws=${ws}: no pude anotar el plan nuevo en el cobro ${c.id}: ${e1.message}`);
    const { error: e2 } = await db.from('workspaces').update({ capa: destino.capa }).eq('id', ws);
    if (e2) console.error(`[retencion] ws=${ws}: no pude cambiar la capa a ${destino.capa}: ${e2.message}`);
    resumen = `Listo: pasas a ${destino.nombre}. Desde tu próximo cobro pagas ${formatoMonto(precioDestino!, c.moneda)}.`;
  } else if (opcion === 'pausa') {
    resumen = `Listo: tu plan queda en pausa ${meses === 1 ? 'un mes' : `${meses} meses`}, sin cobro. Sigues entrando y tus datos quedan como están.`;
  } else {
    resumen = `Listo: los próximos ${meses} meses pagas ${100 - retencion.descuento!.pct}% de tu plan.`;
  }
  if (c.lead_id) {
    await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Retención', `Iba a darse de baja y eligió: ${resumen} (${autor})`.slice(0, 300), autor)).catch(() => {});
  }
  return { ok: true, resumen };
}

/**
 * Mercado Pago no vuelve solo: el DESCUENTO, cuando ya se cobraron las cuotas con descuento (las de DESPUÉS de aceptar:
 * la del mismo día pudo cobrarse a precio de lista); la PAUSA, cuando se cumple su `hasta`. Lo llama el cron de la
 * pasarela. Idempotente (marcado `restaurada`). Nunca tira.
 */
export async function restaurarRetencionesMp(): Promise<{ restauradas: number }> {
  let restauradas = 0;
  try {
    const db = getSupabaseServer();
    const { data } = await db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETENCION).like('value', '%"pasarela":"mercadopago"%').limit(200);
    const plataforma = await wsSuperAdmin();
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    if (!token) return { restauradas };
    for (const fila of (data ?? []) as Array<{ workspace_id: number; value: string }>) {
      const g = leerRetencion(fila.value);
      if (!g || g.estado !== 'aplicada' || g.restaurada || g.opcion === 'bajar') continue;
      if (g.opcion === 'pausa' && (!g.hasta || Date.now() < Date.parse(g.hasta))) continue;
      if (g.opcion === 'descuento') {
        const { count } = await db.from('pagos').select('id', { count: 'exact', head: true })
          .eq('workspace_id', plataforma).eq('cobro_id', g.cobroId).eq('pagado', true).gt('fecha_pago', g.aplicadaAt.slice(0, 10)); // gt: la cuota del mismo día pudo cobrarse a precio de lista
        if ((count ?? 0) < (g.meses ?? 1)) continue;
      }
      const { data: c } = await db.from('cobros').select('proveedor_suscripcion_id, proveedor_ref, suscripcion_estado').eq('id', g.cobroId).maybeSingle();
      const cc = c as { proveedor_suscripcion_id: string | null; proveedor_ref: string | null; suscripcion_estado: string | null } | null;
      const id = cc?.proveedor_suscripcion_id ?? cc?.proveedor_ref;
      if (!id || cc?.suscripcion_estado === 'cancelada') { await runWithWorkspace(fila.workspace_id, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true }))); continue; }
      const r = g.opcion === 'pausa'
        ? await estadoSuscripcionMp(token, id, 'authorized', `mako-retencion-fin-${g.cobroId}-pausa`)
        : await montoSuscripcionMp(token, id, g.montoOriginal, `mako-retencion-fin-${g.cobroId}`);
      if (!r.ok) { console.error(`[retencion] no pude restaurar el cobro ${g.cobroId} (${g.opcion}): ${r.error}`); continue; }
      await runWithWorkspace(fila.workspace_id, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true })));
      restauradas++;
    }
  } catch (e) {
    console.error('[retencion] restaurar MP:', e instanceof Error ? e.message : String(e));
  }
  return { restauradas };
}
