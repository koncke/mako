// =============================================================================
// retencion-plan — antes de darse de baja, una oferta según el plan (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si te querés dar de baja en la suscripción debería habilitarte un descuento como lo
// tienen todas las aplicaciones». Las ofertas del Cerebro (docs/ofertas-mako.md, «Baja»): el de 97 ve «2 meses al 50%»
// o pasar al de 47; el de 47 ve «pausar un mes gratis»; nunca se borran sus datos. Lo de cada plan está en
// lib/planes-mako.ts (`retencion`). Una oferta por negocio: quien ya usó una, la próxima vez va directo a la baja.
//
//   · DESCUENTO — Stripe: un cupón `repeating` (vuelve solo). Mercado Pago: el monto rebajado y el cron lo restaura
//     cuando se cobraron esas cuotas, contadas desde el próximo cobro de MP (`restaurarDesde`).
//   · PAUSA — UN CICLO, no 30 días (segunda revisión del 23/10, R3): se pausa hasta pasado el próximo cobro de la pasarela
//     (Stripe: el fin del período; MP: `next_payment_date`), así se saltea exactamente ese cobro. El mes cuenta como cubierto.
//   · BAJAR DE PLAN — el precio nuevo desde el próximo período y la CAPA NUEVA AL TERMINAR el período pagado (R6): el que
//     pagó Pro este mes lo usa entero.
//
// ⚠️ La oferta se reclama con compare-and-set (`plan.retencion` de null a «aplicando») ANTES de tocar la pasarela. Una
// marca que queda trabada en «aplicando» o «error» (la pasarela aplicó y la respuesta se perdió, o falló la escritura
// local) la CONCILIA el cron releyendo la pasarela (`conciliarRetenciones`, R1): queda «aplicada» o se libera.
// ⚠️ Sin oferta: en plena mora (R5: primero «Pagar y volver») y en un plan sin `retencion` válida (R4).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { borrarSettingSi, cambiarSettingSi, getSetting, setSetting } from './settings';
import { credDelCliente } from './credenciales';
import { logLeadEvent } from './leads';
import { suscripcionDeMakoDe } from './cobros';
import { esBajaPedida } from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import {
  cambiarPrecioStripe, descuentoStripe, estadoSuscripcionMp, montoSuscripcionMp, pausarStripe, retencionEnStripe, suscripcionMpDetalle,
} from './pasarela-plan-api';
import { planesMako } from './compra-plan';
import { conceptoDelPlan, precioEn, type PlanMako } from './planes-mako';
import { vigenciaDe } from './plan-acceso';
import { mesesDespuesDe } from './plan-acceso-reglas';
import type { Cobro } from './cobros-tipos';
import { CLAVE_RETENCION, leerRetencion, type Guardada, type OpcionRetencion } from './retencion-reglas';

export { CLAVE_RETENCION, leerRetencion, mesesDePausa, type OpcionRetencion } from './retencion-reglas';

const DIA = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const mismo = (a: number | null | undefined, b: number | null | undefined) => a != null && b != null && Math.abs(a - b) < 0.01;

export type OfertaRetencion = {
  descuento?: { pct: number; meses: number; monto: string; montoConDescuento: string };
  pausa?: { meses: number };
  bajar?: { nombre: string; monto: string };
} | null;

type Contexto = { c: Cobro; plan: PlanMako; destino: PlanMako | null; retencion: NonNullable<PlanMako['retencion']> };
type Marca = Guardada & { reanudaAt?: string };

