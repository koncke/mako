// =============================================================================
// compra-plan — el checkout público de los planes de MaKo (/planes): pagar y quedar adentro, sin nadie en el medio
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida».
// El alta automática ya existía (lib/cobros.ts, `altaSiCorresponde` → lib/alta-cliente.ts → `invitarPorEmail`), pero
// su ÚNICO disparador era un link armado a mano en /admin/cobros. Esto es la puerta pública: el comprador elige un
// plan, deja nombre y email, y sale al checkout de la pasarela con un cobro de SUSCRIPCIÓN que al pagarse da el alta.
//
// QUÉ HACE, en orden:
//   1. El plan sale de lib/planes-mako.ts (con el setting `planes.mako` de la plataforma): la capa y el precio NUNCA
//      salen del pedido.
//   2. La pasarela: las conectadas en el workspace de la plataforma, y de esas las que tienen precio en su moneda (MP
//      cobra en la del sitio de su cuenta: sin precio en ARS, una cuenta argentina no se ofrece).
//   3. El lead del comprador en el CRM de la plataforma: el de ese email (se reusa) o uno nuevo, con la campaña.
//   4. Si ya tiene un link VIVO de ese plan por esa pasarela (de las últimas 23 h), se devuelve ése: dos clics o
//      volver atrás no crean otro checkout.
//   5. `crearCobro` con `altaCapa` (sólo la plataforma puede: lib/cobros.ts lo valida en positivo).
//   6. Se anotan en el cobro el plan, el origen (de qué landing vino: lo lee el onboarding) y el código de MaKo
//      Partners. Best effort: sin la mig 0330 el cobro sigue y lo dice el log.
//
// ⚠️ PÚBLICO: lo llama POST /api/planes/comprar sin sesión. Todo lo del negocio corre en `runWithWorkspace` con el ws
// de la PLATAFORMA (sin el contexto, `getTenantDb` cae al ws1, Mauricio, un cliente).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSetting } from './settings';
import { credDelCliente } from './credenciales';
import { createLead, logLeadEvent } from './leads';
import { esLeadDuplicado } from './leads-duplicados';
import { leadPorEmail } from './editor-landing/pago-pedido';
import { crearCobro, linkDelCobro, pasarelasConectadas } from './cobros';
import { leerCuentaMp } from './mercadopago-api';
import { COLS_COBRO, cobroDeFila, type Pasarela } from './cobros-tipos';
import { CLAVE_PLANES, conceptoDelPlan, planesDeSetting, precioEn, type PlanMako } from './planes-mako';
import { pasarelaDeLaCompra, TEXTO_SIN_PASARELA, type PedidoCompra } from './compra-plan-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Los planes que valen hoy (el setting de la plataforma, o los de siempre). Nunca tira: sin base, los de siempre. */
export async function planesMako(): Promise<PlanMako[]> {
  try {
    const ws = await wsSuperAdmin();
    const crudo = await runWithWorkspace(ws, () => getSetting(CLAVE_PLANES));
    return planesDeSetting(crudo);
  } catch (e) {
    console.warn('[compra-plan] no pude leer los planes del setting:', msg(e));
    return planesDeSetting(null);
  }
}

/** La moneda en que cobraría HOY cada pasarela conectada de la plataforma (Stripe: USD; MP: la de su sitio). */
async function monedasDeLaPlataforma(ws: number): Promise<Array<{ pasarela: Pasarela; moneda: string }>> {
  const conectadas = await pasarelasConectadas(ws);
  const out: Array<{ pasarela: Pasarela; moneda: string }> = [];
  for (const p of conectadas) {
    if (p === 'stripe') { out.push({ pasarela: 'stripe', moneda: 'USD' }); continue; }
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', ws);
    if (!token) continue;
    const c = await leerCuentaMp(token);
    if (c.ok && c.moneda) out.push({ pasarela: 'mercadopago', moneda: c.moneda });
  }
  return out;
}

/** Lo que la página /planes/<id> necesita para dibujar el formulario: el plan y con qué se puede pagar (y cuánto). */
export async function ofertaDelPlan(planId: string): Promise<{ plan: PlanMako; pasarelas: Array<{ pasarela: Pasarela; moneda: string; monto: number }> } | null> {
  const plan = (await planesMako()).find((p) => p.id === planId && p.activo);
  if (!plan) return null;
  try {
    const ws = await wsSuperAdmin();
    const monedas = await monedasDeLaPlataforma(ws);
    const pasarelas = monedas.map((m) => ({ ...m, monto: precioEn(plan, m.moneda) })).filter((x): x is { pasarela: Pasarela; moneda: string; monto: number } => x.monto != null);
    return { plan, pasarelas };
  } catch (e) {
    console.warn('[compra-plan] no pude leer las pasarelas de la plataforma:', msg(e));
    return { plan, pasarelas: [] };
  }
}

