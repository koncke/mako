// =============================================================================
// Hijo de tests/ia-permiso.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre las puertas REALES de la capa de IA adentro de un pedido de mentira (el mismo AsyncLocalStorage que usa Next para `headers()`),
// con un `fetch` que cuenta lo que le llega a un proveedor. Lo único que mira: si salió algo. Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const AL_PROVEEDOR = /openai\.com|groq\.com|anthropic\.com|googleapis\.com|mistral\.ai|cerebras\.ai|openrouter\.ai|elevenlabs\.io/;

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces', 'usuarios', 'credenciales', 'ia_uso', 'chat_cost'] });
  let alProveedor = 0;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (AL_PROVEEDOR.test(u.host)) {
      alProveedor += 1;
      return json(200, { choices: [{ message: { content: 'ok' } }], content: [{ type: 'text', text: 'ok' }], usage: {} });
    }
    if (u.host === 'supa.test') return pg.responder(u, init);
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.GROQ_API_KEY = 'gsk_prueba_de_mentira_0123456789';
  process.env.CHEAP_API_KEY = 'gsk_prueba_de_mentira_0123456789';

  // Lo que Next pone al arrancar su servidor (next/dist/server/node-environment): sin esto, sus storages no cargan.
  (globalThis as unknown as { AsyncLocalStorage: unknown }).AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage;
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');

  /** Corre `fn` adentro de un pedido con ese user agent y sin sesión. */
  const enPedido = <T>(ua: string, fn: () => Promise<T>): Promise<T> => {
    const headers = new Headers({ 'user-agent': ua });
    const store = {
      type: 'request', phase: 'action', implicitTags: { tags: [], expirationsByCacheKind: new Map() },
      url: { pathname: '/api/mako/chat', search: '' },
      headers: HeadersAdapter.seal(HeadersAdapter.from(headers)),
      cookies: RequestCookiesAdapter.seal(new RequestCookies(headers)),
      mutableCookies: new RequestCookies(headers),
      userspaceMutableCookies: new RequestCookies(headers),
      draftMode: { isEnabled: false },
      rootParams: {}, prerenderResumeDataCache: null, renderResumeDataCache: null, hmrRefreshHash: undefined, devFallbackParams: null,
    };
    const work = { route: '/api/mako/chat', page: '/api/mako/chat', isStaticGeneration: false, forceStatic: false, dynamicShouldError: false, afterContext: { after() {} }, incrementalCache: undefined, invalidDynamicUsageError: undefined };
    return workAsyncStorage.run(work as never, () => workUnitAsyncStorage.run(store as never, fn));
  };

  const { exigirPermisoIa } = await imp('lib/ia-permiso.ts');
  const { chatCheap, chatCheapCascade, transcribirAudio, leerDocumentoIA, chatCheapTools } = await imp('lib/ai-cheap.ts');
  const { chatClaude, chatClaudeTools } = await imp('lib/anthropic.ts');
  const { embed } = await imp('lib/embeddings.ts');
  const { clonarVoz, elevenKey } = await imp('lib/elevenlabs.ts');

  const PUERTAS: Array<[string, () => Promise<unknown>]> = [
    ['chatCheap', () => chatCheap({ system: 's', user: 'u' })],
    ['chatCheapCascade', () => chatCheapCascade({ system: 's', user: 'u' })],
    ['chatCheapTools', () => chatCheapTools('s', [{ role: 'user', content: 'u' }], [], async () => '', {})],
    ['leerDocumentoIA', () => leerDocumentoIA({ prompt: 'p', mime: 'application/pdf', data: 'AAAA' })],
    ['transcribirAudio', () => transcribirAudio('AAAA', 'audio/mpeg', { feature: 'prueba' })],
    ['chatClaude', () => chatClaude('s', [{ role: 'user', content: 'u' }], { feature: 'prueba' })],
    ['chatClaudeTools', () => chatClaudeTools('s', [{ role: 'user', content: 'u' }], [], async () => '', { feature: 'prueba' })],
    ['embed', () => embed('hola', 'consulta', { embebedor: { modelo: 'text-embedding-3-small', claves: ['k'], proveedor: 'openai' } })],
    ['clonarVoz', () => clonarVoz('prueba', [])],
  ];

  const R: Record<string, unknown> = {};
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

  // El pedido de mentira funciona: `headers()` lee lo que pusimos (si no, todo lo de abajo mediría «sin pedido»).
  const { headers } = await import('next/headers');
  R.controlDelPedido = await enPedido('Agente-de-control', async () => (await headers()).get('user-agent'));

  // Con la marca y sin permiso: ninguna puerta deja salir nada, y todas dicen por qué.
  const frenadas: Record<string, string> = {};
  for (const [nombre, llamar] of PUERTAS) {
    const antes = alProveedor;
    const salida = await enPedido(`${IPHONE} MaKoApp-iOS`, () => llamar().then(() => 'sin error', (e: Error) => (e.name === 'Error' ? e.constructor.name : e.name)));
    frenadas[nombre] = `${salida}/${alProveedor - antes}`;
  }
  R.frenadas = frenadas;
  // Retirar el permiso no puede impedir borrar: la clave se lee igual.
  R.claveSinPermiso = await enPedido(`${IPHONE} MaKoApp-iOS`, () => elevenKey().then(() => 'se lee', (e: Error) => e.name));

  // Las MISMAS llamadas sin la marca no se frenan por esto: un iPhone en Safari, Android y la computadora quedan como siempre.
  const libres: Record<string, string> = {};
  for (const [nombre, llamar] of PUERTAS) {
    for (const [cual, ua] of [['safari', IPHONE], ['android', 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile']] as const) {
      const salida = await enPedido(ua, () => llamar().then(() => 'sin error', (e: Error) => e.name));
      libres[`${nombre}:${cual}`] = salida;
    }
  }
  R.libres = libres;

  // Sin pedido (un cron, un webhook): no hay a quién preguntarle, y sigue.
  R.sinPedido = await exigirPermisoIa().then(() => 'sigue', (e: Error) => e.name);
  R.alProveedorSinMarca = alProveedor;

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
