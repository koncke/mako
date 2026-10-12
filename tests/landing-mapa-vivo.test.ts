// =============================================================================
// El mapa de calor EN VIVO (v5, 12/10/2026): el puente, las dos puntas que validan, y lo que mira
// =============================================================================
// Decisión de Martín: la landing en vivo adentro de un celular, con el calor encima. Lo que se prueba acá:
//   · el PUENTE PUBLICADO (`public/replay/901/r.js`, no su fuente) corriendo en un `vm` con una ventana, un
//     documento y un padre de mentira: se instala sólo adentro de un marco, le habla SÓLO al origen de MaKo y
//     sólo le contesta a MaKo; no graba;
//   · la punta de MaKo (`leerMensajeDelPuente`): origen EXACTO y ventana por identidad;
//   · el contrato entre las dos: lo que manda el puente lo entiende la pantalla;
//   · dónde va cada toque sobre la página en vivo (`puntosEnVivo`);
//   · que la visita del mapa pida el puente y no el grabador (el beacon) y no gane a nadie;
//   · el filtro acotado de `verificarPagina` (`regexDeLaPagina`): no se queda corto nunca;
//   · que el mapa filtre con las MISMAS dimensiones que el conjunto `toques`.
//
// PROBADO ROMPIÉNDOLO (12/10/2026). Base: 11 pasan / 0 fallan. Cada rotura sola, restaurada de memoria y
// verificada por hash antes de la siguiente (arnés SCRATCH/p7/romper.mjs). Las del puente se hicieron sobre el
// ARTEFACTO publicado (public/replay/901/r.js), que es lo que baja la página: el generador no deja reescribirlo.
//   · el puente contesta a cualquier origen (sin `e.origin !== origen`) ............................ 9 / 2
//   · el puente contesta a cualquier ventana (sin `e.source !== padre`) ............................ 10 / 1
//   · el puente le escribe a '*' en vez de al origen de MaKo ...................................... 9 / 2
//   · el puente se instala también abierto solo (sin `padre === window`) ........................... 10 / 1
//   · `leerMensajeDelPuente` sin comparar el origen .................................................. 10 / 1
//   · `leerMensajeDelPuente` sin comparar la ventana ................................................. 10 / 1
//   · `leerMensajeDelPuente` comparando el origen con `startsWith` .................................. 10 / 1
//   · `puntosEnVivo` sin sumar el scroll a un toque anclado que no es fijo ........................... 10 / 1
//   · `puntosEnVivo` dibujando un fijo en la capa del documento ..................................... 10 / 1
//   · el beacon sirve el grabador a la visita del mapa (sin la rama del puente) ....................... 10 / 1
//   · el beacon deja ganar a la visita del mapa (`pagina` sin el `pruebaDelMapa ? null`) ............... 10 / 1
//   · `regexDeLaPagina` sin `/*` (una barra final queda afuera: «no instalada» sobre una que mide) ..... 10 / 1
//   · `regexDeLaPagina` sin el `$` final (`/vsl-2` entra como `/vsl`) ................................ 10 / 1
//   · `ROTULO_DISPOSITIVO.movil` = 'Móvil' (el chip «Celular» de la hoja dejaría de filtrar el mapa) .. 10 / 1
//   · `verificarPagina` vuelve a filtrar por el host entero (`ilike`, sin la regex) .................... 10 / 1
//   · el marco en vivo con `allow-forms` en el sandbox ............................................... 10 / 1
//   · MaKo le manda el scroll al marco con '*' ...................................................... 10 / 1
//   · una página de MaKo puede ir en vivo (`sePuedeEnVivo` sin `esHostPropio`) ......................... 10 / 1
//   (La primera y la tercera tiran también el test del scroll: sin la guarda del origen un scroll ajeno mueve
//   la página, y con '*' el estado del scroll sale a cualquiera.)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  MARCA_PUENTE, PUENTE_MAPA_VERSION, esPruebaDelMapa, leerMensajeDelPuente, nuevaPruebaDelMapa, pedidoAlPuente,
  puntosEnVivo, scrollAlPuente, selectoresDe, urlEnVivo, type EstadoPuente,
} from '../lib/landing-mapa-puente';
import { regexDeLaPagina } from '../lib/landing-mapa-visitas';
import { ROTULO_DISPOSITIVO, ROTULO_TIPO, dimensionesDeToque, sanearFiltrosToques, sanearVentana } from '../lib/landing-mapa-filtros';
import { normalizarUrl } from '../lib/landing-paginas';
import type { ToqueMapa } from '../lib/landing-mapa';