/**
 * Cada plan activo y si HOY se puede pagar en línea, con UNA lectura de las pasarelas (la misma cuenta que
 * `ofertaDelPlan`: una pasarela conectada con precio en su moneda). La usa /planes para no ofrecer «Empezar» donde el
 * checkout no puede cobrar (lib/compra-plan-reglas.ts, `botonDelPlan`). Sin poder leer las pasarelas, ninguno se cobra:
 * ofrecer la agenda de más es un llamado; ofrecer un pago que no existe es un callejón.
 */
export async function ofertasDeLosPlanes(): Promise<Array<{ plan: PlanMako; cobrable: boolean }>> {
  const planes = (await planesMako()).filter((p) => p.activo);
  let monedas: Array<{ pasarela: Pasarela; moneda: string }> = [];
  try {
    monedas = await monedasDeLaPlataforma(await wsSuperAdmin());
  } catch (e) {
    console.warn('[compra-plan] no pude leer las pasarelas de la plataforma:', msg(e));
  }
  return planes.map((plan) => ({ plan, cobrable: monedas.some((m) => precioEn(plan, m.moneda) != null) }));
}

/** El lead de ese email en el CRM de la plataforma (exacto), o uno nuevo. Corre adentro de runWithWorkspace. */
async function leadDelComprador(p: PedidoCompra): Promise<{ leadId: number; nuevo: boolean }> {
  const db = await getTenantDb();
  const buscar = async () => {
    const patron = p.email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await db.from('leads').select('id, email').ilike('email', patron).limit(20);
    if (error) throw new Error(`No pude buscar el lead por email: ${error.message}`);
    return leadPorEmail((data ?? []) as Array<{ id: number; email: string | null }>, p.email);
  };
  const ya = await buscar();
  if (ya) return { leadId: ya.id, nuevo: false };
  const o = p.origen ?? {};
  try {
    const lead = await createLead({
      nombre: p.nombre, email: p.email, origen_lead: 'landing',
      utm_source: o.utm_source, utm_medium: o.utm_medium, utm_campaign: o.utm_campaign, utm_content: o.utm_content, fbclid: o.fbclid,
    });
    return { leadId: Number(lead.id), nuevo: true };
  } catch (e) {
    if (!esLeadDuplicado(e)) throw e;
    const otro = await buscar();
    if (otro) return { leadId: otro.id, nuevo: false };
    throw e;
  }
}

export type ResultadoCompra =
  | { ok: true; link: string }
  | { ok: false; status: number; error: string; elegir?: Array<{ pasarela: Pasarela; moneda: string; monto: number }> };

