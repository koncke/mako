// =============================================================================
// Hijo de tests/sesiones-revocadas.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre `getUsuarioActual` (lib/auth.ts) DE VERDAD, adentro de un pedido de mentira, con la base caída (el `fetch` a Supabase tira). Lo
// que mira: qué sesión devuelve para un closer, un admin con su segundo factor y la cuenta de revisión de las tiendas, y cuántas veces
// fue a la base. Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const pg = crearPostgrest({ tablas: ['usuarios', 'usuario_contrasena', 'workspaces', 'app_settings'] });
  const db = pg.db as Record<string, Array<Record<string, unknown>>>;
  let aLaBase = 0;
  let caida = true;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') {
      aLaBase += 1;
      if (caida) throw new Error('la base está caída');
      return pg.responder(u, init);
    }
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'http://supa.test', SUPABASE_URL: 'http://supa.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-prueba',
    AUTH_SECRET: 'secreto-de-firma-de-prueba-base-caida-0123456789',
  });

  (globalThis as unknown as { AsyncLocalStorage: unknown }).AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage;
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lo que corre adentro viene de imports dinámicos (any)
  const enPedido = (cookie: string, fn: () => Promise<any>): Promise<any> => {
    const headers = new Headers({ host: 'mako.test', cookie });
    const store = {
      type: 'request', phase: 'action', implicitTags: { tags: [], expirationsByCacheKind: new Map() }, url: { pathname: '/api/prueba', search: '' },
      headers: HeadersAdapter.seal(HeadersAdapter.from(headers)), cookies: RequestCookiesAdapter.seal(new RequestCookies(headers)),
      mutableCookies: new RequestCookies(headers), userspaceMutableCookies: new RequestCookies(headers), draftMode: { isEnabled: false },
      rootParams: {}, prerenderResumeDataCache: null, renderResumeDataCache: null, hmrRefreshHash: undefined, devFallbackParams: null,
    };
    const work = { route: '/api/prueba', page: '/api/prueba', isStaticGeneration: false, forceStatic: false, dynamicShouldError: false, afterContext: { after() {} }, incrementalCache: undefined, invalidDynamicUsageError: undefined };
    return workAsyncStorage.run(work as never, () => workUnitAsyncStorage.run(store as never, fn));
  };

  const { crearToken, SESSION_COOKIE } = await imp('lib/auth-session.ts');
  const { CUENTA_DE_REVISION } = await imp('lib/cuenta-revision-reglas.ts');
  const { getUsuarioActual } = await imp('lib/auth.ts');
  const cookie = (s: Record<string, unknown>) => `${SESSION_COOKIE}=${crearToken(s)}`;
  const R: Record<string, unknown> = {};
  const medir = async (nombre: string, s: Record<string, unknown>) => {
    const antes = aLaBase;
    const r = await enPedido(cookie(s), () => getUsuarioActual());
    R[nombre] = { sesion: r ? { email: r.email, rol: r.rol, mfa: r.mfa ?? null } : null, aLaBase: aLaBase - antes };
  };
  const CLOSER = { sub: '78', email: 'closer@otro.test', nombre: 'C', rol: 'usuario' };
  const ADMIN = { sub: '1', email: 'admin@mako.test', nombre: 'A', rol: 'admin', mfa: 'totp' };
  const REVISION = { sub: '77', email: CUENTA_DE_REVISION.email, nombre: 'R', rol: 'usuario', mfa: 'revision' };
  // Con la base caída: falla ABIERTA para todos (la decisión del 3/11), salvo la única sesión sin segundo factor.
  await medir('caidaCloser', CLOSER);
  await medir('caidaAdmin', ADMIN);
  await medir('caidaRevision', REVISION);
  // Con la base andando: lo que cuesta cada sesión. La de revisión mira además su contraseña; las demás, lo de siempre.
  caida = false;
  db.workspaces.push({ id: 50, nombre: 'Otro', capa: 'completo', estado: 'activo' }, { id: CUENTA_DE_REVISION.ws, nombre: 'Demo', capa: 'completo', estado: 'activo' });
  db.usuarios.push(
    { id: 78, email: CLOSER.email, nombre: 'C', rol: 'usuario', rol_ws: 'closer', workspace_id: 50, estado: 'activo', mfa_activo: false },
    { id: 1, email: ADMIN.email, nombre: 'A', rol: 'admin', rol_ws: null, workspace_id: 50, estado: 'activo', mfa_activo: true },
    { id: 77, email: REVISION.email, nombre: 'R', rol: 'usuario', rol_ws: 'closer', workspace_id: CUENTA_DE_REVISION.ws, estado: 'activo', mfa_activo: false },
  );
  db.usuario_contrasena.push({ usuario_id: 77, hash: 'x', cambiada_at: new Date(Date.now() - 3_600_000).toISOString() });
  await medir('andaCloser', CLOSER);
  await medir('andaAdmin', ADMIN);
  await medir('andaRevision', REVISION);
  console.log(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
