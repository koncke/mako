// =============================================================================
// agencia-plan — cambiar el plan (Esencial ↔ Pro) de la cuenta de un cliente de una agencia (29/10/2026)
// =============================================================================
// Llamada con Thiago (10:24): «son los mismos planes, de 47 y 97». La cuenta se abre con uno (lib/partners.ts) y la agencia
// lo puede cambiar después. Hace, en este orden (la pasarela primero: si no cambió lo que se cobra, no cambia nada más):
//   1. Lo que se COBRA: la suscripción viva pasa al precio del plan nuevo. Una renovación que todavía no se autorizó se anula
//      y el cron la vuelve a crear con el plan nuevo; el link del primer mes sin pagar se rehace con su precio.
//   2. Lo que se ANOTA: el plan en el primer mes (de ahí lo lee la renovación) y el precio en la suscripción.
//   3. La CAPA del plan (Esencial = completo, Pro = agencia): los topes de Esencial corren para estas cuentas.
//
// LO QUE ENCONTRÓ LA REVISIÓN DE PLATA (29/10/2026, dos pasadas: «se puede tener Pro pagando Esencial»):
//   · PRO SE TIENE CUANDO SE PAGA A PRECIO DE PRO (las reglas, en lib/agencia-cobro-reglas.ts → «CAMBIAR EL PLAN»). Subir con
//     Stripe cobra la diferencia ahora (`subirPlanStripe`, como «Pasar a Pro» de lib/subir-plan.ts) y la capa sube en el acto;
//     sin nada pagado todavía, también. Si no (Mercado Pago, que no prorratea; o el primer mes pagado sin una renovación
//     cobrada), la subida queda PENDIENTE y la capa sube con el primer pago a precio de Pro (`aplicarSubidasPendientes`, el
//     cron). Bajar es en el acto. Un «un cambio cada 30 días» no lo cerraba: con Mercado Pago alcanzaba para Pro la mitad de
//     los meses, y en el primer mes regalaba uno.
//   · LA CLAVE DE IDEMPOTENCIA ES UNA POR PEDIDO: por cobro y plan (y después por día) se repetía al ir y volver, y Stripe
//     devolvía la respuesta GUARDADA del «→Pro» anterior sin aplicarlo, con la base diciendo 97. Reintentar no cobra dos
//     veces: `subirPlanStripe` lee la suscripción antes y contesta `yaEstaba` si ya cobra ese precio. Y Mercado Pago tiene
//     que devolver el monto pedido: si no lo tomó, no se sigue.
//   · EL PLAN NUEVO TIENE QUE TENER PRECIO EN LA MONEDA DE LA CUENTA antes de tocar nada (`precioDelPlanEn`).
//   · VIVA ES TAMBIÉN LA PAGADA SIN `suscripcion_estado` (`esSuscripcionViva`): un aviso de Mercado Pago sin el id la dejaba
//     sin marcar, y su precio no cambiaba aunque la capa sí.
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
import { CAPA_DE_PLAN, KEY_PLAN_CAMBIADO, esSuscripcionViva, leerCambioDePlan, planDeCapa, subeEnElActo, subidaCobrada, type PlanCuenta } from './agencia-cobro-reglas';

type Fila = {
  id: number; tipo: 'unico' | 'suscripcion'; estado: string; suscripcion_estado: string | null; proveedor: 'stripe' | 'mercadopago';
  moneda: string; monto: number; proveedor_suscripcion_id: string | null; proveedor_ref: string | null; concepto: string;
};

async function leerSetting(ws: number, key: string): Promise<unknown> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { value?: unknown } | null)?.value ?? null;
}

async function guardarCambio(ws: number, plan: PlanCuenta, pendiente: boolean): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: KEY_PLAN_CAMBIADO, value: JSON.stringify({ at: ahora, plan, pendiente }), updated_at: ahora }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(error.message);
}

