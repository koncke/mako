// =============================================================================
// Hijo de tests/planes-latam-sin-creem.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El checkout PÚBLICO de los planes desde Latinoamérica fuera de Argentina, el 5/11/2026: Creem rechazó la tienda de MaKo y la
// plataforma ya no tiene sus claves. Corre REALES `ofertasDeLosPlanes`, `ofertaDelPlan` y la ruta POST /api/planes/comprar
// contra el PostgREST de mentira y un Mercado Pago (cuenta argentina) y un Stripe en memoria. Le contesta al test con un JSON:
//   · sólo Mercado Pago argentino conectado: desde México ningún plan se cobra en línea, la página no ofrece pasarela, y una
//     compra de una pestaña vieja (con `pasarela: 'creem'`) queda como PEDIDO con un 200, sin cobro y sin llamar a Creem;
//   · desde Argentina, el mismo plan se cobra con Mercado Pago (no se rompió lo que anda);
//   · con Stripe conectado además, México se cobra con Stripe.
// Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const PLATAFORMA = 9;
const MARCA = '@@HIJO@@';
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'app_settings', 'workspaces', 'usuarios', 'usuario_workspaces', 'cuentas_integracion', 'funnels', 'pedidos_ingreso', 'lead_funnel', 'tickets', 'ticket_eventos', 'errores_app'],
    orCompleto: true,
    defaults: (tabla: string, f: Fila) => {
      const ahora = new Date().toISOString();
      if (tabla === 'leads') return { id: ids++, created_at: ahora, estado_lead: 'abierto', pipeline_stage: 'lead', ...f };
      if (tabla === 'cobros' || tabla === 'lead_audit' || tabla === 'pedidos_ingreso' || tabla === 'tickets') return { id: ids++, created_at: ahora, ...f };
      return { ...f };
    },
  });
  const db = pg.db as Record<string, Fila[]>;
  const afuera: string[] = [];
  let checkoutsStripe = 0;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') {
      for (const [k, v] of [...u.searchParams]) if (v.startsWith('ilike.')) u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      return pg.responder(u, init);
    }
    afuera.push(u.host);
    if (u.host === 'api.mercadopago.com' && u.pathname === '/users/me') return json(200, { id: 77, site_id: 'MLA', country_id: 'AR', email: 'mako@mp.test', test_data: null });
    if (u.host === 'api.stripe.com' && u.pathname === '/v1/checkout/sessions') {
      checkoutsStripe++;
      return json(200, { id: `cs_live_${checkoutsStripe}`, url: `https://checkout.stripe.com/cs_${checkoutsStripe}`, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    }
    if (u.host === 'api.resend.com') return json(200, { id: 'mail' });
    return json(404, { error: { message: `sin doble: ${u.host}${u.pathname}` } });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-L';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';
  delete process.env.CREEM_API_KEY;

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const { POST: comprarRuta } = await imp('app/api/planes/comprar/route.ts');
  const { NextRequest } = await import('next/server');
  const { ofertasDeLosPlanes, ofertaDelPlan } = await imp('lib/compra-plan.ts');
  const { CLAVE_PLANES, PLANES_MAKO_DEFAULT } = await imp('lib/planes-mako.ts');

  const cred = (clave: string, valor: string, servicio: string) => db.credenciales.push({ workspace_id: PLATAFORMA, clave, valor_enc: cifrar(valor, PLATAFORMA, clave), servicio });
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  // Mercado Pago argentino, con precio en pesos (lo que hace que se ofrezca en Argentina, nunca con una tasa). Creem: NADA.
  cred('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-1234567890123456-103012-abcdefabcdefabcdefabcdefabcdefab-777777777', 'mercadopago');
  cred('MERCADOPAGO_USER_ID', '77', 'mercadopago');
  db.app_settings.push({
    workspace_id: PLATAFORMA, key: CLAVE_PLANES,
    value: JSON.stringify((PLANES_MAKO_DEFAULT as Array<Record<string, unknown>>).map((p) => ({ ...p, preciosLocales: { ARS: 97000 } }))),
  });

  let nIp = 0;
  const comprar = async (pais: string, extra: Fila = {}) => {
    const req = new NextRequest('https://mako.test/api/planes/comprar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://mako.test', 'x-forwarded-for': `10.1.0.${++nIp}`, 'x-vercel-ip-country': pais },
      body: JSON.stringify({ plan: 'esencial', nombre: 'Ana Pérez', email: `ana${nIp}@ejemplo.com`, whatsapp: '+52 55 1234 5678', ...extra }),
    });
    const r = await comprarRuta(req);
    return { status: r.status, ...(await r.json() as Fila) };
  };
  const pasarelas = async (pais: string) => ((await ofertaDelPlan('esencial', { pais }))?.pasarelas ?? []).map((x: { pasarela: string }) => x.pasarela);
  const out: Record<string, unknown> = {};

  // ── Sólo Mercado Pago argentino: México, Colombia y Chile sin pasarela. ──
  out.cobrablesMx = (await ofertasDeLosPlanes('MX')).map((x: { plan: { id: string }; cobrable: boolean }) => x.cobrable);
  out.pasarelas = { MX: await pasarelas('MX'), CO: await pasarelas('CO'), CL: await pasarelas('CL'), AR: await pasarelas('AR') };
  const cobrosAntes = db.cobros.length;
  const leadsAntes = db.leads.length;
  out.compraMx = await comprar('MX', { pasarela: 'creem' });
  out.compraMxSinElegir = await comprar('MX');
  out.trasMx = {
    cobros: db.cobros.length - cobrosAntes,
    leads: db.leads.length - leadsAntes,
    pedidos: db.pedidos_ingreso.length,
    detalle: db.pedidos_ingreso.map((f) => String(f.detalle ?? '')),
    eventos: db.lead_audit.map((f) => `${f.accion ?? f.tipo ?? ''}|${f.detalle ?? f.descripcion ?? ''}`).filter((s) => /Pedido de plan/.test(s)).length,
  };
  out.alCreem = afuera.filter((h) => /creem/.test(h)).length;

  // ── Con Stripe conectado además: México se cobra con Stripe, Argentina sigue con Mercado Pago. ──
  cred('STRIPE_SECRET_KEY', 'rk_live_LATAMaaaaaaaaaaaaaaaaaa', 'stripe');
  cred('STRIPE_ACCOUNT_ID', 'acct_LT', 'stripe');
  cred('STRIPE_WEBHOOK_SECRET', 'whsec_LATAM', 'stripe');
  out.conStripe = { MX: await pasarelas('MX'), AR: await pasarelas('AR'), cobrablesMx: (await ofertasDeLosPlanes('MX')).map((x: { cobrable: boolean }) => x.cobrable) };
  out.sinMock = [...pg.sinMock];
  // Después de una marca: lo que se loguea en el camino (la migración de credenciales del entorno) también sale por stdout.
  process.stdout.write(`\n${MARCA}${JSON.stringify(out)}`);
}

main().catch((e) => { process.stdout.write(`\n${MARCA}${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
