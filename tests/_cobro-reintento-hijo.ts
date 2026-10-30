// =============================================================================
// Hijo de tests/cobro-reintento.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// «Volver a intentar» un pago que falló (29/10/2026). Es el guion del refutador de la verificación de ddfa645d4
// (C:/dev/revisiones/scratch-ddfa/cobros/c2-reintentos.ts), versionado: crearCobro, la ruta firmada del webhook de Stripe,
// urlParaPagar y /pagar/[token] REALES (en un node aparte con `--conditions=react-server`), sobre el PostgREST de mentira y un
// Stripe en memoria con sesiones, suscripciones y facturas. Casos:
//   · T1 y T2: un pago único con OXXO que falla y se reintenta con tarjeta, o que falla dos veces.
//   · S1: una suscripción con SEPA que falla; el SEGUNDO aviso del mismo fallo llega DESPUÉS de armar B (en los dos órdenes).
//   · S2: Stripe reintenta la factura de A con B en curso: vuelve a fallar, o ENTRA.
//   · S3: el control, sin nada tardío.
//   · S4 (nuevo): cancelar sub_A al armar B dispara `customer.subscription.deleted` de sub_A; no cancela el cobro.
//   · S5 (nuevo): la carrera: el aviso leyó la sesión A y, antes de escribir, se armó B. El fallo de A no se escribe sobre B.
// Lo que tiene que dar en todos: UNA cuota y UNA suscripción viva en Stripe.
// =============================================================================

import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);

