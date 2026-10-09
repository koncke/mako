// =============================================================================
// El Pixel en UNA línea: el cargador (lib/pixel-cargador.ts + app/m.js/route.ts)
// =============================================================================
// Decisión de Martín (09/10/2026, «terminalo todo»): en vez de pegar ~2.226 líneas,
// se pega `<script src="https://hola-mako.com/m.js?id=mko_…" defer></script>` y la
// ruta sirve el Pixel ACTUAL. Lo que estos tests cuidan:
//   · la ruta: token bueno → el mismo código que el archivo descargable, como JS y
//     con caché CORTA; token malo o desconocido → 404 con un comentario; base caída →
//     503 SIN caché (un «no sé» guardado en el CDN apagaba el Pixel diez minutos);
//   · el JS que sale de la ruta COMPILA (vm.Script), armado con el snippet de verdad;
//   · el token no puede inyectar código (va adentro del JS que se sirve);
//   · el camino no lleva palabras que listan los bloqueadores, y el proxy no la corta;
//   · el WhatsApp de «quedó viejo» no sale de nuevo por la v23 (la clave sigue en 'v22').
//
// PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez con todo en verde antes
// (11 pass / 0 fail), restaurando de memoria (un arnés en el scratchpad que guarda el
// archivo, lo rompe, corre ESTE test y lo reescribe; comparado byte a byte después):
//   1. `responderCargador` contestando 404 cuando el resolver tira (en vez de 503)
//      → 10 / 1 «la base caída es 503 sin caché»
//   2. `CACHE_PIXEL` con `max-age=86400` → 10 / 1 «token bueno: 200…»
//   3. `FORMA_TOKEN` como /^.{8,64}$/ (acepta comillas) → 10 / 1 «un token que podría
//      cerrar la cadena…»
//   4. la ruta con `wsPorIdentificador` (la tolerante) → 10 / 1 «el cableado de la ruta»
//   5. '/m.js' fuera de PUBLICOS → 10 / 1 «el proxy no la corta»
//   6. el cron con dedupKey `v${SNIPPET_VERSION}` → 10 / 1 «el WhatsApp…»
//   7. `tokenDelCargador` sin el `(?:&(?:amp;)?)?` → 10 / 1 «la línea se reconoce…»
//   8. la barra de la línea sin su botón de copiar (`onClick={copiar}`) → 10 / 1 «la
//      pantalla ofrece primero la línea…»
//   9. `snippetDesactualizado` cortando en SNIPPET_VERSION → 10 / 1 «el WhatsApp…»
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import {
  CACHE_DESCONOCIDO, CACHE_PIXEL, FORMA_TOKEN, PARAM_CARGADOR, RUTA_CARGADOR,
  lineaCargador, responderCargador, tokenDelCargador,
} from '../lib/pixel-cargador';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { PIXEL_MINIMO_AVISO } from '../lib/pixel-aviso';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = `mko_${'b2'.repeat(16)}`;

/** Lo que contesta la ruta con el snippet de VERDAD. `lib/landing-token.ts` tiene
 *  `server-only`, así que se corre en un node aparte con la condición del server; el
 *  resolver es falso (la base no se toca) y el resto es el mismo cableado de la ruta. */
function respuestaReal(): { status: number; cuerpo: string; headers: Record<string, string> } {
  const m = (r: string) => JSON.stringify(pathToFileURL(join(RAIZ, r)).href);
  const codigo = [
    `import { landingSnippet } from ${m('lib/landing-token.ts')};`,
    `import { pixelComoArchivo } from ${m('lib/pixel-archivo.ts')};`,
    `import { responderCargador } from ${m('lib/pixel-cargador.ts')};`,
    `const r = await responderCargador(${JSON.stringify(TOKEN)}, { resolver: async () => 7, pixel: (t) => pixelComoArchivo(landingSnippet(t)) });`,
    'process.stdout.write(JSON.stringify(r));',
  ].join('\n');
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }));
}

const REAL = respuestaReal();

