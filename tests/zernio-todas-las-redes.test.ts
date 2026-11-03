// =============================================================================
// Todas las redes de Zernio en MaKo: una tarjeta por red, el login de Zernio y el Calendario con los límites de cada una (29/10/2026)
// =============================================================================
// Martín, 29/10: «aprovechar todas las conexiones que tiene [Zernio] para implementar en integraciones todas las redes sociales...
// publicar en Facebook, TikTok, LinkedIn, etc... Y que aparezcan en integraciones». Y el Cerebro: «cualquier "Conectar Meta/Instagram"
// sin un Zernio empieza en el Paso 1 ahí mismo y continúa con el login»; «las tarjetas dicen lo que no se soporta». Lo que tiene que
// pasar:
//
//   1. LinkedIn, X, Threads y Google Business se conectan en el paso 2 de Zernio; Pinterest y Reddit NO (MaKo no publica en ellas):
//      se ven, dicen por qué, y no gastan una de las 2 gratis.
//   2. CADA RED TIENE SU TARJETA en /integraciones, que abre Zernio y deja marcada la red que sigue.
//   3. LA LÍNEA DE CADA TARJETA NO PROMETE: lo que dice que se publica, el Calendario lo publica; los mensajes que no llegan, se dice.
//   4. EL CALENDARIO PUBLICA EN LAS NUEVAS con su límite (X 280, Threads 500, Google Business 1.500 y sin video), y la migración
//      0348 acepta exactamente esas redes.
//   5. SIN CLAVE, ZERNIO PRIMERO: el paso 1 ahí mismo y, con la clave guardada, el paso 2 resalta la red que se pidió.
//
// Probado ROMPIÉNDOLO (29/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/zernio-todas-las-redes.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_SIGUE_ZERNIO, QUE_HACE_MAKO, REDES, REDES_CON_TARJETA, REDES_VISIBLES, SIN_USO_TODAVIA, redDeTarjeta, tarjetaDeRed,
} from '../lib/zernio-redes';
import { DEFS, SE_CONFIGURA_EN, integracionQueConfigura, ORDEN_CATEGORIAS } from '../lib/integraciones-catalogo';
import {
  REDES_PUBLICAR, TOPE_TEXTO, TOPE_TEXTO_RED, esRedPublicar, formatosDeRed, motivoParaNoProgramar, topeDeTexto, type EventoParaPublicar,
} from '../lib/calendario-publicar-reglas';

const RAIZ = join(__dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('LinkedIn, X, Threads y Google Business se conectan en el paso 2; Pinterest y Reddit no se ofrecen', () => {
  for (const r of ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'threads', 'googlebusiness'] as const) {
    assert.ok(REDES_VISIBLES.includes(r), `${r} no se ofrece en el paso 2`);
  }
  for (const r of ['pinterest', 'reddit'] as const) {
    assert.ok(!REDES_VISIBLES.includes(r), `${r} se ofrece y MaKo no publica en ella`);
    assert.match(SIN_USO_TODAVIA[r] ?? '', /todavía no publica/);
  }
  // Las rutas del login son las de Zernio (`/v1/connect/<ruta>`), igual que la plataforma.
  assert.equal(REDES.twitter.ruta, 'twitter');
  assert.equal(REDES.googlebusiness.ruta, 'googlebusiness');
  assert.equal(REDES.reddit.plataforma, 'reddit');
});