const WS = 3;
const PLATAFORMA = 9;
const KEY = 'rk_live_REFUTAaaaaaaaaaaaaaaaaaaa';
const WHSEC = 'whsec_REFUTAREFUTAREFUTAREFUTA';
const ACCT = 'acct_REFUTA';
type Fila = Record<string, unknown>;

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'pagos', 'app_settings', 'workspaces', 'cobro_etapa_vinculos', 'productos', 'pasarela_eventos', 'tickets', 'ticket_eventos', 'usuarios', 'cuentas_integracion'],
    defaults: (tabla: string, f: Fila) => {
      const ahora = new Date().toISOString();
      if (tabla === 'cobros') return { id: ids++, created_at: ahora, updated_at: ahora, lead_id: null, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, alta_capa: null, alta_estado: null, suscripcion_estado: null, proveedor_pago_id: null, proveedor_suscripcion_id: null, pagado_at: null, reembolsado_at: null, ...f };
      if (tabla === 'leads') return { id: ids++, created_at: ahora, estado_lead: 'abierto', pipeline_stage: 'lead', ...f };
      if (tabla === 'lead_audit') return { id: ids++, created_at: ahora, ...f };
      if (tabla === 'pasarela_eventos') return { id: ids++, intentos: 1, created_at: ahora, updated_at: ahora, motivo: null, ...f };
      if (tabla === 'pagos') return { id: ids++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f };
      if (tabla === 'tickets') return { id: ids++, created_at: ahora, updated_at: ahora, ...f };
      return { ...f };
    },
    unicos: [
      { tabla: 'cobros', columnas: ['proveedor', 'proveedor_ref'], donde: (f: Fila) => f.proveedor_ref != null, nombre: 'cobros_ref_uk' },
      { tabla: 'pasarela_eventos', columnas: ['proveedor', 'evento_id'], donde: () => true, nombre: 'pasarela_eventos_uk' },
      { tabla: 'pagos', columnas: ['workspace_id', 'proveedor', 'proveedor_pago_id'], donde: (f: Fila) => f.proveedor_pago_id != null, nombre: 'pagos_proveedor_uk' },
    ],
  });
  const db = pg.db as Record<string, Fila[]>;
  const llamadas: string[] = [];
  let nSes = 0;
  let sesiones: Record<string, Fila> = {};
  let facturas: Record<string, Fila> = {};
  let subs: Record<string, Fila> = {};
  const idem = new Map<string, { params: string; status: number; body: unknown }>();
  const red: string[] = [];
  /** Corre justo antes del PRÓXIMO PATCH a `cobros`: otro pedido que se mete entre la lectura del aviso y su escritura. */
  let antesDePatchCobro: (() => void) | null = null;

  const json = (status: number, body: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    const metodo = (init.method ?? 'GET').toUpperCase();
    if (u.host === 'supa.test') {
      for (const [k, v] of [...u.searchParams]) if (v.startsWith('ilike.')) u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      const tabla = u.pathname.replace('/rest/v1/', '');
      if (metodo === 'PATCH' && tabla === 'cobros' && antesDePatchCobro) { const f = antesDePatchCobro; antesDePatchCobro = null; f(); }
      if (metodo === 'PATCH' && tabla === 'pasarela_eventos' && u.searchParams.has('or')) {
        const or = u.searchParams.get('or') ?? '';
        const hace = /updated_at\.lt\.([^)]+)\)/.exec(or)?.[1] ?? '';
        const prov = (u.searchParams.get('proveedor') ?? '').replace(/^eq\./, '');
        const ev = (u.searchParams.get('evento_id') ?? '').replace(/^eq\./, '');
        const filas = db.pasarela_eventos.filter((f) => f.proveedor === prov && f.evento_id === ev && (f.estado === 'error' || (f.estado === 'procesando' && String(f.updated_at) < hace)));
        for (const f of filas) Object.assign(f, JSON.parse(String(init.body ?? '{}')));
        return json(200, filas.map((f) => ({ id: f.id })));
      }
      return pg.responder(u, init);
    }
    if (u.host === 'api.stripe.com') {
      const h = new Headers(init.headers);
      const clave = h.get('Idempotency-Key');
      const cuerpo = String(init.body ?? '');
      llamadas.push(`${metodo} ${u.pathname}${clave ? ` [${clave}]` : ''}`);
      await pausa(2);
      const responder = (status: number, body: unknown) => {
        if (clave && metodo === 'POST') idem.set(clave, { params: `${u.pathname}?${cuerpo}`, status, body });
        return json(status, body);
      };
      if (clave && metodo === 'POST' && idem.has(clave)) {
        const ya = idem.get(clave)!;
        if (ya.params !== `${u.pathname}?${cuerpo}`) return json(400, { error: { type: 'idempotency_error', message: 'Keys for idempotent requests can only be used with the same parameters.' } });
        return json(ya.status, ya.body);
      }
      if (metodo === 'POST' && u.pathname === '/v1/checkout/sessions') {
        const p = new URLSearchParams(cuerpo);
        const id = `cs_live_${String.fromCharCode(65 + nSes++)}`;
        const s = {
          id, object: 'checkout.session', status: 'open', payment_status: 'unpaid', livemode: true, mode: p.get('mode'),
          client_reference_id: p.get('client_reference_id'), metadata: { mako_cobro: p.get('metadata[mako_cobro]') },
          _subMeta: { mako_cobro: p.get('subscription_data[metadata][mako_cobro]') },
          amount_total: Number(p.get('line_items[0][price_data][unit_amount]')), currency: p.get('line_items[0][price_data][currency]'),
          payment_intent: null, subscription: null, invoice: null, payment_link: null,
          url: `https://checkout.stripe.com/c/pay/${id}`, expires_at: Number(p.get('expires_at')),
        };
        sesiones[id] = s;
        return responder(200, s);
      }
      let m = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)\/expire$/);
      if (m && metodo === 'POST') {
        const s = sesiones[m[1]];
        if (!s) return responder(404, { error: { message: 'No such checkout.session' } });
        if (s.status !== 'open') return responder(400, { error: { message: 'Only Checkout Sessions with a status of `open` can be expired.' } });
        s.status = 'expired';
        return responder(200, s);
      }
      m = u.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/);
      if (m && (metodo === 'DELETE' || metodo === 'POST')) {
        const sub = subs[m[1]];
        if (sub && (metodo === 'DELETE' || /cancel/.test(cuerpo))) sub.status = 'canceled';
        return json(sub ? 200 : 404, sub ?? { error: { message: 'No such subscription' } });
      }
      if (metodo !== 'GET') return json(400, { error: { message: `sin doble: ${metodo} ${u.pathname}` } });
      m = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
      if (m) {
        const s = sesiones[decodeURIComponent(m[1])];
        return s ? json(200, s) : json(404, { error: { message: 'No such checkout.session' } });
      }
      m = u.pathname.match(/^\/v1\/invoices\/([^/]+)$/);
      if (m) {
        const f = facturas[decodeURIComponent(m[1])];
        return f ? json(200, f) : json(404, { error: { message: 'No such invoice' } });
      }
      m = u.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/);
      if (m) {
        const sub = subs[decodeURIComponent(m[1])];
        return sub ? json(200, sub) : json(404, { error: { message: 'No such subscription' } });
      }
      return json(404, { error: { message: `sin doble: ${u.pathname}` } });
    }
    red.push(`${metodo} ${u.host}${u.pathname}`);
    return json(500, { error: 'red de mentira' });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const { runWithWorkspace } = await imp('lib/workspace.ts');
  const cobros = await imp('lib/cobros.ts');
  const { POST } = await imp('app/api/webhooks/stripe/route.ts');
  const pagarRuta = await imp('app/pagar/[token]/route.ts');
  const { NextRequest } = await import('next/server');

  const cred = (clave: string, valor: string) => db.credenciales.push({ workspace_id: WS, clave, valor_enc: cifrar(valor, WS, clave), servicio: 'stripe' });
  function reset() {
    pg.vaciar(); llamadas.length = 0; nSes = 0; sesiones = {}; facturas = {}; subs = {}; idem.clear(); red.length = 0; antesDePatchCobro = null;
    db.workspaces.push({ id: WS, nombre: 'Tienda', capa: 'cliente' }, { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin' });
    db.app_settings.push({ workspace_id: WS, key: 'mako.timezone', value: 'Europe/Madrid', updated_at: new Date().toISOString() });
    cred('STRIPE_SECRET_KEY', KEY); cred('STRIPE_ACCOUNT_ID', ACCT); cred('STRIPE_WEBHOOK_SECRET', WHSEC);
    db.webhook_routing.push({ servicio: 'stripe', identificador: ACCT, workspace_id: WS });
    db.leads.push({ id: 41, workspace_id: WS, nombre: 'Beto', email: 'beto@mail.test', telefono: null, estado_lead: 'abierto', pipeline_stage: 'propuesta', created_at: '2026-10-01T00:00:00Z' });
  }
  async function cobroReal(p: Fila) {
    const r = await runWithWorkspace(WS, () => cobros.crearCobro(WS, { leadId: 41, pasarela: 'stripe', concepto: 'Mentoría', email: 'beto@mail.test', nombre: 'Beto', creadoPor: 'usuario:7', ...p }));
    if (!r.ok) throw new Error(`crearCobro: ${r.error}`);
    return r as { cobro: Fila; link: string };
  }
  const fila = (id: number) => db.cobros.find((c) => c.id === id)!;
  const abrirPagar = async (token: string) => {
    const res = await pagarRuta.GET(new NextRequest(`https://mako.test/pagar/${token}`), { params: Promise.resolve({ token }) });
    return `${res.status} ${res.headers.get('location') ?? (await res.text()).match(/<h1>([^<]*)<\/h1>/)?.[1] ?? ''}`;
  };
  let nEv = 0;
  const postear = async (tipo: string, objeto: Fila) => {
    const raw = JSON.stringify({ id: `evt_V${++nEv}_${tipo.replace(/[^a-z]/gi, '_')}`, object: 'event', type: tipo, livemode: true, created: Math.floor(Date.now() / 1000) - 30, data: { object: objeto } });
    const t = Math.floor(Date.now() / 1000);
    const firma = `t=${t},v1=${createHmac('sha256', WHSEC).update(`${t}.${raw}`).digest('hex')}`;
    const res = await POST(new NextRequest(`https://mako.test/api/webhooks/stripe?acct=${ACCT}`, { method: 'POST', body: raw, headers: { 'stripe-signature': firma } }));
    const j = JSON.parse(await res.text()) as Fila;
    return `${tipo} → ${res.status} ${j.estado ?? j.error ?? ''}${j.motivo ? `: ${j.motivo}` : ''}`;
  };
  /** Un pago único: la sesión se completa (paid con tarjeta; unpaid con OXXO/SEPA). */
  const completarUnico = (id: string, pago: 'paid' | 'unpaid', pi: string) => {
    const s = sesiones[id];
    if (s.status !== 'open') return `no se pudo: ${id} está ${s.status}`;
    Object.assign(s, { status: 'complete', payment_status: pago, payment_intent: pi });
    return `completó ${id} (${pago})`;
  };
  /** Una suscripción: la sesión se completa y Stripe arma la sub y su primera factura (open si SEPA en curso, paid si tarjeta). */
  const completarSus = (id: string, pago: 'paid' | 'unpaid') => {
    const s = sesiones[id];
    if (s.status !== 'open') return `no se pudo: ${id} está ${s.status}`;
    const L = id.slice(-1);
    const sub = `sub_${L}`, inv = `in_${L}1`;
    const meta = s._subMeta as Fila;
    subs[sub] = { id: sub, object: 'subscription', status: pago === 'paid' ? 'active' : 'active', metadata: meta, livemode: true };
    facturas[inv] = {
      id: inv, object: 'invoice', status: pago === 'paid' ? 'paid' : 'open', amount_paid: pago === 'paid' ? s.amount_total : 0, currency: s.currency,
      billing_reason: 'subscription_create', livemode: true, customer_email: 'beto@mail.test',
      parent: { type: 'subscription_details', subscription_details: { subscription: sub, metadata: meta } },
    };
    Object.assign(s, { status: 'complete', payment_status: pago, subscription: sub, invoice: inv });
    return `completó ${id} (${pago}) → ${sub} ${inv}`;
  };
  const facturaPaga = (inv: string) => { const f = facturas[inv]; Object.assign(f, { status: 'paid', amount_paid: sesiones[`cs_live_${inv.slice(3, 4)}`]?.amount_total ?? 10000 }); return f; };
  const reintentoDeA = (n: number) => {
    // Un REINTENTO de Stripe sobre la factura de A (Smart Retries / la configuración de la cuenta): misma factura, falla otra vez.
    const f = facturas.in_A1; Object.assign(f, { attempt_count: n }); return f;
  };
  const cuotas = () => db.pagos.filter((x) => x.proveedor_pago_id).map((x) => `${x.proveedor_pago_id}:${x.monto_usd}`);
  const ses = () => Object.values(sesiones).map((s) => `${s.id}:${s.status}/${s.payment_status}${s.subscription ? `→${s.subscription}` : ''}`);
  const rech = () => db.lead_audit.filter((x) => /rechazado/i.test(JSON.stringify(x))).length;
  const vivas = () => Object.values(subs).filter((s) => s.status !== 'canceled').map((s) => String(s.id));
  const est = (id: number) => `${fila(id).estado}${fila(id).motivo ? ` (${fila(id).motivo})` : ''}`;
  const out: Record<string, unknown> = {}; (globalThis as any).__out = out;
  const url = async (token: string) => { llamadas.length = 0; const r = await cobros.urlParaPagar((await cobros.getCobroPorToken(token))!); return { r, stripe: [...llamadas] }; };
  // Cada sesión vence en su minuto (la de A, la de B…): la clave de idempotencia de la sesión nueva sale del vencimiento anterior.
  let nVence = 0;
  const vence = (id: number) => { fila(id).url_vence_at = new Date(Date.now() - (60 + 7 * ++nVence) * 60_000).toISOString(); };

  // ═══ T1: pago único. A con OXXO falla → «Volver a intentar» arma B → B se paga con TARJETA. ¿Pagado, una cuota? ═══
  {
    reset();
    const { cobro } = await cobroReal({ tipo: 'unico', moneda: 'MXN', monto: 2000, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    log.push(completarUnico('cs_live_A', 'unpaid', 'pi_A'), await postear('checkout.session.completed', sesiones.cs_live_A));
    vence(id);
    log.push(await postear('checkout.session.async_payment_failed', sesiones.cs_live_A), `cobro: ${est(id)}`);
    log.push(await url(token), `cobro tras armar B: ${est(id)}`);
    log.push(completarUnico('cs_live_B', 'paid', 'pi_B_tarjeta'), await postear('checkout.session.completed', sesiones.cs_live_B));
    log.push(`cobro: ${est(id)}`, await url(token), await abrirPagar(token));
    out.T1_fallido_reintento_con_tarjeta = { log, final: est(id), cuotas: cuotas(), sesiones: ses() };
  }

  // ═══ T2: pago único. A OXXO falla → B → B OXXO TAMBIÉN falla → ¿se puede reintentar (C) y pagar con tarjeta? ¿Una cuota? ═══
  {
    reset();
    const { cobro } = await cobroReal({ tipo: 'unico', moneda: 'MXN', monto: 2000, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    completarUnico('cs_live_A', 'unpaid', 'pi_A'); await postear('checkout.session.completed', sesiones.cs_live_A); vence(id);
    log.push(await postear('checkout.session.async_payment_failed', sesiones.cs_live_A), `cobro: ${est(id)}`);
    log.push(await url(token)); (out as any).T2_parcial = log;
    completarUnico('cs_live_B', 'unpaid', 'pi_B'); log.push(await postear('checkout.session.completed', sesiones.cs_live_B), `cobro tras voucher B: ${est(id)}`);
    vence(id);
    log.push('B en curso, URL vencida:', await url(token));
    log.push(await postear('checkout.session.async_payment_failed', sesiones.cs_live_B), `cobro tras fallar B: ${est(id)}`);
    log.push('tras fallar B:', await url(token), await abrirPagar(token));
    const c = Object.keys(sesiones).find((k) => k === 'cs_live_C');
    if (c) { log.push(completarUnico(c, 'paid', 'pi_C_tarjeta'), await postear('checkout.session.completed', sesiones[c])); }
    out.T2_segundo_voucher_tambien_falla = { log, final: est(id), cuotas: cuotas(), sesiones: ses() };
  }

  // ═══ S1: SUSCRIPCIÓN común EUR. A con SEPA: complete/unpaid, sub_A activa, in_A1 open. Falla el débito: llega invoice.payment_failed
  // (in_A1) → fallido. «Volver a intentar» → ¿arma B (otra suscripción)? ¿Cancela sub_A? Después llega checkout.session.async_payment_failed
  // de A (los DOS avisos del mismo fallo; éste más tarde). En B elige SEPA otra vez (en curso). Vence la URL de B: ¿arma C? ═══
  for (const orden of ['factura_primero', 'sesion_primero'] as const) {
    reset();
    const { cobro } = await cobroReal({ tipo: 'suscripcion', moneda: 'EUR', monto: 100, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    log.push(`sesión A: mode=${sesiones.cs_live_A?.mode}`);
    log.push(completarSus('cs_live_A', 'unpaid'), await postear('checkout.session.completed', sesiones.cs_live_A), `cobro: ${est(id)}`);
    vence(id);
    const primero = orden === 'factura_primero' ? () => postear('invoice.payment_failed', facturas.in_A1) : () => postear('checkout.session.async_payment_failed', sesiones.cs_live_A);
    const segundo = orden === 'factura_primero' ? () => postear('checkout.session.async_payment_failed', sesiones.cs_live_A) : () => postear('invoice.payment_failed', facturas.in_A1);
    log.push('falla el SEPA de A, primer aviso:', await primero(), `cobro: ${est(id)}`);
    const uB = await url(token);
    log.push('«Volver a intentar»:', uB, `cobro tras armar B: ${est(id)}`, `subs vivas: ${vivas().join(',')}`);
    log.push('segundo aviso del MISMO fallo de A, después de armar B:', await segundo(), `cobro: ${est(id)}`);
    log.push(completarSus('cs_live_B', 'unpaid'), await postear('checkout.session.completed', sesiones.cs_live_B), `cobro con el SEPA de B en curso: ${est(id)}`);
    log.push('/pagar con B en curso (dentro de las 23 h):', await abrirPagar(token));
    vence(id);
    const uC = await url(token);
    log.push('URL de B vencida, SEPA de B en curso:', uC, await abrirPagar(token), `cobro: ${est(id)}`);
    if (sesiones.cs_live_C && sesiones.cs_live_C.status === 'open') {
      log.push(completarSus('cs_live_C', 'paid'), await postear('checkout.session.completed', sesiones.cs_live_C), await postear('invoice.paid', facturas.in_C1));
    }
    // Se acredita el SEPA de B.
    facturaPaga('in_B1'); Object.assign(sesiones.cs_live_B, { payment_status: 'paid' });
    log.push(await postear('checkout.session.async_payment_succeeded', sesiones.cs_live_B), await postear('invoice.paid', facturas.in_B1));
    out[`S1_sus_sepa_${orden}`] = { log, final: est(id), sub: fila(id).proveedor_suscripcion_id, cuotas: cuotas(), sesiones: ses(), subsVivasEnStripe: vivas(), rechazosEnElHistorial: rech() };
  }

  // ═══ S2: SUSCRIPCIÓN común EUR, los dos avisos del fallo de A ANTES de armar B (lo normal). B con SEPA en curso; no se arma C.
  // Días después, Stripe REINTENTA la factura de A (sub_A sigue viva): (a) el reintento falla → invoice.payment_failed in_A1;
  // (b) el reintento ENTRA → invoice.paid in_A1. ═══
  for (const reintento of ['reintento_A_falla', 'reintento_A_entra'] as const) {
    reset();
    const { cobro } = await cobroReal({ tipo: 'suscripcion', moneda: 'EUR', monto: 100, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    completarSus('cs_live_A', 'unpaid'); await postear('checkout.session.completed', sesiones.cs_live_A); vence(id);
    log.push(await postear('invoice.payment_failed', facturas.in_A1), await postear('checkout.session.async_payment_failed', sesiones.cs_live_A), `cobro: ${est(id)}`);
    log.push(await url(token), `cobro tras armar B: ${est(id)}`);
    log.push(completarSus('cs_live_B', 'unpaid'), await postear('checkout.session.completed', sesiones.cs_live_B), `cobro con el SEPA de B en curso: ${est(id)}`);
    if (reintento === 'reintento_A_falla') {
      log.push('Stripe reintenta in_A1 y falla:', await postear('invoice.payment_failed', reintentoDeA(2)), `cobro: ${est(id)}`);
      vence(id);
      const uC = await url(token);
      log.push('URL de B vencida, SEPA de B en curso:', uC, await abrirPagar(token));
      if (sesiones.cs_live_C?.status === 'open') log.push(completarSus('cs_live_C', 'paid'), await postear('checkout.session.completed', sesiones.cs_live_C));
      facturaPaga('in_B1'); Object.assign(sesiones.cs_live_B, { payment_status: 'paid' });
      log.push(await postear('checkout.session.async_payment_succeeded', sesiones.cs_live_B), await postear('invoice.paid', facturas.in_B1));
    } else {
      facturaPaga('in_B1'); Object.assign(sesiones.cs_live_B, { payment_status: 'paid' });
      log.push(await postear('checkout.session.async_payment_succeeded', sesiones.cs_live_B), `cobro: ${est(id)}`);
      log.push('Stripe reintenta in_A1 y ENTRA:', await postear('invoice.paid', facturaPaga('in_A1')), `cobro: ${est(id)}`);
    }
    out[`S2_sus_sepa_${reintento}`] = { log, final: est(id), sub: fila(id).proveedor_suscripcion_id, cuotas: cuotas(), sesiones: ses(), subsVivasEnStripe: vivas(), rechazosEnElHistorial: rech(), tickets: db.tickets.map((t) => String(t.ref ?? '')) };
  }

  // ═══ S3 (control): SUSCRIPCIÓN SEPA, los dos avisos del fallo de A ANTES de armar B, y nada más de A. B con SEPA en curso, su URL
  // vence: ¿no se arma C? (lo que be95 sí arregla para una suscripción). ═══
  {
    reset();
    const { cobro } = await cobroReal({ tipo: 'suscripcion', moneda: 'EUR', monto: 100, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    completarSus('cs_live_A', 'unpaid'); await postear('checkout.session.completed', sesiones.cs_live_A); vence(id);
    log.push(await postear('invoice.payment_failed', facturas.in_A1), await postear('checkout.session.async_payment_failed', sesiones.cs_live_A), `cobro: ${est(id)}`);
    log.push(await url(token), `cobro tras armar B: ${est(id)}`);
    log.push(completarSus('cs_live_B', 'unpaid'), await postear('checkout.session.completed', sesiones.cs_live_B), `cobro con el SEPA de B en curso: ${est(id)}`);
    vence(id);
    log.push('URL de B vencida, SEPA de B en curso:', await url(token), await abrirPagar(token));
    facturaPaga('in_B1'); Object.assign(sesiones.cs_live_B, { payment_status: 'paid' });
    log.push(await postear('checkout.session.async_payment_succeeded', sesiones.cs_live_B), await postear('invoice.paid', facturas.in_B1));
    out.S3_control_sus_sepa_sin_aviso_tardio = { log, final: est(id), sub: fila(id).proveedor_suscripcion_id, cuotas: cuotas(), sesiones: ses(), subsVivasEnStripe: vivas(), rechazosEnElHistorial: rech() };
  }

  // ═══ S4 (29/10/2026): cancelar sub_A al armar B dispara `customer.subscription.deleted` de sub_A. Con B abierta y con B ya
  // pagada, ese aviso NO cancela el cobro (ni la suscripción del lead): la vigente es la de B. ═══
  {
    reset();
    const { cobro } = await cobroReal({ tipo: 'suscripcion', moneda: 'EUR', monto: 100, montoUsd: 110 });
    const id = Number(cobro.id), token = String(cobro.token);
    const log: unknown[] = [];
    completarSus('cs_live_A', 'unpaid'); await postear('checkout.session.completed', sesiones.cs_live_A); vence(id);
    await postear('invoice.payment_failed', facturas.in_A1);
    log.push(await url(token), `cobro tras armar B: ${est(id)}`, `sub_A: ${subs.sub_A?.status}`);
    log.push('se canceló sub_A, con B abierta:', await postear('customer.subscription.deleted', subs.sub_A), `suscripción del cobro: ${fila(id).suscripcion_estado ?? '—'}`);
    const conBAbierta = { estado: fila(id).estado, suscripcion: fila(id).suscripcion_estado ?? null };
    completarSus('cs_live_B', 'paid'); facturaPaga('in_B1');
    log.push(await postear('checkout.session.completed', sesiones.cs_live_B), await postear('invoice.paid', facturas.in_B1), `cobro: ${est(id)}`);
    log.push('el mismo aviso, otra vez, con B pagada:', await postear('customer.subscription.deleted', subs.sub_A));
    out.S4_cancelar_A_no_cancela_el_cobro = {
      log, conBAbierta, final: est(id), sub: fila(id).proveedor_suscripcion_id, suscripcion: fila(id).suscripcion_estado ?? null,
      cuotas: cuotas(), subsVivasEnStripe: vivas(), canceladaEnElHistorial: db.lead_audit.filter((x) => /cancelada/i.test(JSON.stringify(x))).length,
    };
  }

  // ═══ S5 (29/10/2026): LA CARRERA. El segundo aviso del fallo de A lee el cobro `pendiente` con la sesión A y, antes de escribir,
  // «Volver a intentar» arma B (la sesión cambia y el cobro vuelve a `pendiente`). El fallo de A no se escribe sobre B. ═══
  {
    reset();
    const { cobro } = await cobroReal({ tipo: 'suscripcion', moneda: 'EUR', monto: 100, montoUsd: 110 });
    const id = Number(cobro.id);
    completarSus('cs_live_A', 'unpaid'); await postear('checkout.session.completed', sesiones.cs_live_A); vence(id);
    antesDePatchCobro = () => { Object.assign(fila(id), { proveedor_ref: 'cs_live_B', estado: 'pendiente', motivo: null }); };
    const aviso = await postear('invoice.payment_failed', facturas.in_A1);
    out.S5_carrera_fallo_de_A_contra_B = { aviso, estado: fila(id).estado, ref: fila(id).proveedor_ref, motivo: fila(id).motivo ?? null, rechazos: rech() };
  }
  out.rechazosEnElHistorial = 'ver lead_audit por escenario (abajo)';
  out.red = [...new Set(red)];
  // Se cierra a mano: algún módulo de cobros deja un temporizador vivo y el padre (execFileSync) esperaría para siempre.
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}\n`, () => process.exit(0));
}
void main().catch((e) => { process.stdout.write(`\n@@RESULTADO@@${JSON.stringify({ tiro: e instanceof Error ? e.stack : String(e), parcial: (globalThis as any).__out })}\n`, () => process.exit(0)); });

export {};
