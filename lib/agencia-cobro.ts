// =============================================================================
// agencia-cobro — el cobro de un cliente de AGENCIA: el link del primer mes y la renovación (#866 y #867, 17/10/2026)
// =============================================================================
// Las reglas y el porqué, en lib/agencia-cobro-reglas.ts. Acá está lo que necesita base y pasarela:
//   · el precio: el del PLAN de la cuenta (Esencial o Pro, lib/planes-mako.ts, 29/10/2026); el setting viejo
//     `agencia.precio_cliente` queda sólo como el precio en pesos del Esencial si el plan no tiene uno;
//   · `linkPrimerMes`: lo crea `abrirCuentaDePartner` (lib/partners.ts) al abrirle la cuenta;
//   · `renovacionesDeAgencia`: el cron de cobros (cada 30 min) crea la suscripción mensual cuando el cliente termina el
//     onboarding, y anota cuando la agencia la autorizó;
//   · `cobrosDeClientesDeAgencia`: lo que la pantalla de la agencia muestra en cada cliente.
//
// LA PASARELA SEGÚN EL PAÍS (29/10/2026, Thiago, agencia de España): como /planes. Mercado Pago sólo en su país; afuera,
// Stripe en USD (o EUR en la zona euro). La renovación usa la MISMA pasarela y moneda que el primer mes.
//   · Mercado Pago difiere el primer cobro (`start_date`): la renovación se crea al terminar el onboarding.
//   · Stripe no (sin una prueba, que daría una factura de $0 que se asentaría como plata): la renovación se abre
//     DIAS_ANTES_RENOVACION_STRIPE días antes de que tenga que empezar a cobrar, con su `inicio_at` anotado, y cobra al pagarla.
//
// ⚠️ TODO COBRO ES DE LA PLATAFORMA (`wsSuperAdmin()`): lo que se cobra es el lugar en MaKo. `crearCobro` rechaza
//    `paraCliente` fuera de la plataforma.
// ⚠️ SIN UNA PASARELA QUE SIRVA PARA SU PAÍS NO HAY LINK, y no es un error: la cuenta queda esperando que el super admin la
//    apruebe (lib/agencia.ts). Lo dice `motivo`.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSetting, setSetting } from './settings';
import { anotarAutorizacionMp, anularCobro, crearCobro, linkDelCobro, pasarelasConectadas } from './cobros';
import { COLS_COBRO, cobroDeFila, type Pasarela } from './cobros-tipos';
import { estadoDeLoGuardado } from './onboarding-contrato';
import { ONBOARDING_KEY } from './onboarding-state';
import { ofertaDelPlan, planesMako } from './compra-plan';
import { conceptoDelPlan, precioEn, type PlanMako } from './planes-mako';
import {
  KEY_PRECIO_CLIENTE_AGENCIA, abreRenovacionStripe, cobroDeLaCuenta, cobrosParaLaAgencia, desdeDelMes, inicioDeRenovacion, sanearPrecioClienteAgencia,
  unMesDespues, type CobroDeCliente, type OpcionDeCobro, type PlanCuenta, type PrecioClienteAgencia,
} from './agencia-cobro-reglas';

export async function precioClienteDeAgencia(): Promise<PrecioClienteAgencia> {
  const plataforma = await wsSuperAdmin();
  return runWithWorkspace(plataforma, async () => sanearPrecioClienteAgencia(await getSetting(KEY_PRECIO_CLIENTE_AGENCIA)));
}

/** Lo guarda el super admin (/admin/cobros). Devuelve lo que QUEDÓ, saneado. */
export async function guardarPrecioClienteDeAgencia(p: unknown): Promise<PrecioClienteAgencia> {
  const limpio = sanearPrecioClienteAgencia(p);
  const plataforma = await wsSuperAdmin();
  await runWithWorkspace(plataforma, () => setSetting(KEY_PRECIO_CLIENTE_AGENCIA, JSON.stringify(limpio)));
  return limpio;
}

/** La ficha de la agencia en el CRM de MaKo: el lead de la plataforma que apunta a su cuenta (`leads.cliente_ws`). */
async function leadDeLaAgencia(plataforma: number, agenciaWs: number): Promise<number | null> {
  const { data, error } = await getSupabaseServer().from('leads').select('id')
    .eq('workspace_id', plataforma).eq('cliente_ws', agenciaWs).order('id').limit(1).maybeSingle();
  if (error) throw new Error(`No pude leer la ficha de la agencia en el CRM de MaKo: ${error.message}`);
  return data ? Number((data as { id: number }).id) : null;
}