test('cada red tiene su tarjeta en /integraciones, que abre Zernio (salvo las que todavía no se usan)', () => {
  assert.ok(ORDEN_CATEGORIAS.includes('Redes sociales' as never));
  // Toda red que se conecta en el paso 2 (salvo los anuncios, que son Meta Ads, y YouTube, que ya tiene la suya) tiene tarjeta.
  for (const r of REDES_VISIBLES.filter((x) => !REDES[x].anuncios && x !== 'youtube')) {
    assert.ok((REDES_CON_TARJETA as readonly string[]).includes(r), `${r} se conecta y no tiene tarjeta`);
  }
  for (const red of REDES_CON_TARJETA) {
    const key = tarjetaDeRed(red);
    const d = DEFS.find((x) => x.key === key);
    assert.ok(d, `sin tarjeta: ${red}`);
    assert.equal(d!.nombre, REDES[red].etiqueta);
    assert.equal(d!.categoria, 'Redes sociales');
    assert.deepEqual(d!.envs, [], 'el estado sale de Zernio, no de una credencial');
    assert.equal(d!.descripcion, QUE_HACE_MAKO[red]);
    assert.equal(redDeTarjeta(key), red);
    assert.equal(integracionQueConfigura(key), SIN_USO_TODAVIA[red] ? key : 'zernio');
  }
  // YouTube ya tiene la suya (las vistas del VSL): no hay dos «YouTube».
  assert.equal(DEFS.filter((d) => d.nombre === 'YouTube').length, 1);
  assert.equal(redDeTarjeta('youtube'), null);
  assert.equal(redDeTarjeta('red-toString'), null);
  assert.equal(SE_CONFIGURA_EN.meta, 'zernio');
});

test('la línea de cada tarjeta no promete: lo que publica está en el Calendario, y los mensajes que no llegan se dicen', () => {
  // Sólo Facebook e Instagram reciben mensajes en MaKo (`cuentasConectadas` rutea esas dos).
  assert.match(leer('lib/zernio.ts'), /\.filter\(\(a\) => a\.platform === 'instagram' \|\| a\.platform === 'facebook'\)/);
  for (const red of REDES_CON_TARJETA) {
    const t = QUE_HACE_MAKO[red];
    assert.ok(t.length <= 120, `${red}: la línea pasa de 120 caracteres`);
    if (SIN_USO_TODAVIA[red]) {
      assert.ok(!esRedPublicar(red), `${red} dice que no se publica y el Calendario la publica`);
      continue;
    }
    assert.match(t, /Calendario/, `${red} no dice dónde se publica`);
    assert.ok(esRedPublicar(red), `${red} promete el Calendario y el Calendario no la publica`);
    if (red !== 'facebook' && red !== 'instagram') assert.match(t, /no llegan a MaKo/, `${red} no dice que sus mensajes no llegan`);
  }
  // Los topes que dice la tarjeta son los que aplica el Calendario.
  assert.match(QUE_HACE_MAKO.twitter, /280 caracteres/);
  assert.equal(TOPE_TEXTO_RED.twitter, 280);
  assert.match(QUE_HACE_MAKO.threads, /500 caracteres/);
  assert.equal(TOPE_TEXTO_RED.threads, 500);
  assert.match(QUE_HACE_MAKO.googlebusiness, /sin video/);
  assert.deepEqual(formatosDeRed('googlebusiness'), ['post']);
});

const ev = (o: Partial<EventoParaPublicar>): EventoParaPublicar => ({
  id: 'e1', tipo: 'publicacion', formato: 'post', titulo: 'Hola', inicio: new Date(Date.UTC(2026, 10, 2, 15)).toISOString(), dia_completo: false,
  estado: 'planeado', red: 'linkedin', cuenta_red: 'acc_1', archivo: '3/calendario/e1/abcdefgh12.jpg', archivo_tipo: 'image', texto: 'x',
  post_id: null, publicacion: null, publicacion_motivo: null, publicacion_url: null, ...o,
});
const AHORA = Date.UTC(2026, 10, 1, 12);

