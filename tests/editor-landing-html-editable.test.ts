// =============================================================================
// «Diseño editable» (lib/editor-landing/html-editable.ts): la landing de hola-mako.com en Web Generator
// =============================================================================
// Pedido de Martín (23/10/2026): «Que tenga la landing principal de MaKo en el editable de web generator y
// que le pueda hacer cambios de allí y se apliquen. Revisa que no se dañe la landing».
//
// Lo que fija este test, y por qué cada cosa importa para que la landing se vea IGUAL:
//   · Una página con secciones de diseño se publica LIBRE: sin el marco de Gamma (sin `.gm-doc` alrededor
//     del diseño), las secciones una tras otra y en orden, cada una en un envoltorio `display: contents`.
//   · Las secciones de Gamma que haya en el medio salen en su propio tramo `.gm-doc`, sin tapar el diseño.
//   · Una página SIN diseño editable sale exactamente como antes (byte a byte).
//   · El saneo del server saca script, on* y `javascript:`, y deja el VSL de Panda con SU src.
//   · La página publicada lleva la hoja del diseño, el script por hash y la política para lo que usa.
//
// Probado rompiéndolo (23/10/2026): con el `return htmlDePaginaLibre(...)` de render.ts apagado fallan 2 de 9
// («la página libre no envuelve…» y «una sección de Gamma en el medio…»: el diseño sale adentro de
// section.gm-tarjeta, con el marco de Gamma). Con la base ADELANTE del @import en `hojaDeDiseno`, falla 1 de 10
// («la hoja publicada lleva el @import…»). Con todo en su lugar,  11 de 11. Con `medioPermitido` aceptando todo, falla 1 de 11 («ningún medio de un diseño apunta a la API…»).
// Con la pasada única de `</?style` de antes en `cssDisenoLimpio` (en vez de sacar todo `<`), falla 1 de 11 («la hoja del
// diseño: sin cerrar el <style>…»: `<</style/style><script>` sobrevivía).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NODO, tarjeta, titulo, parrafo, type LandingContenido, type Pagina } from '../lib/editor-landing/doc';
import { htmlDePagina } from '../lib/editor-landing/render';
import { temaPorId } from '../lib/editor-landing/temas';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { CLASE_LIBRE, CSS_BASE_LIBRE, SCRIPT_DISENO, cssDisenoLimpio, hojaDeDiseno, esTarjetaEditable, tieneEditables, textoDeHtmlEditable } from '../lib/editor-landing/html-editable';
import { armarDocumento } from '../lib/editor-landing/pagina-publica';
import { sanearContenido, sanearConfig } from '../lib/editor-landing/validar';
import { sinCierreDeStyle } from '../app/vsl/Landing';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// html-editable-seguro.ts lleva `server-only`: se corre en un node aparte (tests/_html-editable-seguro-hijo.ts).
const RAIZ = join(__dirname, '..');
function sanearHtmlEditable(html: string): string {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_html-editable-seguro-hijo.ts'), html], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
  return (JSON.parse(salida) as { limpio: string }).limpio;
}

const editable = (html: string, id = 'h1') => ({ type: NODO.htmlEditable, attrs: { id, html } });
const tema = temaPorId('pewter');
const config: ConfigLanding = { ...CONFIG_DEFAULT, diseno: { css: '.gm-libre .mk-x{color:red}' }, sitio: { ...CONFIG_DEFAULT.sitio, marcaMako: false } };

const HEADER = '<header style="position:sticky;top:0"><a href="#beta">Agenda</a></header>';
const HERO = '<section id="top"><h1>El mejor software</h1></section>';
const pagina = (tarjetas: unknown[]): Pagina => ({ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: tarjetas as never } });

test('la página libre no envuelve el diseño con .gm-doc y respeta el orden', () => {
  const html = htmlDePagina(pagina([tarjeta([editable(HEADER, 'ha')], { id: 'ta' }), tarjeta([editable(HERO, 'hb')], { id: 'tb' })]), config, tema, { modo: 'publico' });
  assert.ok(html.startsWith(`<div class="${CLASE_LIBRE}"`), html.slice(0, 80));
  assert.ok(!html.includes('gm-doc'), 'ninguna raíz de Gamma si todo es diseño');
  assert.ok(!html.includes('gm-tarjeta'), 'sin el marco de la sección');
  assert.ok(html.indexOf(HEADER) > 0 && html.indexOf(HERO) > html.indexOf(HEADER), 'el HTML tal cual y en orden');
  assert.match(html, /<div class="gm-libre-seccion" data-seccion="ta">/);
});

