// =============================================================================
// El LECTOR de landings en el navegador de la persona (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...», y su decisión: «si detecta que tenes el pixel instalado, que lo haga
// desde allí y sino desde la ventana emergente», con el aviso de las ventanas bloqueadas «para ambos».
// Lo que estos tests cuidan (lib/editor-landing/lector*.ts, app/m.js, la ruta de la página de afuera, el
// Pixel y el «Probar»):
//   · el saneo: sólo SU id, sólo la forma, los topes; el texto lo arma MaKo y no la página;
//   · lo que va al server tiene la forma que el server acepta (se pasa por SU `sanearLectura`);
//   · la ventana: sólo la abre MaKo (`Sec-Fetch-Site`), decide el camino con UNA bajada, va aislada con
//     la guarda ADELANTE de todo, y el módulo suelto de una app va en línea;
//   · los scripts que se sirven compilan y no traen lo que rompe un `<script>` ni un template;
//   · el Pixel v24 no mide nada con `?mako_leer=` y la ventana de MaKo detrás, y carga el lector;
//   · `leerEnNavegador`: bloqueada → no navega; cerrada al instante → bloqueada; el final mandado
//     mientras la página se va (sin `ev.source`) se acepta sólo después del saludo.
//
// LO QUE NO SE PUEDE PROBAR ACÁ (no hay navegador en node:test) se midió en Chromium headless con un
// arnés en el scratchpad (14/10/2026): una landing de prueba por los dos caminos (desplegables, pestañas,
// modal, window.open, scroll, location.href, submit, agenda), una app de Vite de prueba (módulo sin CORS,
// router por pathname, localStorage) y la landing real del caso por la ventana: 445 palabras y la agenda
// «cargó, 700 px», donde antes salía «No pude leer el texto de esa página».
//
// PROBADO ROMPIÉNDOLO (14/10/2026): ver el bloque «ROTURAS» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script, createContext, runInContext } from 'node:vm';
import {
  FORMA_ID_LECTURA, PARAM_LEER, TOPES_LECTOR, VERSION_PIXEL_LECTOR,
  aLecturaDelServer, armarTextoLectura, idLecturaValido, nuevoIdLectura, origenDeLecturaValido,
  sanearMensajeLectura, sanearPiezas, urlConLectura,
} from '../lib/editor-landing/lector';
import {
  JS_APAGAR_RASTREADORES, JS_LECTOR, JS_PRELUDIO_VENTANA, PARAM_LECTOR_CARGADOR,
  responderLectorDelPixel, scriptLector, scriptPreludio,
} from '../lib/editor-landing/lector-script';
import {
  documentoLector, esModuloSuelto, modulosDelDocumento, pedidoDeLector, responderPaginaLector, tienePixelConLector,
} from '../lib/editor-landing/lector-pagina';
import { leerEnNavegador, rutaLector } from '../lib/editor-landing/lector-navegador';
import { sanearLectura } from '../lib/editor-landing/lectura-reglas';
import { lineaCargador } from '../lib/pixel-cargador';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ID = 'abcdefghijklmnopQRSTUV_-12';
const MAKO = 'https://hola-mako.com';
const URL_L = 'https://su-landing.com/oferta';
const BT = String.fromCharCode(96);

// ─────────────────────────────────────────────────────────────────────────────
// El saneo y el texto
// ─────────────────────────────────────────────────────────────────────────────

const fin = (piezas: unknown[], extra: Record<string, unknown> = {}) =>
  ({ tipo: 'mako-lectura', id: ID, fase: 'fin', camino: 'ventana', titulo: 'T', ms: 1234, quieto: true, parcial: false, piezas, ...extra });

test('el mensaje: sólo SU id y la forma; la URL la pone MaKo, no la página', () => {
  const esperado = { id: ID, url: URL_L };
  assert.equal(sanearMensajeLectura(fin([]), { id: 'otroidotroidotroid12', url: URL_L }), null, 'otro id');
  assert.equal(sanearMensajeLectura({ ...fin([]), tipo: 'otra-cosa' }, esperado), null, 'otro tipo');
  assert.equal(sanearMensajeLectura({ ...fin([]), camino: 'cualquiera' }, esperado), null, 'camino sin forma');
  assert.equal(sanearMensajeLectura('hola', esperado), null);
  assert.deepEqual(sanearMensajeLectura({ tipo: 'mako-lectura', id: ID, fase: 'hola', camino: 'pixel' }, esperado), { fase: 'hola', camino: 'pixel' });
  const e = sanearMensajeLectura({ tipo: 'mako-lectura', id: ID, fase: 'error', error: 'x'.repeat(900) }, esperado);
  assert.equal(e?.fase, 'error');
  assert.ok(e?.fase === 'error' && e.mensaje.length <= TOPES_LECTOR.error);
  const m = sanearMensajeLectura(fin([{ tipo: 'texto', texto: 'Hola' }], { url: 'https://otra.com/' }), esperado);
  assert.ok(m?.fase === 'fin');
  assert.equal(m.detalle.url, URL_L, 'la URL de la lectura es la que se pidió, nunca la que dice la página');
  assert.equal(m.detalle.camino, 'ventana');
  assert.equal(m.detalle.ms, 1234);
});