export type ResultadoLinkCliente = { ok: true; link: string; yaEstaba: boolean } | { ok: false; motivo: string };

/** El plan de MaKo de esa cuenta (Esencial o Pro), o null si el setting de planes no lo tiene. */
async function planDe(plan: PlanCuenta): Promise<PlanMako | null> {
  return (await planesMako()).find((x) => x.id === plan) ?? null;
}

/**
 * Con qué y a cuánto se le cobra a una cuenta de ese PLAN, para quien la abre desde `pais` (`motivo` si hoy no se puede).
 * El Esencial en pesos, si el plan no tiene precio en ARS, sale del setting viejo del cliente de agencia (/admin/cobros).
 */
export async function cobroParaCuenta(plataforma: number, p: { plan: PlanCuenta; pais: string | null }): Promise<{ motivo: string } | { cobro: OpcionDeCobro; plan: PlanMako }> {
  const plan = await planDe(p.plan);
  if (!plan) return { motivo: `El plan ${p.plan} no está en los planes de MaKo.` };
  const oferta = await ofertaDelPlan(plan.id, { pais: p.pais }).catch(() => null);
  const opciones: OpcionDeCobro[] = [...(oferta?.pasarelas ?? [])];
  if (!opciones.some((o) => o.pasarela === 'mercadopago') && plan.id === 'esencial' && (!p.pais || p.pais === 'AR')) {
    const viejo = await precioClienteDeAgencia().catch(() => null);
    if (viejo?.mp && (await pasarelasConectadas(plataforma)).includes('mercadopago')) opciones.unshift({ pasarela: 'mercadopago', moneda: viejo.mp.moneda, monto: viejo.mp.monto });
  }
  const cobro = cobroDeLaCuenta({ pais: p.pais, opciones, eur: plan.preciosLocales.EUR ?? null });
  return cobro ? { cobro, plan } : { motivo: 'MaKo todavía no tiene una pasarela que cobre en ese país.' };
}

/**
 * El link del PRIMER MES de un cliente de agencia (#866): pago único, de la pasarela de MaKo, a la ficha de la agencia en el
 * CRM de MaKo. Al pagarse, el cliente queda habilitado (`habilitarClienteDeAgencia`). Si ya hay uno vivo, ése.
 * `email` es el de quien paga, y el que pide la suscripción del mes siguiente. `pais`: de quien la abre (el encabezado).
 */
