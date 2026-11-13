// =============================================================================
// La fuente de la publicada, desde su dominio y sin frenar el primer pintado (13/11/2026)
// =============================================================================
// Medido en producción (4G lenta, CPU ×4, 375 px): la publicada pintaba recién cuando llegaba la hoja de Google
// Fonts (de 354 a 587 ms, y dos conexiones nuevas antes de mostrar una letra). Lo que fija:
//   1. la hoja de Google se lee en el servidor: sus caras con la ruta PROPIA, y lo que no tiene la forma, afuera;
//   2. la ruta de las fuentes no es un proxy abierto (tres segmentos, .woff2, sólo fonts.gstatic.com) y cachea un año;
//   3. el documento: precarga + `<style>` en línea, ningún `<link>` a Google, y «<Familia> respaldo» en la pila con
//      las medidas de la tabla; sin fuentes propias, los `<link>` de siempre;
//   4. documentoPublico las lee una vez (memoria) y, si Google no contesta, sale con los `<link>`;
//   5. /l/html/fuentes/… pasa por el proxy en hola-mako.site y en el dominio de un cliente;
//   6. cada familia del catálogo tiene su letra de respaldo (si se suma una: scripts/generar-metricas-fuentes.mts).
// Correr: node --import tsx --test tests/web-generator-fuentes-propias.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarFuentesPropias, carasDeHoja, conRespaldo, fuentesPropias, olvidarFuentes, responderFuente, rutaPropiaDe, urlDeGoogle,
  CACHE_FUENTE, PREFIJO_FUENTES,
} from '../lib/editor-landing/fuentes-propias';
import { armarDocumento, documentoPublico, type EntradaDocumento } from '../lib/editor-landing/pagina-publica';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { METRICAS_FUENTES, SIN_MEDIDAS } from '../lib/editor-landing/metricas-fuentes';
import { FUENTES } from '../lib/editor-landing/temas';
import { decidirLandings } from '../lib/editor-landing/origen-landings';
import { decidirHost } from '../lib/editor-landing/dominios-reglas';

// La hoja que dio Google el 13/11 para la publicada de prueba (Schibsted Grotesk 400 y 700: variable, un archivo por alfabeto).
const HOJA = `/* latin-ext */
@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Iayoxdg.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+1E00-1E9F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Gayo.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Iayoxdg.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+1E00-1E9F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Schibsted Grotesk';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Gayo.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F, U+FEFF, U+FFFD;
}
`;
const URL_HOJA = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;700&display=swap';
const LATINO = '/l/html/fuentes/schibstedgrotesk/v7/Jqz55SSPQuCQF3t8uOwiUL-taUTtap9Gayo.woff2';
// Como queda en el HTML guardado: la pila de `pilaFuente` (temas.ts) dentro del style, con la comilla escapada.
const CUERPO = '<div class="gm-doc" style="--gm-fuente-titulo:&#39;Schibsted Grotesk&#39;, system-ui, sans-serif;--gm-fuente-cuerpo:&#39;Schibsted Grotesk&#39;, system-ui, sans-serif"><section class="gm-tarjeta"><div class="gm-tarjeta-cuerpo"><h1 class="gm-titulo">Hola</h1></div></section></div>';
const ENTORNO = { appBaseUrl: 'https://hola-mako.com', prefijoBucket: 'https://proy.supabase.co/storage/v1/object/public/landing-imagenes/' };
const entrada = (over: Partial<EntradaDocumento> = {}): EntradaDocumento => ({
  html: CUERPO, config: CONFIG_DEFAULT, workspaceId: 7, modo: 'publico', urlCanonica: 'https://hola-mako.site/app', fuentes: URL_HOJA, ...over,
});