/** La suscripción que se sigue cobrando, su plan y lo que su plan ofrece. null si no hay nada que ofrecer. */
async function contexto(ws: number): Promise<Contexto | null> {
  const c = await suscripcionDeMakoDe(ws).catch(() => null);
  if (!c || c.suscripcion_estado === 'cancelada' || esBajaPedida(c.motivo)) return null;
  if (c.proveedor === 'stripe' ? !c.proveedor_suscripcion_id : !(c.proveedor_suscripcion_id ?? c.proveedor_ref)) return null;
  // ⚠️ EN MORA NO HAY OFERTAS (R5): la pausa borraba el mes adeudado y «bajar» reescribía la deuda. Primero «Pagar y volver».
  const v = await vigenciaDe(ws);
  if (!v || v.vigencia.estado === 'mora' || v.vigencia.estado === 'vencido') return null;
  const { data } = await getSupabaseServer().from('cobros').select('plan_mako').eq('id', c.id).maybeSingle();
  const planId = (data as { plan_mako?: string | null } | null)?.plan_mako ?? null;
  const planes = await planesMako();
  const plan = planId ? planes.find((p) => p.id === planId) ?? null : null;
  // ⚠️ SIN RETENCIÓN VÁLIDA EN SU PLAN, NO HAY OFERTA (R4): ni un 50% por defecto. Va directo a la baja.
  if (!plan?.retencion) return null;
  const destino = plan.retencion.bajarA ? planes.find((p) => p.id === plan.retencion!.bajarA) ?? null : null;
  return { c, plan, destino, retencion: plan.retencion };
}

/** ¿Qué se le ofrece a este negocio antes de la baja? null = nada. */
export async function ofertaDeRetencion(ws: number): Promise<OfertaRetencion> {
  const x = await contexto(ws);
  if (!x) return null;
  const usada = await runWithWorkspace(ws, () => getSetting(CLAVE_RETENCION)).catch(() => 'x');
  if (usada) return null;
  const { c, retencion, destino } = x;
  const out: NonNullable<OfertaRetencion> = {};
  if (retencion.descuento) {
    out.descuento = { ...retencion.descuento, monto: formatoMonto(c.monto, c.moneda), montoConDescuento: formatoMonto(r2(c.monto * (100 - retencion.descuento.pct) / 100), c.moneda) };
  }
  if (retencion.pausa) out.pausa = { ...retencion.pausa };
  const precioDestino = destino ? precioEn(destino, c.moneda) : null;
  if (destino && precioDestino != null && precioDestino < c.monto) out.bajar = { nombre: destino.nombre, monto: formatoMonto(precioDestino, c.moneda) };
  return Object.keys(out).length ? out : null;
}

/** El próximo cobro de la pasarela (YYYY-MM-DD): Stripe el fin del período, MP `next_payment_date`; si no, el de la cobertura. */
async function proximoCobroDe(ws: number, c: Cobro, plataforma: number): Promise<string | null> {
  if (c.proveedor === 'stripe' && c.proveedor_suscripcion_id) {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const s = key ? await retencionEnStripe(key, c.proveedor_suscripcion_id) : null;
    if (s?.ok && s.periodoFin) return s.periodoFin.slice(0, 10);
  } else if (c.proveedor === 'mercadopago') {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    const id = c.proveedor_suscripcion_id ?? c.proveedor_ref;
    const s = token && id ? await suscripcionMpDetalle(token, id) : null;
    if (s?.ok && s.proximo) return s.proximo.slice(0, 10);
  }
  const v = await vigenciaDe(ws);
  return v?.vigencia.estado === 'al-dia' ? v.vigencia.hasta ?? null : null;
}