const raiz = new URL('../', import.meta.url);
const leer = (ruta: string) => readFileSync(new URL(ruta, raiz), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PUENTE = leer(`public/replay/${PUENTE_MAPA_VERSION}/r.js`);
const MAKO = 'https://hola-mako.com';
const PAGINA = 'https://negocio.com';

// ─────────────────────────────────────────────────────────────────────────────
// El mundo de mentira del puente: la página del cliente, adentro de un marco de MaKo
// ─────────────────────────────────────────────────────────────────────────────
type Enviado = { m: Record<string, unknown>; destino: unknown };
function mundo(ops: { enMarco?: boolean; src?: string | null } = {}) {
  const enviados: Enviado[] = [];
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const timers: Array<() => void> = [];
  const caja = (x: number, y: number, w: number, h: number) => ({ getBoundingClientRect: () => ({ left: x, top: y, width: w, height: h }) });
  const elementos: Record<string, unknown> = {
    'body > a:nth-of-type(1)': caja(20, 300, 200, 48),
  };
  const marco = { tagName: 'IFRAME', getAttribute: (k: string) => (k === 'src' ? 'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=x&token=secreto' : null), ...caja(0, 100, 390, 220) };
  const padre = { postMessage: (m: Record<string, unknown>, destino: unknown) => { enviados.push({ m, destino }); } };
  const documentElement = { scrollHeight: 4200, clientWidth: 375, scrollTop: 0 };
  const document = {
    currentScript: ops.src === null ? null : { src: ops.src ?? `${MAKO}/replay/${PUENTE_MAPA_VERSION}/r.js` },
    getElementsByTagName: () => [],
    documentElement,
    body: { scrollHeight: 4200 },
    querySelector: (sel: string) => {
      if (sel === ':::roto') throw new Error('SyntaxError');
      return elementos[sel] ?? null;
    },
    querySelectorAll: () => [marco],
  };
  const window: Record<string, unknown> = {
    innerWidth: 390, innerHeight: 844, pageYOffset: 0,
    addEventListener: (t: string, f: (e: unknown) => void) => { (listeners[t] ??= []).push(f); },
    scrollTo: (_x: number, y: number) => { window.pageYOffset = y; },
  };
  window.parent = ops.enMarco === false ? window : padre;
  const ctx = vm.createContext({
    window, document, location: { href: `${PAGINA}/` }, URL,
    setTimeout: (f: () => void) => { timers.push(f); return timers.length; }, clearTimeout: () => {},
  });
  vm.runInContext(PUENTE, ctx);
  const recibir = (data: unknown, origin: string, source: unknown) => { for (const f of listeners.message ?? []) f({ data, origin, source }); };
  return { enviados, recibir, padre, window, timers, listeners };
}

test('el puente se instala SÓLO adentro de un marco, y sólo sabiendo de dónde lo bajaron', () => {
  const solo = mundo({ enMarco: false });
  assert.equal(solo.window.mkoPuenteMapa, undefined, 'abierta sola, la página no tiene a quién contestarle');
  assert.equal((solo.listeners.message ?? []).length, 0);
  const sinScript = mundo({ src: null });
  assert.equal(sinScript.window.mkoPuenteMapa, undefined, 'sin la dirección del script no hay origen de MaKo');
  // Un script servido por http (que no sea localhost) no es MaKo.
  assert.equal(mundo({ src: 'http://hola-mako.com/replay/901/r.js' }).window.mkoPuenteMapa, undefined);
  // Y NO GRABA: no deja con qué grabar (el snippet, al terminar de bajarlo, no encuentra nada).
  const w = mundo();
  assert.equal(w.window.mkoPuenteMapa, 1);
  assert.equal(w.window.rrwebRecord, undefined);
  assert.equal(w.window.rrweb, undefined);
  assert.doesNotMatch(PUENTE, /rrwebRecord|rrweb\.record/);
});

test('⚠️ el puente le escribe SÓLO al origen de MaKo, y sólo le contesta a su padre con ese origen', () => {
  const w = mundo();
  // Al instalarse avisa que está, al origen de MaKo (nunca a '*').
  assert.deepEqual(w.enviados.map((e) => [e.m.tipo, e.destino]), [['listo', MAKO]]);
  const pedir = pedidoAlPuente(7, ['body > a:nth-of-type(1)', '#no-esta', ':::roto']);
  // Otro origen (un parecido), con la ventana correcta: nada.
  w.recibir(pedir, 'https://hola-mako.com.evil.tld', w.padre);
  w.recibir(pedir, 'http://hola-mako.com', w.padre);
  // El origen correcto desde OTRA ventana (otra pestaña, un marco de la página): nada.
  w.recibir(pedir, MAKO, { postMessage() {} });
  // Algo que no es del puente: nada.
  w.recibir({ ...pedir, mko: 'otra-cosa' }, MAKO, w.padre);
  assert.equal(w.enviados.length, 1, 'el puente contestó a alguien que no es MaKo');
  // MaKo, desde el padre: contesta, al origen de MaKo.
  w.recibir(pedir, MAKO, w.padre);
  assert.equal(w.enviados.length, 2);
  const { m, destino } = w.enviados[1];
  assert.equal(destino, MAKO);
  assert.ok(w.enviados.every((e) => e.destino === MAKO), 'un mensaje salió a un destino que no es MaKo');
  assert.equal(m.tipo, 'estado');
  assert.equal(m.pedido, 7);
  // El ancho que USA la página (sin la barra de scroll), el alto del documento, la ventana y el scroll.
  assert.deepEqual([m.ancho, m.alto, m.vh, m.sy], [375, 4200, 844, 0]);
  // La caja de cada elemento pedido, null si no está; un selector roto no rompe nada.
  // (Los objetos vienen de OTRO realm, el del vm: se comparan por su JSON.)
  const plano = (x: unknown) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plano(m.rects), [[20, 300, 200, 48], null, null]);
  // El marco de Panda, con su dirección SIN query (nada de un token de la página viaja a MaKo).
  assert.deepEqual(plano(m.huecos), [[0, 100, 390, 220, 'iframe', 'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/']]);
  assert.doesNotMatch(PUENTE, /postMessage\([^)]*'\*'\)/);
});

