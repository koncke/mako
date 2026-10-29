// =============================================================================
// agencia-plan — cambiar el plan (Esencial ↔ Pro) de la cuenta de un cliente de una agencia (29/10/2026)
// =============================================================================
// Llamada con Thiago (10:24): «son los mismos planes, de 47 y 97». La cuenta se abre con uno (lib/partners.ts) y la agencia
// lo puede cambiar después. Hace, en este orden (la pasarela primero: si no cambió lo que se cobra, no cambia nada más):
//   1. Lo que se COBRA: la suscripción viva pasa al precio del plan nuevo. Una renovación que todavía no se autorizó se anula
//      y el cron la vuelve a crear con el plan nuevo; el link del primer mes sin pagar se rehace con su precio.
//   2. Lo que se ANOTA: el plan en el primer mes (de ahí lo lee la renovación) y el precio en la suscripción.
//   3. La CAPA del plan (Esencial = completo, Pro = agencia), en el acto: los topes de Esencial corren para estas cuentas.
//
// LO QUE ENCONTRÓ LA REVISIÓN DE PLATA (29/10/2026, hallazgo 2: «se puede tener Pro pagando Esencial»):
//   · SUBIR CON STRIPE COBRA LA DIFERENCIA AHORA (`subirPlanStripe`, como «Pasar a Pro» de lib/subir-plan.ts): si ese cobro
//     falla, nada cambia. Con `proration_behavior: none`, pasar a Pro después de cada cobro y volver antes del siguiente pagaba
//     siempre 47 y usaba Pro. Bajar no prorratea: el precio menor corre desde el próximo cobro.
//   · MERCADO PAGO NO PRORRATEA: el precio nuevo corre desde el próximo período, y el acceso a Pro es inmediato (lo mismo que
//     decidió el Cerebro el 23/10 para «Pasar a Pro»). Por eso, UN CAMBIO CADA 30 DÍAS (`proximoCambioDePlan`): sin eso, ir y
//     volver regalaba un mes de Pro por cada ida.
//   · LA CLAVE DE IDEMPOTENCIA LLEVA EL DÍA: la de siempre por cobro y plan hacía que Stripe devolviera la respuesta guardada
//     de un «→Pro» anterior sin aplicarlo, con la base diciendo 97.
//   · EL PLAN NUEVO TIENE QUE TENER PRECIO EN LA MONEDA DE LA CUENTA antes de tocar nada (`precioDelPlanEn`).
//   · Si la cuenta LA PAGA EL CLIENTE, se le avisa por mail: lo que cambia es lo que se cobra en su tarjeta.
// ⚠️ Sólo la agencia DUEÑA de la fila de la cartera, y nunca con la cuenta dada de baja.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { credDelCliente } from './credenciales';
import { anularCobro } from './cobros';
import { cambiarPrecioStripe, montoSuscripcionMp, subirPlanStripe } from './pasarela-plan-api';
import { planesMako } from './compra-plan';
import { conceptoDelPlan } from './planes-mako';
import { formatoMonto } from './pasarela-moneda';
import { avisarDePlataforma } from './invitaciones';
import { linkApp } from './app-url';
import { KEY_QUIEN_PAGA, quienPagaDe } from './agency-reglas';
import { precioDelPlanEn, rehacerPrimerMes } from './agencia-cobro';
import { adminsDeCuenta } from './agencia-baja';
import { CAPA_DE_PLAN, KEY_PLAN_CAMBIADO, planDeCapa, proximoCambioDePlan, type PlanCuenta } from './agencia-cobro-reglas';

type Fila = {
  id: number; tipo: 'unico' | 'suscripcion'; estado: string; suscripcion_estado: string | null; proveedor: 'stripe' | 'mercadopago';
  moneda: string; monto: number; proveedor_suscripcion_id: string | null; proveedor_ref: string | null; concepto: string;
};

async function leerSetting(ws: number, key: string): Promise<unknown> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { value?: unknown } | null)?.value ?? null;
}

