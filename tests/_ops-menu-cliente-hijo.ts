// =============================================================================
// Hijo de tests/ops-menu-cliente.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre la ruta REAL /api/mako/chat (GET ?sesiones=1 y POST `renombrar` / `criatura`, el «⋯» de una fila del Ops Center del
// cliente, F96) adentro de un pedido de mentira con una cookie de sesión FIRMADA, sobre un PostgREST de mentira. La sesión, el
// negocio (`getWorkspaceActual`), la capa, lib/chat-munecos-db.ts y chart_sessions son los de verdad: sólo la base es de mentira.
// Imprime lo que contestó cada pedido y cómo quedó la base. Necesita `--conditions=react-server`. Nada sale a la red.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);

const WS = 3;          // el de prueba (nunca el 1)
const OTRO_WS = 4;
const ANA = 42;        // la persona que mira
const OTRA = 43;       // otra persona del mismo negocio
const A = { forma: 'gota', color: '--grafo-documentos', cara: 'sonrisa' };

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const ahoraIso = () => new Date().toISOString();
  const pg = crearPostgrest({ tablas: ['usuarios', 'usuario_contrasena', 'workspaces', 'chart_sessions', 'chart_chats', 'app_settings', 'agencia_clientes'] });
  const db = pg.db as Record<string, Array<Record<string, unknown>>>;
  const red: string[] = [];
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') return pg.responder(u, init);
    red.push(u.host);
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'http://supa.test', SUPABASE_URL: 'http://supa.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-prueba',
    AUTH_SECRET: 'secreto-de-firma-de-prueba-menu-del-cliente-0123456789', APP_BASE_URL: 'https://mako.test',
  });

  db.workspaces.push(
    { id: WS, nombre: 'Prueba', slug: 'prueba', estado: 'activo', capa: 'completo', created_at: ahoraIso() },
    { id: OTRO_WS, nombre: 'Otro', slug: 'otro', estado: 'activo', capa: 'completo', created_at: ahoraIso() },
  );
  db.usuarios.push(
    { id: ANA, email: 'ana@prueba.test', nombre: 'Ana', rol: 'usuario', rol_ws: 'admin', workspace_id: WS, estado: 'activo', mfa_activo: false },
    { id: OTRA, email: 'otra@prueba.test', nombre: 'Otra', rol: 'usuario', rol_ws: 'admin', workspace_id: WS, estado: 'activo', mfa_activo: false },
  );
  const sesion = (id: number, ws: number, persona: number, titulo: string | null, dias: number) => ({
    id, workspace_id: ws, chart_key: `mako-movil:u${persona}`, titulo, contexto: null, pinned: false, archived: false,
    created_at: new Date(Date.now() - dias * 86_400_000).toISOString(), updated_at: new Date(Date.now() - dias * 86_400_000).toISOString(),
  });
  db.chart_sessions.push(
    sesion(10, WS, ANA, null, 9),          // su Cerebro (la más vieja: el jefe)
    sesion(11, WS, ANA, 'Precios', 2),     // un chat suyo
    sesion(12, WS, OTRA, 'De otra', 1),    // de otra persona del mismo negocio
    sesion(13, OTRO_WS, ANA, 'Ajeno', 1),  // con su clave, pero en otro negocio
  );

  (globalThis as unknown as { AsyncLocalStorage: unknown }).AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage;
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lo que corre adentro viene de imports dinámicos (any)
  const enPedido = (cookie: string, fn: () => Promise<any>): Promise<any> => {
    const headers = new Headers({ host: 'mako.test', cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140' });
    const store = {
      type: 'request', phase: 'action', implicitTags: { tags: [], expirationsByCacheKind: new Map() }, url: { pathname: '/api/mako/chat', search: '' },
      headers: HeadersAdapter.seal(HeadersAdapter.from(headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(headers)),
      mutableCookies: new RequestCookies(headers), userspaceMutableCookies: new RequestCookies(headers), draftMode: { isEnabled: false },
      rootParams: {}, prerenderResumeDataCache: null, renderResumeDataCache: null, hmrRefreshHash: undefined, devFallbackParams: null,
    };
    const work = { route: '/api/mako/chat', page: '/api/mako/chat', isStaticGeneration: false, forceStatic: false, dynamicShouldError: false, afterContext: { after() {} }, incrementalCache: undefined, invalidDynamicUsageError: undefined };
    return workAsyncStorage.run(work as never, () => workUnitAsyncStorage.run(store as never, fn));
  };

  const { crearToken, SESSION_COOKIE } = await imp('lib/auth-session.ts');
  const { GET, POST } = await imp('app/api/mako/chat/route.ts');
  const cookieDe = (id: number, email: string) => `${SESSION_COOKIE}=${crearToken({ sub: String(id), email, nombre: 'P', rol: 'usuario', ws: WS })}`;
  const COOKIE_ANA = cookieDe(ANA, 'ana@prueba.test');
  const pedir = async (cookie: string, metodo: 'GET' | 'POST', cuerpo?: Record<string, unknown>) => {
    const req = metodo === 'GET'
      ? new Request('https://mako.test/api/mako/chat?sesiones=1')
      : new Request('https://mako.test/api/mako/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    // La ruta lee `req.nextUrl` en el GET: lo que le da Next.
    Object.defineProperty(req, 'nextUrl', { value: new URL(req.url) });
    const r = await enPedido(cookie, () => (metodo === 'GET' ? GET(req) : POST(req)));
    return { status: r.status as number, cuerpo: (await r.json()) as Record<string, unknown> };
  };
  const titulo = (id: number) => db.chart_sessions.find((s) => s.id === id)?.titulo ?? null;
  const munecosGuardados = () => {
    const f = db.app_settings.find((x) => x.key === `chats.munecos:u${ANA}`);
    return f ? { ws: f.workspace_id, valor: JSON.parse(String(f.value)) } : null;
  };

  const R: Record<string, unknown> = {};
  R.sinSesion = await pedir('', 'POST', { action: 'renombrar', sessionId: 11, nombre: 'X' });
  R.listaAntes = await pedir(COOKIE_ANA, 'GET');
  R.renombrarSuyo = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 11, nombre: '  Ventas   del mes  ' });
  R.tituloSuyo = titulo(11);
  R.renombrarJefe = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 10, nombre: 'Otro nombre' });
  R.tituloJefe = titulo(10);
  R.renombrarDeOtra = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 12, nombre: 'Robado' });
  R.tituloDeOtra = titulo(12);
  R.renombrarOtroNegocio = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 13, nombre: 'Robado' });
  R.tituloOtroNegocio = titulo(13);
  R.renombrarVacio = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 11, nombre: '   ' });
  R.renombrarLargo = await pedir(COOKIE_ANA, 'POST', { action: 'renombrar', sessionId: 11, nombre: 'x'.repeat(81) });
  R.tituloTrasLosMalos = titulo(11);
  R.criaturaSuya = await pedir(COOKIE_ANA, 'POST', { action: 'criatura', sessionId: 11, aspecto: A });
  R.guardadoTrasElegir = munecosGuardados();
  R.criaturaJefe = await pedir(COOKIE_ANA, 'POST', { action: 'criatura', sessionId: 10, aspecto: A });
  R.criaturaDeOtra = await pedir(COOKIE_ANA, 'POST', { action: 'criatura', sessionId: 12, aspecto: A });
  R.criaturaInvalida = await pedir(COOKIE_ANA, 'POST', { action: 'criatura', sessionId: 11, aspecto: { forma: 'inventada' } });
  R.guardadoTrasLosMalos = munecosGuardados();
  R.listaDespues = await pedir(COOKIE_ANA, 'GET');
  R.listaDeOtra = await pedir(cookieDe(OTRA, 'otra@prueba.test'), 'GET');
  R.quitarCriatura = await pedir(COOKIE_ANA, 'POST', { action: 'criatura', sessionId: 11, aspecto: null });
  R.guardadoTrasQuitar = munecosGuardados();
  // Con las criaturas sin poder leerse (la fila de app_settings contesta error), la lista sale igual y `munecos` viene null.
  pg.faltan.add('app_settings');
  R.listaSinCriaturas = await pedir(COOKIE_ANA, 'GET');
  pg.faltan.delete('app_settings');
  R.red = red;
  console.log(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
