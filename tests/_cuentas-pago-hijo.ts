// =============================================================================
// Hijo de tests/cuentas-pago.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Varias cuentas de Stripe y de Mercado Pago en UN negocio (22/10/2026). lib/cobros-conexion.ts, lib/cuentas-pago-server.ts
// y lib/cobros-webhook.ts llevan `server-only`: corren en un node aparte con `--conditions=react-server` y le contestan al
// test con un JSON. Sin red ni base: `fetch` contesta la API de Stripe, la de Mercado Pago y el PostgREST de Supabase
// (tests/_postgrest-de-mentira.ts). Lo que se prueba es lo que decide este repo: qué queda de cada cuenta, a quién rutea
// cada aviso, y que una cuenta nunca toque lo de la otra.

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';

type Resp = { status: number; body: unknown };

const pg = crearPostgrest({ tablas: ['credenciales', 'webhook_routing', 'credenciales_auditoria', 'cobros', 'cobro_etapa_vinculos'] });
const db = pg.db;
let cuentasStripe: Record<string, Resp> = {};
let cuentasMp: Record<string, Resp> = {};
let endpoints: Array<{ id: string; url: string; metadata?: Record<string, string> }> = [];
let nAviso = 0;
/** Una lectura de `credenciales` por ESTA clave contesta 500: la base que no contesta, a mitad de camino. */
let fallarClave: string | null = null;

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function stripe(u: URL, init: RequestInit): Promise<Response> {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const key = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
  if (u.pathname === '/v1/account') {
    const r = cuentasStripe[key] ?? { status: 401, body: { error: { message: 'Invalid API Key provided' } } };
    return json(r.status, r.body);
  }
  if (u.pathname === '/v1/webhook_endpoints' && metodo === 'GET') return json(200, { data: endpoints });
  if (u.pathname.startsWith('/v1/webhook_endpoints/') && metodo === 'DELETE') {
    const id = decodeURIComponent(u.pathname.split('/').pop() ?? '');
    endpoints = endpoints.filter((e) => e.id !== id);
    return json(200, { id, deleted: true });
  }
  if (u.pathname.startsWith('/v1/webhook_endpoints/') && metodo === 'POST') {
    const id = decodeURIComponent(u.pathname.split('/').pop() ?? '');
    return json(200, endpoints.find((e) => e.id === id) ?? {});
  }
  if (u.pathname === '/v1/webhook_endpoints' && metodo === 'POST') {
    const url = new URLSearchParams(String(init.body ?? '')).get('url') ?? '';
    nAviso += 1;
    const e = { id: `we_${nAviso}`, url, metadata: { mako: '1' } };
    endpoints.push(e);
    return json(200, { ...e, secret: `whsec_prueba${nAviso}AAAAAAAAAAAAAAAAAAAA` });
  }
  // La relectura de un pago: no hace falta contestarla, el corte de la cuenta va ANTES.
  return json(404, { error: { message: `sin mock: ${metodo} ${u.pathname}` } });
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    if (fallarClave && u.pathname.endsWith('/credenciales') && u.searchParams.get('clave') === `eq.${fallarClave}`) {
      return json(500, { code: 'XX000', message: 'la base no contesta' });
    }
    return pg.responder(u, init);
  }
  if (u.host === 'api.stripe.com') return stripe(u, init);
  if (u.host === 'api.mercadopago.com' && u.pathname === '/users/me') {
    const token = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
    const r = cuentasMp[token] ?? { status: 401, body: { message: 'invalid_token' } };
    return json(r.status, r.body);
  }
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.APP_BASE_URL = 'https://mako.test';

