// =============================================================================
// agencia-plan — cambiar el plan (Esencial ↔ Pro) de la cuenta de un cliente de una agencia (29/10/2026)
// =============================================================================
// Llamada con Thiago (10:24): «son los mismos planes, de 47 y 97». La cuenta se abre con uno (lib/partners.ts) y la agencia
// lo puede cambiar después. Hace, en este orden (la pasarela primero: si no cambió lo que se cobra, no cambia nada más):
//   1. Lo que se COBRA: la renovación que ya cobra (o que la agencia ya autorizó) pasa al precio del plan nuevo desde el próximo
//      cobro (Stripe: el ítem con `proration_behavior: none`; MP: el monto del preapproval). Una renovación que todavía no se
//      autorizó se anula y el cron la vuelve a crear con el plan nuevo.
//   2. Lo que se ANOTA: el plan en el primer mes (de ahí lo lee la renovación) y el precio en la renovación.
//   3. La CAPA del plan (Esencial = completo, Pro = agencia), en el acto: los topes de Esencial corren para estas cuentas.
// ⚠️ Sólo la agencia DUEÑA de la fila de la cartera, y nunca con la cuenta dada de baja.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { credDelCliente } from './credenciales';
import { anularCobro } from './cobros';
import { cambiarPrecioStripe, montoSuscripcionMp } from './pasarela-plan-api';
import { planesMako } from './compra-plan';
import { conceptoDelPlan, precioEn } from './planes-mako';
import { CAPA_DE_PLAN, planDeCapa, type PlanCuenta } from './agencia-cobro-reglas';

type Fila = { id: number; tipo: 'unico' | 'suscripcion'; estado: string; suscripcion_estado: string | null; proveedor: 'stripe' | 'mercadopago'; moneda: string; proveedor_suscripcion_id: string | null; proveedor_ref: string | null; concepto: string };

export async function cambiarPlanDeCliente(p: { agenciaWs: number; clienteWs: number; plan: PlanCuenta; autor: string }): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data: fila } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).maybeSingle();
  if (!fila) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  if ((fila as { estado: string }).estado === 'revocado') return { ok: false, error: 'Esa cuenta está dada de baja.' };
  const { data: w } = await db.from('workspaces').select('capa').eq('id', p.clienteWs).maybeSingle();
  if (planDeCapa((w as { capa?: string } | null)?.capa) === p.plan) return { ok: true, resumen: 'Ya tiene ese plan.' };
  const plan = (await planesMako()).find((x) => x.id === p.plan);
  if (!plan) return { ok: false, error: 'Ese plan no está en los planes de MaKo.' };

  const plataforma = await wsSuperAdmin();
  const { data: cobros, error } = await db.from('cobros').select('id, tipo, estado, suscripcion_estado, proveedor, moneda, proveedor_suscripcion_id, proveedor_ref, concepto')
    .eq('workspace_id', plataforma).eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).in('estado', ['pendiente', 'fallido', 'pagado']).limit(50);
  if (error) return { ok: false, error: `No pude leer sus cobros: ${error.message}` };
  const filas = (cobros ?? []) as Fila[];
  const renov = filas.filter((c) => c.tipo === 'suscripcion' && c.suscripcion_estado !== 'cancelada');

  // 1. Lo que se cobra.
  for (const c of renov) {
    const cobra = c.estado === 'pagado' || c.suscripcion_estado === 'activa';
    if (!cobra) {
      const r = await anularCobro(plataforma, c.id, p.autor);
      if (!r.ok) return { ok: false, error: `No pude rehacer su renovación: ${r.error ?? 'sin detalle'}` };
      continue;
    }
    const monto = precioEn(plan, c.moneda);
    if (monto == null) return { ok: false, error: `${plan.nombre} no tiene precio en ${c.moneda}: no se puede cambiar.` };
    const idem = `mako-plan-agencia-${c.id}-${plan.id}`;
    let fallo: string | null = null;
    if (c.proveedor === 'stripe') {
      const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
      const r = key && c.proveedor_suscripcion_id ? await cambiarPrecioStripe(key, c.proveedor_suscripcion_id, { monto, moneda: c.moneda, idem }) : null;
      if (!r?.ok) fallo = r && !r.ok ? r.error : 'Stripe no está conectado';
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
  // 2. El plan en el primer mes (de ahí lo lee la renovación que el cron crea).
  await db.from('cobros').update({ plan_mako: plan.id }).eq('workspace_id', plataforma).eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).eq('tipo', 'unico');
  // 3. La capa.
  const { error: eCapa } = await db.from('workspaces').update({ capa: CAPA_DE_PLAN[p.plan] }).eq('id', p.clienteWs);
  if (eCapa) return { ok: false, error: `Se cambió lo que se cobra, pero no su plan en MaKo: ${eCapa.message}` };
  const cobrando = renov.some((c) => c.estado === 'pagado' || c.suscripcion_estado === 'activa');
  return { ok: true, resumen: `Listo: pasa a ${plan.nombre}.${cobrando ? ' Desde su próximo cobro se le cobra el precio de ese plan.' : ''}` };
}
