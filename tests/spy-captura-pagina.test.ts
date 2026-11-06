// «Capturar» en «Sus páginas» con la extensión, sin evadir nada (4/11/2026, 0.76.0).
//
// Martín: «Pero podemos hacerlo con la extension de mako... Yo no quiero vulnerar a nadie, solo quiero capturar el diseño». Y
// después de probar Replicar con Beacons («La página pide comprobar que es una persona»): «Si, tendremos que hacerlo con la
// extension entonces». El Cerebro: «Test del recorrido con la extensión de mentira, probado rompiéndolo: sin extensión, con
// desafío, página que no carga y captura vacía».
//   1. la pantalla y el puente: sin extensión (o vieja) se pide instalarla; con ella, el pedido viaja con su `id` y una respuesta
//      ajena no lo cierra; sin respuesta, es «sin extensión»;
//   2. el worker: abre ESA página a la vista sólo si la pide una pestaña de MaKo, la anota, y al terminar cierra esa pestaña,
//      vuelve a Spy y le avisa; si la cierran sin capturar, la pantalla deja de esperar;
//   3. el lector (spy-pagina.js), corrido con una página de mentira: su título, su texto y sus enlaces sin la consulta; y no toca
//      la página, ni sus formularios, ni la red;
//   4. el desplegable: en la pestaña anotada, el toque en el ícono captura; si no se guardó (el desafío), la pestaña queda;
//   5. el servidor: el desafío, su página de error, una página que no carga y una captura vacía no se guardan; sus otras páginas
//      salen sólo de una página de enlaces; lo guardado se lee sano y con tope;
//   6. las rutas y la pantalla: la captura entra por la ruta de la extensión, sólo para SUS páginas; la pantalla muestra la foto;
//   7. sin permisos nuevos (la tienda los revisa y desactivarían la extensión) y la política lo dice.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `extensionCaptura` que no compara la versión                                → 1
//   · `pedirCaptura` que acepta la respuesta de otro pedido                        → 1
//   · el worker que abre la página sin mirar quién la pide                          → 2
//   · el worker que no cierra la pestaña al terminar                                → 2
//   · el lector que manda la consulta de los enlaces                                → 3
//   · el desplegable que cierra la pestaña aunque no se haya guardado               → 4
//   · `juzgarCaptura` sin el desafío                                                → 5
//   · `juzgarCaptura` que guarda una página que no cargó                            → 5
//   · `paginasDeLaCaptura` que saca páginas de cualquier sitio                      → 5
//   · la ruta sin `guardarPaginaCapturada` (otro camino)                            → 6
//   · un permiso nuevo en el manifest                                               → 7
//
// Correr: node --import tsx --test tests/spy-captura-pagina.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { alTerminarCaptura, extensionCaptura, pedirCaptura, type FinDeCaptura, type VentanaPuente } from '../lib/spy-captura-cliente';
import {
  capturaDe, conPaginaCapturada, juzgarCaptura, leerCapturaDePagina, leerPaginasCapturadas, paginasDeLaCaptura, PAGINAS_POR_COMPETIDOR,
  VERSION_CAPTURA, type CapturaDePagina, type PaginaCapturada,
} from '../lib/spy-pagina-capturada';
import { esMasVieja } from '../lib/version-comparar';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const plano = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Una ventana de mentira: eventos del DOM y relojes de verdad, sin navegador. */
function ventana(): VentanaPuente & EventTarget {
  const t = new EventTarget() as VentanaPuente & EventTarget;
  t.setTimeout = (fn, ms) => setTimeout(fn, ms);
  t.clearTimeout = (x) => clearTimeout(x as unknown as NodeJS.Timeout);
  return t;
}

