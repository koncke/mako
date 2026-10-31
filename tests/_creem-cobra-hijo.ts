// =============================================================================
// Hijo de tests/creem-cobra.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo que le pasa a un cobro de Creem, sobre el PostgREST de mentira y un Creem en memoria. Corren REALES `subirAPro`,
// `aplicarRetencion`, `conciliarRetenciones`, `crearCobro`, `activarPruebaSiAutorizo`, `aplicarPagoAprobado`,
// `asegurarPlazosCreem` y `darDeBajaMiPlan`. La plataforma tiene conectada TAMBIÉN una Mercado Pago, que es lo que hacía
// invisible al bug: el `else` le hablaba a ella. Necesita `--conditions=react-server`.
// Lo que NO prueba: que Creem de verdad se comporte así. El doble sale de su OpenAPI; falta un cobro con una clave real.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const PLATAFORMA = 9;
const DIA = 86_400_000;
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type SubCreem = { id: string; status: string; product: { id: string; price: number } | string; customer: { id: string }; metadata: Fila; created_at: string; current_period_end_date: string | null; next_transaction_date: string | null; last_transaction_id?: string };

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'pagos', 'app_settings', 'workspaces', 'cobro_etapa_vinculos', 'productos', 'pasarela_eventos', 'tickets', 'pedidos_ingreso', 'usuarios', 'workspace_miembros', 'agencia_clientes', 'funnels', 'crm_pipelines', 'avisos_catalogo', 'avisos'],
    orCompleto: true,
    defaults: (tabla: string, f: Fila) => {
      const ahora = new Date().toISOString();
      if (tabla === 'workspaces') return { id: ids++, created_at: ahora, ...f };
      if (tabla === 'cobros') return { id: ids++, created_at: ahora, updated_at: ahora, lead_id: null, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, alta_capa: null, alta_ws: null, alta_estado: null, alta_motivo: null, alta_email_cambios: 0, producto_id: null, proveedor_pago_id: null, proveedor_suscripcion_id: null, suscripcion_estado: null, url_vence_at: null, pagado_at: null, reembolsado_at: null, inicio_at: null, cliente_ws: null, agencia_ws: null, plan_mako: null, ...f };
      if (tabla === 'leads') return { id: ids++, created_at: ahora, estado_lead: 'abierto', pipeline_stage: 'lead', ...f };
      if (tabla === 'pagos') return { id: ids++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f };
      if (['lead_audit', 'tickets', 'pedidos_ingreso'].includes(tabla)) return { id: ids++, created_at: ahora, ...f };
      return { ...f };
    },
    unicos: [
      { tabla: 'cobros', columnas: ['proveedor', 'proveedor_ref'], donde: (f: Fila) => f.proveedor_ref != null, nombre: 'cobros_ref_uk' },
      { tabla: 'pagos', columnas: ['workspace_id', 'proveedor', 'proveedor_pago_id'], donde: (f: Fila) => f.proveedor_pago_id != null, nombre: 'pagos_proveedor_uk' },
      { tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' },
    ],
  });
  const db = pg.db as Record<string, Fila[]>;

  // ── El Creem en memoria ──
  const subs = new Map<string, SubCreem>();
  const checkouts = new Map<string, Fila>();
  const productos = new Map<string, Fila>();
  const porIdem = new Map<string, string>();
  let txs: Fila[] = [];
  let pedidosDeTransacciones: Array<string | null> = [];
  let sinPortal = false;
  let rechazaPatch = false;
  let patches = 0;
  const webhooks: Array<{ id: string; url: string; secret: string; events?: unknown }> = [];
  let posts: Array<{ ruta: string; body: Fila | null }> = [];
  let nId = 0;
  let aMercadoPago = 0;
  let rechazaUpgrade = false;
  let rechazaCancelar = false;
  let upgradeAplicaYSeCorta = false;
  let upgradeSeCortaSinAplicar = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') {
      for (const [k, v] of [...u.searchParams]) {
        if (!v.startsWith('ilike.')) continue;
        if (v.startsWith('ilike.%')) u.searchParams.set(k, `like.${v.slice(6)}`);
        else u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      }
      return pg.responder(u, init);
    }
    if (u.host === 'api.mercadopago.com') { aMercadoPago++; return json(404, { message: 'no es mío' }); }
    if (u.host === 'api.resend.com') return json(200, { id: 'mail' });
    if (u.host !== 'api.creem.io') return json(500, { error: `red de mentira: ${u.host}` });

    const metodo = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Fila : null;
    const ruta = u.pathname.replace(/^\/v1/, '');
    if (metodo === 'POST') posts.push({ ruta, body });
    if (metodo === 'GET' && ruta === '/subscriptions') {
      const s = subs.get(u.searchParams.get('subscription_id') ?? '');
      return s ? json(200, s) : json(404, { message: 'no existe' });
    }
    if (metodo === 'GET' && ruta === '/checkouts') {
      const c = checkouts.get(u.searchParams.get('checkout_id') ?? '');
      return c ? json(200, c) : json(404, { message: 'no existe' });
    }
    // Como su OpenAPI: sólo filtra por cliente. `subscription_id` no existe, y sin cliente vuelven las de toda la tienda.
    if (metodo === 'GET' && ruta === '/transactions/search') {
      const cliente = u.searchParams.get('customer_id');
      pedidosDeTransacciones.push(cliente);
      const todas = cliente ? txs.filter((t) => t.customer === cliente) : txs;
      const tam = Number(u.searchParams.get('page_size') ?? 10);
      const pag = Number(u.searchParams.get('page_number') ?? 1);
      return json(200, { items: todas.slice((pag - 1) * tam, pag * tam), pagination: { total_pages: Math.max(1, Math.ceil(todas.length / tam)), current_page: pag } });
    }
    if (metodo === 'GET' && ruta === '/transactions') {
      const t = txs.find((x) => x.id === u.searchParams.get('transaction_id'));
      return t ? json(200, t) : json(404, { message: 'no existe' });
    }
    if (metodo === 'POST' && ruta === '/customers/billing') {
      if (sinPortal) return json(500, { message: 'caído' });
      return json(200, { customer_portal_link: `https://creem.io/portal/${String(body?.customer_id)}` });
    }
    if (metodo === 'GET' && ruta === '/products/search') return json(200, { items: [] });
    if (metodo === 'GET' && ruta === '/webhooks') return json(200, { items: webhooks });
    if (metodo === 'POST' && ruta === '/webhooks') {
      const w = { id: `wh_nuevo${++nId}`, url: String(body?.url), secret: 'whsec_del_doble', events: body?.events };
      webhooks.push(w);
      return json(200, w);
    }
    const mw = /^\/webhooks\/([^/]+)(\/secret)?$/.exec(ruta);
    if (mw) {
      const w = webhooks.find((x) => x.id === mw[1]);
      if (!w) return json(404, { message: 'no existe' });
      if (mw[2]) return json(200, { secret: w.secret });
      if (metodo === 'GET') return json(200, w);
      if (metodo === 'PATCH') {
        if (rechazaPatch) return json(400, { message: 'no' });
        patches++;
        w.url = String(body?.url);
        return json(200, w);
      }
    }
    if (metodo === 'POST' && ruta === '/products') {
      const idem = new Headers(init.headers).get('Idempotency-Key') ?? '';
      const ya = porIdem.get(idem);
      if (ya) return json(200, productos.get(ya));
      const p = { id: `prod_${++nId}`, ...body };
      productos.set(p.id, p);
      porIdem.set(idem, p.id);
      return json(200, p);
    }
    if (metodo === 'POST' && ruta === '/discounts') return json(200, { id: `dis_${++nId}`, code: body?.code });
    if (metodo === 'POST' && ruta === '/checkouts') {
      const id = `ch_${++nId}`;
      checkouts.set(id, { id, status: 'pending', request_id: body?.request_id, metadata: body?.metadata });
      return json(200, { id, checkout_url: `https://creem.io/checkout/${id}` });
    }
    const m = /^\/subscriptions\/([^/]+)\/(upgrade|pause|resume|cancel)$/.exec(ruta);
    if (metodo === 'POST' && m) {
      const s = subs.get(m[1]);
      if (!s) return json(404, { message: 'no existe' });
      if (m[2] === 'upgrade') {
        if (rechazaUpgrade) return json(402, { message: 'card_declined' });
        if (upgradeSeCortaSinAplicar) throw new Error('timeout');
        const prod = productos.get(String(body?.product_id));
        if (!prod) return json(400, { message: 'no hay producto' });
        s.product = { id: String(prod.id), price: Number(prod.price) };
        if (upgradeAplicaYSeCorta) throw new Error('timeout');
      }
      if (m[2] === 'pause') {
        if (s.status === 'paused') return json(400, { message: 'ya estaba' });
        s.status = 'paused';
      }
      if (m[2] === 'resume') {
        if (s.status !== 'paused' && s.status !== 'scheduled_cancel') return json(400, { message: 'no se puede' });
        s.status = 'active';
      }
      if (m[2] === 'cancel') {
        if (rechazaCancelar) return json(400, { message: 'no se pudo' });
        s.status = body?.mode === 'scheduled' ? 'scheduled_cancel' : 'canceled';
      }
      return json(200, s);
    }
    return json(404, { message: `sin doble: ${metodo} ${ruta}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const cobros = await imp('lib/cobros.ts');
  const { cobroDeFila } = await imp('lib/cobros-tipos.ts');
  const { subirAPro } = await imp('lib/subir-plan.ts');
  const { aplicarRetencion, conciliarRetenciones, ofertaDeRetencion, CLAVE_RETENCION } = await imp('lib/retencion-plan.ts');
  const { creadoPorPrueba, finDeLaPrueba } = await imp('lib/prueba-plan-reglas.ts');

  const cred = (clave: string, valor: string, servicio: string) => db.credenciales.push({ workspace_id: PLATAFORMA, clave, valor_enc: cifrar(valor, PLATAFORMA, clave), servicio });
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  cred('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-de-la-mercado-pago-de-mako', 'mercadopago');
  cred('MERCADOPAGO_USER_ID', '123456', 'mercadopago');
  cred('MERCADOPAGO_WEBHOOK_SECRET', 'secreto-mp', 'mercadopago');
  cred('CREEM_API_KEY', 'creem_clave_de_la_plataforma', 'creem');
  cred('CREEM_WEBHOOK_ID', 'wh_plataforma', 'creem');
  cred('CREEM_WEBHOOK_SECRET', 'whsec_creem', 'creem');

  const iso = (ms: number) => new Date(ms).toISOString();
  const hoy = Date.now();
  let nWs = 100;
  const unNegocio = (capa: string, plan: string, monto: number, extra: Fila = {}) => {
    const ws = ++nWs;
    const susId = `sub_${ws}`;
    db.workspaces.push({ id: ws, nombre: `Negocio ${ws}`, capa, estado: 'activo' });
    subs.set(susId, {
      id: susId, status: 'active', product: { id: `prod_de_${ws}`, price: monto * 100 }, customer: { id: `cu_${ws}` }, metadata: {},
      created_at: iso(hoy - 5 * DIA), current_period_end_date: iso(hoy + 25 * DIA), next_transaction_date: iso(hoy + 25 * DIA),
    });
    const id = ids++;
    db.cobros.push({
      id, workspace_id: PLATAFORMA, token: `tok${String(id).padEnd(29, 'x')}`, proveedor: 'creem', modo: 'real', tipo: 'suscripcion', concepto: `MaKo ${plan} · mensual`,
      monto, moneda: 'USD', monto_usd: monto, email: `ws${ws}@ejemplo.com`, nombre: 'Dueño', estado: 'pagado', suscripcion_estado: 'activa',
      proveedor_ref: `ch_viejo_${ws}`, proveedor_pago_id: `tran_${ws}`, proveedor_suscripcion_id: susId, url_proveedor: 'https://creem.io/x', alta_ws: ws, alta_capa: capa, alta_estado: 'hecha',
      plan_mako: plan, pagado_at: iso(hoy - 5 * DIA), created_at: iso(hoy - 5 * DIA), updated_at: iso(hoy - 5 * DIA), lead_id: null, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, producto_id: null, inicio_at: null, url_vence_at: null, reembolsado_at: null, alta_motivo: null, alta_email_cambios: 0, creado_por: `planes:${plan}`, cliente_ws: null, agencia_ws: null, ...extra,
    });
    db.pagos.push({ id: ids++, workspace_id: PLATAFORMA, cobro_id: id, pagado: true, fecha_pago: iso(hoy - 5 * DIA).slice(0, 10), monto_usd: monto, proveedor: 'creem', proveedor_pago_id: `tran_${ws}`, baja_at: null });
    return { ws, susId, cobroId: id };
  };
  const cobroDb = (id: unknown) => db.cobros.find((c) => c.id === id)!;
  const capa = (ws: number) => db.workspaces.find((w) => w.id === ws)!.capa;
  const marca = (ws: number) => {
    const v = db.app_settings.find((f) => f.workspace_id === ws && f.key === CLAVE_RETENCION)?.value;
    return v ? JSON.parse(String(v)) as Fila : null;
  };
  const precioDe = (susId: string) => { const p = subs.get(susId)!.product; return typeof p === 'object' ? p.price : null; };
  const limpiar = () => { posts = []; };
  const out: Record<string, unknown> = {};

  // ── PASAR A PRO ──
  {
    const n = unNegocio('completo', 'esencial', 47);
    limpiar(); aMercadoPago = 0;
    const r = await subirAPro(n.ws, 'Dueño');
    out.subir = {
      r, precio: precioDe(n.susId), capa: capa(n.ws), plan: cobroDb(n.cobroId).plan_mako, monto: cobroDb(n.cobroId).monto, aMp: aMercadoPago,
      prorrateo: posts.find((x) => x.ruta.endsWith('/upgrade'))?.body?.update_behavior ?? null,
      producto: posts.find((x) => x.ruta === '/products')?.body ?? null,
    };
    limpiar();
    out.subirOtraVez = { r: await subirAPro(n.ws, 'Dueño'), posts: posts.length };

    // La tarjeta no pasó: no sube la capa, se dice bien, y se puede volver a intentar.
    const f = unNegocio('completo', 'esencial', 47);
    rechazaUpgrade = true;
    const rf = await subirAPro(f.ws, 'Dueño');
    rechazaUpgrade = false;
    out.subirFalla = { r: rf, capa: capa(f.ws), precio: precioDe(f.susId) };
    out.subirReintento = { r: await subirAPro(f.ws, 'Dueño'), capa: capa(f.ws) };

    // Creem lo aplicó y la respuesta se perdió: tocar de nuevo termina sin cobrar otra vez.
    const c = unNegocio('completo', 'esencial', 47);
    upgradeAplicaYSeCorta = true;
    const rc = await subirAPro(c.ws, 'Dueño');
    upgradeAplicaYSeCorta = false;
    out.subirCorte = { primero: rc, capa: capa(c.ws) };

    // Se cortó y al releer no se ve el cambio: no se sabe. No se dice «tu plan sigue igual» ni «revisa tu tarjeta».
    const sc = unNegocio('completo', 'esencial', 47);
    upgradeSeCortaSinAplicar = true;
    const rsc = await subirAPro(sc.ws, 'Dueño');
    upgradeSeCortaSinAplicar = false;
    out.subirSinConfirmar = { r: rsc, capa: capa(sc.ws) };

    // Un intento anterior cobró y nunca se supo: Creem ya cobra Pro. Tocar de nuevo termina, sin una segunda diferencia.
    const y = unNegocio('completo', 'esencial', 47);
    subs.get(y.susId)!.product = { id: 'prod_ya_pro', price: 9700 };
    limpiar();
    const ry = await subirAPro(y.ws, 'Dueño');
    out.subirYaEstaba = { r: ry, upgrades: posts.filter((x) => x.ruta.endsWith('/upgrade')).length, capa: capa(y.ws) };

    // Con la baja agendada, o en mora en la pasarela, no se le mueve nada.
    const a = unNegocio('completo', 'esencial', 47);
    subs.get(a.susId)!.status = 'scheduled_cancel';
    limpiar();
    out.subirNoActiva = { r: await subirAPro(a.ws, 'Dueño'), upgrades: posts.filter((x) => x.ruta.endsWith('/upgrade')).length, capa: capa(a.ws) };
  }

  // ── LA RETENCIÓN ──
  {
    // 2 meses al 50%.
    const n = unNegocio('agencia', 'pro', 97);
    out.oferta = await ofertaDeRetencion(n.ws);
    limpiar(); aMercadoPago = 0;
    const r = await aplicarRetencion(n.ws, 'Dueño', 'descuento');
    out.descuento = {
      r, precio: precioDe(n.susId), marca: marca(n.ws), aMp: aMercadoPago,
      prorrateo: posts.find((x) => x.ruta.endsWith('/upgrade'))?.body?.update_behavior ?? null, monto: cobroDb(n.cobroId).monto,
    };
    // El cron: sin cuotas cobradas todavía no vuelve; con las dos, vuelve al precio lleno y sin cobrar nada.
    limpiar();
    await conciliarRetenciones();
    out.descuentoSinCuotas = { precio: precioDe(n.susId), restaurada: marca(n.ws)!.restaurada };
    const desde = String(marca(n.ws)!.restaurarDesde);
    db.pagos.push(
      { id: ids++, workspace_id: PLATAFORMA, cobro_id: n.cobroId, pagado: true, fecha_pago: desde, proveedor_pago_id: 'tran_m1', proveedor: 'creem' },
      { id: ids++, workspace_id: PLATAFORMA, cobro_id: n.cobroId, pagado: true, fecha_pago: desde, proveedor_pago_id: 'tran_m2', proveedor: 'creem' },
    );
    limpiar();
    await conciliarRetenciones();
    out.descuentoVuelve = { precio: precioDe(n.susId), restaurada: marca(n.ws)!.restaurada, prorrateo: posts.find((x) => x.ruta.endsWith('/upgrade'))?.body?.update_behavior ?? null };

    // Una oferta por negocio.
    out.segundaOferta = await aplicarRetencion(n.ws, 'Dueño', 'descuento');

    // Pausar un mes.
    const p = unNegocio('completo', 'esencial', 47);
    limpiar(); aMercadoPago = 0;
    const rp = await aplicarRetencion(p.ws, 'Dueño', 'pausa');
    out.pausa = { r: rp, estado: subs.get(p.susId)!.status, marca: marca(p.ws), aMp: aMercadoPago, proximo: subs.get(p.susId)!.next_transaction_date };
    await conciliarRetenciones();
    out.pausaAntes = { estado: subs.get(p.susId)!.status, restaurada: marca(p.ws)!.restaurada };
    const fila = db.app_settings.find((f) => f.workspace_id === p.ws && f.key === CLAVE_RETENCION)!;
    fila.value = JSON.stringify({ ...marca(p.ws), reanudaAt: iso(Date.now() - 1000) });
    await conciliarRetenciones();
    out.pausaDespues = { estado: subs.get(p.susId)!.status, restaurada: marca(p.ws)!.restaurada };

    // Pasar al plan más barato.
    const b = unNegocio('agencia', 'pro', 97);
    limpiar();
    const rb = await aplicarRetencion(b.ws, 'Dueño', 'bajar');
    out.bajar = { r: rb, precio: precioDe(b.susId), plan: cobroDb(b.cobroId).plan_mako, capa: capa(b.ws), marca: marca(b.ws), prorrateo: posts.find((x) => x.ruta.endsWith('/upgrade'))?.body?.update_behavior ?? null };

    // Creem la rechaza: se dice, y la oferta NO se quema: el cron relee y la libera.
    const e = unNegocio('agencia', 'pro', 97);
    rechazaUpgrade = true;
    const re = await aplicarRetencion(e.ws, 'Dueño', 'descuento');
    rechazaUpgrade = false;
    const estadoError = marca(e.ws)!.estado;
    await conciliarRetenciones();
    out.rechazada = { r: re, estadoError, marcaDespues: marca(e.ws), oferta: await ofertaDeRetencion(e.ws) };

    // Creem la aplicó y la respuesta se perdió: el cron la da por aplicada, no la libera.
    const t = unNegocio('agencia', 'pro', 97);
    upgradeAplicaYSeCorta = true;
    await aplicarRetencion(t.ws, 'Dueño', 'descuento');
    upgradeAplicaYSeCorta = false;
    await conciliarRetenciones();
    out.seCorto = { marca: marca(t.ws)?.estado ?? null, precio: precioDe(t.susId) };

    // Un producto que vino como id suelto no dice su precio: «no sé» no libera la oferta.
    const i = unNegocio('agencia', 'pro', 97);
    rechazaUpgrade = true;
    await aplicarRetencion(i.ws, 'Dueño', 'descuento');
    rechazaUpgrade = false;
    subs.get(i.susId)!.product = 'prod_suelto';
    await conciliarRetenciones();
    out.sinPrecio = marca(i.ws)?.estado ?? null;

    // Una suscripción cancelada no se reanuda.
    const k = unNegocio('completo', 'esencial', 47);
    await aplicarRetencion(k.ws, 'Dueño', 'pausa');
    const filaK = db.app_settings.find((f) => f.workspace_id === k.ws && f.key === CLAVE_RETENCION)!;
    filaK.value = JSON.stringify({ ...marca(k.ws), reanudaAt: iso(Date.now() - 1000) });
    cobroDb(k.cobroId).suscripcion_estado = 'cancelada';
    limpiar();
    await conciliarRetenciones();
    out.canceladaNoReanuda = { resumes: posts.filter((x) => x.ruta.endsWith('/resume')).length, restaurada: marca(k.ws)!.restaurada };
  }

  // ── LA PRUEBA GRATIS ──
  {
    const lead = (email: string) => { const id = ids++; db.leads.push({ id, workspace_id: PLATAFORMA, nombre: 'Comprador', email, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null }); return id; };
    const pedirPrueba = (email: string) => cobros.crearCobro(PLATAFORMA, {
      leadId: lead(email), pasarela: 'creem', tipo: 'suscripcion', concepto: 'MaKo Pro · mensual', monto: 97, moneda: 'USD', montoUsd: 97, email, nombre: 'Comprador',
      altaCapa: 'agencia', creadoPor: creadoPorPrueba('pro'), inicioAt: finDeLaPrueba(Date.now()),
    });
    limpiar(); aMercadoPago = 0;
    const r = await pedirPrueba('prueba@ejemplo.com') as { ok: boolean; error?: string; cobro?: { id: number; token: string; proveedor_ref: string } };
    out.pruebaCreada = {
      ok: r.ok, error: r.error ?? null, dias: posts.find((x) => x.ruta === '/products')?.body?.trial_period_days ?? null,
      aMp: aMercadoPago,
    };
    if (r.ok && r.cobro) {
      // Sin completar: no se entrega nada.
      const c0 = cobros.getCobroPorToken ? await cobros.getCobroPorToken(r.cobro.token) : null;
      out.pruebaSinCompletar = await cobros.activarPruebaSiAutorizo(c0);
      const proximo = iso(Date.now() + 7 * DIA);
      const completar = (ref: string, token: string, susId: string, cliente: string) => {
        checkouts.set(ref, { id: ref, status: 'completed', request_id: token, subscription: susId, metadata: { mako_cobro: token } });
        subs.set(susId, { id: susId, status: 'trialing', product: { id: 'prod_p', price: 9700 }, customer: { id: cliente }, metadata: { mako_cobro: token }, created_at: iso(hoy), current_period_end_date: proximo, next_transaction_date: proximo });
      };
      completar(r.cobro.proveedor_ref, r.cobro.token, 'sub_prueba_1', 'cu_repite');
      aMercadoPago = 0;
      const c1 = await cobros.getCobroPorToken(r.cobro.token);
      const act = await cobros.activarPruebaSiAutorizo(c1);
      const fila = cobroDb(r.cobro.id);
      out.pruebaActivada = { act, estado: fila.estado, sus: fila.suscripcion_estado, susId: fila.proveedor_suscripcion_id, huella: fila.prueba_huella, inicio: fila.inicio_at === proximo, alta: fila.alta_estado, altaWs: fila.alta_ws != null, aMp: aMercadoPago };

      // El mismo cliente de Creem, con otro email en MaKo: se corta, sin cobrar.
      const r2 = await pedirPrueba('otroemail@ejemplo.com') as { ok: boolean; cobro: { id: number; token: string; proveedor_ref: string } };
      completar(r2.cobro.proveedor_ref, r2.cobro.token, 'sub_prueba_2', 'cu_repite');
      const act2 = await cobros.activarPruebaSiAutorizo(await cobros.getCobroPorToken(r2.cobro.token));
      const f2 = cobroDb(r2.cobro.id);
      out.pruebaRepetida = { act: act2, estado: f2.estado, sus: f2.suscripcion_estado, enCreem: subs.get('sub_prueba_2')!.status, motivo: f2.motivo, altaWs: f2.alta_ws ?? null };

      // ⚠️ El límite de verdad: otro email también en Creem, la misma tarjeta. Creem no la muestra, y pasa.
      const r3 = await pedirPrueba('tercero@ejemplo.com') as { ok: boolean; cobro: { id: number; token: string; proveedor_ref: string } };
      completar(r3.cobro.proveedor_ref, r3.cobro.token, 'sub_prueba_3', 'cu_otro');
      out.pruebaOtroCliente = await cobros.activarPruebaSiAutorizo(await cobros.getCobroPorToken(r3.cobro.token));

      // El checkout completo con la suscripción en cualquier otro estado, o de otro cobro: no se entrega nada.
      for (const [nombre, estado, ref] of [['pruebaCancelada', 'canceled', null], ['pruebaActivaYa', 'active', null], ['pruebaDeOtroCobro', 'trialing', 'otro_token']] as const) {
        const rx = await pedirPrueba(`${nombre}@ejemplo.com`) as { ok: boolean; cobro: { id: number; token: string; proveedor_ref: string } };
        const susId = `sub_${nombre}`;
        completar(rx.cobro.proveedor_ref, rx.cobro.token, susId, `cu_${nombre}`);
        subs.get(susId)!.status = estado;
        if (ref) subs.get(susId)!.metadata = { mako_cobro: ref };
        out[nombre] = { act: await cobros.activarPruebaSiAutorizo(await cobros.getCobroPorToken(rx.cobro.token)), altaWs: cobroDb(rx.cobro.id).alta_ws ?? null };
      }

      // El cobro del día 8 se rechaza: sigue siendo su plan, en mora, y se puede dar de baja.
      {
        const rf = await pedirPrueba('dia8@ejemplo.com') as { ok: boolean; cobro: { id: number; token: string; proveedor_ref: string } };
        completar(rf.cobro.proveedor_ref, rf.cobro.token, 'sub_dia8', 'cu_dia8');
        await cobros.activarPruebaSiAutorizo(await cobros.getCobroPorToken(rf.cobro.token));
        await cobros.aplicarPagoFallido(await cobros.getCobroPorToken(rf.cobro.token), 'Creem: past_due');
        const fd = cobroDb(rf.cobro.id);
        const delPlan = await cobros.suscripcionDeMakoDe(Number(fd.alta_ws));
        const baja = await cobros.darDeBajaMiPlan(Number(fd.alta_ws), 'Dueño');
        out.pruebaDia8 = { estado: fd.estado, tienePlan: delPlan?.id === rf.cobro.id, baja: baja.ok, enCreem: subs.get('sub_dia8')!.status };
      }

      // Un link común de Creem con fecha futura sigue sin poder abrirse: lo que no sabe hacer, se dice.
      const comun = await cobros.crearCobro(PLATAFORMA, {
        leadId: lead('comun@ejemplo.com'), pasarela: 'creem', tipo: 'suscripcion', concepto: 'Otra cosa', monto: 10, moneda: 'USD', montoUsd: 10, email: 'comun@ejemplo.com', nombre: 'Comun',
        inicioAt: iso(Date.now() + 30 * DIA),
      }) as { ok: boolean; error?: string };
      out.fechaFuturaSinPrueba = comun;
    }
  }

  // ── EL PLAZO ──
  {
    const prod = (meses: number | null) => { const id = ids++; db.productos.push({ id, workspace_id: PLATAFORMA, nombre: `Producto ${id}`, tipo: 'suscripcion', monto_usd: 50, suscripcion_meses: meses, activo: true }); return id; };
    const conPlazo = (meses: number | null, mesesCorridos: number) => {
      const n = unNegocio('completo', 'esencial', 47, { producto_id: prod(meses), alta_ws: null, alta_capa: null, plan_mako: null, estado: 'pendiente', suscripcion_estado: null, pagado_at: null, proveedor_pago_id: null, proveedor_suscripcion_id: null });
      const inicio = hoy - mesesCorridos * 30 * DIA;
      const s = subs.get(n.susId)!;
      s.created_at = iso(inicio);
      s.current_period_end_date = iso(inicio + (mesesCorridos + 1) * 30.4 * DIA);
      return n;
    };
    const pagar = async (id: number, susId: string, tran: string) => cobros.aplicarPagoAprobado(cobroDeFila(cobroDb(id)), { proveedorPagoId: tran, monto: 50, moneda: 'USD', suscripcionId: susId, autor: 'Creem' });

    const seis = conPlazo(6, 0);
    limpiar();
    await pagar(seis.cobroId, seis.susId, 'tran_s1');
    out.plazoPrimerMes = { estado: subs.get(seis.susId)!.status, cancels: posts.filter((x) => x.ruta.endsWith('/cancel')).length };

    // El sexto: la baja se agenda para el fin de lo que ya pagó, sin cortar en el acto.
    const s = subs.get(seis.susId)!;
    s.created_at = iso(hoy - 5 * 30.4 * DIA);
    s.current_period_end_date = iso(hoy + 30 * DIA);
    limpiar();
    await pagar(seis.cobroId, seis.susId, 'tran_s6');
    out.plazoUltimoMes = { estado: s.status, modo: posts.find((x) => x.ruta.endsWith('/cancel'))?.body?.mode ?? null };

    // Una ya agendada no se vuelve a pedir.
    limpiar();
    await pagar(seis.cobroId, seis.susId, 'tran_s6b');
    out.plazoNoRepite = posts.filter((x) => x.ruta.endsWith('/cancel')).length;

    // De un mes: al primer pago.
    const uno = conPlazo(1, 0);
    limpiar();
    await pagar(uno.cobroId, uno.susId, 'tran_u1');
    out.plazoDeUnMes = subs.get(uno.susId)!.status;

    // Sin plazo: nunca.
    const sin = conPlazo(null, 0);
    limpiar();
    await pagar(sin.cobroId, sin.susId, 'tran_n1');
    out.sinPlazo = { estado: subs.get(sin.susId)!.status, cancels: posts.filter((x) => x.ruta.endsWith('/cancel')).length };

    // Creem no la agenda: queda dicho en el cobro, y la red lo termina y borra el aviso.
    const no = conPlazo(1, 0);
    rechazaCancelar = true;
    await pagar(no.cobroId, no.susId, 'tran_f1');
    rechazaCancelar = false;
    out.plazoFallaMotivo = cobroDb(no.cobroId).motivo;
    await cobros.asegurarPlazosCreem(PLATAFORMA);
    out.plazoRed = { estado: subs.get(no.susId)!.status, motivo: cobroDb(no.cobroId).motivo };

    // El aviso de la renovación se perdió: la red del día igual cierra el último ciclo.
    const perdido = conPlazo(3, 0);
    await pagar(perdido.cobroId, perdido.susId, 'tran_p1');
    const sp = subs.get(perdido.susId)!;
    const antes = sp.status;
    sp.created_at = iso(hoy - 2 * 30.4 * DIA);
    sp.current_period_end_date = iso(hoy + 30 * DIA);
    await cobros.asegurarPlazosCreem(PLATAFORMA);
    out.plazoAvisoPerdido = { antes, despues: sp.status };
  }

  // ── LA PLATA DE UN AVISO: en unidades, y sólo la de ESTA suscripción ──
  {
    const { procesarEventoCreem } = await imp('lib/cobros-webhook.ts');
    const { avisoCreem: _a, eventoCreem } = await imp('lib/cobros-eventos.ts');
    const leadId = ids++;
    db.leads.push({ id: leadId, workspace_id: PLATAFORMA, nombre: 'Renueva', email: 'renueva@ejemplo.com', estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
    const n = unNegocio('completo', 'esencial', 47, { lead_id: leadId });
    const cu = `cu_${n.ws}`;
    txs = [
      { id: `tran_${n.ws}`, status: 'paid', amount: 4700, amount_paid: 5687, tax_amount: 987, currency: 'USD', subscription: n.susId, customer: cu, created_at: iso(hoy - 5 * DIA) },
      { id: 'tran_renueva', status: 'paid', amount: 4700, amount_paid: 5687, tax_amount: 987, currency: 'USD', subscription: n.susId, customer: cu, created_at: iso(hoy - DIA) },
      // Otra suscripción del MISMO cliente, más nueva: no es de este cobro.
      { id: 'tran_otra_sub', status: 'paid', amount: 9700, currency: 'USD', subscription: 'sub_de_otro_producto', customer: cu, created_at: iso(hoy) },
      // De otro cliente de la tienda: sin el filtro, ésta era «la más nueva».
      { id: 'tran_de_otro', status: 'paid', amount: 29700, currency: 'USD', subscription: 'sub_ajena', customer: 'cu_ajeno', created_at: iso(hoy) },
    ];
    subs.get(n.susId)!.metadata = { mako_cobro: cobroDb(n.cobroId).token };
    // El listado sin orden, y la vieja primero: lo que dice cuál es, es la suscripción o su fecha.
    txs = txs.map((t) => ({ ...t, created_at: Date.parse(String(t.created_at)) }));
    const ev = eventoCreem({ id: 'evt_renueva', eventType: 'subscription.paid', created_at: Date.now(), object: { id: n.susId, status: 'active', metadata: { mako_cobro: cobroDb(n.cobroId).token } } });
    pedidosDeTransacciones = [];
    const r = await procesarEventoCreem(PLATAFORMA, ev);
    out.pedidoPorCliente = { pedidos: [...pedidosDeTransacciones], cliente: cu };
    const asentadas = db.pagos.filter((p) => p.proveedor_pago_id === 'tran_renueva');
    out.renovacion = {
      r, nCuotas: asentadas.length, usd: asentadas[0]?.monto_usd ?? null, monto: asentadas[0]?.monto_moneda ?? asentadas[0]?.monto ?? null,
      ajenas: db.pagos.filter((p) => p.proveedor_pago_id === 'tran_otra_sub' || p.proveedor_pago_id === 'tran_de_otro').length,
    };
    (out.renovacion as Fila).fecha = asentadas[0]?.fecha_pago ?? null;
    (out.renovacion as Fila).hoy = iso(hoy).slice(0, 10);

    // Con la última dicha por la suscripción: gana aunque otra tenga una fecha más nueva.
    subs.get(n.susId)!.last_transaction_id = 'tran_vieja_dicha';
    txs = [...txs, { id: 'tran_vieja_dicha', status: 'paid', amount: 4700, currency: 'USD', subscription: n.susId, customer: cu, created_at: hoy - 3 * DIA }];
    await procesarEventoCreem(PLATAFORMA, eventoCreem({ id: 'evt_renueva2', eventType: 'subscription.paid', created_at: Date.now(), object: { id: n.susId, status: 'active' } }));
    out.laQueDiceLaSuscripcion = db.pagos.filter((p) => p.proveedor_pago_id === 'tran_vieja_dicha').length;

    // Paginado: la de esta suscripción en la página 2 de ese cliente.
    const { buscarTransaccionesCreem } = await imp('lib/creem-api.ts');
    const relleno = (k: number) => Array.from({ length: k }, (_, i) => ({ id: `r${i}`, status: 'paid', amount: 100, subscription: 'otra', customer: 'cu_mucho', created_at: hoy }));
    txs = [...relleno(150), { id: 'tran_p2', status: 'paid', amount: 4700, subscription: 'sub_mucho', customer: 'cu_mucho', created_at: hoy }];
    const p2 = await buscarTransaccionesCreem('creem_clave_de_la_plataforma', 'sub_mucho', 'cu_mucho');
    out.paginaDos = p2.ok ? p2.transacciones.map((t: { id: string }) => t.id) : p2.error;
    txs = relleno(1200);
    const pTope = await buscarTransaccionesCreem('creem_clave_de_la_plataforma', 'sub_mucho', 'cu_mucho');
    out.paginasTope = pTope.ok;

    // ── Los reembolsos ──
    const refund = (id: string, sus: string | null, tran: string, extra: Fila = {}) => eventoCreem({ id, eventType: 'refund.created', created_at: Date.now(), object: { id: `ref_${id}`, refund_amount: 500, transaction: { id: tran, amount: 4700 }, ...(sus ? { subscription: { id: sus } } : {}), ...extra } });
    const conCuotas = () => {
      const leadR = ids++;
      db.leads.push({ id: leadR, workspace_id: PLATAFORMA, nombre: 'Devuelve', email: `dev${leadR}@ejemplo.com`, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
      const x = unNegocio('completo', 'esencial', 47, { lead_id: leadR });
      return { ...x, cu: `cu_${x.ws}`, primera: `tran_${x.ws}` };
    };
    // Parcial de una renovación: nada se desmarca.
    const a = conCuotas();
    await cobros.aplicarPagoAprobado(cobroDeFila(cobroDb(a.cobroId)), { proveedorPagoId: 'tran_a2', monto: 47, moneda: 'USD', suscripcionId: a.susId, autor: 'Creem' });
    txs = [{ id: 'tran_a2', status: 'partialRefund', amount: 4700, subscription: a.susId, customer: a.cu, created_at: hoy }];
    const rp = await procesarEventoCreem(PLATAFORMA, refund('evt_a', a.susId, 'tran_a2'));
    out.reembolsoParcial = { r: rp, estado: cobroDb(a.cobroId).estado, pagada: db.pagos.find((p) => p.proveedor_pago_id === 'tran_a2')?.pagado };
    // Total de una renovación: esa cuota, y el cobro sigue vivo.
    const b = conCuotas();
    await cobros.aplicarPagoAprobado(cobroDeFila(cobroDb(b.cobroId)), { proveedorPagoId: 'tran_b2', monto: 47, moneda: 'USD', suscripcionId: b.susId, autor: 'Creem' });
    txs = [{ id: 'tran_b2', status: 'refunded', amount: 4700, subscription: b.susId, customer: b.cu, created_at: hoy }];
    const rt = await procesarEventoCreem(PLATAFORMA, refund('evt_b', b.susId, 'tran_b2'));
    out.reembolsoRenovacion = { r: rt, estado: cobroDb(b.cobroId).estado, devuelta: db.pagos.find((p) => p.proveedor_pago_id === 'tran_b2')?.pagado };
    // De otra suscripción: no se toca nada.
    txs = [{ id: 'tran_otra', status: 'refunded', amount: 4700, subscription: 'sub_ajena', customer: b.cu, created_at: hoy }];
    out.reembolsoAjeno = await procesarEventoCreem(PLATAFORMA, refund('evt_c', b.susId, 'tran_otra'));
    // Todavía sigue pagada: que Creem reintente.
    txs = [{ id: 'tran_b2', status: 'paid', amount: 4700, subscription: b.susId, customer: b.cu, created_at: hoy }];
    out.reembolsoSinAsentar = await procesarEventoCreem(PLATAFORMA, refund('evt_d', b.susId, 'tran_b2')).then(() => 'no tiró', () => 'tiró');

    // Un pago ÚNICO: el aviso trae su cobro adentro de `checkout`.
    const unico = () => {
      const leadU = ids++;
      db.leads.push({ id: leadU, workspace_id: PLATAFORMA, nombre: 'Unico', email: `uni${leadU}@ejemplo.com`, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
      const id = ids++;
      const token = `uni${String(id).padEnd(29, 'x')}`;
      db.cobros.push({ id, workspace_id: PLATAFORMA, token, proveedor: 'creem', modo: 'real', tipo: 'unico', concepto: 'Curso', monto: 500, moneda: 'USD', monto_usd: 500, email: 'u@ejemplo.com', nombre: 'U', estado: 'pagado', suscripcion_estado: null, proveedor_ref: `ch_uni${id}`, proveedor_pago_id: `tran_uni${id}`, proveedor_suscripcion_id: null, lead_id: leadU, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, producto_id: null, alta_capa: null, alta_ws: null, alta_estado: null, alta_motivo: null, alta_email_cambios: 0, pagado_at: iso(hoy), reembolsado_at: null, url_proveedor: 'x', url_vence_at: null, created_at: iso(hoy), updated_at: iso(hoy), creado_por: 'x', cliente_ws: null, agencia_ws: null });
      return { id, token, ref: `ch_uni${id}`, tran: `tran_uni${id}` };
    };
    const u1 = unico();
    txs = [{ id: u1.tran, status: 'refunded', amount: 50000, customer: 'cu_u', created_at: hoy }];
    const ru = await procesarEventoCreem(PLATAFORMA, refund('evt_u', null, u1.tran, { checkout: { id: u1.ref, request_id: u1.token, metadata: { mako_cobro: u1.token } } }));
    out.reembolsoUnico = { r: ru, estado: cobroDb(u1.id).estado };
    // Una disputa: su `checkout` no trae el token, sólo el id.
    const u2 = unico();
    const rd = await procesarEventoCreem(PLATAFORMA, eventoCreem({ id: 'evt_dis', eventType: 'dispute.created', created_at: Date.now(), object: { id: 'dis_1', transaction: { id: u2.tran }, checkout: { id: u2.ref } } }));
    out.disputaUnico = { r: rd, motivo: cobroDb(u2.id).motivo };
    // Sólo con la transacción: `transaction` es el único obligatorio.
    const u3 = unico();
    const rs = await procesarEventoCreem(PLATAFORMA, eventoCreem({ id: 'evt_dis2', eventType: 'dispute.created', created_at: Date.now(), object: { id: 'dis_2', transaction: u3.tran } }));
    out.disputaSoloTransaccion = { r: rs, motivo: cobroDb(u3.id).motivo };
    // La transacción que trae no es la que MaKo tiene anotada (el aviso del pago se perdió): sólo el `checkout` dice de qué cobro es.
    const u4 = unico();
    const rc4 = await procesarEventoCreem(PLATAFORMA, eventoCreem({ id: 'evt_dis3', eventType: 'dispute.created', created_at: Date.now(), object: { id: 'dis_3', transaction: 'tran_desconocida', checkout: u4.ref } }));
    out.disputaSoloCheckout = { r: rc4, motivo: cobroDb(u4.id).motivo };
    const u5 = unico();
    const rc5 = await procesarEventoCreem(PLATAFORMA, eventoCreem({ id: 'evt_dis4', eventType: 'dispute.created', created_at: Date.now(), object: { id: 'dis_4', transaction: 'tran_desconocida2', checkout: { id: 'ch_que_no_es', metadata: { mako_cobro: u5.token } } } }));
    out.disputaSoloToken = { r: rc5, motivo: cobroDb(u5.id).motivo };
    txs = [];

    // ── Un link anulado ──
    const anular = async (email: string) => {
      const leadA = ids++;
      db.leads.push({ id: leadA, workspace_id: PLATAFORMA, nombre: 'Anula', email, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
      return await cobros.crearCobro(PLATAFORMA, { leadId: leadA, pasarela: 'creem', tipo: 'suscripcion', concepto: 'Otra', monto: 20, moneda: 'USD', montoUsd: 20, email, nombre: 'Anula' }) as { ok: boolean; cobro: { id: number; token: string; proveedor_ref: string } };
    };
    const la = await anular('anula1@ejemplo.com');
    limpiar();
    await cobros.anularCobro(PLATAFORMA, la.cobro.id, 'Dueño');
    out.anularSinPagar = { cancels: posts.filter((x) => x.ruta.endsWith('/cancel')).map((x) => x.ruta), estado: cobroDb(la.cobro.id).estado };

    // Se pagó igual: la suscripción no sigue cobrando todos los meses.
    subs.set('sub_anulada', { id: 'sub_anulada', status: 'active', product: { id: 'p', price: 2000 }, customer: { id: 'cu_a' }, metadata: {}, created_at: iso(hoy), current_period_end_date: iso(hoy + 30 * DIA), next_transaction_date: iso(hoy + 30 * DIA) });
    await cobros.aplicarPagoAprobado(await cobros.getCobroPorToken(la.cobro.token), { proveedorPagoId: 'tran_anulada', monto: 20, moneda: 'USD', suscripcionId: 'sub_anulada', autor: 'Creem' });
    out.anuladoPagado = { enCreem: subs.get('sub_anulada')!.status, motivo: cobroDb(la.cobro.id).motivo };

    // Anulado con el checkout ya completo y el aviso sin llegar: la suscripción sale del checkout.
    const lb = await anular('anula2@ejemplo.com');
    checkouts.set(lb.cobro.proveedor_ref, { id: lb.cobro.proveedor_ref, status: 'completed', request_id: lb.cobro.token, subscription: 'sub_del_checkout' });
    subs.set('sub_del_checkout', { id: 'sub_del_checkout', status: 'active', product: { id: 'p', price: 2000 }, customer: { id: 'cu_b' }, metadata: {}, created_at: iso(hoy), current_period_end_date: iso(hoy + 30 * DIA), next_transaction_date: iso(hoy + 30 * DIA) });
    await cobros.anularCobro(PLATAFORMA, lb.cobro.id, 'Dueño');
    out.anularYaCompleto = subs.get('sub_del_checkout')!.status;

    // ── Conectar: la URL del aviso lleva su id, y la ruta lo acepta ──
    const { descubrirPasarela } = await imp('lib/cobros-conexion.ts');
    const { POST: rutaCreem } = await imp('app/api/webhooks/creem/route.ts');
    const { firmarCreem } = await imp('lib/pasarela-firma.ts');
    const { NextRequest } = await import('next/server');
    const WS_NEGOCIO = 777;
    db.workspaces.push({ id: WS_NEGOCIO, nombre: 'Un negocio', capa: 'completo', estado: 'activo' });
    const con = await descubrirPasarela('creem', WS_NEGOCIO, 'creem_clave_del_negocio1', 'Dueño', { guardarClave: true, cuenta: 'principal' });
    const wNuevo = webhooks.at(-1)!;
    const crudo = JSON.stringify({ id: 'evt_conecta', eventType: 'subscription.trialing', created_at: Date.now(), object: { id: 'sub_x' } });
    const pedir = (url: string) => rutaCreem(new NextRequest(url, { method: 'POST', body: crudo, headers: { 'creem-signature': firmarCreem(crudo, wNuevo.secret), 'content-type': 'application/json' } }));
    const conUrl = await pedir(wNuevo.url);
    const sinW = await pedir('https://mako.test/api/webhooks/creem');
    out.conectar = { ok: con.ok, url: wNuevo.url, id: wNuevo.id, status: conUrl.status, statusSinW: sinW.status };

    // Uno que ya estaba registrado con la URL pelada se repara al reconectar; si Creem no deja, no se conecta.
    const { asegurarWebhookCreem } = await imp('lib/creem-api.ts');
    webhooks.push({ id: 'wh_viejo', url: 'https://mako.test/api/webhooks/creem', secret: 'whsec_viejo' });
    const clavePropia = 'creem_otra_tienda_1';
    const soloViejo = webhooks.splice(0, webhooks.length).filter((w) => w.id === 'wh_viejo');
    webhooks.push(...soloViejo);
    const re = await asegurarWebhookCreem(clavePropia, 'https://mako.test/api/webhooks/creem');
    out.reparaLaVieja = { ok: re.ok, url: webhooks[0].url };
    webhooks[0].url = 'https://mako.test/api/webhooks/creem';
    rechazaPatch = true;
    out.sinPatchNoConecta = (await asegurarWebhookCreem(clavePropia, 'https://mako.test/api/webhooks/creem')).ok;
    rechazaPatch = false;

    // ── La cuenta que se conectó con el código viejo: la repara el cron, sola ──
    webhooks.splice(0, webhooks.length, { id: 'wh_plataforma', url: 'https://mako.test/api/webhooks/creem', secret: 'whsec_creem' });
    patches = 0;
    await cobros.mantenerAvisosCreem(PLATAFORMA);
    const reparada = { url: webhooks[0].url, patches };
    await cobros.mantenerAvisosCreem(PLATAFORMA);
    // Borrado a mano: no se crea otro, porque su secreto no lo guardaría nadie.
    webhooks.splice(0, webhooks.length);
    const sinTirar = await cobros.mantenerAvisosCreem(PLATAFORMA).then(() => true, () => false);
    out.reparaElCron = { ...reparada, otraVuelta: patches, creados: webhooks.length, sinTirar };
  }

  // ── ANTES DE CORTAR POR IMPAGO ──
  {
    const { confirmarImpago, pagarDeuda } = await imp('lib/plan-deuda.ts');
    const fila = (id: number) => cobroDb(id) as never;

    // Pagó y el aviso se perdió: no se le corta, y se asienta.
    const leadPerdida = ids++;
    db.leads.push({ id: leadPerdida, workspace_id: PLATAFORMA, nombre: 'Perdida', email: 'perdida@ejemplo.com', estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
    const n = unNegocio('completo', 'esencial', 47, { lead_id: leadPerdida });
    txs = [{ id: `tran_${n.ws}`, status: 'paid', amount: 4700, currency: 'USD', subscription: n.susId, customer: `cu_${n.ws}`, created_at: iso(hoy - 5 * DIA) }, { id: 'tran_perdida', status: 'paid', amount: 4700, currency: 'USD', subscription: n.susId, customer: `cu_${n.ws}`, created_at: iso(hoy - DIA) }];
    aMercadoPago = 0;
    out.impagoPagoPerdido = { r: await confirmarImpago(fila(n.cobroId), { reparar: true }), aMp: aMercadoPago, asentada: db.pagos.filter((p) => p.proveedor_pago_id === 'tran_perdida').length };

    // Sin cobrar y vencida: sí es impago.
    const v = unNegocio('completo', 'esencial', 47);
    subs.get(v.susId)!.status = 'past_due';
    txs = [{ id: `tran_${v.ws}`, status: 'paid', amount: 4700, currency: 'USD', subscription: v.susId, customer: `cu_${v.ws}`, created_at: iso(hoy - 5 * DIA) }];
    out.impagoDeVerdad = await confirmarImpago(fila(v.cobroId), { reparar: true });

    // La pasarela no contesta: no se le corta a nadie por eso.
    const s = unNegocio('completo', 'esencial', 47);
    subs.delete(s.susId);
    out.impagoSinRespuesta = await confirmarImpago(fila(s.cobroId), { reparar: true });
    txs = [];

    // En mora con la suscripción viva: Creem reintenta sola, y un cobro aparte serían dos.
    const leadMora = ids++;
    db.leads.push({ id: leadMora, workspace_id: PLATAFORMA, nombre: 'Mora', email: 'mora@ejemplo.com', estado_lead: 'abierto', pipeline_stage: 'lead', created_at: iso(hoy), telefono: null, telefono_normalizado: null, cliente_ws: null });
    const m = unNegocio('completo', 'esencial', 47, { lead_id: leadMora, pagado_at: iso(hoy - 40 * DIA), created_at: iso(hoy - 40 * DIA), motivo: 'Falló el cobro de la renovación: Creem: past_due' });
    db.pagos.filter((p) => p.cobro_id === m.cobroId).forEach((p) => { p.fecha_pago = iso(hoy - 40 * DIA).slice(0, 10); });
    subs.get(m.susId)!.status = 'past_due';
    const antes = db.cobros.length;
    out.moraViva = { r: await pagarDeuda(m.ws, { crear: true }), cobrosNuevos: db.cobros.length - antes, cliente: `cu_${m.ws}` };
    // El portal no contesta: se le dice que está en proceso, sin abrir nada.
    sinPortal = true;
    out.moraSinPortal = await pagarDeuda(m.ws, { crear: true });
    sinPortal = false;
    // Creem ya la canceló y el aviso se perdió: ahí sí, el cobro aparte.
    subs.get(m.susId)!.status = 'canceled';
    const antes2 = db.cobros.length;
    out.moraCancelada = { r: await pagarDeuda(m.ws, { crear: true }), cobrosNuevos: db.cobros.length - antes2 };
  }

  // ── LA BAJA ──
  {
    const n = unNegocio('completo', 'esencial', 47);
    const fin = subs.get(n.susId)!.current_period_end_date;
    limpiar(); aMercadoPago = 0;
    const r = await cobros.darDeBajaMiPlan(n.ws, 'Dueño');
    out.baja = { ok: r.ok, finAt: r.finAt, finEsElDelPeriodo: r.finAt === fin, enCreem: subs.get(n.susId)!.status, modo: posts.find((x) => x.ruta.endsWith('/cancel'))?.body?.mode ?? null, aMp: aMercadoPago, enBase: cobroDb(n.cobroId).suscripcion_estado };
  }

  console.log(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
