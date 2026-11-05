// =============================================================================
// Hijo de tests/spy-varias-claves.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre las funciones REALES con varias claves de Spy (lib/instagram-perfil-server.ts y lib/metodo-verificar.ts, `server-only`)
// en un node aparte con `--conditions=react-server`, con las credenciales de mentira (por `Module._load`) y un Apify de mentira
// que contesta según la CLAVE: «sin crédito» (402), «no entra» (401) o bien. Anota con qué clave salió cada pedido e imprime una
// línea JSON. Las claves son textos de mentira, a propósito largos y reconocibles: el test busca que NO aparezcan en ninguna
// respuesta.
// =============================================================================

export {};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Modulo = require('node:module') as { _load: (pedido: string, padre: unknown, esMain: boolean) => unknown };
const cargarOriginal = Modulo._load;

/** `<ws>:<clave>` → valor. */
let creds: Record<string, string> = {};
const leer = async (clave: string, ws?: number) => creds[`${ws}:${clave}`] ?? null;
const credenciales = {
  credWs: async (clave: string, ws?: number) => creds[`${ws ?? 8}:${clave}`] ?? null,
  credDelCliente: leer,
  credWsEstricta: leer,
  credDelClienteEstricta: leer,
  // Los nombres guardados con esas bases (como la de verdad: sólo nombres, nunca valores).
  clavesGuardadasConBase: async (ws: number, bases: readonly string[]) =>
    Object.keys(creds).filter((k) => k.startsWith(`${ws}:`)).map((k) => k.slice(String(ws).length + 1)).filter((c) => bases.includes(c)),
};
// Lo que el verificador importa de otros módulos y este test no usa: funciones vacías (un stub tiene que llevar CADA nombre).
const vacio = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : async () => null) });
Modulo._load = function (this: unknown, pedido: string, padre: unknown, esMain: boolean) {
  if (/[/\\]credenciales$|^@\/lib\/credenciales$|^\.\/credenciales$/.test(pedido)) return credenciales;
  if (/[/\\]workspace$|^@\/lib\/workspace$|^\.\/workspace$/.test(pedido)) return { wsSuperAdmin: async () => 9, getWorkspaceActual: async () => 8 };
  if (/^\.\/(calcom|mercadopago-api|stripe-api|creem-api)$/.test(pedido)) return vacio;
  return cargarOriginal.call(this, pedido, padre, esMain);
};

/** Cómo contesta Apify a cada clave al correr un actor. */
const COMO: Record<string, 'sin-credito' | 'rota' | 'bien' | 'apurado'> = {
  'clave-uno-sin-credito-XXXX': 'sin-credito',
  'clave-dos-con-credito-YYYY': 'bien',
  'clave-uno-rota-ZZZZ': 'rota',
  'clave-uno-apurada-WWWW': 'apurado',
};
const CREDITO: Record<string, { usado: number; tope: number }> = {
  'clave-uno-sin-credito-XXXX': { usado: 5, tope: 5 },
  'clave-dos-con-credito-YYYY': { usado: 1.5, tope: 5 },
};
const pedidos: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const h = (init.headers ?? {}) as Record<string, string>;
  const token = String(h.Authorization ?? h.authorization ?? '').replace(/^Bearer /, '');
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
  if (u.host !== 'api.apify.com') return json({ error: 'red de mentira' }, 500);
  pedidos.push(`${u.pathname.replace(/^\/v2/, '')} ${Object.keys(COMO).indexOf(token) + 1}`);
  const como = COMO[token];
  if (u.pathname === '/v2/users/me') return como === 'rota' ? json({ error: { type: 'user-or-token-not-found' } }, 401) : json({ data: { username: 'alguien' } });
  if (u.pathname === '/v2/users/me/limits') {
    const c = CREDITO[token];
    return c ? json({ data: { limits: { maxMonthlyUsageUsd: c.tope }, current: { monthlyUsageUsd: c.usado } } }) : json({ error: {} }, 500);
  }
  if (como === 'sin-credito') return json({ error: { type: 'not-enough-usage-to-run-paid-actor', message: 'By launching this job you will exceed the memory limit' } }, 402);
  if (como === 'rota') return json({ error: { type: 'user-or-token-not-found' } }, 401);
  if (como === 'apurado') return json({ error: { type: 'rate-limit-exceeded', message: 'You have exceeded the rate limit' } }, 429);
  const body = JSON.parse(String(init.body ?? '{}')) as { usernames?: string[] };
  return json((body.usernames ?? []).map((usuario) => ({ username: usuario, fullName: 'Por Apify', biography: 'bio', followersCount: 10, latestPosts: [] })), 201);
}) as typeof fetch;
console.warn = () => {};
console.error = () => {};