/** Cuándo se cambió el plan por última vez (`agency.plan_cambiado`, en la cuenta del cliente), o null. */
function ultimoCambio(crudo: unknown): string | null {
  try {
    const v = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    return v && typeof v === 'object' && typeof (v as { at?: unknown }).at === 'string' ? (v as { at: string }).at : null;
  } catch { return null; }
}

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export async function cambiarPlanDeCliente(p: { agenciaWs: number; clienteWs: number; plan: PlanCuenta; autor: string }): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data: fila } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).maybeSingle();
  if (!fila) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  if ((fila as { estado: string }).estado === 'revocado') return { ok: false, error: 'Esa cuenta está dada de baja.' };
  const { data: w } = await db.from('workspaces').select('capa').eq('id', p.clienteWs).maybeSingle();
  if (planDeCapa((w as { capa?: string } | null)?.capa) === p.plan) return { ok: true, resumen: 'Ya tiene ese plan.' };
  const plan = (await planesMako()).find((x) => x.id === p.plan);
  if (!plan) return { ok: false, error: 'Ese plan no está en los planes de MaKo.' };

  // Un cambio cada 30 días: Mercado Pago no prorratea, e ir y volver regalaba Pro.
  let pagaCliente = false;
  try {
    const [cambio, quien] = await Promise.all([leerSetting(p.clienteWs, KEY_PLAN_CAMBIADO), leerSetting(p.clienteWs, KEY_QUIEN_PAGA)]);
    const proximo = proximoCambioDePlan(ultimoCambio(cambio), Date.now());
    if (proximo) return { ok: false, error: `El plan de esta cuenta se cambió hace poco: se puede volver a cambiar desde el ${fechaCorta(proximo)}.` };
    pagaCliente = quienPagaDe(quien) === 'cliente';
  } catch (e) {
    return { ok: false, error: `No pude leer su plan: ${e instanceof Error ? e.message : String(e)}` };
  }

  const plataforma = await wsSuperAdmin();
  const { data: cobros, error } = await db.from('cobros').select('id, tipo, estado, suscripcion_estado, proveedor, moneda, monto, proveedor_suscripcion_id, proveedor_ref, concepto')
    .eq('workspace_id', plataforma).eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs)
    .in('estado', ['pendiente', 'fallido', 'pagado', 'reembolsado']).limit(50);
  if (error) return { ok: false, error: `No pude leer sus cobros: ${error.message}` };
  const filas = (cobros ?? []) as Fila[];
  // Viva = la pasarela la cobra (pagada, autorizada sin cobrar, fallida o con el primer pago devuelto).
  const vivas = filas.filter((c) => c.tipo === 'suscripcion' && c.suscripcion_estado === 'activa');
  const sinAutorizar = filas.filter((c) => c.tipo === 'suscripcion' && c.suscripcion_estado == null && (c.estado === 'pendiente' || c.estado === 'fallido'));
  const primerMesSinPagar = filas.filter((c) => c.tipo === 'unico' && (c.estado === 'pendiente' || c.estado === 'fallido'));
  const primerMesPagado = filas.find((c) => c.tipo === 'unico' && c.estado === 'pagado') ?? null;

  // El precio en la moneda de la cuenta, ANTES de tocar nada (la renovación del cron lo va a necesitar también).
  const precios = new Map<string, number>();
  for (const m of new Set(filas.map((c) => c.moneda.toUpperCase()))) {
    const v = await precioDelPlanEn(plan, m);
    if (v == null) return { ok: false, error: `${plan.nombre} no tiene precio en ${m}: no se puede cambiar.` };
    precios.set(m, v);
  }
  const precioEnMoneda = (moneda: string) => precios.get(moneda.toUpperCase())!;

  // 1. Lo que se cobra.
  const hoy = new Date().toISOString().slice(0, 10);
  let diferenciaCobrada = false;
  for (const c of vivas) {
    const monto = precioEnMoneda(c.moneda);
    const idem = `mako-plan-agencia-${c.id}-${plan.id}-${hoy}`;
    let fallo: string | null = null;
    if (c.proveedor === 'stripe') {
      const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
      if (!key || !c.proveedor_suscripcion_id) fallo = 'Stripe no está conectado';
      else if (p.plan === 'pro') {
        const r = await subirPlanStripe(key, c.proveedor_suscripcion_id, { mensual: monto, anual: null, moneda: c.moneda, idem });
        if (!r.ok) fallo = r.error; else if (!r.yaEstaba) diferenciaCobrada = true;
      } else {
        const r = await cambiarPrecioStripe(key, c.proveedor_suscripcion_id, { monto, moneda: c.moneda, idem });
        if (!r.ok) fallo = r.error;
      }
    } else {
      const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
      const id = c.proveedor_suscripcion_id ?? c.proveedor_ref;
      const r = token && id ? await montoSuscripcionMp(token, id, monto, idem) : null;
      if (!r?.ok) fallo = r && !r.ok ? r.error : 'Mercado Pago no está conectado';
    }
    if (fallo) return { ok: false, error: `No pude cambiar lo que se le cobra: ${fallo}. Prueba otra vez en un minuto.` };
    await db.from('cobros').update({ monto, monto_usd: plan.precioUsd, plan_mako: plan.id, concepto: c.concepto.replace(/^MaKo [A-Za-zé ]+ · /, `${conceptoDelPlan(plan).replace(/ · mensual$/, '')} · `).slice(0, 200) })
      .eq('id', c.id).eq('workspace_id', plataforma);
  }
  for (const c of sinAutorizar) {
    const r = await anularCobro(plataforma, c.id, p.autor);
    if (!r.ok) return { ok: false, error: `No pude rehacer su renovación: ${r.error ?? 'sin detalle'}` };
  }
  for (const c of primerMesSinPagar) {
    const r = await rehacerPrimerMes(c.id, plan, p.autor);
    if (!r.ok) return { ok: false, error: r.error };
  }
  // 2. El plan en el primer mes pagado (de ahí lo lee la renovación que el cron crea).
  if (primerMesPagado) await db.from('cobros').update({ plan_mako: plan.id }).eq('id', primerMesPagado.id).eq('workspace_id', plataforma);
  // 3. La capa.
  const { error: eCapa } = await db.from('workspaces').update({ capa: CAPA_DE_PLAN[p.plan] }).eq('id', p.clienteWs);
  if (eCapa) return { ok: false, error: `Se cambió lo que se cobra, pero no su plan en MaKo: ${eCapa.message}` };
  const ahora = new Date().toISOString();
  await db.from('app_settings').upsert({ workspace_id: p.clienteWs, key: KEY_PLAN_CAMBIADO, value: JSON.stringify({ at: ahora, plan: plan.id }), updated_at: ahora }, { onConflict: 'workspace_id,key' });

  const viva = vivas[0];
  const cuanto = viva ? formatoMonto(precioEnMoneda(viva.moneda), viva.moneda) : null;
  const queSeCobra = diferenciaCobrada
    ? ` Hoy se cobró la diferencia de este mes y desde su próximo cobro se cobran ${cuanto}.`
    : viva ? ` Desde su próximo cobro se cobran ${cuanto}.` : '';
  if (pagaCliente) {
    for (const to of await adminsDeCuenta(p.clienteWs).catch(() => [] as string[])) {
      await avisarDePlataforma({
        to, asunto: `Tu plan de MaKo pasó a ${plan.nombre}`, preheader: 'Lo cambió tu agencia.', tag: 'agencia-plan',
        cuerpo: ['Hola,', '', `Tu agencia cambió tu plan de MaKo a ${plan.nombre}.${queSeCobra}`, '', 'Lo ves en «Tu plan»:', linkApp('/configuraciones/plan', p.clienteWs)].join('\n'),
      }).catch((e) => console.warn(`[agencia-plan] cliente ${p.clienteWs}: no pude avisarle: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
  return { ok: true, resumen: `Listo: pasa a ${plan.nombre}.${queSeCobra}${pagaCliente ? ' A tu cliente le avisamos.' : ''}` };
}
