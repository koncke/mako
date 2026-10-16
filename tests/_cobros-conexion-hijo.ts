// =============================================================================
// Hijo de tests/cobros-conexion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/cobros-conexion.ts y todo lo que toca (credenciales, webhook-routing, stripe-api) llevan
// `server-only`, así que node:test no los puede importar: este archivo corre en un node aparte con
// `--conditions=react-server` (el precedente es tests/agenda-whatsapp.test.ts) y le contesta al
// test con un JSON.
//
// No hay red ni base: `fetch` es de mentira y contesta las tres cosas que se tocan —la API de
// Stripe, la de Mercado Pago y el PostgREST de Supabase (credenciales, webhook_routing y la
// auditoría)—. Lo que se prueba es lo que decide el código de ESTE repo: qué se guarda, en qué
// orden, y qué NO se guarda cuando algo falla.

type Fila = Record<string, unknown>;
type Resp = { status: number; body: unknown };

const db: Record<string, Fila[]> = { credenciales: [], webhook_routing: [], credenciales_auditoria: [] };
/** Lo que pasó, en orden: «db POST credenciales STRIPE_SECRET_KEY», «stripe POST /v1/webhook_endpoints»… */
let log: string[] = [];
let cuentasStripe: Record<string, Resp> = {};
let cuentasMp: Record<string, Resp> = {};
let endpoints: Array<{ id: string; url: string; metadata?: Record<string, string> }> = [];
let falloAlCrearAviso: Resp | null = null;
let falloAlBorrarAviso: Resp | null = null;
let nAviso = 0;

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function filtros(u: URL): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push([k, v.slice(3)]);
  }
  return out;
}
const cumple = (f: Fila, fs: Array<[string, string]>) => fs.every(([k, v]) => String(f[k]) === v);

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  const filas = (db[tabla] ??= []);
  const metodo = (init.method ?? 'GET').toUpperCase();
  const fs = filtros(u);
  if (metodo === 'GET') return json(200, filas.filter((f) => cumple(f, fs)));
  if (metodo === 'DELETE') {
    const quedan = filas.filter((f) => !cumple(f, fs));
    log.push(`db DELETE ${tabla} ${fs.map(([k, v]) => `${k}=${v}`).join('&')}`);
    db[tabla] = quedan;
    return json(204, undefined);
  }
  // POST: insert o upsert (`on_conflict` + `Prefer: resolution=…`).
  const prefer = new Headers(init.headers).get('Prefer') ?? '';
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
  const conflicto = (u.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
  for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
    log.push(`db POST ${tabla} ${String(fila.clave ?? fila.identificador ?? '')}`.trim());
    const previa = conflicto.length ? filas.find((f) => conflicto.every((c) => String(f[c]) === String(fila[c]))) : undefined;
    if (!previa) filas.push({ ...fila });
    else if (!prefer.includes('ignore-duplicates')) Object.assign(previa, fila);
  }
  return json(201, undefined);
}