test('1. la hoja de Google, leída en el servidor: las caras con la ruta propia; lo que no tiene la forma, afuera', () => {
  const caras = carasDeHoja(HOJA);
  assert.equal(caras.length, 4);
  assert.deepEqual(caras[1], { familia: 'Schibsted Grotesk', estilo: 'normal', peso: '400', rango: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F, U+FEFF, U+FFFD', ruta: LATINO });
  const mala = (src: string, familia = "'X'") => carasDeHoja(`@font-face{font-family:${familia};font-weight:400;src:url(${src}) format('woff2');unicode-range:U+0000-00FF}`);
  assert.deepEqual(mala('https://evil.tld/s/a/v1/b.woff2'), [], 'otro origen');
  assert.deepEqual(mala('https://fonts.gstatic.com/s/a/../../b.woff2'), [], 'con ..');
  assert.deepEqual(mala('https://fonts.gstatic.com/s/a/v1/b.ttf'), [], 'que no es woff2');
  assert.deepEqual(mala('https://fonts.gstatic.com/s/a/v1/b.woff2', "'X</style><script>'"), [], 'una familia con marcado');
  assert.equal(mala('https://fonts.gstatic.com/s/a/v1/b.woff2').length, 1);
});

test('2. la ruta de las fuentes no es un proxy abierto, y cachea un año', async () => {
  assert.equal(PREFIJO_FUENTES, '/l/html/fuentes');
  assert.equal(urlDeGoogle(['a', 'v1', 'b.woff2']), 'https://fonts.gstatic.com/s/a/v1/b.woff2');
  for (const segs of [['a', 'b.woff2'], ['a', 'v1', 'c', 'b.woff2'], ['..', 'v1', 'b.woff2'], ['a', 'v1', 'b.css'], ['a', 'v1', '%2e%2e.woff2'], ['a', 'evil.com', 'b.woff2']]) {
    assert.equal(urlDeGoogle(segs), null, segs.join('/'));
  }
  assert.equal(rutaPropiaDe('https://fonts.gstatic.com/s/a/v1/b.woff2'), '/l/html/fuentes/a/v1/b.woff2');
  assert.equal(rutaPropiaDe('https://fonts.gstatic.com.evil.tld/s/a/v1/b.woff2'), null);

  let pedidas = 0;
  const fetchFalso = (async (u: string | URL | Request) => { pedidas++; assert.equal(String(u), 'https://fonts.gstatic.com/s/a/v1/b.woff2'); return new Response(new Uint8Array([119, 79, 70, 50])); }) as typeof fetch;
  const ok = await responderFuente(['a', 'v1', 'b.woff2'], { fetch: fetchFalso });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'font/woff2');
  assert.equal(ok.headers.get('cache-control'), CACHE_FUENTE);
  assert.equal(ok.headers.get('vercel-cdn-cache-control'), CACHE_FUENTE);
  assert.equal((await ok.arrayBuffer()).byteLength, 4);
  const mal = await responderFuente(['..', 'v1', 'b.woff2'], { fetch: fetchFalso });
  assert.equal(mal.status, 404);
  assert.equal(pedidas, 1, 'lo que no tiene la forma no sale a la red');
  const caida = await responderFuente(['a', 'v1', 'b.woff2'], { fetch: (async () => { throw new Error('sin red'); }) as typeof fetch });
  assert.equal(caida.status, 502);
  assert.equal(caida.headers.get('cache-control'), 'no-store', 'una falla no se guarda en el borde');
});

test('3. el documento: precarga y estilo en línea, nada de Google, y la letra de respaldo en la pila', () => {
  const propias = armarFuentesPropias(carasDeHoja(HOJA))!;
  assert.deepEqual(propias.precargas, [LATINO], 'el latino, una vez (400 y 700 son el mismo archivo)');
  assert.deepEqual(propias.familias, ['Schibsted Grotesk']);
  assert.match(propias.css, /font-display:swap;src:url\(\/l\/html\/fuentes\/schibstedgrotesk\/v7\/[^)]+\.woff2\) format\('woff2'\)/);
  const [, tamano, alto, bajada, interlinea] = METRICAS_FUENTES['Schibsted Grotesk'];
  assert.ok(propias.css.includes(`@font-face{font-family:'Schibsted Grotesk respaldo';src:local('Arial'), local('Helvetica'), local('Roboto'), local('Roboto-Regular');size-adjust:${tamano}%;ascent-override:${alto}%;descent-override:${bajada}%;line-gap-override:${interlinea}%}`));
  assert.equal(METRICAS_FUENTES.Inter[1], 107.12, 'la misma cuenta que next/font (Inter: 107,12 %)');

  const d = armarDocumento({ ...entrada(), fuentesPropias: propias }, ENTORNO);
  assert.doesNotMatch(d, /fonts\.googleapis\.com\/css2|<link rel="stylesheet"/, 'ninguna hoja que frene el pintado');
  assert.doesNotMatch(d, /(?:href=|src=|url\()["']?https:\/\/fonts\.g/, 'ningún pedido a Google (la política lo sigue dejando, para la de respaldo)');
  const precarga = d.indexOf(`<link rel="preload" href="${LATINO}" as="font" type="font/woff2" crossorigin>`);
  assert.ok(precarga > 0 && precarga < d.indexOf("@font-face{font-family:'Schibsted Grotesk'"), 'la precarga antes de las caras');
  assert.ok(d.includes("--gm-fuente-cuerpo:&#39;Schibsted Grotesk&#39;, &#39;Schibsted Grotesk respaldo&#39;, system-ui"));
  assert.match(d, /font-src &#39;self&#39;/, 'la política (escapada en el atributo) deja pasar la fuente del mismo dominio');
  assert.equal(conRespaldo("font-family:'Inter', sans-serif", ['Inter']), "font-family:'Inter', 'Inter respaldo', sans-serif");

  const sin = armarDocumento(entrada(), ENTORNO);
  assert.ok(sin.includes(`<link rel="stylesheet" href="${URL_HOJA.replace(/&/g, '&amp;')}">`), 'sin fuentes propias, como antes');
  assert.ok(!sin.includes('respaldo'));
});

test('4. documentoPublico lee la hoja una vez y, si Google no contesta, sale con los <link> de siempre', async () => {
  olvidarFuentes();
  let pedidas = 0;
  const google = (async (u: string | URL | Request, init?: RequestInit) => {
    pedidas++;
    assert.equal(String(u), URL_HOJA);
    assert.match(String(new Headers(init?.headers).get('user-agent')), /Chrome\/\d+/, 'con un navegador moderno: woff2');
    return new Response(HOJA, { status: 200 });
  }) as typeof fetch;
  const dep = { tokenPixel: async () => null, entorno: ENTORNO, fuentesPropias: (urls: readonly string[]) => fuentesPropias(urls, { fetch: google }) };
  const d1 = await documentoPublico(entrada(), dep);
  const d2 = await documentoPublico(entrada(), dep);
  assert.equal(pedidas, 1, 'la segunda sale de la memoria');
  assert.equal(d1, d2);
  assert.ok(d1.includes(`rel="preload" href="${LATINO}"`));

  olvidarFuentes();
  const caido = { ...dep, fuentesPropias: (urls: readonly string[]) => fuentesPropias(urls, { fetch: (async () => new Response('', { status: 400 })) as typeof fetch }) };
  const d3 = await documentoPublico(entrada(), caido);
  assert.ok(d3.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2'), 'sin la hoja, la de Google');
  const tira = { ...dep, fuentesPropias: async () => { throw new Error('x'); } };
  assert.ok((await documentoPublico(entrada(), tira)).includes('<link rel="stylesheet"'), 'un error no tira la página');
  assert.equal(await fuentesPropias([], { fetch: google }), null, 'sin hojas, sin pedidos');
  olvidarFuentes();
});

test('5. /l/html/fuentes/… pasa por el proxy en hola-mako.site y en el dominio de un cliente', () => {
  const ruta = '/l/html/fuentes/schibstedgrotesk/v7/x.woff2';
  assert.deepEqual(decidirLandings(ruta, 'GET'), { tipo: 'pasar' });
  assert.deepEqual(decidirHost('promo.tunegocio.com', ruta, 'GET'), { tipo: 'pasar' });
});

test('6. cada familia del catálogo tiene su letra de respaldo (si se suma una: scripts/generar-metricas-fuentes.mts)', () => {
  const faltan = Object.keys(FUENTES).filter((f) => !METRICAS_FUENTES[f] && !SIN_MEDIDAS.includes(f));
  assert.deepEqual(faltan, [], 'correr: node --import tsx scripts/generar-metricas-fuentes.mts');
  for (const [f, m] of Object.entries(METRICAS_FUENTES)) {
    assert.ok(m[1] > 50 && m[1] < 200 && m[2] > 0 && m[3] >= 0 && m[4] >= 0, `${f}: ${m.join(', ')}`);
    assert.equal(m[0], FUENTES[f]?.tipo === 'serif' ? 'serif' : m[0], `${f}: una serif usa Times`);
  }
});