test('las piezas: destinos saneados, textos seguidos juntos, y los topes cortan (y lo dicen)', () => {
  const { piezas } = sanearPiezas([
    { tipo: 'texto', texto: 'Uno' }, { tipo: 'texto', texto: 'Dos' },
    { tipo: 'boton', texto: 'Malo', destino: { tipo: 'url', valor: 'javascript:alert(1)' } },
    { tipo: 'boton', texto: 'Sale', destino: { tipo: 'url', valor: '' } },
    { tipo: 'boton', texto: 'Ancla', destino: { tipo: 'ancla', valor: 'sin-numeral' } },
    { tipo: 'boton', texto: '   ', destino: { tipo: 'nada' } },
    { tipo: 'calendario', proveedor: 'inventado', url: 'https://calendly.com/x', alto: -5, cargo: 'si' },
    { tipo: 'script', texto: '<b>' },
  ]);
  assert.deepEqual(piezas[0], { tipo: 'texto', texto: 'Uno\nDos' });
  assert.deepEqual(piezas[1], { tipo: 'boton', texto: 'Malo', destino: { tipo: 'nada' } }, 'javascript: no es un destino');
  assert.deepEqual(piezas[2], { tipo: 'boton', texto: 'Sale', destino: { tipo: 'url', valor: '' } }, "'' = salió a otra página");
  assert.deepEqual(piezas[3], { tipo: 'boton', texto: 'Ancla', destino: { tipo: 'nada' } });
  assert.deepEqual(piezas[4], { tipo: 'calendario', proveedor: 'otro', url: 'https://calendly.com/x', alto: 0, cargo: null });
  assert.equal(piezas.length, 5, 'el botón sin texto y el tipo desconocido no entran');
  const muchas = sanearPiezas(Array.from({ length: TOPES_LECTOR.piezas + 50 }, (_, i) => ({ tipo: 'boton', texto: `B${i}`, destino: { tipo: 'nada' } })));
  assert.equal(muchas.piezas.length, TOPES_LECTOR.piezas);
  assert.equal(muchas.cortada, true);
  const larga = sanearPiezas(Array.from({ length: 40 }, () => ({ tipo: 'texto', texto: 'p'.repeat(3_000) })));
  const p0 = larga.piezas[0];
  assert.ok(larga.cortada && p0?.tipo === 'texto' && p0.texto.length <= TOPES_LECTOR.texto + 50);
});

test('el texto: las marcas en el orden de la página, sin renglones repetidos', () => {
  const t = armarTextoLectura([
    { tipo: 'texto', texto: '# Título' },
    { tipo: 'desplegable', pregunta: '¿Cuánto dura?', respuesta: 'Dura 90 días.\nCon soporte.' },
    { tipo: 'boton', texto: 'Agenda', destino: { tipo: 'ancla', valor: '#agenda', existe: false } },
    { tipo: 'boton', texto: 'Agenda', destino: { tipo: 'ancla', valor: '#agenda', existe: false } },
    { tipo: 'boton', texto: 'Ver', destino: { tipo: 'modal', valor: 'Detalles' } },
    { tipo: 'boton', texto: 'Ir', destino: { tipo: 'url', valor: '' } },
    { tipo: 'calendario', proveedor: 'calendly', url: 'https://calendly.com/x', alto: 700, cargo: true },
    { tipo: 'calendario', proveedor: 'cal', url: '', alto: 0, cargo: null },
  ]);
  assert.equal(t, [
    '# Título',
    '[DESPLEGABLE] ¿Cuánto dura? → Dura 90 días. / Con soporte.',
    '[BOTÓN] Agenda → #agenda (no existe en la página)',
    '[BOTÓN] Ver → abre una ventana: «Detalles»',
    '[BOTÓN] Ir → sale a otra página',
    '[CALENDARIO] Calendly (https://calendly.com/x) → cargó, 700 px de alto',
    '[CALENDARIO] Cal.com → sin comprobar',
  ].join('\n'));
});

