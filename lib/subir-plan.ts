// =============================================================================
// subir-plan — «Pasar a Pro» desde «Tu plan» (23/10/2026)
// =============================================================================
// A donde llevan todos los carteles de tope (lib/topes-plan.ts, RUTA_CAMBIAR_PLAN). Sube de MaKo Esencial a Pro, y el
// negocio pasa a la capa de Pro (`agencia`) en el acto. Las reglas (a qué plan, a qué precio, si ya está) están en
// lib/subir-plan-reglas.ts.
//
// Lo que no se ve en el código y muerde:
//   · STRIPE COBRA LA DIFERENCIA AHORA, y si ese cobro falla la suscripción NO cambia (`subirPlanStripe`,
//     `error_if_incomplete`): entonces la capa tampoco sube, y se dice. Mensual sigue mensual y anual sigue anual.
//   · MERCADO PAGO no prorratea: el preapproval pasa al monto de Pro desde el PRÓXIMO período, y el acceso a Pro es
//     inmediato (lo decidió el Cerebro, 23/10/2026).
//   · CREEM COBRA LA DIFERENCIA AHORA, como Stripe, pero pasando la suscripción a OTRO PRODUCTO: su precio es el del producto
//     (`cambiarPrecioCreem`). ⚠️ Caía en el `else` de Mercado Pago y le pedía cambiar el monto de un id que no es suyo: nadie
//     de LatAm pasaba a Pro, y el error culpaba a una pasarela que no usa (31/10/2026).
//   · DOS CLICS NO COBRAN DOS VECES: la subida se reclama con compare-and-set (`plan.subida`) ANTES de tocar la pasarela, y
//     Stripe dice `yaEstaba` si la suscripción ya cobra el precio de Pro (un reintento después de un corte no cobra otra vez).
//   · LA CAPA SUBE SÓLO DESPUÉS DE QUE LA PASARELA ACEPTÓ. Si anotar el cobro o la capa falla después, se reintenta tocando
//     de nuevo: la pasarela contesta `yaEstaba` y se termina lo que faltaba.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { cambiarSettingSi, getSetting, setSetting } from './settings';
import { credDelCliente } from './credenciales';
import { logLeadEvent } from './leads';
import { credCreemDelCobro, suscripcionDeMakoDe } from './cobros';
import { cambiarPrecioCreem, sinConfirmarCreem } from './creem-api';
import { CAPACIDADES_PASARELA, NOMBRE_PASARELA } from './cobros-tipos';
import { esBajaPedida } from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import { montoSuscripcionMp, subirPlanStripe } from './pasarela-plan-api';
import { planesMako } from './compra-plan';
import { conceptoDelPlan } from './planes-mako';
import { CLAVE_SUBIDA, decidirSubida, subidaLibre } from './subir-plan-reglas';
import { CLAVE_RETENCION, leerRetencion } from './retencion-reglas';

export type ResultadoSubida = { ok: boolean; resumen: string; yaEstaba?: boolean };

