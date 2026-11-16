// =============================================================================
// La API pública (16/11/2026): /api-mako SIN sesión es la referencia de la API, abierta; con sesión, la tab de siempre
// =============================================================================
// El pedido: «NO es otra página; es la MISMA /api-mako abierta a quien no tiene sesión: la referencia, sin claves, sin tokens y
// sin el botón de probar; con sesión, lo de hoy», con la barra y el pie del sitio, y el renglón «Documentación de la API» del
// menú Recursos sin la marca `conCuenta`.
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: «sumarla a PUBLICOS de lib/rutas-publicas.ts, sólo lectura». Una página en PUBLICOS
// es de sólo lectura PARA TODOS (`esPublicaSoloLeer`), y en /api-mako crear, editar o borrar un token, «Probar» y las descargas
// son acciones del servidor: un POST a la página. Con sesión, el 405 de la rama pública del proxy las cortaba. Por eso es una
// lista aparte (`LEIBLES_SIN_SESION`) que el proxy mira DESPUÉS de la sesión. El test 2 es el que lo fija.
//
// Lo que se EJECUTA: la decisión (`decidirSinSesion`), el PROXY DE VERDAD (`proxy(new NextRequest(...))`, como
// tests/alumno-sesion.test.ts), el índice y las páginas de la referencia (app/api-mako/datos.ts, con `server-only` vacío) y la
// pantalla dibujada (ApiMako + Docs, renderToStaticMarkup). Lo que se lee del fuente: el layout (la sesión baja por contexto) y la
// página (que la rama sin sesión va ANTES de `requireRolWs`).
//
// PROBADO ROMPIÉNDOLO (16/11/2026; base 7 / 0), cada rotura restaurada (pasan / fallan):
//   · el proxy sin la rama de `decidirSinSesion`                                          -> 6 / 1 (el 2)
//   · el camino obvio: '/api-mako' en PUBLICOS                                             -> 5 / 2 (el 1 y el 2: con sesión, 405)
//   · `paginaDocs` sin mirar `probar` (vuelve «Probar con tus datos»)                     -> 5 / 2 (el 4 y el 5)
//   · `VISTA_PUBLICA` con `plataforma: true` (entran las operaciones de MaKo misma)        -> 6 / 1 (el 4)
//   · la pantalla pública con las tres pestañas (Tokens y Registro)                        -> 6 / 1 (el 5)
//   · ReferenciaPublica sin `publica: true` en sus datos (vuelven las descargas)           -> 6 / 1 (el 5)
//   · el layout con `conSesion={true}` fijo · HideOnPublicLanding sin la sesión           -> 6 / 1 cada una (el 3)
//   · «Documentación de la API» vuelve a llevar `conCuenta`                                -> 6 / 1 (el 7)
// Correr: node --import tsx --test tests/api-mako-publica.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';

// `server-only` vacío (la condición de react-server, el molde de tests/admin-polar-ajustes.test.ts) y las hojas .css sin nada
// (ApiMako importa github.css): así se cargan datos.ts y la pantalla. Los módulos que los usan se importan DESPUÉS, con import().
type Ctx = { conditions?: string[] };
type Resolver = (spec: string, ctx: Ctx, next: (spec: string, ctx: Ctx) => unknown) => unknown;
type Loader = (u: string, ctx: unknown, next: (u: string, c: unknown) => unknown) => unknown;
(modulo as unknown as { registerHooks: (h: { resolve: Resolver; load: Loader }) => void }).registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'server-only') return next(spec, { ...ctx, conditions: [...(ctx.conditions ?? []), 'react-server'] });
    return next(spec, ctx);
  },
  load(u, ctx, next) {
    if (/\.css($|\?)/.test(u)) return { format: 'commonjs', source: '', shortCircuit: true };
    return next(u, ctx);
  },
});