test('lo que va al server pasa por SU saneo (lectura-reglas.ts) sin perder nada', () => {
  const m = sanearMensajeLectura(fin([
    { tipo: 'texto', texto: 'Hola' },
    { tipo: 'desplegable', pregunta: '¿Qué?', respuesta: 'Esto' },
    { tipo: 'boton', texto: 'Agenda', destino: { tipo: 'url', valor: 'https://calendly.com/x' } },
    { tipo: 'boton', texto: 'Agenda', destino: { tipo: 'url', valor: 'https://calendly.com/x' } },
    { tipo: 'boton', texto: 'Enviar', destino: { tipo: 'formulario', valor: 'https://su-landing.com/enviar' } },
    { tipo: 'calendario', proveedor: 'calendly', url: 'https://calendly.com/x', alto: 700, cargo: false },
  ]), { id: ID, url: URL_L });
  assert.ok(m?.fase === 'fin');
  const alServer = aLecturaDelServer(m.detalle);
  assert.equal(alServer.fuente, 'navegador');
  assert.equal(alServer.interacciones.length, 4, 'el botón repetido se probó una vez');
  const saneada = sanearLectura(JSON.parse(JSON.stringify(alServer)));
  assert.ok(saneada, 'el server la rechazó: los dos contratos se separaron');
  assert.equal(saneada.texto, alServer.texto);
  assert.deepEqual(saneada.interacciones, alServer.interacciones);
  assert.deepEqual(saneada.interacciones.map((i) => i.tipo), ['desplegable', 'boton', 'formulario', 'calendario']);
  assert.match(saneada.interacciones[3].texto, /no cargó/);
});

test('el id, el origen y la URL de la página real', () => {
  const a = nuevoIdLectura();
  assert.ok(idLecturaValido(a) && a.length === 24 && a !== nuevoIdLectura());
  assert.ok(!idLecturaValido('corto') && !idLecturaValido(`${'a'.repeat(20)}"`) && !idLecturaValido(42));
  assert.equal(urlConLectura('https://a.com/x?y=1#precios', ID), `https://a.com/x?y=1&${PARAM_LEER}=${ID}#precios`, 'antes del #: si no, location.search no lo ve');
  assert.equal(urlConLectura('javascript:alert(1)', ID), null);
  assert.equal(urlConLectura(URL_L, 'malo'), null);
  assert.ok(origenDeLecturaValido('null', URL_L, MAKO), 'la ventana aislada');
  assert.ok(origenDeLecturaValido(MAKO, URL_L, MAKO));
  assert.ok(origenDeLecturaValido('https://www.su-landing.com', URL_L, MAKO), 'con o sin www');
  assert.ok(!origenDeLecturaValido('https://otra.com', URL_L, MAKO));
  assert.ok(!origenDeLecturaValido('https://su-landing.com.evil.io', URL_L, MAKO));
});

// ─────────────────────────────────────────────────────────────────────────────
// La ventana sin Pixel
// ─────────────────────────────────────────────────────────────────────────────