test('el scroll lo manda MaKo (la página no recibe clics), acotado, y el puente contesta el nuevo estado', () => {
  const w = mundo();
  w.recibir(pedidoAlPuente(1, []), MAKO, w.padre);
  w.recibir(scrollAlPuente(900), MAKO, w.padre);
  assert.equal(w.window.pageYOffset, 900);
  // Un scroll de un origen ajeno no mueve la página.
  w.recibir({ mko: MARCA_PUENTE, v: 1, tipo: 'scroll', y: 50 }, 'https://evil.tld', w.padre);
  assert.equal(w.window.pageYOffset, 900);
  w.recibir({ mko: MARCA_PUENTE, v: 1, tipo: 'scroll', y: -50 }, MAKO, w.padre);
  assert.equal(w.window.pageYOffset, 0);
  w.recibir({ mko: MARCA_PUENTE, v: 1, tipo: 'scroll', y: 9e9 }, MAKO, w.padre);
  assert.equal(w.window.pageYOffset, 1_000_000);
  // El estado del scroll sale en el próximo cuadro (un timer en este mundo), y sólo a MaKo.
  const antes = w.enviados.length;
  for (const f of w.timers.splice(0)) f();
  assert.ok(w.enviados.length > antes);
  assert.ok(w.enviados.every((e) => e.destino === MAKO));
});