// El proxy lee el secreto en cada pedido (`gateConfigurado`): con esto el gate está ACTIVO, como en producción.
process.env.AUTH_SECRET = 'secreto-de-prueba-de-la-api-publica-0123456789';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la regla: /api-mako, exacta, sólo para leer y nunca una acción del servidor', async () => {
  const { decidirSinSesion, seLeeSinSesion, esPublica, abreSinCuenta, LEIBLES_SIN_SESION } = await import('../lib/rutas-publicas');
  assert.deepEqual([...LEIBLES_SIN_SESION], ['/api-mako']);
  assert.equal(decidirSinSesion('/api-mako', 'GET', false), 'pasa');
  assert.equal(decidirSinSesion('/api-mako', 'head', false), 'pasa');
  assert.equal(decidirSinSesion('/api-mako', 'GET', true), null, 'una acción del servidor no pasa ni por GET');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(decidirSinSesion('/api-mako', m, false), null, m);
  for (const p of ['/api-mako/', '/api-mako/x', '/api-makos', '/api/v1', '/crm', '/']) {
    assert.equal(decidirSinSesion(p, 'GET', false), null, p);
    assert.equal(seLeeSinSesion(p), false, p);
  }
  // NO está en PUBLICOS (ver la cabecera), pero sí la abre alguien sin cuenta.
  assert.equal(esPublica('/api-mako'), false, '/api-mako en PUBLICOS: con sesión, el 405 corta crear un token');
  assert.equal(abreSinCuenta('/api-mako'), true);
});