test('el Calendario publica en las nuevas, con el límite de cada una', () => {
  for (const r of ['linkedin', 'twitter', 'threads', 'googlebusiness'] as const) assert.ok(REDES_PUBLICAR.includes(r));
  assert.equal(motivoParaNoProgramar(ev({}), AHORA), null);
  assert.equal(motivoParaNoProgramar(ev({ red: 'twitter', texto: 'a'.repeat(280) }), AHORA), null);
  assert.equal(motivoParaNoProgramar(ev({ red: 'twitter', texto: 'a'.repeat(281) }), AHORA), 'En X el texto llega hasta 280 caracteres.');
  assert.equal(motivoParaNoProgramar(ev({ red: 'threads', texto: 'a'.repeat(501) }), AHORA), 'En Threads el texto llega hasta 500 caracteres.');
  // Google Business: imagen sí, video no (y el motivo no dice «lleva un video» de una red que no publica videos).
  assert.equal(motivoParaNoProgramar(ev({ red: 'googlebusiness', archivo_tipo: 'video' }), AHORA), 'Un post en Google Business lleva una imagen.');
  assert.equal(motivoParaNoProgramar(ev({ red: 'linkedin', formato: 'reel' }), AHORA), 'En LinkedIn no se publica un formato «reel».');
  // Lo de antes, igual.
  assert.equal(motivoParaNoProgramar(ev({ red: 'instagram', formato: 'reel', archivo_tipo: 'image' }), AHORA), 'Un reel en Instagram lleva un video.');
  assert.equal(topeDeTexto('twitter'), 280);
  assert.equal(topeDeTexto('linkedin'), TOPE_TEXTO);
  assert.equal(topeDeTexto(null), TOPE_TEXTO);
  assert.ok(!esRedPublicar('pinterest') && !esRedPublicar('reddit'));
  // La pantalla corta el texto en el tope de ESA red.
  assert.match(leer('app/calendario/PublicarEnRed.tsx'), /maxLength=\{topeDeTexto\(d\.red\)\}/);
});