export async function subirAPro(ws: number, autor: string): Promise<ResultadoSubida> {
  const c = await suscripcionDeMakoDe(ws).catch(() => null);
  if (!c || c.suscripcion_estado === 'cancelada' || esBajaPedida(c.motivo)) return { ok: false, resumen: 'Tu plan no tiene una suscripción activa para cambiar.' };
  const plataforma = await wsSuperAdmin();
  const { data, error: eLeer } = await getSupabaseServer().from('cobros').select('plan_mako').eq('id', c.id).eq('workspace_id', plataforma).maybeSingle();
  if (eLeer) return { ok: false, resumen: 'No pudimos leer tu plan. Intenta de nuevo.' };
  const planActual = (data as { plan_mako?: string | null } | null)?.plan_mako ?? null;
  const [planes, w, ret] = await Promise.all([
    planesMako(),
    getSupabaseServer().from('workspaces').select('capa').eq('id', ws).maybeSingle(),
    runWithWorkspace(ws, () => getSetting(CLAVE_RETENCION)).catch(() => null),
  ]);
  if (w.error) return { ok: false, resumen: 'No pudimos leer tu plan. Intenta de nuevo.' };
  const d = decidirSubida({ planActual, planes, moneda: c.moneda, proveedor: c.proveedor, montoHoy: c.monto, capa: (w.data as { capa?: string | null } | null)?.capa ?? null });
  // Con una oferta de retención viva (descuento o pausa sin restaurar), no: el cron la devolvería al precio de antes.
  const r0 = leerRetencion(ret);
  if (d.accion === 'subir' && r0 && r0.cobroId === c.id && r0.estado === 'aplicada' && !r0.restaurada) {
    return { ok: false, resumen: 'Tienes una oferta de tu plan en curso. Cuando termine, puedes pasar a Pro.' };
  }
  if (d.accion === 'no') return { ok: false, resumen: d.motivo };
  if (d.accion === 'ya') {
    // Ya es Pro en el cobro: que la capa también lo sea (un intento que se cortó antes de subirla).
    if (!(await subirCapa(ws, d.destino.capa))) return { ok: false, resumen: SIN_CAPA };
    return { ok: true, resumen: `Ya tienes ${d.destino.nombre}.`, yaEstaba: true };
  }

  // El reclamo: dos clics o dos pestañas no llegan los dos a la pasarela.
  const ahora = Date.now();
  const antes = await runWithWorkspace(ws, () => getSetting(CLAVE_SUBIDA)).catch(() => null);
  if (!subidaLibre(antes, ahora)) return { ok: false, resumen: 'Ya se está cambiando tu plan. Recarga en un momento.' };
  const marca = { estado: 'aplicando', cobroId: c.id, a: d.destino.id, at: new Date(ahora).toISOString() };
  const gano = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_SUBIDA, antes, JSON.stringify(marca))).catch(() => false);
  if (!gano) return { ok: false, resumen: 'Ya se está cambiando tu plan. Recarga en un momento.' };

  const idem = `mako-subir-${c.id}-${d.destino.id}-${ahora}`;
  let error: string | null = null;
  // Creem no contestó y al releer tampoco se pudo ver: no se dice «tu plan sigue igual» a quien pudo haber pagado la diferencia.
  let sinConfirmar = false;
  let monto = d.mensual;
  let periodo = 'por mes';
  if (c.proveedor === 'stripe') {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const sub = c.proveedor_suscripcion_id;
    if (!key || !sub) error = 'Stripe no está conectado';
    else {
      const r = await subirPlanStripe(key, sub, { mensual: d.mensual, anual: d.anual, moneda: c.moneda, idem });
      if (!r.ok) error = r.error;
      else { monto = r.monto; periodo = r.intervalo === 'year' ? 'por año' : 'por mes'; }
    }
  } else if (c.proveedor === 'creem') {
    const creem = await credCreemDelCobro(c);
    const sub = c.proveedor_suscripcion_id;
    if (!creem || !sub) error = 'Creem no está conectado';
    else {
      const r = await cambiarPrecioCreem(creem.key, sub, { monto: d.mensual, moneda: c.moneda, nombre: conceptoDelPlan(d.destino), idem, cobrarDiferencia: true });
      if (!r.ok) { error = r.error; sinConfirmar = sinConfirmarCreem(r.status); }
    }
  } else if (c.proveedor === 'mercadopago') {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    const sub = c.proveedor_suscripcion_id ?? c.proveedor_ref;
    if (!token || !sub) error = 'Mercado Pago no está conectado';
    else {
      const r = await montoSuscripcionMp(token, sub, d.mensual, idem);
      if (!r.ok) error = r.error;
    }
  } else {
    const _x: never = c.proveedor;
    error = `Esa pasarela no sabe cambiar un plan: ${String(_x)}`;
  }
  if (error) {
    // No sube la capa, y se dice. La marca queda en «error»: se puede volver a intentar.
    await runWithWorkspace(ws, () => setSetting(CLAVE_SUBIDA, JSON.stringify({ ...marca, estado: 'error', error: error!.slice(0, 200) }))).catch(() => {});
    console.error(`[subir-plan] ws=${ws} cobro ${c.id}: ${error}`);
    if (sinConfirmar) return { ok: false, resumen: `No pudimos confirmar tu paso a ${d.destino.nombre}. Toca el botón de nuevo en unos minutos: no se cobra otra vez.` };
    return { ok: false, resumen: `No pudimos pasarte a ${d.destino.nombre}: ${CAPACIDADES_PASARELA[c.proveedor].subidaCobraLaDiferencia ? 'el cobro de la diferencia no pasó' : `${NOMBRE_PASARELA[c.proveedor]} no lo aceptó`}. Tu plan sigue igual. Revisa tu tarjeta e intenta de nuevo.` };
  }

  // La pasarela aceptó: el cobro recuerda el plan nuevo y el negocio sube de capa, en el acto.
  const { error: e1 } = await getSupabaseServer().from('cobros')
    .update({ plan_mako: d.destino.id, monto, monto_usd: c.moneda.toUpperCase() === 'USD' ? monto : d.destino.precioUsd, concepto: conceptoDelPlan(d.destino) })
    .eq('id', c.id).eq('workspace_id', plataforma);
  if (e1) console.error(`[subir-plan] ws=${ws}: no pude anotar el plan nuevo en el cobro ${c.id}: ${e1.message}`);
  const capaOk = await subirCapa(ws, d.destino.capa);
  await runWithWorkspace(ws, () => setSetting(CLAVE_SUBIDA, JSON.stringify({ ...marca, estado: capaOk ? 'aplicada' : 'error', ...(capaOk ? {} : { error: 'la capa no subió' }) }))).catch(() => {});
  // Pagó y no se activó: se dice (y tocar de nuevo lo termina, sin cobrar otra vez: la pasarela contesta `yaEstaba`).
  if (!capaOk) return { ok: false, resumen: SIN_CAPA };
  const resumen = CAPACIDADES_PASARELA[c.proveedor].subidaCobraLaDiferencia
    ? `Listo: ya tienes ${d.destino.nombre}. Cobramos la diferencia de este período, y desde el próximo pagas ${formatoMonto(monto, c.moneda)} ${periodo}.`
    : `Listo: ya tienes ${d.destino.nombre}. Desde tu próximo cobro pagas ${formatoMonto(d.mensual, c.moneda)} por mes.`;
  if (c.lead_id) {
    await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Cambio de plan', `${resumen} (${autor})`.slice(0, 300), autor)).catch(() => {});
  }
  return { ok: true, resumen };
}

const SIN_CAPA = 'Tu cambio de plan quedó cobrado, pero no pudimos activarlo todavía. Toca «Pasar a Pro» de nuevo: no se cobra otra vez.';

async function subirCapa(ws: number, capa: string): Promise<boolean> {
  const { error } = await getSupabaseServer().from('workspaces').update({ capa }).eq('id', ws);
  if (error) console.error(`[subir-plan] ws=${ws}: no pude cambiar la capa a ${capa}: ${error.message}`);
  return !error;
}