/** El checkout de un plan. Ver el orden arriba. */
export async function iniciarCompraDePlan(p: PedidoCompra): Promise<ResultadoCompra> {
  const oferta = await ofertaDelPlan(p.plan);
  if (!oferta) return { ok: false, status: 404, error: 'Ese plan no existe.' };
  const { plan, pasarelas } = oferta;
  const eleccion = pasarelaDeLaCompra({ pedida: p.pasarela, sirven: pasarelas.map((x) => x.pasarela) });
  if (!eleccion.ok) {
    if (eleccion.motivo === 'elegir') return { ok: false, status: 409, error: '¿Con qué quieres pagar?', elegir: pasarelas };
    return { ok: false, status: 503, error: TEXTO_SIN_PASARELA };
  }
  const via = pasarelas.find((x) => x.pasarela === eleccion.pasarela)!;
  const ws = await wsSuperAdmin();

  return runWithWorkspace(ws, async () => {
    let lead: { leadId: number; nuevo: boolean };
    try {
      lead = await leadDelComprador(p);
    } catch (e) {
      console.error('[compra-plan] no pude crear el lead del comprador:', msg(e));
      return { ok: false, status: 503, error: 'No pudimos registrar tu compra. Prueba otra vez en un minuto.' };
    }
    // ⚠️ NO se devuelve un link vivo de ese email (revisión del 23/10, alta 1): el token de /pagar es la credencial del cambio
    // de email del acceso, y se lo daba a cualquiera que tipeara el email de otro. Cada pedido abre su propio checkout (con los
    // topes por IP y por email de la ruta).

    const r = await crearCobro(ws, {
      leadId: lead.leadId, pasarela: via.pasarela, tipo: 'suscripcion', concepto: conceptoDelPlan(plan),
      monto: via.monto, moneda: via.moneda, montoUsd: plan.precioUsd, email: p.email, nombre: p.nombre,
      altaCapa: plan.capa, creadoPor: `planes:${plan.id}`,
    });
    if (!r.ok) {
      console.error(`[compra-plan] crearCobro (${plan.id}, ${via.pasarela}): ${r.error}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    // Lo que el cobro tiene que recordar: el plan, de dónde vino y quién lo refirió. Antes de devolver el link: nadie
    // puede haber pagado todavía. Best effort (sin la mig 0330 el cobro vale igual).
    const { error } = await getSupabaseServer().from('cobros')
      .update({ plan_mako: plan.id, origen: p.origen, ref_codigo: p.ref })
      .eq('id', r.cobro.id).eq('workspace_id', ws);
    if (error) console.warn(`[compra-plan] no pude anotar plan/origen/ref en el cobro ${r.cobro.id}: ${error.message}`);
    if (lead.nuevo || !r.yaEstaba) {
      const de = p.origen?.landing ? ` desde la landing «${p.origen.landing}»` : '';
      const ref = p.ref ? ` (referido por ${p.ref})` : '';
      await logLeadEvent(lead.leadId, 'Compra de plan', `Abrió el pago de ${plan.nombre}${de}${ref}.`, 'Checkout de MaKo').catch(() => {});
    }
    return { ok: true, link: r.link };
  });
}

/**
 * VOLVER A MaKo (23/10/2026): quien tuvo un plan que terminó (se dio de baja, o la pasarela dejó de cobrar) lo
 * reactiva desde /cuenta-pausada o «Tu plan», con su misma pasarela y el precio de HOY de su plan. Es una suscripción
 * nueva atada a SU negocio (`alta_ws`, sin `alta_capa`: no crea otra cuenta). Con deuda, primero la deuda
 * (lib/plan-deuda.ts): quien llama lo decide con `pagarDeuda`.
 */
export async function reactivarPlan(ws: number, p: { email: string; nombre: string | null }): Promise<ResultadoCompra> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma) return { ok: false, status: 400, error: 'La cuenta de MaKo no tiene plan.' };
  const db = getSupabaseServer();
  const { data, error } = await db.from('cobros').select(COLS_COBRO).eq('workspace_id', plataforma).eq('alta_ws', ws)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return { ok: false, status: 503, error: 'No pudimos leer tu plan. Prueba otra vez en un minuto.' };
  const cobros = (data ?? []).map((x) => cobroDeFila(x as Record<string, unknown>));
  // La base es la ÚLTIMA SUSCRIPCIÓN (revisión del 23/10, alta 7): un cobro único de deuda tiene N meses de precio y otro concepto.
  const base = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pagado' || c.estado === 'reembolsado'));
  if (!base || !base.lead_id) return { ok: false, status: 404, error: 'Tu plan no se cobra en línea: escríbenos y lo reactivamos.' };
  // Una suscripción que la pasarela SIGUE cobrando no se duplica: sería cobrar dos veces el mismo mes.
  if (cobros.some((c) => c.tipo === 'suscripcion' && (c.estado === 'pagado' || c.estado === 'reembolsado') && c.suscripcion_estado !== 'cancelada')) {
    return { ok: false, status: 409, error: 'Tu suscripción sigue activa: no hace falta reactivarla.' };
  }
  const desde = new Date(Date.now() - 23 * 3600_000).toISOString();
  const vivo = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pendiente' || c.estado === 'fallido') && c.created_at >= desde && c.creado_por === `reactivar:${ws}`);
  if (vivo) return { ok: true, link: linkDelCobro(vivo.token) };
  // El plan que tenía (mig 0330; sin ella, el precio del último cobro).
  const { data: conPlan } = await db.from('cobros').select('plan_mako').eq('workspace_id', plataforma).eq('alta_ws', ws)
    .not('plan_mako', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const planId = (conPlan as { plan_mako?: string | null } | null)?.plan_mako ?? null;
  const plan = planId ? (await planesMako()).find((x) => x.id === planId) ?? null : null;
  const monto = (plan ? precioEn(plan, base.moneda) : null) ?? base.monto;
  const montoUsd = plan?.precioUsd ?? base.monto_usd;
  return runWithWorkspace(plataforma, async () => {
    const r = await crearCobro(plataforma, {
      leadId: base.lead_id!, pasarela: base.proveedor, tipo: 'suscripcion', concepto: plan ? conceptoDelPlan(plan) : base.concepto,
      monto, moneda: base.moneda, montoUsd, email: p.email, nombre: p.nombre ?? base.nombre, creadoPor: `reactivar:${ws}`,
    });
    if (!r.ok) {
      console.error(`[compra-plan] reactivar ws=${ws}: ${r.error}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    // ⚠️ ATADO A SU NEGOCIO ANTES DE DEVOLVER EL LINK: sin `alta_ws` el pago no le devolvería el acceso.
    const { error: e2 } = await getSupabaseServer().from('cobros').update({ alta_ws: ws, ...(planId ? { plan_mako: planId } : {}) })
      .eq('id', r.cobro.id).eq('workspace_id', plataforma);
    if (e2) {
      console.error(`[compra-plan] reactivar ws=${ws}: no pude atar el cobro ${r.cobro.id}: ${e2.message}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    await logLeadEvent(base.lead_id!, 'Compra de plan', 'Abrió el pago para reactivar su plan.', 'Checkout de MaKo').catch(() => {});
    return { ok: true, link: r.link };
  });
}