export async function linkPrimerMes(p: { agenciaWs: number; clienteWs: number; nombreCliente: string; email: string | null; creadoPor: string; plan?: PlanCuenta; pais?: string | null }): Promise<ResultadoLinkCliente> {
  try {
    const plataforma = await wsSuperAdmin();
    const c = await cobroParaCuenta(plataforma, { plan: p.plan ?? 'esencial', pais: p.pais ?? null });
    if ('motivo' in c) return { ok: false, motivo: c.motivo };
    const leadId = await leadDeLaAgencia(plataforma, p.agenciaWs);
    if (!leadId) return { ok: false, motivo: 'La agencia no tiene su ficha en el CRM de MaKo.' };
    const r = await crearCobro(plataforma, {
      leadId, pasarela: c.cobro.pasarela, tipo: 'unico',
      monto: c.cobro.monto, moneda: c.cobro.moneda, montoUsd: c.plan.precioUsd,
      concepto: `${conceptoDelPlan(c.plan).replace(/ · mensual$/, '')} · ${p.nombreCliente.trim() || `cliente ${p.clienteWs}`} · primer mes`.slice(0, 200),
      email: p.email, paraCliente: { agenciaWs: p.agenciaWs, clienteWs: p.clienteWs }, creadoPor: p.creadoPor,
    });
    if (!r.ok) return { ok: false, motivo: r.error };
    // El plan queda en el cobro: la renovación lo lee (y su precio), y la ficha de la agencia lo muestra.
    await getSupabaseServer().from('cobros').update({ plan_mako: c.plan.id }).eq('id', r.cobro.id).eq('workspace_id', plataforma);
    return { ok: true, link: r.link, yaEstaba: !!r.yaEstaba };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * El link del primer mes SIN PAGAR, rehecho con otro plan (revisión de plata, hallazgo 2c): el link guarda su monto, y
 * cambiar sólo el plan anotado cobraba el Esencial por un mes de Pro (o al revés). La misma pasarela, moneda, ficha y email.
 * PRIMERO el nuevo y después se anula el viejo: al revés, una falla dejaba la cuenta sin ningún link para pagar. Si el viejo
 * no se deja anular, se anula el nuevo (nunca quedan dos vivos). La pantalla de la agencia y el cartel del cliente leen el
 * link vivo, así que ven el nuevo.
 */
export async function rehacerPrimerMes(cobroId: number, plan: PlanMako, autor: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const { data, error } = await db.from('cobros').select('id, lead_id, agencia_ws, cliente_ws, email, concepto, proveedor, moneda, estado, tipo, creado_por')
    .eq('id', cobroId).eq('workspace_id', plataforma).maybeSingle();
  if (error || !data) return { ok: false, error: 'No pude leer su primer mes.' };
  const c = data as { lead_id: number | null; agencia_ws: number; cliente_ws: number; email: string | null; concepto: string; proveedor: Pasarela; moneda: string; estado: string; tipo: string; creado_por: string | null };
  if (c.tipo !== 'unico' || (c.estado !== 'pendiente' && c.estado !== 'fallido') || !c.lead_id) return { ok: false, error: 'Su primer mes ya no se puede rehacer.' };
  const monto = await precioDelPlanEn(plan, c.moneda);
  if (monto == null) return { ok: false, error: `${plan.nombre} no tiene precio en ${c.moneda}.` };
  const r = await crearCobro(plataforma, {
    leadId: c.lead_id, pasarela: c.proveedor, tipo: 'unico', monto, moneda: c.moneda, montoUsd: plan.precioUsd,
    concepto: c.concepto.replace(/^MaKo [A-Za-zé ]+ · /, `${conceptoDelPlan(plan).replace(/ · mensual$/, '')} · `).slice(0, 200),
    email: c.email, paraCliente: { agenciaWs: Number(c.agencia_ws), clienteWs: Number(c.cliente_ws) }, creadoPor: c.creado_por ?? autor,
  });
  if (!r.ok) return { ok: false, error: `No pude crear su link nuevo: ${r.error}` };
  const anulado = await anularCobro(plataforma, cobroId, autor);
  if (!anulado.ok) {
    await anularCobro(plataforma, r.cobro.id, autor).catch(() => {});
    return { ok: false, error: `No pude anular su link de antes: ${anulado.error ?? 'sin detalle'}` };
  }
  await db.from('cobros').update({ plan_mako: plan.id }).eq('id', r.cobro.id).eq('workspace_id', plataforma);
  return { ok: true };
}

type FilaPrimerMes = {
  id: number; lead_id: number | null; agencia_ws: number; cliente_ws: number; email: string | null; pagado_at: string | null; concepto: string;
  proveedor: Pasarela; moneda: string; monto: number; monto_usd: number | null; plan_mako: string | null;
};

/**
 * El precio de un plan en una moneda: el del plan; el Esencial en la moneda de Mercado Pago, si el plan no la tiene, el del
 * setting viejo del cliente de agencia (como el primer mes, `cobroParaCuenta`). null = ese plan no se cobra en esa moneda.
 */
export async function precioDelPlanEn(plan: PlanMako, moneda: string): Promise<number | null> {
  const propio = precioEn(plan, moneda);
  if (propio != null) return propio;
  if (plan.id !== 'esencial') return null;
  const viejo = await precioClienteDeAgencia().catch(() => null);
  return viejo?.mp && viejo.mp.moneda.toUpperCase() === moneda.toUpperCase() ? viejo.mp.monto : null;
}

/**
 * El precio del mes que sigue, en la MISMA moneda del primero: el de su plan; sin plan (las cuentas de antes), el mismo monto.
 * ⚠️ Con plan y sin precio en esa moneda, null (revisión de plata, hallazgo 2d): caer al monto del primer mes cobraba el Pro
 * a precio de Esencial (o al revés) cuando la agencia cambió el plan antes de la renovación.
 */
async function precioDeRenovacion(f: FilaPrimerMes): Promise<{ monto: number; montoUsd: number | null } | null> {
  if (!f.plan_mako) return { monto: Number(f.monto), montoUsd: f.monto_usd != null ? Number(f.monto_usd) : null };
  const plan = await planDe(f.plan_mako === 'pro' ? 'pro' : 'esencial');
  const monto = plan ? await precioDelPlanEn(plan, f.moneda) : null;
  return plan && monto != null ? { monto, montoUsd: plan.precioUsd } : null;
}

/**
 * El cron (#867): por cada cliente de agencia con el primer mes PAGADO y sin renovación, si ya terminó el onboarding, crea
 * la suscripción mensual con su primer cobro un mes después de que arrancó su mes (MP: `start_date`; Stripe: se abre unos
 * días antes y cobra al pagarla). Y anota las renovaciones de MP que la agencia ya autorizó. Sólo en la plataforma; nunca tira
 * por un cliente (lo cuenta en `errores`).
 */
export async function renovacionesDeAgencia(): Promise<{ creadas: number; autorizadas: number; errores: number }> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const [primeros, renov] = await Promise.all([
    db.from('cobros').select('id, lead_id, agencia_ws, cliente_ws, email, pagado_at, concepto, proveedor, moneda, monto, monto_usd, plan_mako')
      .eq('workspace_id', plataforma).eq('tipo', 'unico').eq('estado', 'pagado').not('cliente_ws', 'is', null).limit(200),
    db.from('cobros').select(`${COLS_COBRO}, cliente_ws`)
      .eq('workspace_id', plataforma).eq('tipo', 'suscripcion').not('cliente_ws', 'is', null)
      // `reembolsado` también (revisión de plata, hallazgo 3a): devolver el primer pago no cancela la suscripción, que sigue cobrando.
      .in('estado', ['pendiente', 'fallido', 'pagado', 'reembolsado']).limit(500),
  ]);
  if (primeros.error) throw new Error(`No pude leer los primeros meses de los clientes de agencia: ${primeros.error.message}`);
  if (renov.error) throw new Error(`No pude leer las renovaciones de los clientes de agencia: ${renov.error.message}`);
  const renovaciones = (renov.data ?? []).map((x) => ({ cobro: cobroDeFila(x as Record<string, unknown>), clienteWs: Number((x as { cliente_ws: number }).cliente_ws) }));
  const conRenovacion = new Set(renovaciones.filter((r) => r.cobro.suscripcion_estado !== 'cancelada').map((r) => r.clienteWs));
  // Una cuenta que la agencia dio de baja (cartera revocada, lib/agencia-baja.ts) no renueva más.
  // Sin poder leerlas, no se renueva a nadie (revisión de plata, hallazgo 11): se renovaba a las dadas de baja.
  const { data: revocadas, error: eRev } = await db.from('agencia_clientes').select('cliente_ws').eq('estado', 'revocado').limit(1000);
  if (eRev) throw new Error(`No pude leer las cuentas dadas de baja: ${eRev.message}`);
  const deBaja = new Set(((revocadas ?? []) as Array<{ cliente_ws: number }>).map((r) => Number(r.cliente_ws)));
  const conectadas = await pasarelasConectadas(plataforma);

  let creadas = 0;
  let autorizadas = 0;
  let errores = 0;
  for (const f of (primeros.data ?? []) as FilaPrimerMes[]) {
    const clienteWs = Number(f.cliente_ws);
    if (conRenovacion.has(clienteWs) || deBaja.has(clienteWs) || !f.lead_id) continue;
    try {
      const { data: on, error } = await db.from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', ONBOARDING_KEY).maybeSingle();
      if (error) throw new Error(error.message);
      const crudo = (on as { value: unknown } | null)?.value ?? null;
      const estado = estadoDeLoGuardado(crudo == null ? null : typeof crudo === 'string' ? crudo : JSON.stringify(crudo));
      if (estado.status !== 'done') continue; // su mes todavía no arrancó
      const desde = desdeDelMes({ onboardingCompletoAt: estado.completedAt, pagadoAt: f.pagado_at });
      if (!desde) continue;
      if (!conectadas.includes(f.proveedor)) { console.warn(`[agencia-cobro] el cliente ${clienteWs} terminó el onboarding y ${f.proveedor} ya no está conectado: sin renovación`); continue; }
      const inicio = inicioDeRenovacion(desde, Date.now());
      // Stripe cobra al pagarla: se abre recién unos días antes de que tenga que empezar a cobrar.
      if (f.proveedor === 'stripe' && !abreRenovacionStripe(unMesDespues(desde), Date.now())) continue;
      const precio = await precioDeRenovacion(f);
      if (!precio) { errores++; console.error(`[agencia-cobro] el cliente ${clienteWs}: su plan (${f.plan_mako}) no tiene precio en ${f.moneda}: sin renovación`); continue; }
      // Releída justo antes de crearla (hallazgo 11): una baja que corrió mientras tanto no recibe una renovación nueva.
      const { data: cart, error: eCart } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', Number(f.agencia_ws)).eq('cliente_ws', clienteWs).maybeSingle();
      if (eCart) throw new Error(eCart.message);
      if (!cart || (cart as { estado: string }).estado === 'revocado') continue;
      const r = await crearCobro(plataforma, {
        leadId: f.lead_id, pasarela: f.proveedor, tipo: 'suscripcion',
        monto: precio.monto, moneda: f.moneda, montoUsd: precio.montoUsd,
        concepto: f.concepto.replace(/ · primer mes$/, ' · mensual').slice(0, 200),
        email: f.email, paraCliente: { agenciaWs: Number(f.agencia_ws), clienteWs },
        ...(f.proveedor === 'mercadopago' ? { inicioAt: inicio } : {}), creadoPor: 'MaKo · fin del onboarding',
      });
      if (r.ok) {
        if (!r.yaEstaba) {
          creadas++;
          // El plan, y en Stripe cuándo tenía que empezar a cobrar: sin pagarla para ese día, la cuenta se corta como una de MP
          // sin autorizar (lib/plan-acceso-reglas.ts, `renovacion-sin-autorizar`).
          const { error: eAnotar } = await db.from('cobros').update({ ...(f.plan_mako ? { plan_mako: f.plan_mako } : {}), ...(f.proveedor === 'stripe' ? { inicio_at: unMesDespues(desde) } : {}) })
            .eq('id', r.cobro.id).eq('workspace_id', plataforma);
          // Sin `inicio_at` una renovación de Stripe nunca corta (revisión de plata, hallazgo 10): se anula y la próxima vuelta la rehace.
          if (eAnotar && f.proveedor === 'stripe') {
            errores++;
            console.error(`[agencia-cobro] el cliente ${clienteWs}: no pude anotar la renovación ${r.cobro.id} (${eAnotar.message}); la anulo`);
            await anularCobro(plataforma, r.cobro.id, 'MaKo (no se pudo anotar la renovación)').catch(() => {});
          }
        }
      } else { errores++; console.error(`[agencia-cobro] no pude crear la renovación del cliente ${clienteWs}: ${r.error}`); }
    } catch (e) {
      errores++;
      console.error(`[agencia-cobro] renovación del cliente ${clienteWs}:`, e instanceof Error ? e.message : String(e));
    }
  }
  for (const { cobro } of renovaciones) {
    if (await anotarAutorizacionMp(cobro)) autorizadas++;
  }
  return { creadas, autorizadas, errores };
}

/**
 * Lo que la pantalla de la AGENCIA muestra en cada cliente suyo: el link del primer mes o el de la renovación. Lee los
 * cobros de la plataforma con el cliente de servicio, y SÓLO los de esta agencia (`agencia_ws`): una agencia nunca ve
 * los links de otra. Sin la migración 0308 (o si falla), `{}`: la pantalla queda como era.
 */
export async function cobrosDeClientesDeAgencia(agenciaWs: number): Promise<ReturnType<typeof cobrosParaLaAgencia>> {
  try {
    const plataforma = await wsSuperAdmin();
    const { data, error } = await getSupabaseServer().from('cobros')
      .select('cliente_ws, tipo, estado, suscripcion_estado, token, inicio_at, created_at')
      .eq('workspace_id', plataforma).eq('agencia_ws', agenciaWs).not('cliente_ws', 'is', null)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as Array<Omit<CobroDeCliente, 'link'> & { token: string }>;
    return cobrosParaLaAgencia(filas.map(({ token, ...f }) => ({ ...f, cliente_ws: Number(f.cliente_ws), link: linkDelCobro(token) })));
  } catch (e) {
    console.error(`[agencia-cobro] cobros de los clientes de la agencia ${agenciaWs}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}