/** Aceptar una opción. Cambia lo que se cobra (o pausa): sólo desde la pantalla, por el admin, una vez por negocio. */
export async function aplicarRetencion(ws: number, autor: string, opcion: OpcionRetencion = 'descuento'): Promise<{ ok: boolean; resumen: string }> {
  const x = await contexto(ws);
  if (!x) return { ok: false, resumen: 'Tu plan no tiene una oferta disponible ahora.' };
  const { c, retencion, destino } = x;
  if (opcion === 'descuento' && !retencion.descuento) return { ok: false, resumen: 'Esa oferta no es de tu plan.' };
  if (opcion === 'pausa' && !retencion.pausa) return { ok: false, resumen: 'Esa oferta no es de tu plan.' };
  const precioDestino = destino ? precioEn(destino, c.moneda) : null;
  if (opcion === 'bajar' && (!destino || precioDestino == null || precioDestino >= c.monto)) return { ok: false, resumen: 'No hay un plan más barato para pasar.' };

  const plataforma = await wsSuperAdmin();
  const proximo = await proximoCobroDe(ws, c, plataforma);
  if ((opcion === 'pausa' || opcion === 'bajar') && !proximo) return { ok: false, resumen: 'No pudimos leer tu próximo cobro. Prueba otra vez en un minuto.' };
  // Hasta pasado el próximo cobro (2 días de margen): Stripe anula la factura de ese día y vuelve sola.
  const reanudaMs = proximo ? Date.parse(`${proximo}T00:00:00Z`) + 2 * DIA : 0;
  const meses = opcion === 'descuento' ? retencion.descuento!.meses : opcion === 'pausa' ? retencion.pausa!.meses : undefined;
  const marca: Marca = {
    estado: 'aplicando', opcion, cobroId: c.id, pasarela: c.proveedor, aplicadaAt: new Date().toISOString(), montoOriginal: c.monto, moneda: c.moneda,
    ...(opcion === 'descuento' ? { pct: retencion.descuento!.pct, meses, objetivo: r2(c.monto * (100 - retencion.descuento!.pct) / 100), ...(proximo ? { restaurarDesde: proximo } : {}) } : {}),
    // La pausa cubre UN ciclo: el que empieza en el próximo cobro (R3).
    ...(opcion === 'pausa' ? { meses, hasta: mesesDespuesDe(proximo!, meses ?? 1), reanudaAt: new Date(reanudaMs).toISOString() } : {}),
    ...(opcion === 'bajar' ? { objetivo: precioDestino!, planDestino: destino!.id, capaPendiente: { capa: destino!.capa, desde: proximo! } } : {}),
  };
  const gano = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_RETENCION, null, JSON.stringify(marca)));
  if (!gano) return { ok: false, resumen: 'Ya usaste una oferta de tu plan.' };

  const idem = `mako-retencion-${c.id}-${opcion}`;
  const subMp = c.proveedor_suscripcion_id ?? c.proveedor_ref;
  let error: string | null = null;
  if (c.proveedor === 'stripe') {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const sub = c.proveedor_suscripcion_id;
    if (!key || !sub) error = 'Stripe no está conectado';
    else {
      const r = opcion === 'descuento' ? await descuentoStripe(key, sub, { pct: retencion.descuento!.pct, meses: meses!, idem })
        : opcion === 'pausa' ? await pausarStripe(key, sub, { hastaMs: reanudaMs, idem })
          : await cambiarPrecioStripe(key, sub, { monto: precioDestino!, moneda: c.moneda, idem });
      if (!r.ok) error = r.error;
    }
  } else {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    if (!token || !subMp) error = 'Mercado Pago no está conectado';
    else {
      const r = opcion === 'descuento' ? await montoSuscripcionMp(token, subMp, marca.objetivo!, idem)
        : opcion === 'pausa' ? await estadoSuscripcionMp(token, subMp, 'paused', idem)
          : await montoSuscripcionMp(token, subMp, precioDestino!, idem);
      if (!r.ok) error = r.error;
    }
  }
  if (error) {
    // Queda en «error»: si la pasarela sí lo tomó (la respuesta se perdió), el cron lo concilia (R1).
    await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...marca, estado: 'error', error: error!.slice(0, 200) })));
    console.error(`[retencion] ws=${ws} cobro ${c.id} (${opcion}): ${error}`);
    return { ok: false, resumen: 'No pudimos aplicarlo. Escríbenos y lo resolvemos.' };
  }
  const aplicada = await marcarAplicada(ws, marca, plataforma);
  const resumen = opcion === 'bajar' && destino
    ? `Listo: desde tu próximo cobro (${proximo!.slice(8, 10)}/${proximo!.slice(5, 7)}) pasas a ${destino.nombre} y pagas ${formatoMonto(precioDestino!, c.moneda)}. Hasta ese día sigues con tu plan.`
    : opcion === 'pausa'
      ? 'Listo: tu próximo cobro no se hace. Sigues entrando y tus datos quedan como están.'
      : `Listo: los próximos ${meses} meses pagas ${100 - retencion.descuento!.pct}% de tu plan.`;
  if (aplicada && c.lead_id) {
    await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Retención', `Iba a darse de baja y eligió: ${resumen} (${autor})`.slice(0, 300), autor)).catch(() => {});
  }
  return { ok: true, resumen };
}