test('una sección de Gamma en el medio sale en su tramo, y la oculta no sale', () => {
  const html = htmlDePagina(pagina([
    tarjeta([editable(HEADER, 'ha')], { id: 'ta' }),
    tarjeta([titulo('Hola', 2), parrafo('Texto')], { id: 'tg' }),
    tarjeta([editable(HERO, 'hb')], { id: 'tb', oculta: true }),
  ]), config, tema, { modo: 'publico' });
  assert.equal((html.match(/class="gm-doc"/g) ?? []).length, 1, 'un tramo');
  assert.match(html, /data-tramo="si"/);
  assert.ok(html.includes('Hola'));
  assert.ok(!html.includes('El mejor software'), 'la oculta no se publica');
});

test('una página sin diseño editable sale como siempre', () => {
  const p = pagina([tarjeta([titulo('Hola', 2)], { id: 'tg' })]);
  const sin = htmlDePagina(p, { ...CONFIG_DEFAULT }, tema, { modo: 'publico' });
  assert.ok(sin.startsWith('<div class="gm-doc"'));
  assert.ok(!sin.includes(CLASE_LIBRE));
});

test('en el editor y en una miniatura va en un iframe sin scripts', () => {
  const html = htmlDePagina(pagina([tarjeta([editable(HERO)], { id: 'tb' })]), config, tema, { modo: 'miniatura' });
  assert.match(html, /<iframe sandbox="" srcdoc="/);
  assert.ok(html.includes('mk-x'), 'con la hoja del documento');
});

test('tarjeta editable, contenido con editables y el texto del HTML', () => {
  assert.equal(esTarjetaEditable(tarjeta([editable(HERO)])), true);
  assert.equal(esTarjetaEditable(tarjeta([editable(HERO), parrafo('x')])), false);
  assert.equal(tieneEditables([pagina([tarjeta([editable(HERO)])])]), true);
  assert.equal(textoDeHtmlEditable('<h1>Hola&nbsp;<b>mundo</b></h1><p>Chau</p>'), 'Hola mundo\nChau');
});

test('el saneo del contenido conserva el diseño y su hoja', () => {
  const c: LandingContenido = { v: 1, paginas: [pagina([tarjeta([editable(HERO, 'hb')], { id: 'tb' })])] };
  const r = sanearContenido(c);
  const n = r.contenido.paginas[0].doc.content[0].content?.[0];
  assert.equal(n?.type, NODO.htmlEditable);
  assert.equal(n?.attrs?.html, HERO);
  assert.equal(sanearConfig(config).config.diseno?.css, '.gm-libre .mk-x{color:red}');
  assert.equal(sanearConfig({ ...CONFIG_DEFAULT }).config.diseno, undefined, 'sin hoja, sin campo');
});

test('la hoja del diseño: sin cerrar el <style>, @import sólo de Google Fonts', () => {
  // REGLA: el CSS del diseño nunca lleva `<`. Sacar `</style` en una pasada se evadía anidando (revisión de
  // Integración, 23/10/2026): `<</style/style>` dejaba un `</style>` y el `<script>` de después corría en hola-mako.com.
  for (const sucio of ['a{}</style><script>x</script>', 'a{}<</style/style><script>alert(1)</script>', 'a{}<!--x--><img src=x onerror=y>']) {
    const limpio = cssDisenoLimpio(sucio);
    assert.ok(!limpio.includes('<'), limpio);
  }
  assert.equal(cssDisenoLimpio('.a > .b{color:red}'), '.a > .b{color:red}', 'el > del selector hijo se queda');
  assert.equal(sinCierreDeStyle('a{}</STYLE><script>'), 'a{}<\\/style><script>');
  assert.equal(cssDisenoLimpio("@import url('https://evil.tld/x.css');a{}"), 'a{}');
  const g = "@import url('https://fonts.googleapis.com/css2?family=Geist');";
  assert.equal(cssDisenoLimpio(g + 'a{}'), g + 'a{}');
});

test('la hoja publicada lleva el @import de la fuente ADELANTE de la base (si no, el navegador lo ignora)', () => {
  // La URL de Google Fonts lleva `;` (wght@400;500): medido el 23/10/2026, con la regex que cortaba en el `;` el
  // import quedaba detrás de la base y la Geist no cargaba en hola-mako.site (todos los textos más angostos).
  const g = "@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');";
  const hoja = hojaDeDiseno(g + '\n.gm-libre{color:red}');
  assert.ok(hoja.startsWith(g), hoja.slice(0, 120));
  assert.ok(hoja.indexOf(CSS_BASE_LIBRE) > 0);
  assert.equal(cssDisenoLimpio('@import "https://evil.tld/x.css";a{}'), 'a{}');
  assert.equal(cssDisenoLimpio('@import url(https://evil.tld/x.css) screen;a{}'), 'a{}');
});

test('el saneo del server saca scripts y eventos, y deja el VSL de Panda con su src', () => {
  const panda = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634&color=%232F6FED';
  const sucio = `<div class="a" style="color:red" data-reveal="1" onclick="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a>`
    + `<iframe src="${panda}" allow="autoplay" style="position:absolute"></iframe><iframe src="https://evil.tld/"></iframe>`
    + `<svg viewBox="0 0 24 24"><path d="M0 0h24"></path></svg><img src="https://hola-mako.com/vsl-assets/a.png" onerror="x()"></div>`;
  const limpio = sanearHtmlEditable(sucio);
  assert.ok(!/onclick|onerror|<script|javascript:|evil\.tld/i.test(limpio), limpio);
  assert.ok(limpio.includes(`src="${panda.replace(/&/g, '&amp;')}"`), 'el VSL con su color');
  assert.ok(limpio.includes('data-reveal="1"') && limpio.includes('style="color:red"'));
  assert.match(limpio, /<svg viewBox="0 0 24 24">/);
});

test('ningún medio de un diseño apunta a la API ni es relativo (el editor lo carga con la sesión de quien abre)', () => {
  const limpio = sanearHtmlEditable('<div style="background:url(/api/salir);color:red"><img src="/api/x"><img src="https://hola-mako.com/api/y">'
    + '<img src="https://hola-mako.com/vsl-assets/a.png"><video poster="//evil.tld/p.png"></video><div style="background-image:url(\'https://hola-mako.com//API/z\')"></div></div>');
  assert.ok(!/\/api\//i.test(limpio) && !/evil\.tld/.test(limpio), limpio);
  assert.ok(limpio.includes('src="https://hola-mako.com/vsl-assets/a.png"'));
  assert.ok(limpio.includes('color:red'), 'el resto del estilo queda');
  assert.equal(cssDisenoLimpio('.a{background:url(/api/x)}.b{background:url(https://hola-mako.com/vsl-assets/b.png)}'), '.a{background:url()}.b{background:url(https://hola-mako.com/vsl-assets/b.png)}');
});

test('a Calendly no le llega ninguna UTM en undefined (el widget la escribe como el texto «undefined»)', () => {
  // Medido en producción el 23/10/2026: sin utm_medium en el link, Calendly recibía `utm_medium=undefined`.
  assert.ok(!/\|\| undefined/.test(SCRIPT_DISENO), 'una UTM armada con «|| undefined»');
  assert.match(SCRIPT_DISENO, /if \(v\) utm\[p\[0\]\] = v;/);
  assert.match(SCRIPT_DISENO, /if \(uid\) utm\.utmTerm = uid;/);
});

test('la publicada lleva la hoja y el script del diseño, con la política que los deja correr', () => {
  const html = htmlDePagina(pagina([tarjeta([editable('<div id="cal-embed" data-calendly="https://calendly.com/koncke/asesoria"></div>')], { id: 'tc' })]), config, tema, { modo: 'publico' });
  const doc = armarDocumento(
    { html, config, cssDiseno: CSS_BASE_LIBRE + '\n' + config.diseno!.css, workspaceId: 9, modo: 'publico', urlCanonica: 'https://hola-mako.site/x' },
    { appBaseUrl: 'https://hola-mako.com', prefijoBucket: null },
  );
  assert.ok(doc.includes('<style>' + CSS_BASE_LIBRE), 'la base');
  assert.ok(doc.includes(`<script>${SCRIPT_DISENO}</script>`), 'el script');
  const hash = `'sha256-${createHash('sha256').update(SCRIPT_DISENO, 'utf8').digest('base64')}'`;
  const csp = (/Content-Security-Policy" content="([^"]+)"/.exec(doc)?.[1] ?? '').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, '&');
  assert.ok(csp.includes(hash), 'el hash del script');
  assert.match(csp, /script-src[^;]*https:\/\/assets\.calendly\.com/);
  assert.match(csp, /media-src[^;]*https:\/\/hola-mako\.com/);
});