test('la migración 0348 acepta EXACTAMENTE las redes que publica el Calendario, y sin ella se dice en palabras', () => {
  const mig = leer('supabase/migrations/0348_calendario_publicar_mas_redes.sql');
  const lista = /red in \(([^)]+)\)/.exec(mig)?.[1] ?? '';
  assert.deepEqual(lista.split(',').map((x) => x.trim().replace(/'/g, '')).sort(), [...REDES_PUBLICAR].sort());
  assert.match(mig, /drop constraint if exists calendario_eventos_red_ok;/);
  const pub = leer('lib/calendario-publicar.ts');
  assert.match(pub, /if \(\/calendario_eventos_red_ok\/\.test\(error\.message \?\? ''\)\) return \{ ok: false, error: FALTA_MIGRACION_REDES \};/);
});

test('cada tarjeta de red tiene su logo (el oficial, o una inicial), nunca el de otro', () => {
  const v = leer('app/_components/ServicioVisual.tsx');
  for (const red of REDES_CON_TARJETA) {
    // Tres formas válidas: el trazo pegado (`sym`), un archivo oficial de /public/logos (`img`, que es
    // lo que llevan los logos que sólo se publican en PNG o con degradés) o la inicial.
    const m = new RegExp(`'${tarjetaDeRed(red)}': \\{ (?:img: '([a-z0-9.-]+)'|sym: '([a-z-]+)'|letter: '[A-Z]')`).exec(v);
    assert.ok(m, `sin logo: ${red}`);
    // El archivo tiene que EXISTIR. Sin esto, una ruta mal escrita no falla: deja la tarjeta con una
    // imagen rota, que se lee como que la integración está mal, no como que falta un archivo.
    if (m![1]) assert.ok(existsSync(join(RAIZ, 'public/logos', m![1])), `${red}: falta public/logos/${m![1]}`);
    if (m![2]) assert.ok(v.includes(`<symbol id="${m![2]}"`), `${red}: el símbolo ${m![2]} no está dibujado`);
  }
});

// Lo mismo para TODO el mapa, no sólo las redes: cualquier `img` de ICON tiene que tener su archivo.
test('cada logo servido como archivo existe en public/logos', () => {
  const v = leer('app/_components/ServicioVisual.tsx');
  const mapa = v.slice(v.indexOf('export const ICON'), v.indexOf('export const iconFor'));
  const archivos = [...mapa.matchAll(/img: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(archivos.length >= 6, `esperaba varios logos por archivo, encontré ${archivos.length}`);
  for (const a of archivos) {
    assert.ok(existsSync(join(RAIZ, 'public/logos', a)), `falta public/logos/${a}`);
  }
});

test('sin clave, Zernio primero: la red queda marcada y el paso 2 la resalta hasta que se conecta', () => {
  assert.equal(CLAVE_SIGUE_ZERNIO, 'mako:zernio-sigue');
  // Un «Conectar…» de cualquier pantalla sin clave: marca la red ANTES de abrir el modal de Zernio.
  const h = leer('app/_components/ConectarViaZernio.tsx');
  const sinClave = h.slice(h.indexOf("if (motivo === 'sin-clave' || motivo === 'clave-mala') {"));
  const iMarca = sinClave.indexOf('sessionStorage.setItem(CLAVE_SIGUE_ZERNIO, redElegida)');
  assert.ok(iMarca > 0 && iMarca < sinClave.indexOf("abrirIntegracion('zernio')"), 'la red que sigue se marca ANTES de abrir Zernio');
  // La tarjeta de una red: marca y abre Zernio.
  const b = leer('app/integraciones/IntegracionesBoard.tsx');
  assert.match(b, /if \(red && !i\.sinConexion\) \{\n\s+try \{ window\.sessionStorage\.setItem\(CLAVE_SIGUE_ZERNIO, red\); \}/);
  assert.match(b, /setModal\(\{ t: 'svc', key: integracionQueConfigura\(i\.key\) \}\);/);
  assert.match(b, /onClick=\{\(\) => abrirTarjeta\(i\)\}/);
  // El paso 2 la resalta, y la suelta al quedar conectada.
  const r = leer('app/integraciones/ConectarRedes.tsx');
  assert.match(r, /const esLaQueSigue = sigue === red && e\?\.estado !== 'conectada';/);
  assert.match(r, /`Sigue aquí: conecta tu \$\{REDES\[red\]\.etiqueta\}\.`/);
  assert.match(r, /if \(!sigue \|\| !lista \|\| estadoDeRed\(sigue, lista\)\.estado !== 'conectada'\) return;\n\s+setSigue\(null\);\n\s+try \{ window\.sessionStorage\.removeItem\(CLAVE_SIGUE_ZERNIO\); \}/);
  // Sin clave todavía, el paso 2 dice qué login sigue.
  assert.match(leer('app/integraciones/ServicioConfigForm.tsx'), /`Falta tu API key de Zernio \(paso 1\)\. Con ella guardada, sigue el login de \$\{REDES\[sigueRed\]\.etiqueta\}\.`/);
});

test('la tarjeta de una red mide a Zernio una vez por carga, con tope de tiempo, y dice qué falta en orden', () => {
  const s = leer('lib/integraciones.ts');
  const f = s.slice(s.indexOf('async function estadoDeRedZernio('), s.indexOf('/** Las IA de la cascada barata:'));
  assert.match(f, /if \(sinUso\) return \{ estado: 'falta', detalle: sinUso, soloServidor: true, sinConexion: \{ texto: sinUso, chip: 'Próximamente' \} \};/);
  assert.match(f, /primero tu API key, después el login de \$\{nombre\}/);
  assert.match(f, /if \(e\.estado === 'conectada'\) return \{ estado: 'conectada'/);
  const memo = s.slice(s.indexOf('async function redesDelNegocio('), s.indexOf('async function estadoDeRedZernio('));
  assert.match(memo, /if \(hit && hit\.vence > Date\.now\(\)\) return hit\.p;/);
  assert.match(memo, /setTimeout\(\(\) => ok\(null\), TOPE_REDES_MS\)/);
  // Una red sin conectar no es un pendiente del negocio.
  assert.match(leer('app/integraciones/IntegracionesBoard.tsx'), /\|\| \(redDeTarjeta\(i\.key\) != null && sevOf\(i\) !== 'good'\)/);
});

test('el tutorial de Zernio va un paso por pantalla, con capturas REALES que existen; X avisa la tarjeta antes del login', () => {
  // lib/metodo-catalogo.ts es sólo de servidor: se lee el tutorial de Zernio como texto.
  const cat = leer('lib/metodo-catalogo.ts');
  const bloque = cat.slice(cat.indexOf("key: 'zernio',"), cat.indexOf("key: 'email',", cat.indexOf("key: 'zernio',")));
  const tut = bloque.slice(bloque.indexOf('tutorial: {'));
  const pasosTxt = tut.slice(tut.indexOf('pasos: ['), tut.indexOf('],', tut.indexOf('pasos: [')));
  const pasos = [...pasosTxt.matchAll(/^ {8}'([^']+)',$/gm)].map((m) => m[1]);
  const capTxt = /capturas: \[([^\]]*)\]/.exec(tut)?.[1] ?? '';
  const capturas = capTxt.split(',').map((x) => x.trim()).map((x) => (x === 'null' ? null : x.replace(/^'|'$/g, '')));
  const z = { tutorial: { pasos, capturas } };
  assert.ok(pasos.length >= 3, `leí ${pasos.length} pasos del tutorial de Zernio`);
  assert.equal(capturas.length, z.tutorial.pasos.length, 'una captura (o null) por paso');
  assert.ok(capturas.some(Boolean), 'sin ninguna captura no es «con capturas reales»');
  for (const c of capturas.filter((x): x is string => !!x)) {
    assert.match(c, /^\/tutoriales\/zernio\/[a-z0-9-]+\.webp$/);
    assert.ok(existsSync(join(RAIZ, 'public', c)), `la captura ${c} no está en public/`);
  }
  // Los nombres de los botones, tal cual los muestra zernio.com.
  assert.match(z.tutorial.pasos[0], /«Continue with Google»/);
  assert.match(z.tutorial.pasos[1], /«API keys» toca «Create API key»/);
  const f = leer('app/integraciones/ServicioConfigForm.tsx');
  assert.match(f, /if \(ayuda\.capturas\?\.some\(Boolean\)\) return <PasosUnoPorPantalla ayuda=\{ayuda\} nota=\{nota\} \/>;/);
  assert.match(f, /Paso \{i \+ 1\} de \{total\}/);
  // X: Zernio pide una tarjeta aunque sea de las 2 gratis (docs.zernio.com/quickstart). Se dice en la fila y en la tarjeta.
  assert.match(REDES.twitter.ayuda, /tarjeta/);
  assert.match(QUE_HACE_MAKO.twitter, /tarjeta/);
});

// ── Probado ROMPIÉNDOLO (29/10/2026) ──────────────────────────────────────────
// Con el código como está: 9 pases y 0 fallos. Rota, una por vez y restaurando:
//   · Pinterest se ofrece en el paso 2 (gasta una gratis en algo que no se usa) → 8 / 1
//   · LinkedIn sin tarjeta                                                     → 8 / 1
//   · la tarjeta de una red no abre Zernio                                      → 8 / 1
//   · la tarjeta de X promete sin decir que sus mensajes no llegan              → 8 / 1
//   · el Calendario no publica en Threads                                       → 6 / 3
//   · X sin su tope de 280                                                      → 7 / 2
//   · Google Business acepta video                                              → 8 / 1
//   · la migración se olvida de una red                                         → 8 / 1
//   · sin clave no queda marcada la red que sigue                               → 8 / 1
//   · el paso 2 no suelta la red que sigue al conectarla                        → 8 / 1
//   · la tarjeta lee Zernio sin tope de tiempo                                  → 8 / 1
//   · una red sin conectar cuenta como pendiente                                → 8 / 1
//   · una tarjeta de red sin logo                                               → 8 / 1
//   · el tutorial vuelve a la lista (sin un paso por pantalla)                  → 8 / 1
//   · la captura del paso 1 apunta a un archivo que no existe                   → 8 / 1
// (Las dos primeras corridas dejaron pasar «LinkedIn sin tarjeta» y «sin clave no queda marcada»: el test recorría la misma lista
// que se rompía, y un indexOf de -1 es «antes». Se endureció y ahora muerden.)