/** La marca pasa a «aplicada» con sus escrituras locales (bajar: el cobro con el plan nuevo). Si la escritura falla, la marca
 *  queda como estaba y el cron la vuelve a conciliar (R11). */
async function marcarAplicada(ws: number, g: Marca, plataforma: number): Promise<boolean> {
  if (g.opcion === 'bajar' && g.planDestino) {
    const destino = (await planesMako()).find((p) => p.id === g.planDestino);
    if (destino) {
      const { error } = await getSupabaseServer().from('cobros')
        .update({ plan_mako: destino.id, monto: g.objetivo, monto_usd: destino.precioUsd, concepto: conceptoDelPlan(destino) })
        .eq('id', g.cobroId).eq('workspace_id', plataforma);
      if (error) { console.error(`[retencion] ws=${ws}: no pude anotar el plan nuevo en el cobro ${g.cobroId}: ${error.message}`); return false; }
    }
  }
  // Stripe vuelve solo (cupón repeating, resumes_at); MP necesita al cron. Bajar no se restaura nunca.
  await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, estado: 'aplicada', restaurada: g.pasarela === 'stripe' || g.opcion === 'bajar' })));
  return true;
}

/**
 * EL CRON DE LA RETENCIÓN (corre al PRINCIPIO del cron de la pasarela, R9: al final se lo comía el tiempo). Nunca tira.
 *   1. CONCILIAR (R1): una marca «aplicando» de hace más de 10 minutos o en «error» se relee en la pasarela: si lo tomó, queda
 *      «aplicada» con sus escrituras; si no, se libera (la oferta vuelve a estar).
 *   2. LA CAPA DE «BAJAR» (R6): al llegar el próximo cobro, el negocio pasa a la capa del plan nuevo.
 *   3. MERCADO PAGO NO VUELVE SOLO: el descuento, al cobrarse sus cuotas desde `restaurarDesde` (R2: contadas desde el
 *      próximo cobro de MP, no por la hora de aceptar); la pausa, al pasar su `reanudaAt`.
 */