test('token bueno: 200, JavaScript, caché corta, y el JS que sale COMPILA', () => {
  assert.equal(REAL.status, 200);
  assert.equal(REAL.headers['Content-Type'], 'application/javascript; charset=utf-8');
  assert.equal(REAL.headers['Cache-Control'], CACHE_PIXEL);
  // Una versión nueva tiene que llegar sola en minutos: el navegador a los 5, el CDN a los 10.
  const max = Number(/max-age=(\d+)/.exec(CACHE_PIXEL)?.[1]);
  const smax = Number(/s-maxage=(\d+)/.exec(CACHE_PIXEL)?.[1]);
  assert.ok(max > 0 && max <= 600 && smax > 0 && smax <= 900, `caché demasiado larga: ${CACHE_PIXEL}`);
  assert.doesNotThrow(() => new Script(REAL.cuerpo, { filename: 'm.js' }), 'el Pixel servido no compila: no carga en la página');
  assert.ok(!/<\/?script/i.test(REAL.cuerpo), 'el JS servido trae etiquetas <script>');
  assert.ok(REAL.cuerpo.includes(`var CUENTA = '${TOKEN}';`), 'el Pixel servido no lleva el token: los eventos no tendrían de quién ser');
  assert.ok(/var SV = \d+;/.test(REAL.cuerpo), 'el Pixel servido no dice su versión');
});

test('token desconocido o con forma inválida: 404, y el cuerpo es SÓLO un comentario', async () => {
  let preguntas = 0;
  const dep = { resolver: async () => { preguntas++; return null; }, pixel: () => 'no tiene que salir' };
  for (const id of [TOKEN, null, '', 'corto', `mko_${'a'.repeat(70)}`]) {
    const r = await responderCargador(id, dep);
    assert.equal(r.status, 404, String(id));
    assert.equal(r.headers['Content-Type'], 'application/javascript; charset=utf-8');
    assert.equal(r.headers['Cache-Control'], CACHE_DESCONOCIDO);
    assert.doesNotThrow(() => new Script(r.cuerpo));
    assert.equal(sinComentarios(r.cuerpo).trim(), '', 'el 404 trae código: la página lo ejecutaría');
  }
  assert.equal(preguntas, 1, 'una forma inválida no tiene por qué llegar a la base');
});

test('la base caída es 503 sin caché, y no se arma el Pixel', async () => {
  let armado = false;
  const r = await responderCargador(TOKEN, {
    resolver: async () => { throw new Error('webhook_routing (landing): fetch failed'); },
    pixel: () => { armado = true; return 'x'; },
  });
  assert.equal(r.status, 503);
  assert.equal(r.headers['Cache-Control'], 'no-store', 'un «no sé» guardado en el CDN apaga el Pixel de ese negocio diez minutos');
  assert.equal(sinComentarios(r.cuerpo).trim(), '');
  assert.equal(armado, false);
});

test('si el snippet no tiene forma de archivo, 500 sin caché y nada roto', async () => {
  const r = await responderCargador(TOKEN, { resolver: async () => 7, pixel: () => null });
  assert.equal(r.status, 500);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(sinComentarios(r.cuerpo).trim(), '');
});

test('un token que podría cerrar la cadena no pasa: va ADENTRO del JS que se sirve', () => {
  for (const malo of [`mko_ab';alert(1)//`, 'mko_ab"cd1234', 'mko_ab cd1234', 'mko_<script>', 'mko_ab\\cd1234', `mko_${'a'.repeat(61)}`]) {
    assert.equal(FORMA_TOKEN.test(malo), false, malo);
  }
  assert.equal(FORMA_TOKEN.test(TOKEN), true);
});

test('la línea: camino neutro, parámetro sin palabras de secreto, y `defer`', () => {
  // Los bloqueadores de anuncios listan rutas con estas palabras: el Pixel no se bajaría.
  assert.doesNotMatch(RUTA_CARGADOR, /track|pixel|analytic|tag|beacon|collect/i);
  assert.doesNotMatch(PARAM_CARGADOR, /token|key|secret|api|auth/i);
  const l = lineaCargador(TOKEN, 'https://hola-mako.com/');
  assert.equal(l, `<script src="https://hola-mako.com/m.js?id=${TOKEN}" defer></script>`);
  // La carpeta de la ruta es el camino: si uno cambia, el otro también.
  assert.ok(existsSync(join(RAIZ, 'app', RUTA_CARGADOR.slice(1), 'route.ts')), `no hay app${RUTA_CARGADOR}/route.ts`);
});

