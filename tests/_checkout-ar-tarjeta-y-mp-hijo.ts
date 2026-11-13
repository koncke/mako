// =============================================================================
// Hijo de tests/checkout-argentina-tarjeta-y-mp.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El checkout de un plan desde Argentina (13/11/2026: «NO apareció el botón de Mercado Pago, sólo tarjeta. Tiene que ofrecer
// tarjeta y Mercado Pago»). Corre REALES `ofertaDelPlan`, `ofertasDeLosPlanes` y la ruta POST /api/planes/comprar contra el
// PostgREST de mentira, una Mercado Pago argentina y un Stripe en memoria, y con las caídas que sacaban a Mercado Pago:
//   · las dos reales: desde Argentina, Mercado Pago Y tarjeta; la compra con tarjeta desde Argentina abre el pago de Stripe;
//   · Mercado Pago que no contesta UNA vez, y el token de Mercado Pago que no se lee UNA vez: igual está;
//   · la Stripe de PRUEBA (como la de la plataforma hoy): al público no; al super admin, sí;
//   · la clave de Stripe que no se lee y Mercado Pago caído: NADA (antes: «sólo tarjeta», con la Stripe de prueba como real).
// Contesta con un JSON después de la marca. Necesita `--conditions=react-server`.
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
  let checkoutsStripe = 0;
  // Las caídas: cuántas veces más falla cada cosa (Infinity = siempre).
  let fallaCuentaMp = 0;
  const fallaClave: Record<string, number> = {};

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') {
      // La lectura del VALOR de una clave (`credDeBase`), no la de los nombres (`pasarelasConectadas`): la base falla.
      // ⚠️ Con un 500, no un 503: postgrest-js ya reintenta solo los 503 y 520 de un GET (3 veces, con 1, 2 y 4 s de espera),
      // así que un 503 de una vez nunca llega a MaKo y la rotura «sin reintento» pasaba igual.
      const clave = (u.searchParams.get('clave') ?? '').replace(/^eq\./, '');
      if (u.pathname.endsWith('/credenciales') && u.searchParams.get('select') === 'valor_enc' && (fallaClave[clave] ?? 0) > 0) {
        fallaClave[clave]--;
        return json(500, { message: 'la base no contestó', code: 'XX000' });
      }
      for (const [k, v] of [...u.searchParams]) if (v.startsWith('ilike.')) u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      return pg.responder(u, init);
    }
    if (u.host === 'api.mercadopago.com' && u.pathname === '/users/me') {
      if (fallaCuentaMp > 0) { fallaCuentaMp--; return json(500, { message: 'internal_error' }); }
      return json(200, { id: 77, site_id: 'MLA', country_id: 'AR', email: 'mako@mp.test', test_data: null });
    }
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
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-A';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';
  delete process.env.CREEM_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Lo que el camino deja en el log (las líneas de `[compra-plan]` que dicen que una pasarela no se ofrece).
  const avisos: string[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => { const s = a.map(String).join(' '); if (s.includes('[compra-plan]')) avisos.push(s); else warn(...a); };

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const { POST: comprarRuta } = await imp('app/api/planes/comprar/route.ts');
  const { NextRequest } = await import('next/server');
  const { ofertasDeLosPlanes, ofertaDelPlan } = await imp('lib/compra-plan.ts');
  const { CLAVE_PLANES, PLANES_MAKO_DEFAULT } = await imp('lib/planes-mako.ts');

  const cred = (clave: string, valor: string, servicio: string) => {
    db.credenciales = db.credenciales.filter((f) => !(f.workspace_id === PLATAFORMA && f.clave === clave));
    db.credenciales.push({ workspace_id: PLATAFORMA, clave, valor_enc: cifrar(valor, PLATAFORMA, clave), servicio });
  };
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  // La Mercado Pago argentina de la plataforma (en pesos) y la Stripe, las dos REALES; el plan con precio en pesos.
  cred('MERCADOPAGO_ACCESS_TOKEN', 'APP_USR-1234567890123456-111312-abcdefabcdefabcdefabcdefabcdefab-777777777', 'mercadopago');
  cred('MERCADOPAGO_USER_ID', '77', 'mercadopago');
  cred('STRIPE_SECRET_KEY', 'rk_live_ARGENTINAaaaaaaaaaaaaaa', 'stripe');
  cred('STRIPE_ACCOUNT_ID', 'acct_AR', 'stripe');
  cred('STRIPE_WEBHOOK_SECRET', 'whsec_AR', 'stripe');
  db.app_settings.push({
    workspace_id: PLATAFORMA, key: CLAVE_PLANES,
    value: JSON.stringify((PLANES_MAKO_DEFAULT as Array<Record<string, unknown>>).map((p) => ({ ...p, preciosLocales: { ARS: 73555 } }))),
  });

  let nIp = 0;
  const comprar = async (pais: string, extra: Fila = {}) => {
    const req = new NextRequest('https://mako.test/api/planes/comprar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://mako.test', 'x-forwarded-for': `10.2.0.${++nIp}`, 'x-vercel-ip-country': pais },
      body: JSON.stringify({ plan: 'esencial', nombre: 'Lucía Gómez', email: `lucia${nIp}@ejemplo.com`, whatsapp: '+54 9 11 5555 1234', ...extra }),
    });
    const r = await comprarRuta(req);
    const j = await r.json() as Fila;
    return { status: r.status, link: typeof j.link === 'string' ? j.link : null, error: j.error ?? null, elegir: Array.isArray(j.elegir) ? (j.elegir as Fila[]).map((x) => x.pasarela) : null };
  };
  const pasarelas = async (pais: string | null, conPrueba = false) =>
    ((await ofertaDelPlan('esencial', { pais, conPrueba }))?.pasarelas ?? []).map((x: { pasarela: string }) => x.pasarela);
  const out: Record<string, unknown> = {};

  // ── 1. Las dos reales. ──
  out.ambas = { AR: await pasarelas('AR'), MX: await pasarelas('MX'), US: await pasarelas('US'), sinPais: await pasarelas(null) };
  out.compraArSinElegir = await comprar('AR');
  out.compraArTarjeta = await comprar('AR', { pasarela: 'stripe' });
  out.checkoutsStripe = checkoutsStripe;

  // ── 2. Mercado Pago no contesta UNA vez; el token no se lee UNA vez. ──
  avisos.length = 0;
  fallaCuentaMp = 1;
  out.mpNoContestaUnaVez = await pasarelas('AR');
  fallaClave.MERCADOPAGO_ACCESS_TOKEN = 1;
  out.tokenNoSeLeeUnaVez = await pasarelas('AR');
  out.avisosConReintento = avisos.length;

  // ── 3. La Stripe de PRUEBA (la de la plataforma hoy). ──
  cred('STRIPE_SECRET_KEY', 'rk_test_ARGENTINAaaaaaaaaaaaaaa', 'stripe');
  out.stripeDePrueba = { publicoAR: await pasarelas('AR'), superAdminAR: await pasarelas('AR', true), publicoMX: await pasarelas('MX') };

  // ── 4. La clave de Stripe (de prueba) no se lee y Mercado Pago no contesta: no hay con qué cobrar. ──
  avisos.length = 0;
  fallaClave.STRIPE_SECRET_KEY = Infinity;
  fallaCuentaMp = Infinity;
  out.todoCaido = {
    AR: await pasarelas('AR'),
    MX: await pasarelas('MX'),
    cobrablesAR: (await ofertasDeLosPlanes('AR')).map((x: { cobrable: boolean }) => x.cobrable),
  };
  out.avisosCaido = avisos.length;
  out.sinMock = [...pg.sinMock];
  process.stdout.write(`\n${MARCA}${JSON.stringify(out)}`);
}

main().catch((e) => { process.stdout.write(`\n${MARCA}${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