async function main() {
  const { descubrirStripe, descubrirMercadoPago, descubrirPasarela, desconectarPasarela } = await import('../lib/cobros-conexion');
  const { credDelCliente, eliminarCredencial, hidratarCredenciales } = await import('../lib/credenciales');
  const { cuentasDePago, proximaCuentaDe, credStripeDe, credMpDe, cuentaDeIdentificador, guardarAliasCuenta } = await import('../lib/cuentas-pago-server');
  const { procesarEventoStripe } = await import('../lib/cobros-webhook');
  const { runWithWorkspace } = await import('../lib/workspace');

  const WS = 13;
  const KEY_A = 'rk_live_CUENTAaaaaaaaaaaaaaa';
  const KEY_B = 'rk_live_CUENTAbbbbbbbbbbbbbb';
  /** La clave de PRUEBA de la misma cuenta A: Stripe devuelve el mismo `acct`. */
  const KEY_A_PRUEBA = 'rk_test_CUENTAaaaaaaaaaaaaaa';
  const TOKEN_A = 'APP_USR-1111111111111111-101112-aaaaaaaa-111';
  const TOKEN_B = 'APP_USR-2222222222222222-101112-bbbbbbbb-222';
  const cuenta = (id: string) => ({ status: 200, body: { id, country: 'MX', default_currency: 'mxn', charges_enabled: true, email: 'dueno@negocio.test' } });

  function reset() {
    pg.vaciar();
    endpoints = [];
    fallarClave = null;
    cuentasStripe = { [KEY_A]: cuenta('acct_A'), [KEY_B]: cuenta('acct_B'), [KEY_A_PRUEBA]: cuenta('acct_A') };
    cuentasMp = {
      [TOKEN_A]: { status: 200, body: { id: 111, site_id: 'MLM', nickname: 'NEGOCIO', tags: [] } },
      [TOKEN_B]: { status: 200, body: { id: 222, site_id: 'MLA', nickname: 'OTRO', tags: [] } },
    };
  }
  const ruteo = () => db.webhook_routing.map((f) => `${f.servicio}/${f.identificador}→${f.workspace_id}`).sort();
  const claves = (ws = WS) => db.credenciales.filter((f) => f.workspace_id === ws).map((f) => String(f.clave)).sort();
  const lista = async (p: 'stripe' | 'mercadopago') => (await cuentasDePago(WS, p)).map((c) => `${c.id}|${c.nombre}|${c.conectada ? 'cobra' : 'no'}`);
  /** Las dos cuentas de Stripe conectadas: la principal (acct_A) y la «Tienda» (acct_B, c2). */
  async function dosCuentas() {
    await descubrirStripe(WS, KEY_A, 'test');
    const c = await proximaCuenta('stripe');
    const r = await descubrirPasarela('stripe', WS, KEY_B, 'test', { guardarClave: true, cuenta: c });
    await guardarAliasCuenta(WS, 'stripe', c, 'Tienda', 'test');
    return { c, r };
  }
  const proximaCuenta = (p: 'stripe' | 'mercadopago') => proximaCuentaDe(WS, p);
  const out: Record<string, unknown> = {};

  // 1. Dos cuentas de Stripe: cada una con sus claves, su ruteo y su aviso (el de la segunda con SU ?acct=).
  reset();
  const d = await dosCuentas();
  out.dos = { c: d.c, ok: d.r.ok, cuentas: await lista('stripe'), ruteo: ruteo(), avisos: endpoints.map((e) => e.url), claves: claves() };

  // 2. La MISMA cuenta de Stripe otra vez (como tercera): no, y nada guardado.
  const antes = claves();
  const rep = await descubrirPasarela('stripe', WS, KEY_A, 'test', { guardarClave: true, cuenta: 'c3' });
  out.repetida = { ok: rep.ok, error: rep.ok ? null : rep.error, igual: JSON.stringify(antes) === JSON.stringify(claves()) };

  // 3. De qué cuenta es cada identificador, y las claves de cada una.
  out.identificador = {
    b: await cuentaDeIdentificador(WS, 'stripe', 'acct_B'), a: await cuentaDeIdentificador(WS, 'stripe', 'acct_A'), z: await cuentaDeIdentificador(WS, 'stripe', 'acct_Z'),
    keyC2: (await credStripeDe(WS, 'c2'))?.key === KEY_B, keyPrincipal: (await credStripeDe(WS, 'principal'))?.key === KEY_A,
  };

  // 4. Un aviso de la cuenta c2 nunca aplica un cobro de la principal (y al revés). Si pasa el corte, relee (404 → tira).
  const TOKEN = 'tokTokTokTokTokTokTokTokTokTok12';
  const cobro = (cuentaCobro: string | null): Fila => ({
    id: 77, workspace_id: WS, lead_id: 5, proveedor: 'stripe', modo: 'real', token: TOKEN, estado: 'pendiente', tipo: 'unico',
    monto: 10, moneda: 'USD', monto_usd: 10, cuenta: cuentaCobro, proveedor_ref: 'cs_X', created_at: '2026-10-22T00:00:00Z',
  });
  const ev = { id: 'evt_1', tipo: 'checkout.session.completed', livemode: true, objeto: { id: 'cs_X', payment_status: 'paid', metadata: { mako_cobro: TOKEN } } };
  const aviso = async (cuentaCobro: string | null, cuentaAviso: string) => {
    db.cobros = [cobro(cuentaCobro)];
    try {
      const r = await runWithWorkspace(WS, () => procesarEventoStripe(WS, ev as never, cuentaAviso));
      return `${r.estado}: ${r.motivo ?? ''}`;
    } catch (e) {
      return `tira: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  out.aviso = {
    principalPorC2: await aviso(null, 'c2'),
    c2PorPrincipal: await aviso('c2', 'principal'),
    c2PorC2: await aviso('c2', 'c2'),
    principalPorPrincipal: await aviso(null, 'principal'),
  };

  // 5. Desconectar UNA: se van sus claves, su nombre, su ruteo y su aviso; la principal queda entera.
  {
    const r = await desconectarPasarela(WS, 'stripe', 'test', 'c2');
    out.desconectaUna = { ok: r.ok, cuentas: await lista('stripe'), ruteo: ruteo(), avisos: endpoints.map((e) => e.url), claves: claves() };
  }

  // 6. La próxima cuenta nunca hereda el sufijo de una que se fue y dejó cobros o vínculos.
  db.cobros = [];
  const libre = await proximaCuenta('stripe');
  db.cobros = [{ id: 1, workspace_id: WS, proveedor: 'stripe', cuenta: 'c2' }];
  const conCobro = await proximaCuenta('stripe');
  db.cobro_etapa_vinculos = [{ id: 1, workspace_id: WS, producto_id: 3, cuentas: ['stripe:c4', 'mercadopago:c7'] }];
  const conVinculo = await proximaCuenta('stripe');
  db.cobros = [{ id: 2, workspace_id: 99, proveedor: 'stripe', cuenta: 'c9' }];
  db.cobro_etapa_vinculos = [];
  const deOtroNegocio = await proximaCuenta('stripe');
  out.noReusa = { libre, conCobro, conVinculo, deOtroNegocio };

  // 7. Borrar el id de UNA cuenta suelta SU ruteo, no el de las otras.
  reset();
  await dosCuentas();
  await eliminarCredencial(WS, 'STRIPE_ACCOUNT_ID');
  out.eliminarUna = { ruteo: ruteo() };

  // 8. Mercado Pago, dos cuentas: cada una con su token y su user_id.
  reset();
  await descubrirMercadoPago(WS, TOKEN_A, 'test');
  const cMp = await proximaCuenta('mercadopago');
  const rMp = await descubrirPasarela('mercadopago', WS, TOKEN_B, 'test', { guardarClave: true, cuenta: cMp });
  out.mp = {
    c: cMp, ok: rMp.ok, cuentas: await lista('mercadopago'), ruteo: ruteo(),
    userC2: (await credMpDe(WS, cMp))?.userId ?? null, tokenC2: (await credMpDe(WS, cMp))?.token === TOKEN_B,
    de222: await cuentaDeIdentificador(WS, 'mercadopago', '222'),
  };

  // 9. La cuenta de un aviso se busca ESTRICTA: con la base caída a mitad de camino, tira (no «de ninguna»).
  reset();
  await dosCuentas();
  fallarClave = 'STRIPE_ACCOUNT_ID__C2';
  let estricta: string;
  try { estricta = `devolvió ${String(await cuentaDeIdentificador(WS, 'stripe', 'acct_B'))}`; } catch (e) { estricta = `tira: ${e instanceof Error ? e.message : String(e)}`; }
  fallarClave = null;
  out.estricta = estricta;

  // 10. Las claves de la segunda cuenta (y su nombre) del ws1 NO van a process.env: ni al conectar ni en el boot.
  reset();
  const DUENO = 1;
  const ENV = ['STRIPE_SECRET_KEY__C2', 'STRIPE_ACCOUNT_ID__C2', 'STRIPE_WEBHOOK_SECRET__C2', 'STRIPE_ALIAS__C2', 'STRIPE_ALIAS'];
  for (const k of ENV) delete process.env[k];
  await descubrirStripe(DUENO, KEY_A, 'test');
  await descubrirPasarela('stripe', DUENO, KEY_B, 'test', { guardarClave: true, cuenta: 'c2' });
  await guardarAliasCuenta(DUENO, 'stripe', 'c2', 'Tienda', 'test');
  await guardarAliasCuenta(DUENO, 'stripe', 'principal', 'Casa', 'test');
  await hidratarCredenciales();
  out.env = {
    enEnv: ENV.filter((k) => process.env[k] != null),
    guardadas: (await Promise.all(ENV.map((k) => credDelCliente(k, DUENO)))).filter(Boolean).length,
  };

  // 11. Renombrar: el nombre nuevo; vacío vuelve al de siempre («Stripe 2»).
  reset();
  await dosCuentas();
  await guardarAliasCuenta(WS, 'stripe', 'c2', '  Tienda\u0007 online  ', 'test');
  const renombrada = await lista('stripe');
  await guardarAliasCuenta(WS, 'stripe', 'c2', '   ', 'test');
  out.renombrar = { renombrada, sinNombre: await lista('stripe') };

  // 12. Una cuenta de OTRO negocio, como segunda: 409 «ocupada» y nada guardado (ni su ruteo cambia de dueño).
  reset();
  await descubrirStripe(WS, KEY_A, 'test');
  db.credenciales.push({ workspace_id: 99, clave: 'STRIPE_ACCOUNT_ID', valor_enc: 'x', servicio: 'stripe' });
  db.webhook_routing.push({ servicio: 'stripe', identificador: 'acct_B', workspace_id: 99 });
  const antesAjena = claves();
  let ajena: unknown;
  try {
    const r = await descubrirPasarela('stripe', WS, KEY_B, 'test', { guardarClave: true, cuenta: 'c2' });
    ajena = { ok: r.ok, status: r.ok ? null : r.status, nadaGuardado: r.ok ? null : r.nadaGuardado };
  } catch (e) {
    ajena = { tira: e instanceof Error ? e.message : String(e) };
  }
  out.ajena = { r: ajena, igual: JSON.stringify(antesAjena) === JSON.stringify(claves()), ruteo: ruteo() };

  // ── Lo de la revisión de plata (22/10/2026) ──
  const { cuentaParaConectar } = await import('../lib/cuentas-pago-server');
  const { urlParaPagar, refParaCobrar } = await import('../lib/cobros');
  const { integracionConectada } = await import('../lib/credenciales');

  // 13. La MISMA cuenta que se desconecta y vuelve: el sufijo de SUS cobros. Y conectada con otro sufijo igual, sus avisos
  //     la siguen encontrando por su id en el proveedor.
  reset();
  await dosCuentas();
  db.cobros = [{ ...cobro('c2'), cuenta_ref: 'acct_B' }];
  await desconectarPasarela(WS, 'stripe', 'test', 'c2');
  const vuelve = await cuentaParaConectar(WS, 'stripe', 'acct_B');
  await descubrirPasarela('stripe', WS, KEY_B, 'test', { guardarClave: true, cuenta: 'c3' });
  /** El aviso de una cuenta sobre un cobro que dice su id en el proveedor (`cuenta_ref`). */
  const avisoConRef = async (cuentaCobro: string | null, ref: string, cuentaAviso: string) => {
    db.cobros = [{ ...cobro(cuentaCobro), cuenta_ref: ref }];
    try {
      const r = await runWithWorkspace(WS, () => procesarEventoStripe(WS, ev as never, cuentaAviso));
      return `${r.estado}: ${r.motivo ?? ''}`;
    } catch (e) {
      return `tira: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  out.vuelve = {
    sufijo: vuelve,
    // B volvió como c3: el cobro (c2, acct_B) es suyo; el aviso de la principal (acct_A) no.
    avisoPorC3: await avisoConRef('c2', 'acct_B', 'c3'),
    avisoPorPrincipal: await avisoConRef('c2', 'acct_B', 'principal'),
  };

  // 14. En qué cuenta entra «Conectar otra»: la misma si ya está; la principal sólo sin ninguna; si no, la que sigue.
  reset();
  const sinNinguna = await cuentaParaConectar(WS, 'stripe', 'acct_C');
  await dosCuentas();
  const yaEsta = await cuentaParaConectar(WS, 'stripe', 'acct_B');
  await desconectarPasarela(WS, 'stripe', 'test', 'principal');
  const sinPrincipal = await cuentaParaConectar(WS, 'stripe', 'acct_C');
  out.paraConectar = { sinNinguna, yaEsta, sinPrincipal };

  // 14b. «Conectar otra» con la clave de PRUEBA de la principal (mismo acct): «ya está conectada», y la real queda.
  reset();
  await descubrirStripe(WS, KEY_A, 'test');
  const rPrueba = await descubrirPasarela('stripe', WS, KEY_A_PRUEBA, 'test', { guardarClave: true, cuenta: await cuentaParaConectar(WS, 'stripe', 'acct_A') });
  out.pruebaSobreReal = {
    r: { ok: rPrueba.ok, status: rPrueba.ok ? null : rPrueba.status },
    keyPrincipal: (await credStripeDe(WS, 'principal'))?.key === KEY_A,
    claves: claves(),
  };

  // 15. Borrar el id de una cuenta que NO descifra suelta su ruteo, y no el de las otras.
  reset();
  await dosCuentas();
  for (const f of db.credenciales) if (f.clave === 'STRIPE_ACCOUNT_ID__C2') f.valor_enc = 'no-descifra';
  await eliminarCredencial(WS, 'STRIPE_ACCOUNT_ID__C2');
  out.ilegible = { ruteo: ruteo() };

  // 15b. Si el id de OTRA cuenta tampoco se lee, no se suelta NADA (soltar de más corta los avisos de una cuenta que cobra).
  reset();
  await dosCuentas();
  for (const f of db.credenciales) if (f.clave === 'STRIPE_ACCOUNT_ID__C2' || f.clave === 'STRIPE_ACCOUNT_ID') f.valor_enc = 'no-descifra';
  await eliminarCredencial(WS, 'STRIPE_ACCOUNT_ID__C2');
  out.ilegibleOtra = { ruteo: ruteo() };

  // 16. /pagar: un link de Mercado Pago de una cuenta desconectada no abre (antes devolvía la URL vieja y el pago se perdía).
  reset();
  await descubrirMercadoPago(WS, TOKEN_A, 'test');
  await descubrirPasarela('mercadopago', WS, TOKEN_B, 'test', { guardarClave: true, cuenta: 'c2' });
  const linkMp = { ...cobro('c2'), proveedor: 'mercadopago', cuenta_ref: '222', url_proveedor: 'https://www.mercadopago.com/checkout/x' } as never;
  const conectadaMp = await urlParaPagar(linkMp);
  await desconectarPasarela(WS, 'mercadopago', 'test', 'c2');
  const desconectadaMp = await urlParaPagar(linkMp);
  out.pagar = { conectadaMp, desconectadaMp };

  // 17. La tarjeta de Stripe dice «conectada» con sólo una cuenta de más (la principal desconectada).
  reset();
  const ninguna = await integracionConectada('stripe', WS);
  await dosCuentas();
  await desconectarPasarela(WS, 'stripe', 'test', 'principal');
  out.tarjeta = { ninguna, soloC2: await integracionConectada('stripe', WS) };

  // 17b. LA TARJETA DE APIFY con sólo una clave EXTRA (6/11/2026). El cliente que borró la 1 y dejó la 2 veía «Sin conectar»
  //      con Spy leyendo perfecto. Sólo la 1 es requerida; las `_2`…`_5` son opcionales, y Spy anda con cualquiera.
  {
    const { guardarCredencial } = await import('../lib/credenciales');
    reset();
    const sinNinguna = await integracionConectada('apify-instagram', WS);
    await guardarCredencial(WS, 'APIFY_INSTAGRAM_TOKEN_2', 'apify_api_SEGUNDAcuentaDELnegocio', 'apify-instagram', 'test');
    const soloLa2 = await integracionConectada('apify-instagram', WS);
    reset();
    await guardarCredencial(WS, 'APIFY_INSTAGRAM_TOKEN', 'apify_api_PRIMERAcuentaDELnegocio', 'apify-instagram', 'test');
    const soloLa1 = await integracionConectada('apify-instagram', WS);
    // Un NOMBRE de clave guardado solo (sin su token) no es una conexión: es un campo opcional que no sirve para leer nada.
    reset();
    await guardarCredencial(WS, 'APIFY_INSTAGRAM_TOKEN_2_ACCOUNT', 'Otra cuenta', 'apify-instagram', 'test');
    const soloElNombre = await integracionConectada('apify-instagram', WS);
    out.apify = { sinNinguna, soloLa2, soloLa1, soloElNombre };
  }

  // 18. La cuenta con que cobraría un producto vinculado sólo a la segunda (la landing compara con ésta).
  reset();
  await dosCuentas();
  db.cobro_etapa_vinculos = [{ id: 1, workspace_id: WS, funnel_id: 4, etapa: 'ganado', producto_id: 9, cuentas: ['stripe:c2'] }];
  out.refParaCobrar = { vinculado: await refParaCobrar(WS, 'stripe', 9), suelto: await refParaCobrar(WS, 'stripe', 10) };

  // 19. Anular un link cuya cuenta no se puede leer (la base cae a mitad): el cobro queda anulado y anular NO tira.
  //     Antes cortaba con el cobro ya anulado: «No pude anular» de algo anulado.
  {
    const { anularCobro } = await import('../lib/cobros');
    reset();
    await dosCuentas();
    db.cobros = [{ ...cobro('c2'), cuenta_ref: 'acct_B', proveedor_ref: 'cs_X', lead_id: null }];
    fallarClave = 'STRIPE_ACCOUNT_ID__C2';
    let anular: unknown;
    try { anular = await runWithWorkspace(WS, () => anularCobro(WS, 77, 'test')); } catch (e) { anular = { tira: e instanceof Error ? e.message : String(e) }; }
    fallarClave = null;
    out.anular = { r: anular, estado: db.cobros[0]?.estado ?? null };
  }

  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main();

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