test('2. el proxy: sin sesión se LEE; con sesión, sus acciones (crear un token es un POST a la página) siguen pasando', async () => {
  const { proxy } = await import('../proxy');
  const { crearToken, SESSION_COOKIE } = await import('../lib/auth-session');
  const pedir = (metodo: string, ruta: string, extra: { cookie?: string; headers?: Record<string, string>; body?: string } = {}) =>
    proxy(new NextRequest(`http://localhost:3010${ruta}`, {
      method: metodo,
      headers: { ...(extra.cookie ? { cookie: extra.cookie } : {}), ...(extra.headers ?? {}) },
      body: extra.body,
    }));
  const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const aLogin = (r: Response) => r.status === 307 && new URL(r.headers.get('location') ?? 'http://x/').pathname === '/login';

  // Sin sesión: la documentación se lee, con su URL (área, recurso, artículo).
  for (const ruta of ['/api-mako', '/api-mako?tab=docs&area=crm&recurso=leads', '/api-mako?tab=docs&art=autenticacion']) {
    assert.ok(pasa(pedir('GET', ruta)), `${ruta} sin sesión no pasa`);
  }
  assert.ok(pasa(pedir('HEAD', '/api-mako')));
  // …y nada que la escriba: la acción con su header, y la que llega como formulario sin header (Next la corre igual).
  assert.ok(aLogin(pedir('POST', '/api-mako', { headers: { 'next-action': 'abc123', 'content-type': 'text/plain' }, body: '[]' })), 'una acción sin sesión pasó');
  assert.ok(aLogin(pedir('POST', '/api-mako', { headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--' })));
  assert.ok(aLogin(pedir('GET', '/api-mako', { headers: { 'next-action': 'abc123' } })));
  // Lo de al lado sigue cerrado.
  for (const p of ['/api-mako/x', '/crm', '/integraciones']) assert.ok(aLogin(pedir('GET', p)), `${p} se abrió sin sesión`);

  // Con sesión: la tab de siempre, y sus acciones del servidor llegan a la página (no un 405).
  const cookie = `${SESSION_COOKIE}=${crearToken({ sub: '77', email: 'prueba@ejemplo.com', nombre: 'X', rol: 'usuario' }, 7)}`;
  assert.ok(pasa(pedir('GET', '/api-mako?tab=tokens', { cookie })));
  const accion = pedir('POST', '/api-mako?tab=tokens&v=nuevo', { cookie, headers: { 'next-action': 'abc123', 'content-type': 'text/plain', origin: 'http://localhost:3010' }, body: '[]' });
  assert.ok(pasa(accion), `con sesión, crear un token (una acción del servidor) recibe ${accion.status}`);
});

test('3. el cromo de la app se apaga SÓLO sin sesión, y la sesión baja del layout', async () => {
  const { isPublicLandingPath, esVistaSinChrome } = await import('../app/_components/PublicRouteGate');
  assert.equal(isPublicLandingPath('/api-mako', false), true, 'sin sesión, el Sidebar y los pollers (401 en bucle)');
  assert.equal(esVistaSinChrome('/api-mako', false), true);
  assert.equal(isPublicLandingPath('/api-mako'), false, 'con sesión (o sin decirlo), /api-mako es la tab de siempre, con su cromo');
  assert.equal(esVistaSinChrome('/api-mako', true), false);
  for (const p of ['/crm', '/api-mako/x', '/integraciones']) assert.equal(isPublicLandingPath(p, false), false, p);
  // El layout la baja por contexto, envolviendo el cromo y los pollers.
  const layout = sinComentarios(leer('app/layout.tsx'));
  const ini = layout.indexOf('<ConSesionProvider conSesion={!!sesion}>');
  assert.ok(ini > 0, 'el layout no baja la sesión (ConSesionProvider)');
  assert.ok(ini < layout.indexOf('<NotificationsProvider>') && layout.indexOf('</ConSesionProvider>') > layout.indexOf('</NotificationsProvider>'));
  // Y quienes apagan el cromo o sondean, la usan.
  const gate = sinComentarios(leer('app/_components/PublicRouteGate.tsx'));
  assert.match(gate, /esVistaSinChrome\(pathname, conSesion\)/, 'HideOnPublicLanding no mira la sesión');
  assert.match(gate, /isPublicLandingPath\(pathname, conSesion\)/, 'FueraDeLoPublico no mira la sesión');
  assert.equal((sinComentarios(leer('app/_components/NotificationsProvider.tsx')).match(/isPublicLandingPath\([^)]*, conSesion\)/g) ?? []).length, 3, 'un sondeo de NotificationsProvider no mira la sesión');
  assert.match(sinComentarios(leer('app/_components/AvisoPixelViejo.tsx')), /esVistaSinChrome\(pathname, conSesion\)/);
});

test('4. la referencia pública: lo que cualquier negocio puede pedir, nada de adentro, y sin «Probar»', async () => {
  const { VISTA_PUBLICA, indiceDocs, paginaDocs, sePuedeProbar } = await import('../app/api-mako/datos');
  const { porId } = await import('../lib/api-mako/registro');
  const indice = indiceDocs(VISTA_PUBLICA);
  const ids = indice.flatMap((a) => a.recursos.flatMap((r) => r.endpoints.map((e) => e.id)));
  assert.ok(ids.length > 200, `la referencia pública trae ${ids.length} endpoints`);
  for (const id of ids) {
    const g = porId(id)?.gating;
    assert.ok(!g?.soloPlataforma && !g?.soloWs1, `«${id}» es de la plataforma o del workspace principal y está en la referencia pública`);
  }
  // Con sesión, «Probar con tus datos» en las lecturas que no gastan (el control: que haya alguna); sin sesión, en ninguna.
  assert.ok(ids.some((id) => sePuedeProbar(porId(id)!)), 'ninguna lectura se puede probar con sesión: el test no está probando nada');
  for (const a of indice) for (const r of a.recursos) {
    const sin = paginaDocs(indice, a.area, r.slug, 'https://hola-mako.com', { probar: false })!;
    assert.equal(sin.endpoints.filter((e) => e.probable).length, 0, `${a.area}/${r.slug}: «Probar» sin sesión`);
  }
});

test('5. la pantalla sin sesión, dibujada: la barra y el pie del sitio, sólo la Documentación, sin descargas ni «Probar»', async () => {
  const { VISTA_PUBLICA, indiceDocs, paginaDocs } = await import('../app/api-mako/datos');
  const { ReferenciaPublica } = await import('../app/api-mako/ReferenciaPublica');
  const { ApiMako } = await import('../app/api-mako/ApiMako');
  const { Docs } = await import('../app/api-mako/Docs');
  const indice = indiceDocs(VISTA_PUBLICA);
  const nav = (h: string) => h.slice(h.indexOf('gh-underline-nav'), h.indexOf('</nav>', h.indexOf('gh-underline-nav')));
  const publica = (sp: { area?: string; recurso?: string; art?: string }) => renderToStaticMarkup(createElement(ReferenciaPublica, { sp }));

  const portada = publica({});
  assert.match(portada, /<header class="s-barra/, 'sin la barra del sitio');
  assert.equal(portada.split('<footer class="s-pie">').length - 1, 1, 'el pie del sitio, una vez');
  assert.doesNotMatch(nav(portada), /tab=tokens|tab=registro/, 'la pantalla sin sesión muestra Tokens o Registro');
  assert.match(nav(portada), /Documentación/);
  assert.doesNotMatch(portada, /OpenAPI \(JSON\)|Referencia \(markdown\)/, 'las descargas son acciones de un workspace');
  assert.match(portada, /<div class="gh"[^>]*data-tema-fijo=""/, 'sin data-tema-fijo, el sol y la luna del sitio le reescriben los colores');
  // Medido a 1440: con el `min-height:100%` de la tab, la documentación crecía lo que miden la barra y el pie (712 px en blanco).
  assert.doesNotMatch(portada.match(/<div class="gh"[^>]*>/)?.[0] ?? '', /min-height/, 'la documentación pública con el alto de la caja que lleva la barra y el pie');
  assert.doesNotMatch(publica({ art: 'openapi' }), /OpenAPI \(JSON\)/, 'el artículo de OpenAPI trae las descargas');
  // Con sesión (el control, la misma pantalla sin `publica`): las tres pestañas y las descargas.
  const datos = { base: 'https://hola-mako.com', version: '2026-10-08', limites: { ws: 120, ip: 60 }, topeCuerpoKb: 256, indice, ejemplo: null };
  const adentro = (pagina: ReturnType<typeof paginaDocs>, area: string | null, recurso: string | null) =>
    renderToStaticMarkup(createElement(ApiMako, { tab: 'docs', tokens: 2, children: createElement(Docs, { datos, pagina, area, recurso, art: null }) }));
  assert.match(nav(adentro(null, null, null)), /tab=tokens/);
  assert.match(adentro(null, null, null), /OpenAPI \(JSON\)/);
  assert.doesNotMatch(adentro(null, null, null), /data-tema-fijo/);

  // Una página con una lectura que se puede probar: con sesión, el botón; sin sesión, no.
  const a = indice.find((x) => x.recursos.some((r) => paginaDocs(indice, x.area, r.slug, datos.base)!.endpoints.some((e) => e.probable)))!;
  const r = a.recursos.find((y) => paginaDocs(indice, a.area, y.slug, datos.base)!.endpoints.some((e) => e.probable))!;
  assert.match(adentro(paginaDocs(indice, a.area, r.slug, datos.base), a.area, r.slug), /Probar con tus datos/);
  const recurso = publica({ area: a.area, recurso: r.slug });
  assert.match(recurso, /Ejemplos de código para/, `${a.area}/${r.slug}: la página del recurso no se dibujó`);
  assert.doesNotMatch(recurso, /Probar con tus datos/);
  // El modo oscuro del sitio, el de Primer.
  assert.match(leer('app/api-mako/github.css'), /html\[data-sitio-modo="oscuro"\] \.gh\[data-tema-fijo\] \{/);
});

test('6. la página: sin sesión, la referencia, ANTES de pedir el rol; y Tokens y Registro, a entrar', () => {
  const src = sinComentarios(leer('app/api-mako/page.tsx'));
  const pagina = src.slice(src.indexOf('export default async function ApiMakoPage'));
  const sinSesion = pagina.indexOf('if (!(await getUsuarioActual()))');
  assert.ok(sinSesion > 0 && sinSesion < pagina.indexOf('requireRolWs('), 'la rama sin sesión tiene que ir antes de requireRolWs (que manda a /login)');
  assert.ok(pagina.indexOf('return <ReferenciaPublica sp={sp} />;') > sinSesion && pagina.indexOf('return <ReferenciaPublica sp={sp} />;') < pagina.indexOf('requireRolWs('));
  assert.match(sinComentarios(leer('app/api-mako/ReferenciaPublica.tsx')), /indiceDocs\(VISTA_PUBLICA\)/, 'la referencia pública con la vista de un workspace');
  // Los Tokens y el Registro son de un negocio: a entrar, y de vuelta.
  assert.match(pagina, /sp\.tab === 'tokens' \|\| sp\.tab === 'registro'[\s\S]{0,300}redirect\(`\/login\?next=/);
});

test('7. el sitio: «Documentación de la API» ya no dice que pide cuenta, y la portada la nombra en sus integraciones', async () => {
  const { RECURSOS } = await import('../app/vsl/_sitio/datos');
  const api = RECURSOS.flatMap((g) => g.items).find((i) => i.href === '/api-mako');
  assert.ok(api, 'el menú Recursos sin la documentación de la API');
  assert.equal(api.conCuenta, undefined);
  const portada = sinComentarios(leer('app/vsl/_sitio/Portada.tsx'));
  const integraciones = portada.slice(portada.indexOf('id="integraciones"'), portada.indexOf('</section>', portada.indexOf('id="integraciones"')));
  assert.match(integraciones, /href="\/api-mako"/, 'la sección «Tus apps, conectadas» de la portada sin el link a la API');
});