export async function conciliarRetenciones(): Promise<{ conciliadas: number; liberadas: number; capas: number; restauradas: number }> {
  const out = { conciliadas: 0, liberadas: 0, capas: 0, restauradas: 0 };
  try {
    const db = getSupabaseServer();
    const [pendientes, bajadas] = await Promise.all([
      db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETENCION)
        .not('value', 'like', '%"restaurada":true%').order('updated_at', { ascending: true }).limit(200),
      // Las de «bajar» ya restauradas igual pueden tener la capa pendiente.
      db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETENCION).like('value', '%"capaPendiente":{%').limit(200),
    ]);
    const plataforma = await wsSuperAdmin();
    const [key, token] = await Promise.all([credDelCliente('STRIPE_SECRET_KEY', plataforma), credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma)]);
    const vistas = new Set<string>();
    for (const fila of [...(pendientes.data ?? []), ...(bajadas.data ?? [])] as Array<{ workspace_id: number; value: string }>) {
      if (vistas.has(fila.value)) continue;
      vistas.add(fila.value);
      const ws = Number(fila.workspace_id);
      const g = leerRetencion(fila.value) as Marca | null;
      if (!g) continue;
      const { data: c } = await db.from('cobros').select('proveedor_suscripcion_id, proveedor_ref, suscripcion_estado').eq('id', g.cobroId).maybeSingle();
      const cc = c as { proveedor_suscripcion_id: string | null; proveedor_ref: string | null; suscripcion_estado: string | null } | null;
      const id = g.pasarela === 'stripe' ? cc?.proveedor_suscripcion_id : (cc?.proveedor_suscripcion_id ?? cc?.proveedor_ref);
      // 1. Conciliar.
      if (g.estado === 'error' || (g.estado === 'aplicando' && Date.now() - Date.parse(g.aplicadaAt) > 10 * 60_000)) {
        let tomo: boolean | null = null;
        if (g.pasarela === 'stripe' && key && id) {
          const s = await retencionEnStripe(key, id);
          if (s.ok) tomo = g.opcion === 'pausa' ? s.pausada : g.opcion === 'descuento' ? s.conDescuento : mismo(s.montoItem, g.objetivo);
        } else if (g.pasarela === 'mercadopago' && token && id) {
          const s = await suscripcionMpDetalle(token, id);
          if (s.ok) tomo = g.opcion === 'pausa' ? s.estado === 'paused' : mismo(s.monto, g.objetivo);
        }
        if (tomo === true && (await marcarAplicada(ws, g, plataforma))) out.conciliadas++;
        else if (tomo === false && (await runWithWorkspace(ws, () => borrarSettingSi(CLAVE_RETENCION, fila.value)))) out.liberadas++;
        continue;
      }
      if (g.estado !== 'aplicada') continue;
      // 2. La capa del plan nuevo, al llegar el próximo cobro.
      if (g.opcion === 'bajar' && g.capaPendiente && Date.now() >= Date.parse(`${g.capaPendiente.desde}T00:00:00Z`)) {
        const { error } = await db.from('workspaces').update({ capa: g.capaPendiente.capa }).eq('id', ws);
        if (!error) { await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, capaPendiente: null }))); out.capas++; }
        else console.error(`[retencion] ws=${ws}: no pude pasar a la capa ${g.capaPendiente.capa}: ${error.message}`);
        continue;
      }
      // 3. Mercado Pago: volver al precio o reanudar.
      if (g.pasarela !== 'mercadopago' || g.restaurada || !token || !id) continue;
      if (cc?.suscripcion_estado === 'cancelada') { await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true }))); continue; }
      if (g.opcion === 'pausa' && (!g.reanudaAt || Date.now() < Date.parse(g.reanudaAt))) continue;
      if (g.opcion === 'descuento') {
        // Las cuotas desde el próximo cobro de MP al aceptar (con 2 días de margen por la zona horaria).
        const desde = g.restaurarDesde ? new Date(Date.parse(`${g.restaurarDesde}T00:00:00Z`) - 2 * DIA).toISOString().slice(0, 10) : g.aplicadaAt.slice(0, 10);
        const { count } = await db.from('pagos').select('id', { count: 'exact', head: true })
          .eq('workspace_id', plataforma).eq('cobro_id', g.cobroId).eq('pagado', true).gte('fecha_pago', desde);
        if ((count ?? 0) < (g.meses ?? 1)) continue;
      }
      const r = g.opcion === 'pausa'
        ? await estadoSuscripcionMp(token, id, 'authorized', `mako-retencion-fin-${g.cobroId}-pausa`)
        : await montoSuscripcionMp(token, id, g.montoOriginal, `mako-retencion-fin-${g.cobroId}`);
      if (!r.ok) { console.error(`[retencion] no pude restaurar el cobro ${g.cobroId} (${g.opcion}): ${r.error}`); continue; }
      await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true })));
      out.restauradas++;
    }
  } catch (e) {
    console.error('[retencion] cron:', e instanceof Error ? e.message : String(e));
  }
  return out;
}

/** Lo que «Tu plan» dice de una oferta aceptada (R10). null = nada que decir. */
export async function estadoDeRetencion(ws: number): Promise<string | null> {
  const g = leerRetencion(await runWithWorkspace(ws, () => getSetting(CLAVE_RETENCION)).catch(() => null));
  if (!g || g.estado !== 'aplicada') return null;
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  if (g.opcion === 'pausa' && g.hasta && Date.now() < Date.parse(`${g.hasta}T00:00:00Z`)) return `En pausa: tu próximo cobro se saltea; vuelve a cobrarse el ${f(g.hasta)}.`;
  if (g.opcion === 'descuento' && !g.restaurada && g.pct) return `Con ${g.pct}% de descuento los próximos ${g.meses ?? 1} meses.`;
  if (g.opcion === 'bajar' && g.capaPendiente) return `Pasas a tu plan nuevo el ${f(g.capaPendiente.desde)}.`;
  return null;
}
