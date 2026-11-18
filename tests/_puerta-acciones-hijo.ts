// =============================================================================
// Hijo de tests/acciones-con-puerta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre, adentro de un pedido de mentira SIN sesión (el mismo AsyncLocalStorage que usa Next para `cookies()`), el fondo de
// todas las puertas —`getUsuarioActual` y `exigirSesion`— y lo que se arma sobre ellas, y unas server actions de verdad.
// Mira dos cosas: qué devuelve cada una, y si alguna llegó a la base. Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const pg = crearPostgrest({ tablas: ['app_settings', 'workspaces', 'usuarios', 'flow_puentes', 'flow_trabajos'] });
  (pg.db as Record<string, Array<Record<string, unknown>>>).workspaces.push({ id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  // Lo que se le pidió a la base mientras corría UNA cosa (se vacía antes de cada una).
  const pedidos: string[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') { pedidos.push(u.pathname.replace('/rest/v1/', '')); return pg.responder(u, init); }
    pedidos.push(`red:${u.host}`);
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';

  (globalThis as unknown as { AsyncLocalStorage: unknown }).AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage;
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');

  /** Corre `fn` adentro de un pedido con esa cookie (o ninguna). Devuelve lo que dio, o el error, y a qué tablas fue. */
  const enPedido = async (cookie: string, fn: () => Promise<unknown>): Promise<{ dio: unknown; tiro: string | null; base: string[] }> => {
    const headers = new Headers({ 'user-agent': 'prueba', ...(cookie ? { cookie } : {}) });
    const store = {
      type: 'request', phase: 'action', implicitTags: { tags: [], expirationsByCacheKind: new Map() },
      url: { pathname: '/crm', search: '' },
      headers: HeadersAdapter.seal(HeadersAdapter.from(headers)),
      cookies: RequestCookiesAdapter.seal(new RequestCookies(headers)),
      mutableCookies: new RequestCookies(headers),
      userspaceMutableCookies: new RequestCookies(headers),
      draftMode: { isEnabled: false },
      rootParams: {}, prerenderResumeDataCache: null, renderResumeDataCache: null, hmrRefreshHash: undefined, devFallbackParams: null,
    };
    const work = { route: '/crm', page: '/crm', isStaticGeneration: false, forceStatic: false, dynamicShouldError: false, afterContext: { after() {} }, incrementalCache: undefined, invalidDynamicUsageError: undefined };
    pedidos.length = 0;
    try {
      const dio = await workAsyncStorage.run(work as never, () => workUnitAsyncStorage.run(store as never, fn));
      return { dio: dio === undefined ? '(undefined)' : dio, tiro: null, base: [...pedidos] };
    } catch (e) {
      const err = e as { message?: string; digest?: string };
      return { dio: null, tiro: String(err.digest ?? err.message ?? e), base: [...pedidos] };
    }
  };

  // `next/navigation` en el servidor de verdad sale de la versión react-server de Next; acá node carga la del navegador, que
  // pide React entero. Lo único que usan las puertas es `redirect`/`notFound`, que TIRAN: se reemplazan por dos que tiran igual
  // (con el mismo `digest` que Next), sin el resto del módulo.
  const tira = (digest: string) => { const e = new Error(digest) as Error & { digest: string }; e.digest = digest; throw e; };
  const NAVEGACION = {
    redirect: (u: string, t = 'replace') => tira(`NEXT_REDIRECT;${t};${u};307;`),
    permanentRedirect: (u: string, t = 'replace') => tira(`NEXT_REDIRECT;${t};${u};308;`),
    notFound: () => tira('NEXT_HTTP_ERROR_FALLBACK;404'),
    forbidden: () => tira('NEXT_HTTP_ERROR_FALLBACK;403'),
    unauthorized: () => tira('NEXT_HTTP_ERROR_FALLBACK;401'),
    RedirectType: { push: 'push', replace: 'replace' },
    useRouter: () => ({}), usePathname: () => '/', useSearchParams: () => new URLSearchParams(), useParams: () => ({}),
  };
  type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
  const M = (await import('node:module')).default as unknown as { _load: Cargador };
  const cargar = M._load;
  M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
    pedido === 'next/navigation' ? NAVEGACION : Reflect.apply(cargar, M, [pedido, padre, esMain])) as Cargador;

  const { getUsuarioActual, getSesionAdmin } = await imp('lib/auth.ts');
  const { getRolWsEfectivo, adminDeWorkspaceActual } = await imp('lib/workspace.ts');
  const { exigirSesion } = await imp('lib/sesion-accion.ts');
  const { requireSesion } = await imp('lib/tab-access.ts');
  const R: Record<string, unknown> = {};

  // ── El fondo, sin cookie y con una cookie que no es de nadie (firma inválida).
  for (const [cual, cookie] of [['sinCookie', ''], ['cookieFalsa', 'mako_session=no.es.una.sesion']] as const) {
    R[cual] = {
      getUsuarioActual: await enPedido(cookie, () => getUsuarioActual()),
      exigirSesion: await enPedido(cookie, () => exigirSesion()),
      getRolWsEfectivo: await enPedido(cookie, () => getRolWsEfectivo()),
      getSesionAdmin: await enPedido(cookie, () => getSesionAdmin()),
      adminDeWorkspaceActual: await enPedido(cookie, () => adminDeWorkspaceActual()),
      requireSesion: await enPedido(cookie, () => requireSesion()),
    };
  }

  // ── Unas server actions de verdad, una por forma de puerta: sin sesión no llegan a los datos.
  const crm = await imp('app/crm/actions.ts');
  const puente = await imp('app/video-generator/puente-actions.ts');
  const operaciones = await imp('app/admin/operaciones/acciones.ts');
  const spy = await imp('app/competitor-spy/actions.ts');
  R.acciones = {
    'getEquipoAction (exigirSesion)': await enPedido('', () => crm.getEquipoAction()),
    'estadoPuenteAction (getRolWsEfectivo)': await enPedido('', () => puente.estadoPuenteAction()),
    'estadoPruebaAction (getRolWsEfectivo)': await enPedido('', () => puente.estadoPruebaAction(1)),
    'pushesCentroAction (getSesionAdmin + puedeOperar)': await enPedido('', () => operaciones.pushesCentroAction()),
    'competidoresAction (soloMiembro)': await enPedido('', () => spy.competidoresAction()),
  };

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