const pedido = (h: Record<string, string>) => new Request(`${MAKO}/x`, { headers: h });
const DE_MAKO = { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin' };

test('la ventana sólo la abre una página de MaKo', () => {
  assert.ok(pedidoDeLector(pedido(DE_MAKO)));
  assert.ok(!pedidoDeLector(pedido({ ...DE_MAKO, 'sec-fetch-site': 'cross-site' })), 'un link desde otra página');
  assert.ok(!pedidoDeLector(pedido({ ...DE_MAKO, 'sec-fetch-site': 'none' })), 'un link pegado en la barra o en un mail');
  assert.ok(!pedidoDeLector(pedido({ ...DE_MAKO, 'sec-fetch-dest': 'iframe' })));
  assert.ok(!pedidoDeLector(pedido({})));
});

test('el Pixel con lector: la línea de /m.js sí, el código pegado desde la v24, y con dos copias manda la vieja', () => {
  const linea = lineaCargador('mko_' + 'ab'.repeat(16), MAKO);
  const pegado = (v: number) => `<script>var ENDPOINT = '${MAKO}/api/track/vsl'; var CUENTA = 'mko_x1234'; var SV = ${v};</script>`;
  assert.ok(tienePixelConLector(`<html>${linea}</html>`, VERSION_PIXEL_LECTOR));
  assert.ok(tienePixelConLector(pegado(VERSION_PIXEL_LECTOR), VERSION_PIXEL_LECTOR));
  assert.ok(!tienePixelConLector(pegado(VERSION_PIXEL_LECTOR - 1), VERSION_PIXEL_LECTOR), 'el código de antes no trae el lector');
  assert.ok(!tienePixelConLector(`${pegado(22)}${linea}`, VERSION_PIXEL_LECTOR), 'la copia vieja corre primero y se queda con la página');
  assert.ok(!tienePixelConLector('<html>sin nada</html>', VERSION_PIXEL_LECTOR));
});

test('el módulo de una app: sólo el que corre solo va en línea', () => {
  assert.ok(esModuloSuelto('const a=1;window.x=a;export{};'));
  assert.ok(!esModuloSuelto('import{r as e}from"./vendor-1.js";e()'));
  assert.ok(!esModuloSuelto('var x=1;import"./estilos.css";'));
  assert.ok(!esModuloSuelto('const P=()=>import("./Pagina-2.js");'));
  assert.ok(!esModuloSuelto('export*from"./otro.js"'));
  assert.ok(!esModuloSuelto('   '));
  assert.deepEqual(
    modulosDelDocumento('<script type="module" crossorigin src="/assets/i.js"></script><script src="/c.js"></script><script type=module src=\'x/m.js?a=1&amp;b=2\'></script>', 'https://a.com/p/'),
    ['https://a.com/assets/i.js', 'https://a.com/p/x/m.js?a=1&b=2'],
  );
});

const HTML_AFUERA = '<!doctype html><html lang="es"><head><title>T</title>'
  + '<script src="/antes.js"></script>'
  + '<link rel="stylesheet" crossorigin href="/a.css" integrity="sha384-x"><link rel="modulepreload" href="/v.js">'
  + '<script type="module" crossorigin src="/assets/i.js"></script>'
  + '<script>!function(f,b,e,v){f.fbq=1}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");</script>'
  + `<script src="${MAKO}/m.js?id=mko_${'cd'.repeat(16)}" defer></script>`
  + '</head><body><div id=root></div></body></html>';

test('el documento: la guarda y el camino ANTES que cualquier cosa de la página, y el <base> después', () => {
  const codigo = 'console.log("</script><!--")';
  const d = documentoLector(HTML_AFUERA, URL_L + '?a=1#x', ID, MAKO, new Map([['https://su-landing.com/assets/i.js', codigo]]));
  assert.ok(d);
  assert.ok(d.startsWith('<!doctype html><html><head><meta charset="utf-8"><script>(function (ruta)'), 'el preludio va primero');
  const iPre = d.indexOf('(function (ruta)'), iBase = d.indexOf('<base href='), iLector = d.indexOf('(function (id, camino, origenMako)');
  const iPagina = d.indexOf('/antes.js');
  assert.ok(iPre < iBase && iBase < iLector && iLector < iPagina, `orden: preludio ${iPre}, base ${iBase}, lector ${iLector}, página ${iPagina}`);
  assert.ok(d.includes('("/oferta?a=1#x")'), 'el router de la app ve el camino de la landing');
  assert.ok(d.includes('<base href="https://su-landing.com/oferta?a=1#x">'));
  assert.ok(d.includes('<link rel="stylesheet" href="/a.css">'), 'la hoja sin crossorigin ni integrity: así no hace falta CORS');
  assert.ok(!/modulepreload|fbevents|\/m\.js\?id=/.test(d), 'sin precargas, sin rastreadores y sin el Pixel de MaKo');
  assert.ok(!d.includes('src="/assets/i.js"'), 'el módulo bajado va en línea');
  assert.ok(d.includes('URL.createObjectURL(new Blob(['));
  assert.equal(d.split('</script').length - 1, d.split('<script').length - 1, 'cada <script> cierra una sola vez: el código en línea no trae «</script»');
  const sinMod = documentoLector(HTML_AFUERA, URL_L, ID, MAKO);
  assert.ok(sinMod?.includes('<script type="module" crossorigin src="/assets/i.js">'), 'un módulo que no se bajó queda como estaba');
  assert.equal(documentoLector(HTML_AFUERA, URL_L, 'malo', MAKO), null);
});

test('la respuesta de la ruta: la puerta, el Pixel por 303 y la página aislada', async () => {
  let bajadas = 0;
  const dep = (html: string, modulo = { codigo: 'window.x=1;', cors: false }) => ({
    bajar: async () => { bajadas++; return html; },
    bajarModulo: async () => modulo,
    actual: VERSION_PIXEL_LECTOR,
    origen: MAKO,
  });
  const p = (camino: string | null = null, id = ID) => ({ url: URL_L, id, camino });
  assert.equal((await responderPaginaLector(pedido({ ...DE_MAKO, 'sec-fetch-site': 'cross-site' }), p(), dep('x'))).status, 403);
  assert.equal((await responderPaginaLector(pedido(DE_MAKO), p(null, 'malo'), dep('x'))).status, 404);
  assert.equal((await responderPaginaLector(pedido(DE_MAKO), p('cualquiera'), dep('x'))).status, 404);
  assert.equal(bajadas, 0, 'nada de eso baja la página');
  const px = await responderPaginaLector(pedido(DE_MAKO), p('pixel'), dep('x'));
  assert.equal(px.status, 303);
  assert.equal(px.headers.get('location'), `${URL_L}?${PARAM_LEER}=${ID}`);
  assert.equal(bajadas, 0, 'con el Pixel ya sabido no se baja nada');
  const conLinea = await responderPaginaLector(pedido(DE_MAKO), p(), dep(HTML_AFUERA));
  assert.equal(conLinea.status, 303, 'la página trae la línea de /m.js: a la página real');
  const forzada = await responderPaginaLector(pedido(DE_MAKO), p('ventana'), dep(HTML_AFUERA));
  assert.equal(forzada.status, 200);
  assert.match(forzada.headers.get('content-security-policy') ?? '', /^sandbox /, 'aislada: origen opaco');
  assert.equal(forzada.headers.get('cache-control'), 'private, no-store');
  const doc = await forzada.text();
  assert.ok(doc.includes('URL.createObjectURL'), 'el módulo suelto va en línea');
  const conCors = await (await responderPaginaLector(pedido(DE_MAKO), p('ventana'), dep(HTML_AFUERA, { codigo: 'window.x=1;', cors: true }))).text();
  assert.ok(conCors.includes('<script type="module" crossorigin src="/assets/i.js">'), 'si su server manda CORS, carga solo');
  const caida = await responderPaginaLector(pedido(DE_MAKO), p(), { ...dep('x'), bajar: async () => { throw new Error('La página respondió 404.'); } });
  assert.equal(caida.status, 200);
  const err = await caida.text();
  assert.ok(err.includes("fase:'error'") && err.includes(JSON.stringify(ID)) && err.includes('La página respondió 404.'), 'le avisa a MaKo');
});

// ─────────────────────────────────────────────────────────────────────────────
// Los scripts que se sirven
// ─────────────────────────────────────────────────────────────────────────────

test('los scripts compilan y no traen lo que rompe un template ni un <script>', () => {
  for (const [nombre, js] of [['JS_LECTOR', JS_LECTOR], ['JS_PRELUDIO_VENTANA', JS_PRELUDIO_VENTANA], ['JS_APAGAR_RASTREADORES', JS_APAGAR_RASTREADORES]] as const) {
    assert.doesNotThrow(() => new Script(`(${js});`), `${nombre} no compila`);
    assert.ok(!js.includes(BT), `${nombre} trae un backtick`);
    assert.ok(!js.includes('$' + '{'), `${nombre} trae una interpolación suelta`);
    assert.ok(!js.includes('<' + '/'), `${nombre} cerraría su <script>`);
  }
  assert.ok(JS_LECTOR.includes("m.tipo = 'mako-lectura'") && JS_LECTOR.includes("d.fase === 'dale'"), 'el protocolo de lector.ts');
  assert.ok(JS_LECTOR.includes('ev.source === abre && ev.origin === origenMako'), 'el «dale» sólo de la ventana de MaKo');
  assert.ok(JS_LECTOR.includes('if (!abre) return;'), 'sin la ventana de MaKo detrás no hace nada');
  assert.ok(JS_LECTOR.includes('ev.preventDefault(); ev.stopImmediatePropagation();'), 'un submit nunca sale');
  assert.ok(JS_PRELUDIO_VENTANA.indexOf("String(self.origin) === 'null'") < JS_PRELUDIO_VENTANA.indexOf('replaceState'), 'la guarda antes que nada');
  assert.ok(JS_APAGAR_RASTREADORES.includes("['fbq', '_fbq'].forEach(function (k) { try { window[k] = mudo(); }"), 'un fbq que ya existe: el código de Meta no se baja');
  for (const js of [scriptLector(ID, 'pixel', MAKO), scriptPreludio('/x')]) assert.doesNotThrow(() => new Script(js!));
  assert.equal(scriptLector(ID, 'pixel', 'https://hola-mako.com/ruta'), null, 'un origen es sólo el origen');
  assert.equal(scriptLector('"+alert(1)+"aaaaaaaaaaaaaa', 'pixel', MAKO), null, 'el id va adentro del JS: sólo con su forma');
  assert.equal(scriptLector(ID, 'otro' as 'pixel', MAKO), null);
  assert.ok(scriptPreludio('//evil.com/x').includes('("/")'), 'un camino que empieza con // sería otro host');
});

test('el preludio: sin aislar frena la página; aislada, le pone el camino de la landing y storage de memoria', () => {
  const correr = (origen: string) => {
    const hechos: string[] = [];
    const ctx = createContext({
      self: { origin: origen },
      location: { protocol: 'https:', host: 'hola-mako.com' },
      history: { state: null, replaceState: (_s: unknown, _t: string, u: string) => { hechos.push(`camino ${u}`); } },
      navigator: {},
      Element: function () {}, XMLHttpRequest: function () {},
      document: {},
    });
    runInContext('var window = this;', ctx);
    (ctx as { window: { stop: () => void } }).window.stop = () => { hechos.push('stop'); };
    Object.defineProperty(ctx, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    runInContext(scriptPreludio('/oferta?a=1'), ctx);
    let ls: unknown = null;
    try { ls = runInContext("localStorage.setItem('k', 'v'); localStorage.getItem('k')", ctx); } catch { ls = 'tira'; }
    return { hechos, ls };
  };
  const sinAislar = correr('https://hola-mako.com');
  assert.deepEqual(sinAislar.hechos, ['stop'], 'sin la política sandbox no corre nada más: ni el camino ni la página');
  const aislada = correr('null');
  assert.deepEqual(aislada.hechos, ['camino https://hola-mako.com/oferta?a=1']);
  assert.equal(aislada.ls, 'v', 'un localStorage que tira se reemplaza por uno de memoria');
});

test('/m.js?leer=: el lector para el camino del Pixel, sin caché; un id sin forma, un comentario', () => {
  const ok = responderLectorDelPixel(ID, MAKO);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['Cache-Control'], 'private, no-store');
  assert.equal(ok.headers['Content-Type'], 'application/javascript; charset=utf-8');
  assert.doesNotThrow(() => new Script(ok.cuerpo));
  assert.ok(ok.cuerpo.includes(`(${JSON.stringify(ID)}, "pixel", "${MAKO}")`));
  const malo = responderLectorDelPixel('</script>', MAKO);
  assert.equal(malo.status, 404);
  assert.match(malo.cuerpo, /^\/\* MaKo: .* \*\/\n$/);
  const ruta = sinComentarios(leer('app/m.js/route.ts'));
  const iLector = ruta.indexOf('responderLectorDelPixel(leer, req.nextUrl.origin)');
  assert.ok(iLector > 0 && iLector < ruta.indexOf('responderCargador('), 'la ruta contesta el lector ANTES del Pixel, con su origen');
  assert.match(ruta, /searchParams\.get\(PARAM_LECTOR_CARGADOR\)/);
  const pagina = sinComentarios(leer('app/api/landing-generator/diagnostico/pagina/route.ts'));
  assert.ok(pagina.indexOf("if (rol !== 'admin')") < pagina.indexOf('responderPaginaLector('), 'la ventana pasa por la misma puerta');
});

// ─────────────────────────────────────────────────────────────────────────────
// El Pixel v24
// ─────────────────────────────────────────────────────────────────────────────

/** El snippet de VERDAD (lib/landing-token.ts es server-only: se arma en un node aparte con la condición del server). */
function snippetReal(): { codigo: string; version: number } {
  const m = (r: string) => JSON.stringify(pathToFileURL(join(RAIZ, r)).href);
  const codigo = [
    `import { landingSnippet, SNIPPET_VERSION } from ${m('lib/landing-token.ts')};`,
    `import { pixelComoArchivo } from ${m('lib/pixel-archivo.ts')};`,
    `process.stdout.write(JSON.stringify({ codigo: pixelComoArchivo(landingSnippet('mko_${'ef'.repeat(16)}')), version: SNIPPET_VERSION }));`,
  ].join('\n');
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, APP_BASE_URL: 'https://app.ejemplo.com' },
  }));
}