async function stripe(u: URL, init: RequestInit): Promise<Response> {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const key = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
  log.push(`stripe ${metodo} ${u.pathname}`);
  if (u.pathname === '/v1/account') {
    const r = cuentasStripe[key] ?? { status: 401, body: { error: { message: 'Invalid API Key provided' } } };
    return json(r.status, r.body);
  }
  if (u.pathname === '/v1/webhook_endpoints' && metodo === 'GET') return json(200, { data: endpoints });
  if (u.pathname.startsWith('/v1/webhook_endpoints/') && metodo === 'DELETE') {
    if (falloAlBorrarAviso) return json(falloAlBorrarAviso.status, falloAlBorrarAviso.body);
    const id = decodeURIComponent(u.pathname.split('/').pop() ?? '');
    endpoints = endpoints.filter((e) => e.id !== id);
    return json(200, { id, deleted: true });
  }
  if (u.pathname === '/v1/webhook_endpoints' && metodo === 'POST') {
    if (falloAlCrearAviso) return json(falloAlCrearAviso.status, falloAlCrearAviso.body);
    const url = new URLSearchParams(String(init.body ?? '')).get('url') ?? '';
    nAviso += 1;
    const e = { id: `we_${nAviso}`, url };
    endpoints.push(e);
    return json(200, { ...e, secret: `whsec_prueba${nAviso}AAAAAAAAAAAAAAAAAAAA` });
  }
  return json(404, { error: { message: `sin mock: ${metodo} ${u.pathname}` } });
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return postgrest(u, init);
  if (u.host === 'api.stripe.com') return stripe(u, init);
  if (u.host === 'api.mercadopago.com' && u.pathname === '/users/me') {
    const token = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
    log.push('mp GET /users/me');
    const r = cuentasMp[token] ?? { status: 401, body: { message: 'invalid_token' } };
    return json(r.status, r.body);
  }
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';
process.env.APP_BASE_URL = 'https://mako.test';

// El paquete es CommonJS: sin `await` de primer nivel, todo va adentro de main().
async function main() {
  const { descubrirStripe, descubrirMercadoPago, desconectarPasarela } = await import('../lib/cobros-conexion');
  const { credDelCliente, hidratarCredenciales } = await import('../lib/credenciales');
  const { cifrar } = await import('../lib/cripto-credenciales');

  const PLATAFORMA = 9;
  const CLIENTE = 13;
  const KEY_A = 'rk_live_CUENTAaaaaaaaaaaaaaa';
  const KEY_B = 'rk_live_CUENTAbbbbbbbbbbbbbb';
  const MALA = 'rk_live_ROTAxxxxxxxxxxxxxxxx';
  const TOKEN_A = 'APP_USR-1111111111111111-101112-aaaaaaaa-111';
  const TOKEN_B = 'APP_USR-2222222222222222-101112-bbbbbbbb-222';
  const cuenta = (id: string) => ({ status: 200, body: { id, country: 'MX', default_currency: 'mxn', charges_enabled: true, email: 'dueno@negocio.test' } });

  function reset() {
    for (const t of Object.keys(db)) db[t] = [];
    log = [];
    endpoints = [];
    falloAlCrearAviso = null;
    falloAlBorrarAviso = null;
    cuentasStripe = { [KEY_A]: cuenta('acct_A'), [KEY_B]: cuenta('acct_B') };
    cuentasMp = {
      [TOKEN_A]: { status: 200, body: { id: 111, site_id: 'MLM', nickname: 'NEGOCIO', email: 'dueno@negocio.test', tags: [] } },
      [TOKEN_B]: { status: 200, body: { id: 222, site_id: 'MLA', nickname: 'OTRO', tags: ['test_user'] } },
    };
  }
  /** Una credencial ya guardada (cifrada como la guarda el código) y, si rutea, su fila. */
  function sembrar(ws: number, clave: string, valor: string, ruteo?: string) {
    db.credenciales.push({ workspace_id: ws, clave, valor_enc: cifrar(valor, ws, clave), servicio: 'x' });
    if (ruteo) db.webhook_routing.push({ servicio: ruteo, identificador: valor, workspace_id: ws });
  }
  const ruteo = () => db.webhook_routing.map((f) => `${f.servicio}/${f.identificador}→${f.workspace_id}`).sort();
  const leer = async (ws: number, ...claves: string[]) =>
    Object.fromEntries(await Promise.all(claves.map(async (c) => [c, await credDelCliente(c, ws)] as const)));

  const STRIPE = ['STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT_ID', 'STRIPE_WEBHOOK_SECRET'];
  const MP = ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_USER_ID', 'MERCADOPAGO_WEBHOOK_SECRET'];
  const out: Record<string, unknown> = {};

  // 1. Stripe no acepta la clave → no se guarda NADA (ni la clave, ni la cuenta, ni el aviso).
  reset();
  out.claveRota = { r: await descubrirStripe(PLATAFORMA, MALA, 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo(), log };

  // 2. La clave sirve → cuenta reclamada ANTES que la clave, aviso registrado con `?acct=`, firma guardada.
  reset();
  out.conecta = { r: await descubrirStripe(PLATAFORMA, KEY_A, 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo(), endpoints, log };

  // 3. La cuenta ya es de OTRO workspace → 409 y nada guardado (tampoco la clave).
  reset();
  sembrar(CLIENTE, 'STRIPE_ACCOUNT_ID', 'acct_A', 'stripe');
  out.ocupada = { r: await descubrirStripe(PLATAFORMA, KEY_A, 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo(), log };

  // 4. Cambio de cuenta → la vieja se suelta del ruteo y la firma es la nueva.
  reset();
  sembrar(PLATAFORMA, 'STRIPE_ACCOUNT_ID', 'acct_A', 'stripe');
  sembrar(PLATAFORMA, 'STRIPE_WEBHOOK_SECRET', 'whsec_viejaDeLaCuentaAaaaaaaaaaaa');
  out.cambio = { r: await descubrirStripe(PLATAFORMA, KEY_B, 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo() };

  // 5. Cambio de cuenta y el aviso NO se puede registrar (falta el permiso) → la clave y la cuenta
  //    quedan, la firma vieja (de otra cuenta) se borra, y el resultado dice que está a medias.
  reset();
  sembrar(PLATAFORMA, 'STRIPE_ACCOUNT_ID', 'acct_A', 'stripe');
  sembrar(PLATAFORMA, 'STRIPE_WEBHOOK_SECRET', 'whsec_viejaDeLaCuentaAaaaaaaaaaaaa');
  falloAlCrearAviso = { status: 403, body: { error: { message: "Having the 'rak_webhook_write' permission would allow this request to continue." } } };
  out.sinPermiso = { r: await descubrirStripe(PLATAFORMA, KEY_B, 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo() };

  // 6. Volver a conectar con la clave guardada (guardarClave: false) no reescribe la clave.
  reset();
  sembrar(PLATAFORMA, 'STRIPE_SECRET_KEY', KEY_A);
  out.reconecta = { r: await descubrirStripe(PLATAFORMA, KEY_A, 'test', { guardarClave: false }), log };

  // 7. Mercado Pago: token roto → nada; token bueno → la cuenta y el token.
  reset();
  out.mpRoto = { r: await descubrirMercadoPago(CLIENTE, 'APP_USR-9999999999999999-101112-cccccccc-999', 'test'), creds: await leer(CLIENTE, ...MP), ruteo: ruteo() };
  reset();
  out.mpConecta = { r: await descubrirMercadoPago(CLIENTE, TOKEN_A, 'test'), creds: await leer(CLIENTE, ...MP), ruteo: ruteo(), log };

  // 8. Mercado Pago, cambio de cuenta → se suelta la vieja y se borra la clave del aviso (era de la otra).
  reset();
  sembrar(CLIENTE, 'MERCADOPAGO_USER_ID', '111', 'mercadopago');
  sembrar(CLIENTE, 'MERCADOPAGO_WEBHOOK_SECRET', 'clave-del-aviso-de-la-cuenta-vieja');
  out.mpCambio = { r: await descubrirMercadoPago(CLIENTE, TOKEN_B, 'test'), creds: await leer(CLIENTE, ...MP), ruteo: ruteo() };

  // 9. DESCONECTAR Stripe: se van los tres campos y el ruteo, y de la cuenta de Stripe el aviso de MaKo (el de hoy y
  //    el de un dominio viejo), nunca uno ajeno. La cuenta queda libre para conectarla en otro workspace.
  reset();
  await descubrirStripe(PLATAFORMA, KEY_A, 'test');
  endpoints.push({ id: 'we_dominio_viejo', url: 'https://mako-viejo.test/api/webhooks/stripe?acct=acct_A', metadata: { mako: '1' } });
  endpoints.push({ id: 'we_ajeno', url: 'https://otro-sistema.test/hook' });
  log = [];
  const rDesc = await desconectarPasarela(PLATAFORMA, 'stripe', 'test');
  out.desconecta = { r: rDesc, creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo(), endpoints: [...endpoints], log: [...log] };
  out.desconectaLuegoOtro = { r: await descubrirStripe(CLIENTE, KEY_A, 'test'), ruteo: ruteo() };

  // 10. Stripe no deja borrar el aviso (falta el permiso): se desconecta IGUAL y se dice dónde borrarlo a mano.
  reset();
  await descubrirStripe(PLATAFORMA, KEY_A, 'test');
  falloAlBorrarAviso = { status: 403, body: { error: { message: "Having the 'rak_webhook_write' permission would allow this request to continue." } } };
  out.desconectaSinPermiso = { r: await desconectarPasarela(PLATAFORMA, 'stripe', 'test'), creds: await leer(PLATAFORMA, ...STRIPE), ruteo: ruteo() };

  // 11. DESCONECTAR Mercado Pago: los tres campos y el ruteo; el aviso vive en SU panel y se le dice.
  reset();
  await descubrirMercadoPago(CLIENTE, TOKEN_A, 'test');
  sembrar(CLIENTE, 'MERCADOPAGO_WEBHOOK_SECRET', 'clave-del-aviso-de-la-cuenta');
  out.mpDesconecta = { r: await desconectarPasarela(CLIENTE, 'mercadopago', 'test'), creds: await leer(CLIENTE, ...MP), ruteo: ruteo() };

  // 12. Las claves de cobro del ws1 (Mauricio, un CLIENTE) NO se copian a process.env: ni al conectar (guardarCredencial
  //     refleja al entorno lo del dueño) ni en el boot (hidratarCredenciales). Copiadas ahí, cualquier lectura con
  //     credWs o credWsEstricta de otro camino cobraría con la cuenta de Mauricio. Una clave cualquiera SÍ se hidrata:
  //     es el control de que el camino corre.
  reset();
  const DUENO = 1;
  const ENV_COBRO = [...STRIPE, ...MP];
  for (const k of ENV_COBRO) delete process.env[k];
  delete process.env.X_PRUEBA_HIDRATA;
  await descubrirMercadoPago(DUENO, TOKEN_A, 'test');
  await descubrirStripe(DUENO, KEY_A, 'test');
  sembrar(DUENO, 'X_PRUEBA_HIDRATA', 'si');
  await hidratarCredenciales();
  out.envDelDueno = {
    r: { ok: true },
    creds: Object.fromEntries(ENV_COBRO.map((k) => [k, process.env[k] ?? null])),
    log: [`control=${process.env.X_PRUEBA_HIDRATA ?? ''}`, `guardadas=${(await Promise.all(ENV_COBRO.map((k) => credDelCliente(k, DUENO)))).filter(Boolean).length}`],
  };

  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main();

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