test('1. la pantalla y el puente: sin extensión, pedirla; con ella, el pedido con su id; sin respuesta, «sin extensión»', async () => {
  assert.equal(extensionCaptura(null), 'no', 'sin el atributo del puente no hay extensión');
  assert.equal(extensionCaptura('0.75.0'), 'vieja', 'la de antes no sabe capturar');
  assert.equal(extensionCaptura(VERSION_CAPTURA), 'si');
  assert.equal(extensionCaptura('0.80.1'), 'si');

  // Con el puente de mentira: contesta primero a OTRO pedido (no tiene que cerrar éste) y después al suyo.
  const v = ventana();
  const pedidos: Array<Record<string, unknown>> = [];
  v.addEventListener('MAKO_SPY_CAPTURAR_PIDO', (e) => {
    const d = (e as CustomEvent).detail as Record<string, unknown>;
    pedidos.push(d);
    setTimeout(() => v.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA', { detail: { id: 'otro', ok: false, motivo: 'abrir' } })), 5);
    setTimeout(() => v.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA', { detail: { id: d.id, ok: true } })), 15);
  });
  assert.deepEqual(await pedirCaptura(v, 17, 'https://beacons.page/denborg', 500), { ok: true });
  assert.equal(pedidos.length, 1);
  assert.deepEqual({ competidorId: pedidos[0].competidorId, url: pedidos[0].url }, { competidorId: 17, url: 'https://beacons.page/denborg' });

  // Sin extensión: nadie contesta.
  assert.deepEqual(await pedirCaptura(ventana(), 17, 'https://beacons.page/denborg', 30), { ok: false, motivo: 'sin_respuesta' });

  // El aviso de que terminó: sólo con lo que tiene que traer.
  const w = ventana();
  const fines: FinDeCaptura[] = [];
  const soltar = alTerminarCaptura(w, (f) => fines.push(f));
  w.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA_TERMINO', { detail: { competidorId: '17', url: 'x' } }));
  w.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA_TERMINO', { detail: { competidorId: 17, url: 'https://beacons.page/denborg', lista: true } }));
  soltar();
  w.dispatchEvent(new CustomEvent('MAKO_SPY_CAPTURA_TERMINO', { detail: { competidorId: 17, url: 'https://beacons.page/denborg', cerrada: true } }));
  assert.deepEqual(fines, [{ competidorId: 17, url: 'https://beacons.page/denborg', lista: true, cerrada: false }]);
});

/** El worker de la extensión, con un `chrome` de mentira: sólo lo de «Capturar». */
function cargarWorker() {
  const bg = leer('extension/background.js');
  const ayudas = bg.slice(bg.indexOf('function esUrlDeMaKo(url) {'), bg.indexOf('/** Las pestañas de la app de MaKo: sin la ventana de lectura'));
  const capturas = bg.slice(bg.indexOf('// ── «Capturar» desde «Sus páginas» de Spy (0.76.0)'), bg.indexOf('/** Cuánto se espera a que la persona escanee el QR'));
  const bloques = bg.slice(bg.indexOf("  if (msg?.tipo === 'SPY_CAPTURAR') {"), bg.indexOf('  // El reloj del motor por interfaz.'));
  assert.ok(ayudas.length > 200 && capturas.length > 200 && bloques.length > 200, 'los recortes del worker');
  const reg = {
    session: {} as Record<string, unknown>, creadas: [] as Array<Record<string, unknown>>, cerradas: [] as number[], activadas: [] as number[],
    enfocadas: [] as number[], aTabs: [] as Array<[number, Record<string, unknown>]>, alCerrar: null as null | ((id: number) => void),
  };
  const tabs = [{ id: 5, windowId: 1, url: 'https://hola-mako.com/competitor-spy?competidor=17', index: 2 }];
  const fakeChrome = {
    runtime: { id: 'mako' },
    tabs: {
      create: async (o: Record<string, unknown>) => { reg.creadas.push(plano(o)); const t = { id: 40 + reg.creadas.length, windowId: 1, url: o.url }; tabs.push(t as never); return t; },
      remove: async (id: number) => { reg.cerradas.push(id); },
      get: async (id: number) => tabs.find((t) => t.id === id) ?? null,
      update: async (id: number, o: Record<string, unknown>) => { if (o.active) reg.activadas.push(id); },
      sendMessage: async (id: number, m: Record<string, unknown>) => { reg.aTabs.push([id, plano(m)]); },
      onRemoved: { addListener: (fn: (id: number) => void) => { reg.alCerrar = fn; } },
    },
    windows: { update: async (id: number) => { reg.enfocadas.push(id); } },
    storage: { session: {
      get: async (k: string) => (k in reg.session ? { [k]: plano(reg.session[k]) } : {}),
      set: async (o: Record<string, unknown>) => { Object.assign(reg.session, plano(o)); },
    } },
  };
  const ctx: Record<string, unknown> = { chrome: fakeChrome, URL, console, instalacionDeDesarrollo: false };
  runInNewContext(`${ayudas}\n${capturas}\nglobalThis.atender = (msg, _s, responder) => {\n${bloques}\n  return false;\n};`, ctx);
  const atender = ctx.atender as (m: unknown, s: unknown, r: (x: unknown) => void) => boolean;
  const pedir = (m: Record<string, unknown>, s: unknown) => new Promise<unknown>((resolve) => {
    const asinc = atender(m, s, (x) => resolve(plano(x)));
    if (!asinc) setTimeout(() => resolve('sin respuesta'), 50);
  });
  return { reg, pedir };
}
const DE_SPY = { tab: { id: 5, index: 2, url: 'https://hola-mako.com/competitor-spy?competidor=17' }, url: 'https://hola-mako.com/competitor-spy?competidor=17' };
const DEL_POPUP = { id: 'mako' };

test('2. el worker: abre esa página a la vista sólo para una pestaña de MaKo, y al terminar cierra, vuelve y avisa', async () => {
  const w = cargarWorker();
  // De otra página, no.
  assert.deepEqual(await w.pedir({ tipo: 'SPY_CAPTURAR', competidorId: 17, url: 'https://beacons.page/denborg' }, { tab: { id: 9, url: 'https://otro.example.com/' }, url: 'https://otro.example.com/' }),
    { ok: false, motivo: 'origen' });
  assert.deepEqual(await w.pedir({ tipo: 'SPY_CAPTURAR', competidorId: 17, url: 'javascript:alert(1)' }, DE_SPY), { ok: false, motivo: 'pedido' });
  assert.equal(w.reg.creadas.length, 0, 'nada se abrió');

  assert.deepEqual(await w.pedir({ tipo: 'SPY_CAPTURAR', competidorId: 17, url: 'https://beacons.page/denborg' }, DE_SPY), { ok: true });
  assert.deepEqual(w.reg.creadas, [{ url: 'https://beacons.page/denborg', active: true, openerTabId: 5, index: 3 }], 'a la vista, al lado de Spy');
  const tabId = 41;
  assert.deepEqual(Object.keys(w.reg.session.spyCapturas as object), [String(tabId)]);

  // Desde una pestaña (no el desplegable), no se cierra nada.
  assert.deepEqual(await w.pedir({ tipo: 'SPY_CAPTURA_LISTA', tabId }, DE_SPY), { ok: false });
  assert.deepEqual(await w.pedir({ tipo: 'SPY_CAPTURA_LISTA', tabId }, DEL_POPUP), { ok: true });
  assert.deepEqual(w.reg.cerradas, [tabId], 'la pestaña de la captura se cierra');
  assert.deepEqual(w.reg.activadas, [5], 'vuelve a Spy');
  assert.deepEqual(w.reg.aTabs, [[5, { tipo: 'SPY_CAPTURA_TERMINO', competidorId: 17, url: 'https://beacons.page/denborg', lista: true }]]);
  assert.deepEqual(w.reg.session.spyCapturas, {}, 'ya no está pendiente');

  // La cierran sin capturar: la pantalla deja de esperar, sin volver a ella.
  await w.pedir({ tipo: 'SPY_CAPTURAR', competidorId: 17, url: 'https://beacons.page/denborg' }, DE_SPY);
  w.reg.alCerrar!(42);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(w.reg.aTabs.at(-1), [5, { tipo: 'SPY_CAPTURA_TERMINO', competidorId: 17, url: 'https://beacons.page/denborg', cerrada: true }]);
  assert.deepEqual(w.reg.activadas, [5], 'no la pone al frente');
});

test('3. el lector, con una página de mentira: título, texto y enlaces sin la consulta; no toca nada', () => {
  const lector = leer('extension/spy-pagina.js');
  const doc = {
    title: 'Den Borg · Beacons',
    body: { innerText: '  Den Borg\n Marca Personal 360 · Compra tu entrada  ' },
    documentElement: { outerHTML: `<html><head><title>Den Borg</title></head><body>${'x'.repeat(50_000)}</body></html>` },
    querySelectorAll: () => [
      { href: 'https://passline.example.com/eventos/360?utm_source=beacons&email=a%40b.com' },
      { href: 'https://www.instagram.com/den.borgg/' },
      { href: 'mailto:hola@denborg.example.com' },
      { href: 'https://passline.example.com/eventos/360#comprar' },
    ],
  };
  // Por JSON: lo que vuelve de otro contexto trae sus propios prototipos, y un arreglo de allá no es «estrictamente igual» a uno de acá.
  const r = plano(runInNewContext(lector, { document: doc, location: { href: 'https://beacons.page/denborg?ref=ig' }, URL }) as Record<string, unknown>);
  assert.equal(r.modo, 'pagina');
  assert.equal(r.final, 'https://beacons.page/denborg', 'su dirección sin la consulta');
  assert.equal(r.titulo, 'Den Borg · Beacons');
  assert.equal(r.texto, 'Den Borg Marca Personal 360 · Compra tu entrada');
  assert.deepEqual(r.enlaces, ['https://passline.example.com/eventos/360', 'https://www.instagram.com/den.borgg/'], 'sin la consulta, sin el ancla, sin un correo');
  assert.equal((r.html as string).length, 30_000, 'del HTML, sólo el principio');

  const codigo = sinComentarios(lector);
  assert.doesNotMatch(codigo, /\.(?:scroll\w*|click|focus|submit)\(|fetch\(|XMLHttpRequest|sendBeacon|cookie|localStorage|sessionStorage|indexedDB/, 'no mueve ni toca la página, ni pide nada');
  assert.doesNotMatch(codigo, /\.value\b|FormData|elements\b/, 'no lee formularios');
  assert.doesNotMatch(codigo, /\/\*/, 'sin barra-asterisco (los tests quitan comentarios con una regex)');
});

test('4. el desplegable: en la pestaña anotada, el toque captura; si no se guardó, la pestaña queda', () => {
  const p = sinComentarios(leer('extension/popup.js'));
  const arrancar = p.slice(p.indexOf('async function arrancar() {'), p.indexOf('void arrancar();'));
  assert.ok(arrancar.indexOf('capturaPendiente()') > 0 && arrancar.indexOf('capturaPendiente()') < arrancar.indexOf('prepararSpy()'),
    'la captura pendiente va antes que «Guardar en Spy»');
  const cap = p.slice(p.indexOf('async function capturarPagina(p) {'), p.indexOf('async function arrancar() {'));
  assert.match(cap, /files: \['spy-pagina\.js'\], world: 'ISOLATED'/, 'el lector, en el mundo aislado');
  assert.match(cap, /chrome\.tabs\.captureVisibleTab\(p\.windowId, \{ format: 'jpeg'/, 'la foto de lo que se ve');
  const noOk = cap.indexOf('if (!datos?.ok) {');
  const lista = cap.indexOf("enviar({ tipo: 'SPY_CAPTURA_LISTA'");
  assert.ok(noOk > 0 && lista > noOk, 'cerrar la pestaña va DESPUÉS de saber que se guardó');
  assert.match(cap.slice(noOk, lista), /return;\s*\}/, 'si no se guardó (el desafío), vuelve sin cerrar la pestaña');
  assert.match(p, /const p = spyCapturas && spyCapturas\[String\(tab\.id\)\];/, 'sólo la pestaña que abrió Spy');
});

const CAPTURA: CapturaDePagina = {
  final: 'https://beacons.page/denborg', titulo: 'Den Borg · Beacons',
  texto: 'Den Borg. Marca Personal 360: el evento presencial para construir tu marca personal. Compra tu entrada.',
  enlaces: ['https://passline.example.com/eventos/360', 'https://www.instagram.com/den.borgg/', 'https://beacons.page/otra', 'https://cursos.example.com/academia'],
  html: '<html><head><title>Den Borg · Beacons</title></head><body>…</body></html>',
};

test('5. el servidor: el desafío, su error, una página que no carga y una captura vacía no se guardan', () => {
  assert.equal(juzgarCaptura(CAPTURA, true), 'ok');
  const desafio = { ...CAPTURA, titulo: 'Just a moment...', texto: 'Verifying you are human. This may take a few seconds.', html: '<html><head><title>Just a moment...</title></head><body><div id="challenge-running"></div><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script></body></html>' };
  assert.equal(juzgarCaptura(desafio, true), 'desafio', 'el desafío no es la página: la pestaña queda para pasarlo');
  assert.equal(juzgarCaptura({ ...CAPTURA, titulo: '500', texto: '500 Internal Server Error' }, true), 'error');
  assert.equal(juzgarCaptura({ ...CAPTURA, texto: '', titulo: '' }, false), 'vacia', 'no cargó y no hay foto');
  assert.equal(juzgarCaptura({ ...CAPTURA, texto: 'Cargando…' }, true), 'ok', 'poco texto, con su foto, es una página (una de imágenes)');

  // Una captura vacía o con basura no es una captura.
  assert.equal(leerCapturaDePagina(null), null);
  assert.equal(leerCapturaDePagina({}), null);
  assert.equal(leerCapturaDePagina({ final: 'javascript:alert(1)', texto: 'x' }), null);
  const sana = leerCapturaDePagina({ final: 'https://beacons.page/denborg', titulo: 7, texto: 'hola', enlaces: ['https://a.example.com/x', 'ftp://b', 3], html: 'h'.repeat(90_000) });
  assert.deepEqual(sana && { ...sana, html: sana.html.length }, { final: 'https://beacons.page/denborg', titulo: '', texto: 'hola', enlaces: ['https://a.example.com/x'], html: 30_000 });

  // Sus otras páginas: sólo de una página de enlaces, sin sus redes ni otra página de enlaces.
  assert.deepEqual(paginasDeLaCaptura('https://beacons.page/denborg', CAPTURA), ['https://passline.example.com/eventos/360', 'https://cursos.example.com/academia']);
  assert.deepEqual(paginasDeLaCaptura('https://denborg.example.com/', { ...CAPTURA, final: 'https://denborg.example.com/' }), [], 'el menú de un sitio no son «sus páginas»');

  // Lo guardado: sano, por su dirección, las más nuevas y con tope.
  const p = (i: number): PaginaCapturada => ({ url: `https://p${i}.example.com/`, final: `https://p${i}.example.com/`, titulo: `P${i}`, foto: null, paginas: [], texto: '', capturadaEn: `2026-11-04T10:${String(i).padStart(2, '0')}:00Z` });
  let reg: Record<string, PaginaCapturada> = {};
  for (let i = 0; i < PAGINAS_POR_COMPETIDOR + 3; i++) reg = conPaginaCapturada(reg, p(i));
  assert.equal(Object.keys(reg).length, PAGINAS_POR_COMPETIDOR);
  assert.equal(capturaDe(reg, 'https://p0.example.com/'), null, 'la más vieja se va');
  assert.equal(capturaDe(reg, `https://p${PAGINAS_POR_COMPETIDOR + 2}.example.com`)?.titulo, `P${PAGINAS_POR_COMPETIDOR + 2}`, 'se encuentra con o sin la barra');
  assert.deepEqual(Object.keys(leerPaginasCapturadas(JSON.stringify({ a: { url: 'javascript:x', capturadaEn: 'h' }, b: p(1) }))), ['b'], 'lo que no tiene forma se deja afuera');
  assert.deepEqual(leerPaginasCapturadas('no es json'), {});
});

test('6. la captura entra por la ruta de la extensión, sólo para SUS páginas; la pantalla muestra la foto', () => {
  const ruta = sinComentarios(leer('app/api/competitor-spy/extension/route.ts'));
  assert.match(ruta, /if \(cuerpo\.accion === 'pagina'\) \{[\s\S]*?guardarPaginaCapturada\(id, url, captura, cuerpo\.foto\)/);
  assert.match(ruta, /runWithWorkspace\(ws,/, 'en el negocio del token');
  const srv = sinComentarios(leer('lib/spy-pagina-capturada-servidor.ts'));
  const guardar = srv.slice(srv.indexOf('export async function guardarPaginaCapturada'), srv.indexOf('export async function esCompetidorDelNegocio'));
  assert.ok(guardar.indexOf("no('no-es-suya')") > 0 && guardar.indexOf("no('no-es-suya')") < guardar.indexOf('juzgarCaptura('), 'primero que sea suya');
  assert.ok(guardar.indexOf('if (juicio !== \'ok\') return no(juicio);') < guardar.indexOf('subirFotoDePagina('), 'lo que no es la página no sube nada');
  assert.match(srv, /subirFotoDePagina\(`spy\/pagina\/\$\{ws\}\/\$\{competidorId\}\//, 'la foto, en la carpeta del negocio');
  const paginas = sinComentarios(leer('app/api/competitor-spy/paginas/route.ts'));
  assert.match(paginas, /soloAdminDeTab\('market-an'\)/);
  assert.match(paginas, /esCompetidorDelNegocio\(id\)/);
  assert.match(paginas, /\(\{ texto: _texto, \.\.\.p \}\) => p/, 'a la pantalla no viaja el texto');
  assert.match(sinComentarios(leer('app/api/competitor-spy/pagina/route.ts')), /const suyas = await paginasSuyas\(id\)/);

  const sp = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.match(sp, /if \(ext !== 'si'\) \{ setPideExt\(u\); return; \}/, 'sin la extensión que sabe, se pide');
  assert.match(sp, /pedirCaptura\(window as unknown as/);
  assert.match(sp, /Se abrió en otra pestaña\. Cuando la veas, toca el ícono de MaKo\./, 'lo único que necesita Martín, en una frase');
  assert.match(sp, /if \(f\.lista\) setVueltaCapturas\(\(n\) => n \+ 1\);/, 'al capturar, se trae sola');
  assert.match(sp, /const conFoto = conAbrirGrande && conVistaPrevia && !!capturada\?\.foto && capturando !== url;/, 'la foto, si el servidor no la muestra');
  assert.match(sp, /\.\.\.Object\.values\(capturas\)\.flatMap\(\(c\) => c\.paginas\)/, 'sus otras páginas, al desplegable');
});

test('7. sin permisos nuevos, la versión que sabe capturar, y la política lo dice', () => {
  const m = JSON.parse(leer('extension/manifest.json')) as { version: string; permissions: string[]; host_permissions: string[]; optional_host_permissions?: string[] };
  // La que se publica sabe capturar: no es MÁS VIEJA que la primera que supo (`VERSION_CAPTURA`). Era `equal` y dio rojo en la 0.77.0
  // («Guardar en MaKo», 6/11/2026), que no le cambió nada a la captura: subir la versión es lo normal, bajarla es lo que se cuida.
  assert.equal(esMasVieja(m.version, VERSION_CAPTURA), false, `la extensión ${m.version} es más vieja que la que sabe capturar (${VERSION_CAPTURA})`);
  assert.deepEqual(m.permissions, ['storage', 'alarms', 'webRequest', 'scripting', 'activeTab'], 'un permiso nuevo lo revisa la tienda y desactiva la extensión');
  assert.deepEqual(m.host_permissions, ['https://hola-mako.com/*', 'https://labs.google/*', 'https://flow.google.com/*', 'https://aisandbox-pa.googleapis.com/*', 'https://web.whatsapp.com/*']);
  assert.equal(m.optional_host_permissions, undefined);
  const pol = leer('app/privacidad/extension/page.tsx');
  assert.match(pol, /<H>Al capturar una página de un competidor<\/H>/);
  assert.match(pol, /<strong>abre esa página en una pestaña, a la vista<\/strong>/);
  assert.match(pol, /<strong>Recién cuando tocas el ícono de MaKo en esa pestaña<\/strong>/);
  assert.match(pol, /la extensión no hace\s+clic ni resuelve nada por ti/);
});
