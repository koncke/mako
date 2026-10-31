// =============================================================================
// Hijo de tests/primer-mes.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El 50% del primer mes y la prueba apagada, sobre el PostgREST de mentira y un Stripe y un Mercado Pago en memoria. Corren REALES
// `iniciarCompraDePlan`, `crearCobro`, `aplicarPagoAprobado`, `conciliarPrimerMes` y `estadoDePrueba`. Necesita
// `--conditions=react-server`. Lo que NO prueba: las pasarelas de verdad (falta un cobro real con el sí de Martín).
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const PLATAFORMA = 9;
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'pagos', 'app_settings', 'workspaces', 'cobro_etapa_vinculos', 'productos', 'pasarela_eventos', 'tickets', 'ticket_eventos', 'usuarios', 'usuario_workspaces', 'cuentas_integracion', 'funnels'],
    orCompleto: true,
    defaults: (tabla: string, f: Fila) => {
      const ahora = new Date().toISOString();
      if (tabla === 'workspaces') return { id: ids++, created_at: ahora, ...f };
      if (tabla === 'cobros') return { id: ids++, created_at: ahora, updated_at: ahora, lead_id: null, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, alta_capa: null, alta_estado: null, suscripcion_estado: null, proveedor_pago_id: null, proveedor_suscripcion_id: null, pagado_at: null, reembolsado_at: null, ...f };
      if (tabla === 'leads') return { id: ids++, created_at: ahora, estado_lead: 'abierto', pipeline_stage: 'lead', ...f };
      if (tabla === 'pagos') return { id: ids++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f };
      if (tabla === 'lead_audit' || tabla === 'tickets') return { id: ids++, created_at: ahora, ...f };
      return { ...f };
    },
    unicos: [
      { tabla: 'cobros', columnas: ['proveedor', 'proveedor_ref'], donde: (f: Fila) => f.proveedor_ref != null, nombre: 'cobros_ref_uk' },
      { tabla: 'pagos', columnas: ['workspace_id', 'proveedor', 'proveedor_pago_id'], donde: (f: Fila) => f.proveedor_pago_id != null, nombre: 'pagos_proveedor_uk' },
    ],
  });
  const db = pg.db as Record<string, Fila[]>;

  const stripe: Array<{ ruta: string; p: URLSearchParams }> = [];
  const mp: Array<{ metodo: string; ruta: string; body: Fila }> = [];
  const preapproval = new Map<string, Fila>();
  let nSes = 0, nPre = 0, mpPutCae = false;
  const mails: string[] = [];

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    const metodo = (init.method ?? 'GET').toUpperCase();
    if (u.host === 'supa.test') {
      for (const [k, v] of [...u.searchParams]) if (v.startsWith('ilike.')) u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      return pg.responder(u, init);
    }
    if (u.host === 'api.stripe.com') {
      const p = new URLSearchParams(String(init.body ?? ''));
      stripe.push({ ruta: u.pathname, p });
      if (u.pathname === '/v1/coupons') return json(200, { id: `cupon_${stripe.length}` });
      if (u.pathname === '/v1/checkout/sessions') {
        const id = `cs_live_${++nSes}`;
        return json(200, { id, url: `https://checkout.stripe.com/${id}`, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      }
      return json(404, { error: { message: `sin doble: ${u.pathname}` } });
    }
    if (u.host === 'api.mercadopago.com') {
      const body = init.body ? JSON.parse(String(init.body)) as Fila : {};
      mp.push({ metodo, ruta: u.pathname, body });
      if (u.pathname === '/users/me') return json(200, { id: 77, site_id: 'MLA', country_id: 'AR', email: 'mako@mp.test', test_data: null });
      if (metodo === 'POST' && u.pathname === '/preapproval') {
        const id = `pre${++nPre}`;
        preapproval.set(id, { id, status: 'authorized', auto_recurring: body.auto_recurring });
        return json(201, { id, init_point: `https://mp.test/${id}` });
      }
      const m = /^\/preapproval\/([^/]+)$/.exec(u.pathname);
      if (m && metodo === 'PUT') {
        if (mpPutCae) return json(500, { message: 'caído' });
        const f = preapproval.get(m[1]);
        if (!f) return json(404, { message: 'no existe' });
        Object.assign(f.auto_recurring as Fila, (body.auto_recurring ?? {}) as Fila);
        return json(200, f);
      }
      if (m) { const f = preapproval.get(m[1]); return f ? json(200, f) : json(404, { message: 'no existe' }); }
      return json(404, { message: `sin doble: ${u.pathname}` });
    }
    if (u.host === 'api.resend.com') {
      mails.push(String(JSON.parse(String(init.body ?? '{}')).subject ?? ''));
      return json(200, { id: 'mail' });
    }
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.PROMO_ENTRADA_ACTIVA = '1';

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const { firmarVencimiento } = await imp('lib/promo-entrada.ts');
  const { POST: comprarRuta } = await imp('app/api/planes/comprar/route.ts');
  const { NextRequest } = await import('next/server');
  const cobros = await imp('lib/cobros.ts');
  const { conciliarPrimerMes } = await imp('lib/primer-mes.ts');
  const { estadoDePrueba, frenoDePrueba } = await imp('lib/prueba-uso.ts');
  const { runWithWorkspace } = await imp('lib/workspace.ts');

  const cred = (clave: string, valor: string, servicio: string) => db.credenciales.push({ workspace_id: PLATAFORMA, clave, valor_enc: cifrar(valor, PLATAFORMA, clave), servicio });
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  cred('STRIPE_SECRET_KEY', 'rk_live_PRIMERMESaaaaaaaaaaaaaa', 'stripe');
  cred('STRIPE_ACCOUNT_ID', 'acct_PM', 'stripe');
  cred('STRIPE_WEBHOOK_SECRET', 'whsec_PRIMERMES', 'stripe');
  cred('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-1234567890123456-103012-abcdefabcdefabcdefabcdefabcdefab-777777777', 'mercadopago');
  cred('MERCADOPAGO_USER_ID', '77', 'mercadopago');
  db.usuarios.push({ id: 1, email: 'ya-tiene@ejemplo.com', nombre: 'Ya tiene', rol: 'cliente', estado: 'activo', workspace_id: 50 });
  // Los dos planes, con su precio en pesos: lo que hace que Mercado Pago se ofrezca (nunca con una tasa).
  const ahora = Date.now();
  // La ruta de verdad, con su cookie: `reloj` son los minutos que le quedan (negativo = venció hace tanto). null = sin cookie.
  let nIp = 0;
  const cookieDe = (reloj: number | null | string) => (typeof reloj === 'string' ? reloj : reloj == null ? '' : firmarVencimiento(ahora + reloj * 60_000, process.env.AUTH_SECRET));
  const comprar = async (email: string, reloj: number | null | string, extra: Fila = {}) => {
    const cookie = cookieDe(reloj);
    const req = new NextRequest('https://mako.test/api/planes/comprar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://mako.test', 'x-forwarded-for': `10.0.0.${++nIp}`, 'x-vercel-ip-country': 'MX', ...(cookie ? { cookie: `mk_promo=${cookie}` } : {}) },
      body: JSON.stringify({ plan: 'pro', nombre: 'Ana Pérez', email, pasarela: 'stripe', ...extra }),
    });
    const r = await comprarRuta(req);
    const j = await r.json() as Fila;
    return { status: r.status, ok: r.status === 200 && !!j.link, ...j };
  };
  const cobroDe = (email: string) => db.cobros.filter((c) => c.email === email).at(-1);
  const out: Record<string, unknown> = {};

  // ── Sin reloj (llegó directo a /planes): el precio de lista y NINGUNA prueba ──
  let antes = stripe.length;
  out.sinToken = await comprar('directo@ejemplo.com', null);
  if (!(out.sinToken as { ok: boolean }).ok) throw new Error(`la compra no abrió: ${JSON.stringify(out.sinToken)}`);
  const c0 = cobroDe('directo@ejemplo.com')!;
  const ses0 = stripe.slice(antes).find((x) => x.ruta === '/v1/checkout/sessions')!.p;
  out.sinTokenCobro = { creado_por: c0.creado_por, monto: c0.monto, inicio_at: c0.inicio_at ?? null };
  out.sinTokenCupones = stripe.slice(antes).filter((x) => x.ruta === '/v1/coupons').length;
  out.sinTokenSesion = { descuento: ses0.get('discounts[0][coupon]'), prueba: ses0.get('subscription_data[trial_period_days]'), monto: ses0.get('line_items[0][price_data][unit_amount]') };

  // ── Con el reloj vivo: el 50% en Stripe, y el cobro sigue valiendo 97 ──
  antes = stripe.length;
  out.conToken = await comprar('reloj@ejemplo.com', 5);
  const c1 = cobroDe('reloj@ejemplo.com')!;
  const cupon = stripe.slice(antes).find((x) => x.ruta === '/v1/coupons')!.p;
  const ses1 = stripe.slice(antes).find((x) => x.ruta === '/v1/checkout/sessions')!.p;
  out.conTokenCobro = { creado_por: c1.creado_por, monto: c1.monto, monto_usd: c1.monto_usd };
  out.cupon = { pct: cupon.get('percent_off'), duracion: cupon.get('duration') };
  out.sesion = { cupon: ses1.get('discounts[0][coupon]'), monto: ses1.get('line_items[0][price_data][unit_amount]'), prueba: ses1.get('subscription_data[trial_period_days]') };

  // ── El reloj vencido, uno falso, la gracia, y quien sigue a precio normal ──
  const n = () => db.cobros.length;
  let n0 = n();
  out.vencida = await comprar('vencida@ejemplo.com', -30, { promo: true });
  out.vencidaNoCreo = n() === n0;
  out.vencidaSigue = await comprar('vencida@ejemplo.com', -30, { promo: true, sinPromo: true });
  out.vencidaSigueCobro = cobroDe('vencida@ejemplo.com')!.creado_por;
  await comprar('gracia@ejemplo.com', -5, { promo: true });
  out.graciaCobro = cobroDe('gracia@ejemplo.com')!.creado_por;
  // Vencido y sin haberlo visto en la página: el contrato de Landings, precio normal, sin preguntar. La gracia no es para él.
  await comprar('nolovio@ejemplo.com', -5);
  out.noLoVioCobro = cobroDe('nolovio@ejemplo.com')!.creado_por;
  await comprar('falso@ejemplo.com', '9999999999.firma-inventada');
  out.falsoCobro = cobroDe('falso@ejemplo.com')!.creado_por;
  // Con el interruptor de Landings apagado, una cookie buena no da nada: el cartel y el cobro no pueden decir cosas distintas.
  process.env.PROMO_ENTRADA_ACTIVA = '0';
  await comprar('apagada@ejemplo.com', 5);
  out.apagadaCobro = cobroDe('apagada@ejemplo.com')!.creado_por;
  process.env.PROMO_ENTRADA_ACTIVA = '1';

  // ── Un descuento por email ──
  n0 = n();
  out.cuenta = await comprar('ya-tiene@ejemplo.com', 5);
  out.cuentaNoCreo = n() === n0;
  db.cobros.push({ id: ids++, workspace_id: PLATAFORMA, email: 'pago@ejemplo.com', creado_por: 'planes:pro:primer-mes-50', estado: 'pagado', created_at: new Date(ahora - 3600_000).toISOString() });
  out.yaPago = await comprar('pago@ejemplo.com', 5);
  db.cobros.push({ id: ids++, workspace_id: PLATAFORMA, email: 'viejo@ejemplo.com', creado_por: 'planes:pro:primer-mes-50', estado: 'pendiente', created_at: new Date(ahora - 25 * 3600_000).toISOString() });
  out.abandonoViejo = await comprar('viejo@ejemplo.com', 5);
  db.cobros.push({ id: ids++, workspace_id: PLATAFORMA, email: 'reciente@ejemplo.com', creado_por: 'planes:pro:primer-mes-50', estado: 'pendiente', created_at: new Date(ahora - 3600_000).toISOString() });
  out.abandonoReciente = await comprar('reciente@ejemplo.com', 5);

  // ── Lo que entra: el primer pago a mitad, la renovación entera ──
  const crear = (pasarela: string, email: string, extra: Fila = {}) => runWithWorkspace(PLATAFORMA, async () => {
    const lead = { id: ids++, workspace_id: PLATAFORMA, nombre: 'Lead', email, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: new Date().toISOString() };
    db.leads.push(lead);
    return cobros.crearCobro(PLATAFORMA, { leadId: lead.id, pasarela, tipo: 'suscripcion', concepto: 'MaKo Pro · mensual', monto: 97, moneda: 'USD', montoUsd: 97, email, nombre: 'Lead', altaCapa: 'agencia', creadoPor: 'planes:pro:primer-mes-50', ...extra });
  });
  const pagosDe = (id: unknown) => db.pagos.filter((p) => p.proveedor_pago_id != null && db.cobros.some((c) => c.id === id && c.lead_id === p.lead_id)).map((p) => ({ id: p.proveedor_pago_id, usd: p.monto_usd, original: p.monto_original }));

  const rs = await crear('stripe', 'pagastripe@ejemplo.com');
  if (!rs.ok) throw new Error(`crearCobro stripe: ${rs.error}`);
  // SE PAGA ANTES DE ENTRAR: abrir el pago no da de alta a nadie; el pago sí, y entra con su onboarding pendiente.
  const conEmail = () => db.usuarios.filter((u) => u.email === 'pagastripe@ejemplo.com');
  out.usuarioAntesDePagar = conEmail().length;
  await cobros.aplicarPagoAprobado(rs.cobro, { proveedorPagoId: 'in_1', monto: 48.5, moneda: 'USD', suscripcionId: 'sub_1' });
  out.usuarioDespuesDePagar = conEmail().length;
  const wsAlta = db.cobros.find((c) => c.id === rs.cobro.id)!.alta_ws;
  out.onboardingDelAlta = wsAlta == null ? null : db.app_settings.find((f) => f.workspace_id === wsAlta && /onboarding/.test(String(f.key)))?.value ?? null;
  const rsTras = (await cobros.getCobroPorToken(rs.cobro.token))!;
  await cobros.aplicarPagoAprobado(rsTras, { proveedorPagoId: 'in_2', monto: 97, moneda: 'USD', suscripcionId: 'sub_1' });
  out.pagosStripe = pagosDe(rs.cobro.id);
  out.stripeMontoCobro = db.cobros.find((c) => c.id === rs.cobro.id)!.monto;

  const rm = await crear('mercadopago', 'pagamp@ejemplo.com', { moneda: 'ARS', monto: 97000 });
  if (!rm.ok) throw new Error(`crearCobro mp: ${rm.error}`);
  const idMp = String(db.cobros.find((c) => c.id === rm.cobro.id)!.proveedor_ref);
  out.mpNace = (preapproval.get(idMp)!.auto_recurring as Fila).transaction_amount;
  await cobros.aplicarPagoAprobado((await cobros.getCobroPorToken(rm.cobro.token))!, { proveedorPagoId: 'pay_1', monto: 48500, moneda: 'ARS', suscripcionId: idMp });
  out.mpTrasElPrimero = (preapproval.get(idMp)!.auto_recurring as Fila).transaction_amount;
  out.pagosMp = pagosDe(rm.cobro.id);

  // ── El cron: arregla lo que quedó rebajado, y no pisa una retención ──
  mpPutCae = true;
  const rc = await crear('mercadopago', 'caido@ejemplo.com', { moneda: 'ARS', monto: 97000 });
  if (!rc.ok) throw new Error(`crearCobro mp: ${rc.error}`);
  const idC = String(db.cobros.find((c) => c.id === rc.cobro.id)!.proveedor_ref);
  await cobros.aplicarPagoAprobado((await cobros.getCobroPorToken(rc.cobro.token))!, { proveedorPagoId: 'pay_c', monto: 48500, moneda: 'ARS', suscripcionId: idC });
  out.cronAntes = (preapproval.get(idC)!.auto_recurring as Fila).transaction_amount;
  mails.length = 0;
  out.cronCaido = await conciliarPrimerMes();
  out.cronMails = [...mails];
  mpPutCae = false;
  out.cronSube = await conciliarPrimerMes();
  out.cronDespues = (preapproval.get(idC)!.auto_recurring as Fila).transaction_amount;
  out.cronOtraVuelta = await conciliarPrimerMes();

  const rr = await crear('mercadopago', 'retenida@ejemplo.com', { moneda: 'ARS', monto: 97000 });
  if (!rr.ok) throw new Error(`crearCobro mp: ${rr.error}`);
  const idR = String(db.cobros.find((c) => c.id === rr.cobro.id)!.proveedor_ref);
  await cobros.aplicarPagoAprobado((await cobros.getCobroPorToken(rr.cobro.token))!, { proveedorPagoId: 'pay_r', monto: 48500, moneda: 'ARS', suscripcionId: idR });
  (preapproval.get(idR)!.auto_recurring as Fila).transaction_amount = 48500;
  const filaR = db.cobros.find((c) => c.id === rr.cobro.id)!;
  filaR.alta_ws = 70;
  db.app_settings.push({ workspace_id: 70, key: 'plan.retencion', value: JSON.stringify({ estado: 'aplicada', opcion: 'descuento' }) });
  await conciliarPrimerMes();
  out.retenidaSigue = (preapproval.get(idR)!.auto_recurring as Fila).transaction_amount;

  // ── A quien ya está en prueba no se le toca nada ──
  antes = stripe.length;
  const rp = await crear('stripe', 'enprueba@ejemplo.com', { creadoPor: 'planes:pro:prueba', inicioAt: new Date(ahora + 5 * 86_400_000).toISOString() });
  if (!rp.ok) throw new Error(`crearCobro prueba: ${rp.error}`);
  const sesP = stripe.slice(antes).find((x) => x.ruta === '/v1/checkout/sessions')!.p;
  out.pruebaAbierta = { dias: sesP.get('subscription_data[trial_period_days]'), cupon: sesP.get('discounts[0][coupon]') };
  db.workspaces.push({ id: 80, nombre: 'En prueba', capa: 'agencia', estado: 'activo' });
  const filaP = db.cobros.find((c) => c.id === rp.cobro.id)!;
  Object.assign(filaP, { alta_ws: 80, alta_capa: 'agencia', suscripcion_estado: 'activa', estado: 'pendiente', inicio_at: new Date(ahora + 5 * 86_400_000).toISOString() });
  out.pruebaEstado = (await estadoDePrueba(80)).enPrueba;
  out.pruebaFreno = (await frenoDePrueba(80, 'web.landings_publicadas', { usadas: 99 })).ok;

  console.log(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