test('el Pixel v24: con ?mako_leer= y la ventana de MaKo detrás no mide nada y carga el lector', () => {
  const { codigo, version } = snippetReal();
  assert.ok(version >= VERSION_PIXEL_LECTOR, `SNIPPET_VERSION ${version} es menor que VERSION_PIXEL_LECTOR ${VERSION_PIXEL_LECTOR}: la ruta mandaría al Pixel una página que no lo trae`);
  assert.ok(codigo.includes(`/${FORMA_ID_LECTURA.source}/.test(leer)`), 'el Pixel acepta el id con la MISMA forma que MaKo');
  assert.ok(codigo.indexOf(`get('${PARAM_LEER}')`) < codigo.indexOf('function enviar('), 'la lectura va antes de cualquier medición');
  const correr = (search: string, opener: unknown) => {
    const agregados: string[] = [];
    let pedidos = 0;
    const ctx = createContext({
      window: { opener }, location: { search, href: `https://su-landing.com/${search}` }, URLSearchParams,
      document: { createElement: () => ({ src: '' }), head: { appendChild: (s: { src: string }) => { agregados.push(s.src); } } },
      fetch: () => { pedidos++; return Promise.resolve({}); },
    });
    try { runInContext(codigo, ctx); } catch { /* sin opener sigue y choca con lo que no se simuló: se mira sólo lo de arriba */ }
    return { agregados, pedidos };
  };
  const leyendo = correr(`?${PARAM_LEER}=${ID}`, {});
  assert.deepEqual(leyendo.agregados, [`https://app.ejemplo.com/m.js?${PARAM_LECTOR_CARGADOR}=${ID}`]);
  assert.equal(leyendo.pedidos, 0, 'leerla no es una visita');
  assert.deepEqual(correr(`?${PARAM_LEER}=${ID}`, null).agregados, [], 'sin la ventana de MaKo, el parámetro no hace nada');
  assert.deepEqual(correr(`?${PARAM_LEER}=corto`, {}).agregados, [], 'un id sin forma no carga nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// leerEnNavegador (con una ventana de mentira)
// ─────────────────────────────────────────────────────────────────────────────

type Oyente = (ev: { source: unknown; origin: string; data: unknown }) => void;

function navegadorFalso(abrir: 'si' | 'null' | 'cerrada') {
  const oyentes = new Set<Oyente>();
  const ventana = {
    closed: abrir === 'cerrada',
    navegada: '' as string,
    dale: [] as Array<{ data: unknown; destino: string }>,
    document: { title: '', body: { style: { cssText: '' }, textContent: '' } },
    location: { replace(u: string) { ventana.navegada = u; } },
    postMessage(data: unknown, destino: string) { ventana.dale.push({ data, destino }); },
    close() { ventana.closed = true; },
  };
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: MAKO, search: '?ws=9' },
    screen: { availWidth: 1440, availHeight: 900 },
    open: () => (abrir === 'null' ? null : ventana),
    addEventListener: (_: string, f: Oyente) => { oyentes.add(f); },
    removeEventListener: (_: string, f: Oyente) => { oyentes.delete(f); },
  };
  const mandar = (ev: { source: unknown; origin: string; data: unknown }) => { for (const f of [...oyentes]) f(ev); };
  return { ventana, mandar, oyentes };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('leerEnNavegador: bloqueada o cerrada al instante → no navega a nada', async () => {
  const a = navegadorFalso('null');
  assert.deepEqual(await leerEnNavegador(URL_L), { ok: false, motivo: 'bloqueadas', mensaje: 'Habilita las ventanas emergentes' });
  const b = navegadorFalso('cerrada');
  const r = await leerEnNavegador(URL_L);
  assert.equal(!r.ok && r.motivo, 'bloqueadas');
  assert.equal(b.ventana.navegada, '', 'cerrada al instante: no se navega');
  assert.equal(b.oyentes.size, 0, 'sin oyentes colgados');
  assert.equal(a.oyentes.size, 0);
  assert.equal((await leerEnNavegador('no es una url')).ok, false);
});

test('leerEnNavegador: el saludo, el «dale», y el final aunque llegue sin ev.source', async () => {
  const f = navegadorFalso('si');
  const p = leerEnNavegador(URL_L, { topeMs: 3_000 });
  await esperar(320);
  assert.match(f.ventana.navegada, /^\/api\/landing-generator\/diagnostico\/pagina\?url=https%3A%2F%2Fsu-landing\.com%2Foferta&lector=[A-Za-z0-9_-]{24}&ws=9$/);
  const id = new URL(f.ventana.navegada, MAKO).searchParams.get('lector')!;
  // Un final SIN source antes del saludo no se acepta (cualquiera podría mandarlo).
  f.mandar({ source: null, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'fin', camino: 'ventana', piezas: [{ tipo: 'texto', texto: 'trampa' }] } });
  // Otra ventana con el mismo id tampoco.
  f.mandar({ source: {}, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'hola', camino: 'ventana' } });
  assert.equal(f.ventana.dale.length, 0);
  f.mandar({ source: f.ventana, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'hola', camino: 'ventana' } });
  assert.deepEqual(f.ventana.dale, [{ data: { tipo: 'mako-lectura', id, fase: 'dale' }, destino: '*' }], 'a la ventana aislada, con «*»');
  f.mandar({ source: null, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'fin', camino: 'ventana', titulo: 'T', piezas: [{ tipo: 'texto', texto: 'Hola' }, { tipo: 'boton', texto: 'Ir', destino: { tipo: 'url', valor: '' } }], parcial: true } });
  const r = await p;
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.detalle.texto, 'Hola\n[BOTÓN] Ir → sale a otra página');
  assert.equal(r.lectura.fuente, 'navegador');
  assert.equal(f.ventana.closed, true, 'la ventana se cierra');
  assert.equal(f.oyentes.size, 0);
});