const limpiar = () => {
  const gg = globalThis as unknown as Record<string, Map<unknown, unknown> | undefined>;
  for (const k of ['__apifyExtras', '__apifyAgotadas', '__igPerfilCache', '__igApifyHoy']) gg[k]?.clear();
};

async function main() {
  const { leerPerfilInstagram, leerPerfilesEnLote } = await import('../lib/instagram-perfil-server');
  const { verificarServicio } = await import('../lib/metodo-verificar');
  const out: Record<string, unknown> = {};
  const correr = async (nombre: string, u: string, opts: Parameters<typeof leerPerfilInstagram>[1]) => {
    pedidos.length = 0;
    const r = await leerPerfilInstagram(u, opts);
    out[nombre] = { ok: r.ok, motivo: r.ok ? null : r.motivo, detalle: r.ok ? null : r.detalle, pedidos: [...pedidos], crudo: JSON.stringify(r) };
  };
  const SPY = { ws: 8, fuentes: ['apify-spy'] as const, variasClaves: true };

  // A: la 1 sin crédito, la 2 con → lee con la 2; y la vuelta siguiente arranca por la 2 (la 1 quedó recordada).
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-sin-credito-XXXX', '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY' };
  await correr('saltaALa2', 'cuenta_a', SPY);
  await correr('arrancaPorLa2', 'cuenta_b', SPY);

  // B: la 1 no entra (401) → no salta: lo dice, con su número.
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-rota-ZZZZ', '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY' };
  await correr('rotaNoSalta', 'cuenta_c', SPY);

  // C: un 429 de «demasiados pedidos» no es falta de crédito → no salta.
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-apurada-WWWW', '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY' };
  await correr('apuradaNoSalta', 'cuenta_d', SPY);

  // D: el alta del CRM (sin `variasClaves`) usa la 1 sola: sin crédito, no toca la 2.
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-sin-credito-XXXX', '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY' };
  await correr('crmSoloLa1', 'cuenta_e', { ws: 8, fuentes: ['meta-plataforma', 'apify', 'apify-spy'] });

  // E: la clave de siempre sola sigue andando sin que nadie haga nada.
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-dos-con-credito-YYYY' };
  await correr('unaSolaAnda', 'cuenta_f', SPY);

  // F: el lote de Spy (el buscador) también salta.
  limpiar();
  creds = { '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-sin-credito-XXXX', '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY' };
  pedidos.length = 0;
  const lote = await leerPerfilesEnLote(['lote_a', 'lote_b'], { ws: 8 });
  out.lote = { ok: [...lote].filter(([, l]) => l.ok).length, pedidos: [...pedidos], crudo: JSON.stringify([...lote]) };

  // G: la tarjeta de Integraciones (el verificador): el crédito de cada clave, con su nombre, y el total. Ninguna clave.
  limpiar();
  creds = {
    '8:APIFY_INSTAGRAM_TOKEN': 'clave-uno-sin-credito-XXXX', '8:APIFY_INSTAGRAM_TOKEN_ACCOUNT': 'Cuenta A',
    '8:APIFY_INSTAGRAM_TOKEN_2': 'clave-dos-con-credito-YYYY', '8:APIFY_INSTAGRAM_TOKEN_2_ACCOUNT': 'Cuenta B',
  };
  const v = await verificarServicio('apify-instagram', {});
  out.verificar = { ...v, crudo: JSON.stringify(v) };
  // H: una de las dos no entra: el verificador dice cuál.
  creds['8:APIFY_INSTAGRAM_TOKEN_2'] = 'clave-uno-rota-ZZZZ';
  const v2 = await verificarServicio('apify-instagram', {});
  out.verificarRota = { ...v2, crudo: JSON.stringify(v2) };
  process.stdout.write(`${JSON.stringify(out)}\n`);
}
main().catch((e) => { console.log(JSON.stringify({ fallo: String(e?.stack ?? e) })); process.exit(1); });