// ─────────────────────────────────────────────────────────────────────────────
// La punta de MaKo
// ─────────────────────────────────────────────────────────────────────────────
const ventana = { soy: 'el marco que embebimos' };
const estado = (extra: Record<string, unknown> = {}) => ({
  mko: MARCA_PUENTE, v: 1, tipo: 'estado', pedido: 3, ancho: 375, alto: 4200, vh: 844, sy: 600,
  rects: [[20, 300, 200, 48], null], huecos: [[0, 100, 390, 220, 'iframe', 'https://calendly.com/x'], [0, 0, 1, 1, 'pixel', '']],
  ...extra,
});

test('⚠️ MaKo acepta un mensaje sólo con el origen EXACTO de la página y desde SU marco', () => {
  const esperado = { origen: PAGINA, ventana };
  const ok = leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado() }, esperado);
  assert.equal(ok?.tipo, 'estado');
  for (const origin of ['https://negocio.com.evil.tld', 'https://negocio.com:8443', 'http://negocio.com', 'null', 'https://evil.tld']) {
    assert.equal(leerMensajeDelPuente({ origin, source: ventana, data: estado() }, esperado), null, `aceptó el origen ${origin}`);
  }
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: { otra: 'ventana' }, data: estado() }, esperado), null, 'aceptó otra ventana');
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: null, data: estado() }, { origen: PAGINA, ventana: null }), null, 'sin marco no hay de quién');
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado() }, { origen: null, ventana }), null);
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado({ mko: 'otra' }) }, esperado), null);
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado({ tipo: 'pedir' }) }, esperado), null);
  // Números que no salieron del puente: el estado no se acepta, o la caja queda en null.
  assert.equal(leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado({ alto: Number.NaN }) }, esperado), null);
  const raro = leerMensajeDelPuente({ origin: PAGINA, source: ventana, data: estado({ rects: [[1, 2, -5, 4], 'x', [1, 2, 3]] }) }, esperado);
  assert.deepEqual(raro?.tipo === 'estado' ? raro.rects : 'no', [null, null, null]);
  // Un hueco de un tipo desconocido se tira.
  assert.deepEqual(ok?.tipo === 'estado' ? ok.huecos.map((h) => h.tipo) : [], ['iframe']);
});

test('el contrato de las dos puntas: lo que manda el puente PUBLICADO lo entiende la pantalla', () => {
  const w = mundo();
  w.recibir(pedidoAlPuente(9, ['body > a:nth-of-type(1)']), MAKO, w.padre);
  const m = w.enviados.find((e) => e.m.tipo === 'estado')!.m;
  // Del lado de MaKo el evento llega con el origen de la PÁGINA y la ventana del marco (la del puente).
  const e = leerMensajeDelPuente({ origin: PAGINA, source: w.window, data: m }, { origen: PAGINA, ventana: w.window });
  assert.ok(e && e.tipo === 'estado', 'la pantalla no entiende lo que manda el puente');
  assert.equal(e.pedido, 9);
  assert.deepEqual(e.rects[0], { x: 20, y: 300, w: 200, h: 48 });
  assert.equal(e.huecos[0].tipo, 'iframe');
  const listo = leerMensajeDelPuente({ origin: PAGINA, source: w.window, data: w.enviados[0].m }, { origen: PAGINA, ventana: w.window });
  assert.equal(listo?.tipo, 'listo');
});

const toque = (p: Partial<ToqueMapa>): ToqueMapa => ({
  tipo: 'click', x: 0, y: 0, vw: 390, dh: 4200, sel: null, rx: null, ry: null, vh: 844, fijo: false, etiqueta: 'boton: Agendar', p: 0, ...p,
});