test('la línea se reconoce en un HTML (con otro dominio, con más parámetros) y nada más', () => {
  assert.equal(tokenDelCargador(`<body>x${lineaCargador(TOKEN, 'https://hola-mako.com')}</body>`), TOKEN);
  assert.equal(tokenDelCargador(`<script src='https://www.otro-dominio.app/m.js?id=${TOKEN}'></script>`), TOKEN);
  assert.equal(tokenDelCargador(`<script src="https://hola-mako.com/m.js?v=2&amp;id=${TOKEN}" defer></script>`), TOKEN);
  assert.equal(tokenDelCargador(`<script src="https://hola-mako.com/m.js?v=2&id=${TOKEN}"></script>`), TOKEN);
  assert.equal(tokenDelCargador('<script src="https://cdn.x.com/m.js?id=ab"></script>'), null, 'un id corto no es un token');
  // ⚠️ Un `/m.js?id=` de OTRO producto no es nuestra línea (revisión del 09/10/2026): con
  // él, una página con el Pixel viejo metido por un administrador de etiquetas se leía al
  // día y el aviso se apagaba. Verificado quitando el `mko_` de la regex: 13 / 1 (éste).
  assert.equal(tokenDelCargador('<script src="https://cdn.otro.com/m.js?id=GTM-ABCDEFGH12"></script>'), null, 'un id ajeno no es nuestro token');
  assert.equal(tokenDelCargador(`<script src="https://cdn.otro.com/m.js?id=${'f'.repeat(32)}"></script>`), null);
  assert.equal(tokenDelCargador(`<script src="https://x.com/m.jsx?id=${TOKEN}"></script>`), null);
  assert.equal(tokenDelCargador(`<script src="https://x.com/am.js?pid=${TOKEN}"></script>`), null, '`pid=` no es `id=`');
  assert.equal(tokenDelCargador(''), null);
  assert.equal(tokenDelCargador(null), null);
});