test('leerEnNavegador: sin respuesta, se corta en el tope y cierra la ventana', async () => {
  const f = navegadorFalso('si');
  const r = await leerEnNavegador(URL_L, { topeMs: 700, camino: 'pixel' });
  assert.deepEqual(r, { ok: false, motivo: 'tiempo', mensaje: 'La página no respondió' });
  assert.ok(f.ventana.navegada.includes('&camino=pixel'));
  assert.equal(f.ventana.closed, true);
  assert.equal(rutaLector(URL_L, ID, 'ventana', null), `/api/landing-generator/diagnostico/pagina?url=${encodeURIComponent(URL_L)}&lector=${ID}&camino=ventana`);
});

// ─────────────────────────────────────────────────────────────────────────────
// El aviso con la flecha, en los dos lugares
// ─────────────────────────────────────────────────────────────────────────────

test('el aviso de las ventanas: un componente, con flecha y en un portal, y el «Probar» del Pixel lo usa', () => {
  const aviso = sinComentarios(leer('app/landing-generator/lector/AvisoVentanasBloqueadas.tsx'));
  assert.match(aviso, /createPortal\(/);
  assert.match(aviso, /document\.body/);
  assert.match(aviso, /className="mk-puntero"/);
  assert.match(aviso, /className="mk-puntero__flecha"/);
  assert.match(aviso, /TITULO_VENTANAS = 'Habilita las ventanas emergentes'/);
  const probar = sinComentarios(leer('app/integraciones/ProbarTracking.tsx'));
  assert.match(probar, /<AvisoVentanasBloqueadas abierto=\{sinPermiso\}/);
  // Tanda 6 (la pantalla): la pestaña de la landing también se abre vacía en el clic, y su bloqueo frena igual,
  // ANTES del chequeo (la misma condición se repite después del `await`: la primera es la que vale).
  // Rotura (14/10/2026, de memoria, verificada por hash; base 18 / 0): la del clic sin `!pestana` → 17 / 1.
  const i = probar.indexOf('if (!chico || chico.closed || !pestana || pestana.closed) {');
  const iFetch = probar.indexOf("await fetch('/api/integraciones/landing/estado?diag=1'");
  assert.ok(i > 0 && i < iFetch, 'cerrada al instante = bloqueada, en el clic');
  assert.ok(iFetch < probar.indexOf("pestana.location.replace(`${base}${sep}mko_test="), 'la landing navega DESPUÉS del chequeo');
  const hook = sinComentarios(leer('app/landing-generator/lector/useLectorEnNavegador.tsx'));
  assert.ok(hook.indexOf('leerEnNavegador(url, opciones)') < hook.indexOf('setLeyendo(true)'), 'la ventana se abre antes de tocar el estado');
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTURAS (14/10/2026). Con todo en verde antes: 18 pasan / 0 fallan. Una rotura por vez, restaurando de
// memoria (un arnés en el scratchpad guarda el archivo, lo rompe, corre ESTE test y lo reescribe;
// comparado byte a byte después). Cada una, «N pasan / M fallan» y qué la cazó:
//   1. lector.ts sin comparar el id del mensaje ................. 17 / 1  «el mensaje»
//   2. lector.ts con la URL que dice la página .................. 17 / 1  «el mensaje»
//   3. lector.ts sin sanear la url de un botón (javascript:) .... 17 / 1  «las piezas»
//   4. lector.ts mandando otra `fuente` al server ............... 16 / 2  «lo que va al server», «el saludo»
//   5. lector-pagina.ts sin mirar Sec-Fetch-Site ................ 16 / 2  «la ventana sólo la abre…», «la respuesta de la ruta»
//   6. lector-pagina.ts con lo nuestro DESPUÉS de la página ..... 17 / 1  «el documento»
//   7. lector-pagina.ts con un import() en un módulo «suelto» ... 17 / 1  «el módulo de una app»
//   8. lector-pagina.ts tomando cualquier Pixel como con lector . 17 / 1  «el Pixel con lector»
//   9. lector-script.ts sin el «si no hay opener, nada» ......... 17 / 1  «los scripts compilan…»
//  10. lector-script.ts sin validar el id que va adentro del JS . 15 / 3  «el documento», «los scripts…», «/m.js?leer=»
//  11. landing-token.ts sin pedir la ventana de MaKo ............ 17 / 1  «el Pixel v24»
//  12. landing-token.ts con SNIPPET_VERSION en 23 ............... 17 / 1  «el Pixel v24»
//  13. lector-navegador.ts aceptando un final sin source siempre  17 / 1  «el saludo, el dale…»
//  14. lector-navegador.ts sin mirar si se cerró al instante .... 17 / 1  «bloqueada o cerrada al instante»
//  15. ProbarTracking.tsx con `if (!chico)` a secas ............. 17 / 1  «el aviso de las ventanas»
//  16. app/m.js sin contestar el lector ......................... 17 / 1  «/m.js?leer=» (la primera versión del
//      chequeo daba 18 / 0: miraba el orden con un indexOf que daba -1; ahora pide la llamada entera)
//  17. el preludio sin la guarda de aislamiento ................. 17 / 1  «el preludio»
// =============================================================================