test('dónde va cada toque sobre la página EN VIVO: el ancla con el scroll, el fijo en la pantalla, el resto por su punto', () => {
  const sels = ['body > a:nth-of-type(1)', 'body > nav > a:nth-of-type(1)'];
  const e: EstadoPuente = {
    tipo: 'estado', v: 1, pedido: 1, ancho: 375, alto: 4200, vh: 844, sy: 600,
    rects: [{ x: 20, y: -300, w: 200, h: 40 }, { x: 300, y: 10, w: 60, h: 30 }], huecos: [],
  };
  const r = puntosEnVivo([
    // Anclado, no fijo: su caja está 300 px arriba de la ventana con 600 de scroll → y de documento 300 + 20.
    toque({ sel: sels[0], rx: 500, ry: 500 }),
    // Anclado y fijo: va en la pantalla, donde está su caja AHORA.
    toque({ sel: sels[1], rx: 500, ry: 500, fijo: true }),
    // Con un ancla que la página de hoy ya no tiene: por su punto (escalado al ancho que usa la página).
    toque({ sel: 'body > div:nth-of-type(9)', rx: 10, ry: 10, x: 195, y: 2100, vw: 390, dh: 4200 }),
    // Fijo y sin ancla: no se dibuja.
    toque({ x: 10, y: 10, fijo: true }),
  ], sels, e, 'movil');
  assert.deepEqual(r.doc, [{ x: 120, y: 320 }, { x: 187.5, y: 2100 }]);
  assert.deepEqual(r.pantalla, [{ x: 330, y: 25 }]);
  assert.equal(r.fuera, 1);
  // Lo que se le pide al puente: los anclados, del más tocado al menos.
  assert.deepEqual(selectoresDe([toque({ sel: 'b' }), toque({ sel: 'a' }), toque({ sel: 'a' }), toque({})]), ['a', 'b']);
});

test('el marcador del mapa y la dirección que se embebe', () => {
  const p = nuevaPruebaDelMapa(() => 0.5);
  assert.ok(esPruebaDelMapa(p) && p.startsWith('mapa-') && p.length <= 40, p);
  assert.equal(esPruebaDelMapa('mapa-'), false);
  assert.equal(esPruebaDelMapa('xmapa-abcdef'), false);
  assert.equal(esPruebaDelMapa('mapa-<script>'), false);
  assert.equal(esPruebaDelMapa('prueba-abcdef'), false);
  assert.equal(urlEnVivo('https://negocio.com/vsl?ai=1#x', 'mapa-abcd1234'), 'https://negocio.com/vsl?ai=1&mko_test=mapa-abcd1234');
  assert.equal(urlEnVivo('http://negocio.com/', 'mapa-abcd1234'), null, 'una página http adentro de MaKo la bloquea el navegador');
  assert.equal(urlEnVivo('https://a:b@negocio.com/', 'mapa-abcd1234'), null);
  assert.equal(urlEnVivo('https://negocio.com/', 'otra'), null);
});