test('el cableado de la ruta: lectura ESTRICTA del ruteo, el mismo código que el archivo, sólo GET', () => {
  const src = sinComentarios(leer(`app${RUTA_CARGADOR}/route.ts`));
  assert.match(src, /wsPorIdentificadorEstricto\(LANDING_SERVICIO, token\)/, 'el token se resuelve con la lectura ESTRICTA (AGENTS.md): con la tolerante, la base caída es un 404 cacheado');
  assert.doesNotMatch(src, /wsPorIdentificador\(/);
  assert.match(src, /pixelComoArchivo\(landingSnippet\(token\)\)/, 'el código servido tiene que ser el mismo que el archivo descargable');
  assert.match(src, /responderCargador\(req\.nextUrl\.searchParams\.get\(PARAM_CARGADOR\)/);
  assert.match(src, /export async function GET\(/);
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)\b/, 'la ruta del cargador sólo se lee');
  assert.doesNotMatch(src, /cookies\(|headers\(\)/, 'es pública: no puede leer la cookie de sesión');
});

test('el proxy no la corta: el matcher la excluye, y si cambia, está en PUBLICOS y sólo se lee', () => {
  assert.equal(esPublica(RUTA_CARGADOR), true, 'fuera de PUBLICOS, un cambio del matcher apaga el Pixel de todos con un 401');
  assert.equal(esPublicaSoloLeer(RUTA_CARGADOR), true, 'no es /api/: tiene que ser sólo GET/HEAD/OPTIONS');
  // El matcher de proxy.ts excluye los caminos que terminan en .js (hoy el proxy ni la ve).
  const crudo = /matcher:\s*\['([^']+)'\]/.exec(leer('proxy.ts'))?.[1];
  assert.ok(crudo, 'no encontré el matcher del proxy');
  const re = new RegExp(`^${crudo!.replace(/\\\\/g, '\\')}$`);
  assert.equal(re.test('/integraciones'), true, 'el matcher reconstruido no matchea ni una página: este test no mide nada');
  assert.equal(re.test(RUTA_CARGADOR), false, 'el proxy corre sobre el cargador');
});

test('el WhatsApp de «quedó viejo» no sale de nuevo por la v23: la clave sigue en «v22»', () => {
  const cron = sinComentarios(leer('app/api/cron/tracking-vigilante/route.ts'));
  assert.match(cron, /dedupKey: `v\$\{PIXEL_MINIMO_AVISO\}`/, 'con `v${SNIPPET_VERSION}` subir la versión le manda el mensaje a cada negocio');
  assert.doesNotMatch(cron, /dedupKey: `v\$\{SNIPPET_VERSION\}`/);
  // ⚠️ El número fijado a propósito: era 'v22' antes de la v23 y tiene que seguir siéndolo.
  // Si lo subiste a sabiendas (un código que vale la pena repegar), cambiá este número:
  // es mandarle un WhatsApp a cada negocio con un Pixel anterior.
  assert.equal(`v${PIXEL_MINIMO_AVISO}`, 'v22');
  assert.match(cron, /versionServida\(v\.url, \{ minimo: PIXEL_MINIMO_AVISO, actual: SNIPPET_VERSION \}\)/);
  assert.match(cron, /servida >= PIXEL_MINIMO_AVISO/);
  assert.match(cron, /copia la línea del Pixel/, 'el WhatsApp tiene que mandar a la línea, que no se vuelve a pegar');
  assert.doesNotMatch(cron, /vuelve a pegarlo donde estaba/);
  // Y lo que decide «viejo» corta en el mínimo, no en la última versión.
  const lib = sinComentarios(leer('lib/landing-token.ts'));
  const ini = lib.indexOf('export async function snippetDesactualizado(');
  const cuerpo = lib.slice(ini, lib.indexOf('\n}\n', ini));
  assert.match(cuerpo, /viejo: instalada < PIXEL_MINIMO_AVISO/);
  assert.match(lib, /const vieja = version != null && version < PIXEL_MINIMO_AVISO;/, '`verificarPagina` nombraría en el WhatsApp una página en la 22');
});

test('la pantalla ofrece primero la línea, y el código completo queda como alternativa', () => {
  const board = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const ini = board.indexOf('function CodigoLanding(');
  const comp = board.slice(ini, board.indexOf('\nfunction ', ini + 10));
  assert.match(comp, /navigator\.clipboard\.writeText\(cargador\)/, 'no se puede copiar la línea');
  const iLinea = comp.indexOf('onClick={copiarLinea}');
  const iCompleto = comp.indexOf('onClick={copiar}');
  assert.ok(iLinea > 0 && iCompleto > 0, 'falta uno de los dos botones de copiar');
  assert.ok(iLinea < iCompleto, 'la línea tiene que ser lo PRIMERO que se ofrece');
  assert.match(comp, /\{completoAbierto && \(/, 'el código completo tiene que quedar plegado, como alternativa');
  assert.match(comp, /onClick=\{descargar\}/, 'se perdió el archivo descargable');
  const page = sinComentarios(leer('app/integraciones/page.tsx'));
  assert.match(page, /lineaCargador\(tokenLanding, APP_URL\)/);
  assert.match(page, /cargadorLanding=\{cargadorLanding\}/);
  assert.match(board, /cargador=\{cargadorLanding \?\? null\}/);
});

// ── Lo que sumó la revisión (09/10/2026) ─────────────────────────────────────
// PROBADO ROMPIÉNDOLO, una rotura por vez con el archivo en verde antes (14 / 0), con el
// mismo arnés que restaura de memoria (comparado byte a byte después):
//   · un `app/m.js/x/route.ts` vacío al lado de la ruta              → 13 / 1 «la carpeta…»
//   · el aviso fijo con «vuelve a pegar el código» otra vez          → 13 / 1 «ningún texto…»
//   · el botón del pulso con «Volver a copiar el código» otra vez    → 13 / 1 «ningún texto…»
//   · `versionServida` llamando `versionEnHtml(html)` sin `actual`   → 13 / 1 «lo que lee…»
//   · `estadoPixel` llamando `versionServida(url, { minimo })`        → 13 / 1 «lo que lee…»
//   (Antes de este test, la rotura de `versionServida` sin `actual` daba VERDE: 14 / 0 en
//   tests/pixel-aviso.test.ts, que es el que mira `versionEnHtml`.)

test('lo que lee la página le pasa la versión ACTUAL a la línea del cargador, en los tres lectores', () => {
  // `versionEnHtml` sin `actual` lee la línea como PIXEL_MINIMO_AVISO (22): alcanza para
  // apagar el aviso, y el diagnóstico de la página diría «tienes la 22 y la actual es la
  // 23» sobre una página que sirve la 23. Y `versionServida` cachea por PÁGINA, no por
  // `actual`: si un lector lo pasa y otro no, el primero que mira deja el número del otro.
  const servido = sinComentarios(leer('lib/pixel-servido.ts'));
  assert.match(servido, /versionEnHtml\(html, opts\.actual \?\? minimo\)/, 'versionServida no le pasa `actual` a versionEnHtml');
  assert.match(sinComentarios(leer('lib/pixel-estado.ts')), /versionServida\(url, \{ minimo, actual: SNIPPET_VERSION \}\)/);
  assert.match(sinComentarios(leer('lib/landing-token.ts')), /versionServida\(urlLanding, \{ minimo: SNIPPET_VERSION, actual: SNIPPET_VERSION \}\)/);
  const llamadas = [...['app', 'lib'].flatMap((d) => execFileSync('git', ['ls-files', d], { cwd: RAIZ, encoding: 'utf8' }).split('\n'))]
    .filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'lib/pixel-servido.ts')
    .flatMap((f) => (sinComentarios(leer(f)).match(/versionServida\([^)]*\)/g) ?? []).map((m) => `${f}: ${m}`));
  assert.ok(llamadas.length >= 3, `encontré ${llamadas.length} llamadas a versionServida: este test está mirando otra cosa`);
  const sinActual = llamadas.filter((l) => !/actual: SNIPPET_VERSION/.test(l));
  assert.deepEqual(sinActual, [], 'un lector de versionServida sin `actual` deja en la caché la línea leída como 22');
});

test('la carpeta de la ruta tiene SÓLO su route.ts: PUBLICOS la abre como prefijo', () => {
  // `matchea` (lib/rutas-publicas.ts) abre la entrada Y todo lo que cuelgue de ella
  // (`/m.js/…`). Hoy no cuelga nada; una ruta que naciera en `app/m.js/<algo>/` quedaría
  // pública y sin sesión sin que nadie lo decidiera. Es la regla de /api/v1: si el prefijo
  // abre, se enumera en positivo lo que hay adentro.
  const carpeta = join(RAIZ, 'app', RUTA_CARGADOR.slice(1));
  assert.deepEqual(readdirSync(carpeta).sort(), ['route.ts'],
    `en app${RUTA_CARGADOR}/ apareció algo más que route.ts: queda público por el prefijo de PUBLICOS`);
});

test('ningún texto que ve el cliente lo manda a REPEGAR el código: lo manda a la línea', () => {
  // Desde el 09/10/2026 el arreglo de un Pixel viejo es poner la línea del cargador, que
  // sirve siempre la versión del día. Un texto que dice «vuelve a pegar el código» manda a
  // repetir lo que va a quedar viejo otra vez — y era lo que decían el aviso fijo de la
  // esquina, el pulso, el mapa de calor y «Verificar» (los cazó la revisión: el cambio
  // había tocado el WhatsApp y el paso 3, y no éstos).
  const PROHIBIDAS = [
    /vuelve a pegar(?:lo)?(?! nada)/i, /volver a pegar(?!lo)(?! nada)/i, /p[ée]galo de nuevo/i,
    /peg[aá]ndolo de nuevo/i, /copia el c[oó]digo de arriba/i, /volver a copiar el c[oó]digo/i,
    /label: 'Copiar el c[oó]digo'/i, /reempl[aá]zalo/i,
  ];
  const ARCHIVOS = [
    'app/_components/AvisoPixelViejo.tsx',
    'app/landing-analyst/PulsoPaginas.tsx',
    'app/landing-analyst/MapaDeCalor.tsx',
    'app/integraciones/ProbarTracking.tsx',
    'app/integraciones/IntegracionesBoard.tsx',
    'app/api/cron/tracking-vigilante/route.ts',
    'lib/landing-token.ts',
    'lib/avisos-catalogo.ts',
  ];
  const malas: string[] = [];
  for (const f of ARCHIVOS) {
    sinComentarios(leer(f)).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').split('\n').forEach((l, i) => {
      for (const re of PROHIBIDAS) if (re.test(l)) malas.push(`${f}:${i + 1} ${l.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(malas, [], `estos textos todavía mandan a repegar el código:\n${malas.join('\n')}`);
});