export async function cambiarPlanDeCliente(p: { agenciaWs: number; clienteWs: number; plan: PlanCuenta; autor: string }): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  const db = getSupabaseServer();
  const { data: fila } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs).maybeSingle();
  if (!fila) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  if ((fila as { estado: string }).estado === 'revocado') return { ok: false, error: 'Esa cuenta está dada de baja.' };
  let pagaCliente = false;
  let pendiente: ReturnType<typeof leerCambioDePlan> = null;
  try {
    const [cambio, quien] = await Promise.all([leerSetting(p.clienteWs, KEY_PLAN_CAMBIADO), leerSetting(p.clienteWs, KEY_QUIEN_PAGA)]);
    pendiente = leerCambioDePlan(cambio);
    pagaCliente = quienPagaDe(quien) === 'cliente';
  } catch (e) {
    return { ok: false, error: `No pude leer su plan: ${e instanceof Error ? e.message : String(e)}` };
  }
  const { data: w } = await db.from('workspaces').select('capa').eq('id', p.clienteWs).maybeSingle();
  if (planDeCapa((w as { capa?: string } | null)?.capa) === p.plan) {
    if (!pendiente?.pendiente) return { ok: true, resumen: 'Ya tiene ese plan.' };
  } else if (p.plan === 'pro' && pendiente?.pendiente && pendiente.plan === 'pro') {
    return { ok: true, resumen: 'Ya pasa a Pro con su próximo cobro.' };
  }
  const plan = (await planesMako()).find((x) => x.id === p.plan);
  if (!plan) return { ok: false, error: 'Ese plan no está en los planes de MaKo.' };

  const plataforma = await wsSuperAdmin();
  const { data: cobros, error } = await db.from('cobros').select('id, tipo, estado, suscripcion_estado, proveedor, moneda, monto, proveedor_suscripcion_id, proveedor_ref, concepto')
    .eq('workspace_id', plataforma).eq('agencia_ws', p.agenciaWs).eq('cliente_ws', p.clienteWs)
    .in('estado', ['pendiente', 'fallido', 'pagado', 'reembolsado']).limit(50);
  if (error) return { ok: false, error: `No pude leer sus cobros: ${error.message}` };
  const filas = (cobros ?? []) as Fila[];
  const vivas = filas.filter(esSuscripcionViva);
  const sinAutorizar = filas.filter((c) => c.tipo === 'suscripcion' && !esSuscripcionViva(c) && c.suscripcion_estado !== 'cancelada' && (c.estado === 'pendiente' || c.estado === 'fallido'));
  const primerMesSinPagar = filas.filter((c) => c.tipo === 'unico' && (c.estado === 'pendiente' || c.estado === 'fallido'));
  const primerMesPagado = filas.find((c) => c.tipo === 'unico' && c.estado === 'pagado') ?? null;
  const algoPagado = !!primerMesPagado || vivas.some((c) => c.estado === 'pagado' || c.estado === 'reembolsado');

  // El precio en la moneda de la cuenta, ANTES de tocar nada (la renovación del cron lo va a necesitar también).
  const precios = new Map<string, number>();
  for (const m of new Set(filas.map((c) => c.moneda.toUpperCase()))) {
    const v = await precioDelPlanEn(plan, m);
    if (v == null) return { ok: false, error: `${plan.nombre} no tiene precio en ${m}: no se puede cambiar.` };
    precios.set(m, v);
  }
  const precioEnMoneda = (moneda: string) => precios.get(moneda.toUpperCase())!;

  // 1. Lo que se cobra.
  const pedido = Date.now().toString(36);
  let diferenciaCobrada = false;
  for (const c of vivas) {
    const monto = precioEnMoneda(c.moneda);
    const idem = `mako-plan-agencia-${c.id}-${plan.id}-${pedido}`;
    let fallo: string | null = null;
    if (c.proveedor === 'stripe') {
      const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
      if (!key || !c.proveedor_suscripcion_id) fallo = 'Stripe no está conectado';
      else if (p.plan === 'pro') {
        const r = await subirPlanStripe(key, c.proveedor_suscripcion_id, { mensual: monto, anual: null, moneda: c.moneda, idem });
        if (!r.ok) fallo = r.error; else diferenciaCobrada = true; // `yaEstaba`: ya cobraba Pro, también vale
      } else {
        const r = await cambiarPrecioStripe(key, c.proveedor_suscripcion_id, { monto, moneda: c.moneda, idem });
        if (!r.ok) fallo = r.error;
      }
    } else {
      const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
      const id = c.proveedor_suscripcion_id ?? c.proveedor_ref;
      const r = token && id ? await montoSuscripcionMp(token, id, monto, idem) : null;
      if (!r?.ok) fallo = r && !r.ok ? r.error : 'Mercado Pago no está conectado';
      else if (Math.abs(r.monto - monto) > 0.01) fallo = `Mercado Pago quedó cobrando ${r.monto} en vez de ${monto}`;
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
  // 3. La capa: en el acto, salvo una subida que todavía no se cobró (queda pendiente y la sube el cron con ese pago).
  const enElActo = p.plan === 'esencial' || subeEnElActo({ diferenciaCobrada: diferenciaCobrada && vivas.every((c) => c.proveedor === 'stripe'), algoPagado });
  if (enElActo) {
    const { error: eCapa } = await db.from('workspaces').update({ capa: CAPA_DE_PLAN[p.plan] }).eq('id', p.clienteWs);
    if (eCapa) return { ok: false, error: `Se cambió lo que se cobra, pero no su plan en MaKo: ${eCapa.message}` };
  }
  try { await guardarCambio(p.clienteWs, p.plan, !enElActo); }
  catch (e) {
    // Sin la marca, el cron no sabría subirla: se dice, y la agencia lo vuelve a pedir (la pasarela ya está en Pro: no cobra dos veces).
    if (!enElActo) return { ok: false, error: `Lo que se cobra ya es de ${plan.nombre}, pero no pude anotar el cambio: ${e instanceof Error ? e.message : String(e)}. Pídelo otra vez.` };
    console.warn(`[agencia-plan] cliente ${p.clienteWs}: no pude anotar el cambio: ${e instanceof Error ? e.message : String(e)}`);
  }

  const viva = vivas[0];
  const cuanto = viva ? formatoMonto(precioEnMoneda(viva.moneda), viva.moneda) : null;
  const queSeCobra = !enElActo
    ? ` Tiene ${plan.nombre} desde su próximo cobro${cuanto ? `, que ya es de ${cuanto}` : ', que ya es al precio de Pro'}.`
    : diferenciaCobrada ? ` Hoy se cobró la diferencia de este mes y desde su próximo cobro se cobran ${cuanto}.`
      : viva ? ` Desde su próximo cobro se cobran ${cuanto}.` : '';
  if (pagaCliente) {
    for (const to of await adminsDeCuenta(p.clienteWs).catch(() => [] as string[])) {
      await avisarDePlataforma({
        to, asunto: `Tu plan de MaKo pasa a ${plan.nombre}`, preheader: 'Lo cambió tu agencia.', tag: 'agencia-plan',
        cuerpo: ['Hola,', '', `Tu agencia cambió tu plan de MaKo a ${plan.nombre}.${queSeCobra}`, '', 'Lo ves en «Tu plan»:', linkApp('/configuraciones/plan', p.clienteWs)].join('\n'),
      }).catch((e) => console.warn(`[agencia-plan] cliente ${p.clienteWs}: no pude avisarle: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
  return { ok: true, resumen: `Listo.${queSeCobra || ` Pasa a ${plan.nombre}.`}${pagaCliente ? ' A tu cliente le avisamos.' : ''}` };
}

/**
 * El cron (cada 30 min, junto a `renovacionesDeAgencia`): las subidas a Pro PENDIENTES cuyo primer pago a precio de Pro ya
 * entró suben la capa. Lee la marca de cada cuenta (`agency.plan_cambiado`), los cobros de suscripción de esa cuenta anotados
 * en Pro y sus pagos. Nunca tira por una cuenta.
 */
export async function aplicarSubidasPendientes(): Promise<{ subidas: number; errores: number }> {
  const out = { subidas: 0, errores: 0 };
  const db = getSupabaseServer();
  const { data, error } = await db.from('app_settings').select('workspace_id, value').eq('key', KEY_PLAN_CAMBIADO).limit(2000);
  if (error) { console.warn(`[agencia-plan] no pude leer las subidas pendientes: ${error.message}`); return out; }
  const pendientes = ((data ?? []) as Array<{ workspace_id: number; value: unknown }>)
    .map((r) => ({ ws: Number(r.workspace_id), cambio: leerCambioDePlan(r.value) }))
    .filter((x) => x.cambio?.pendiente && x.cambio.plan === 'pro');
  if (!pendientes.length) return out;
  const plataforma = await wsSuperAdmin();
  const pro = (await planesMako()).find((x) => x.id === 'pro') ?? null;
  for (const { ws, cambio } of pendientes) {
    try {
      const { data: cart } = await db.from('agencia_clientes').select('estado').eq('cliente_ws', ws).neq('estado', 'revocado').limit(1);
      if (!cart?.length) continue; // dada de baja: su plan ya no lo maneja la agencia
      const { data: subs, error: eSubs } = await db.from('cobros').select('id').eq('workspace_id', plataforma).eq('cliente_ws', ws)
        .eq('tipo', 'suscripcion').eq('plan_mako', 'pro').limit(50);
      if (eSubs) throw new Error(eSubs.message);
      const ids = ((subs ?? []) as Array<{ id: number }>).map((x) => x.id);
      if (!ids.length) continue;
      const { data: pagos, error: ePagos } = await db.from('pagos').select('fecha_pago, monto_usd, moneda, monto_original').eq('workspace_id', plataforma).in('cobro_id', ids).eq('pagado', true).limit(200);
      if (ePagos) throw new Error(ePagos.message);
      // Un pago de AL MENOS el precio de Pro en su moneda (tercera pasada, hallazgo 2): si la pasarela no tomó el monto nuevo,
      // el cobro de Esencial no sube la capa.
      const conMonto = await Promise.all(((pagos ?? []) as Array<{ fecha_pago: string | null; monto_usd: number | null; moneda: string | null; monto_original: number | null }>).map(async (x) => {
        const moneda = (x.moneda ?? 'USD').toUpperCase();
        const monto = moneda === 'USD' ? Number(x.monto_usd) : Number(x.monto_original);
        const precio = pro ? await precioDelPlanEn(pro, moneda) : null;
        return { fecha_pago: x.fecha_pago, alcanza: precio != null && Number.isFinite(monto) && monto >= precio - 0.01 };
      }));
      if (!subidaCobrada(cambio, conMonto)) continue;
      const { error: eCapa } = await db.from('workspaces').update({ capa: CAPA_DE_PLAN.pro }).eq('id', ws);
      if (eCapa) throw new Error(eCapa.message);
      await guardarCambio(ws, 'pro', false);
      out.subidas++;
    } catch (e) {
      out.errores++;
      console.error(`[agencia-plan] la subida pendiente del cliente ${ws}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}