test('⚠️ la visita del mapa pide el PUENTE y no el grabador, y no gana a nadie', () => {
  const ruta = sinComentarios(leer('app/api/track/vsl/route.ts'));
  const ini = ruta.indexOf("if (tipoEvento === 'pageview')");
  const bloque = ruta.slice(ini, ruta.indexOf("if (!tipoEvento) tipoEvento = 'play';", ini));
  assert.ok(bloque.length > 500 && bloque.length < 8000, `el bloque del pageview mide ${bloque.length}`);
  const iPuente = bloque.indexOf('if (pruebaDelMapa) return json({ ok: true, rec: { v: PUENTE_MAPA_VERSION } });');
  const iGrabador = bloque.indexOf('grabaA(cfg, visitorId)');
  assert.ok(iPuente > 0 && iGrabador > iPuente, 'a la visita del mapa se le serviría el grabador (o ni el puente)');
  assert.match(bloque, /const pruebaDelMapa = esPruebaDelMapa\(payload\.prueba\);/);
  assert.match(bloque, /const pagina = pruebaDelMapa \? null : texto\(payload\.landing_url, 500\);/, 'la visita del mapa ganaría a alguien en una página de gracias');
  // Y el archivo que se anuncia existe, registrado en el generador (que el pre-push revisa).
  assert.ok(existsSync(new URL(`public/replay/${PUENTE_MAPA_VERSION}/r.js`, raiz)));
  const libs = leer('scripts/replay-libs.mjs');
  assert.match(libs, new RegExp(`a: 'public/replay/${PUENTE_MAPA_VERSION}/r\\.js',\\s*\\n\\s*puente: ${PUENTE_MAPA_VERSION},`));
  assert.match(libs, /noDebeTener: \['rrwebRecord'/);
});

test('⚠️ la pantalla: el marco sólo corre la página (no navega MaKo, no manda formularios), MaKo le escribe sólo a ESE origen, y una página de MaKo nunca va en vivo', () => {
  const vivo = sinComentarios(leer('app/dashboard/MapaCalorVivo.tsx'));
  const sandbox = [...vivo.matchAll(/sandbox="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(sandbox, ['allow-scripts allow-same-origin'], 'el sandbox del marco en vivo cambió');
  // Lo que se le manda al marco va al origen de la página que embebimos, nunca a '*'.
  const envios = [...vivo.matchAll(/\.postMessage\((.*), (\w+|'[^']*')\);/g)].map((m) => m[2]);
  assert.ok(envios.length >= 2 && envios.every((d) => d === 'origen'), `postMessage a ${envios.join(', ')}`);
  // La página no recibe clics: la tapa está encima y recibe la rueda y el arrastre.
  assert.match(vivo, /<div ref=\{tapaRef\}[^>]*style=\{\{ position: 'absolute', inset: 0,/);
  const mapa = sinComentarios(leer('app/dashboard/MapaCalor.tsx'));
  const ini = mapa.indexOf('function sePuedeEnVivo');
  const f = mapa.slice(ini, mapa.indexOf('\n}\n', ini));
  // Con allow-scripts + allow-same-origin, una página de NUESTRO origen se sacaría el sandbox.
  assert.match(f, /!esHostPropio\(u\.hostname, propio\)/, 'una página de MaKo iría en vivo');
  assert.match(f, /u\.protocol === 'https:'/);
  assert.match(f, /d\.version < PIXEL_PUENTE_DESDE/, 'sin un Pixel que baje el r.js no hay puente');
});

// ─────────────────────────────────────────────────────────────────────────────
// verificarPagina, acotada: la regex trae candidatos y no se queda corta
// ─────────────────────────────────────────────────────────────────────────────
test('⚠️ `regexDeLaPagina` trae TODA forma de la dirección que normaliza a la página, y ninguna otra', () => {
  // La regex va con `imatch` (POSIX de Postgres, sin mayúsculas). Sólo usa ^ $ ( ) ? * {n,} [ ] y \. , que
  // significan lo mismo en JavaScript: se prueba con RegExp(…, 'i').
  const casos: Array<[string, string[], string[]]> = [
    ['https://negocio.com/vsl',
      ['https://negocio.com/vsl', 'https://negocio.com/vsl/', 'https://NEGOCIO.com/vsl?utm_source=fb&fbclid=1', 'https://negocio.com/vsl/#arriba',
        'http://negocio.com/vsl', 'https://0123456789abcdef0123--negocio.com/vsl', 'https://negocio.com/vsl?mko_test=mapa-abcd1234'],
      ['https://negocio.com/vsl-2', 'https://negocio.com/vslx', 'https://negocio.com/', 'https://otro.com/vsl', 'https://negocio.com.evil.tld/vsl',
        'https://evil.tld/?u=https://negocio.com/vsl', 'https://www.negocio.com/vsl']],
    ['https://negocio.com',
      ['https://negocio.com', 'https://negocio.com/', 'https://negocio.com/?fbclid=1', 'https://negocio.com#x'],
      ['https://negocio.com/gracias', 'https://negocio.community/']],
  ];
  for (const [url, si, no] of casos) {
    const re = new RegExp(regexDeLaPagina(url)!, 'i');
    for (const crudo of si) assert.ok(re.test(crudo), `${url}: dejó afuera ${crudo}`);
    for (const crudo of no) assert.ok(!re.test(crudo), `${url}: trajo ${crudo}`);
    // Lo que importa de verdad: toda dirección que `normalizarUrl` funde con la página entra (la que falta
    // dice «no instalada» sobre una página que mide).
    for (const crudo of [...si, ...no]) if (normalizarUrl(crudo) === normalizarUrl(url)) assert.ok(re.test(crudo), `${crudo} normaliza a ${url} y quedó afuera`);
  }
  // Y `verificarPagina` usa esto en UNA consulta acotada, no el host entero en serie.
  const lib = sinComentarios(leer('lib/landing-token.ts'));
  const ini = lib.indexOf('export async function verificarPagina');
  const cuerpo = lib.slice(ini, lib.indexOf('\n}\n', ini));
  assert.match(cuerpo, /\.filter\('landing_url', 'imatch', patron\)/);
  assert.match(cuerpo, /\.limit\(TOPE_VISITAS_VERIFICAR\)/);
  assert.doesNotMatch(cuerpo, /leerPorPaginas/, 'volvió a leer todas las visitas en serie');
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que mira el mapa: el período y los filtros de la hoja, con las dimensiones de `toques`
// ─────────────────────────────────────────────────────────────────────────────
test('el mapa filtra con los MISMOS valores que el lector del conjunto `toques`', () => {
  // El contrato entre dos archivos que nadie toca junto: los rótulos de acá contra los del lector.
  const lector = sinComentarios(leer('lib/graficos-datos-extra.ts'));
  const disp = /const DISPOSITIVO: Record<string, string> = \{ movil: '([^']+)', escritorio: '([^']+)' \};/.exec(lector);
  assert.ok(disp, 'no encontré los rótulos del dispositivo en el lector de `toques`');
  assert.deepEqual([disp[1], disp[2]], [ROTULO_DISPOSITIVO.movil, ROTULO_DISPOSITIVO.escritorio]);
  const ini = lector.indexOf('async function filasToques');
  const toques = lector.slice(ini, lector.indexOf('\n}\n', ini));
  assert.ok(toques.includes(`tipo: tipo === 'click' ? '${ROTULO_TIPO.click}' : '${ROTULO_TIPO.clic_vacio}'`), 'el lector cambió el rótulo de botón o no');
  assert.match(toques, /pagina: ruta\(x\.landing_url\)/);
  const server = sinComentarios(leer('lib/landing-mapa-server.ts'));
  assert.match(server, /dimensionesDeToque\(\{ pagina: ruta\(f\.landing_url\), lugar: rotuloDe\(\{ tipo, etiqueta \}\), tipo, disp \}\)/);
  assert.match(server, /filtrarFilas\(/, 'el mapa dejó de filtrar con la función del agregador');
  assert.deepEqual(dimensionesDeToque({ pagina: 'negocio.com', lugar: 'Agendar', tipo: 'clic_vacio', disp: 'movil' }),
    { pagina: 'negocio.com', lugar: 'Agendar', tipo: 'Fuera de un botón', dispositivo: 'Celular' });
  // Lo que llega por la URL: sólo dimensiones de `toques`, con topes.
  assert.deepEqual(sanearFiltrosToques(JSON.stringify([
    { dimension: 'dispositivo', valores: ['Celular'] }, { dimension: 'closer', valores: ['Ana'] }, { dimension: 'pagina', texto: ' vsl ' }, 'x',
  ])), [{ dimension: 'dispositivo', valores: ['Celular'] }, { dimension: 'pagina', texto: 'vsl' }]);
  assert.deepEqual(sanearFiltrosToques('no es json'), []);
  assert.deepEqual(sanearVentana('2026-09-12', '2026-10-11'), { desde: '2026-09-12', hasta: '2026-10-11' });
  assert.equal(sanearVentana('2026-10-11', '2026-09-12'), null);
  assert.equal(sanearVentana('2026-02-31', '2026-03-05'), null);
  assert.equal(sanearVentana('2020-01-01', '2026-01-01'), null);
});
