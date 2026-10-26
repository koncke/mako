// =============================================================================
// Lo que se ve bien en el editor y se perdía al GUARDAR un diseño (26/10/2026, la revisión adversarial de tren-l)
// =============================================================================
// La barra «Texto» en los diseños (acciones-diseno.ts) y «Botón» (HtmlEditableVista.tsx) escriben en el HTML del diseño, y
// ese HTML pasa por el saneo del server (html-editable-seguro.ts) al guardar, abrir y publicar. Tres cosas se iban sin
// aviso:
//   1. el TACHADO: Chrome lo escribe como `<strike>` (execCommand sin styleWithCSS) y la lista blanca sólo tenía `s`;
//   2. el enlace «A OTRA PÁGINA» (`pagina:<id>` del selector de destino): `pagina` no era un esquema permitido, y además
//      el HTML de un diseño se publica sin traducir ese enlace a la dirección de la página;
//   3. el PRECIO o los días con formato: la marca sólo se reconocía con texto plano adentro, y con una negrita el precio
//      quedaba congelado en el del día de publicar.
// Correr: node --import tsx --test tests/editor-web-guardado-diseno-26-10.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conPreciosEnHtml } from '../lib/editor-landing/precios-en-landing';
import { conEnlacesDePaginas } from '../lib/editor-landing/html-editable';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
/** El saneo lleva `server-only`: corre en un node aparte (tests/_html-editable-seguro-hijo.ts). */
const sanear = (html: string): string => (JSON.parse(execFileSync(process.execPath,
  ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_html-editable-seguro-hijo.ts'), html], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 })) as { limpio: string }).limpio;

test('1. el tachado y los colores viejos de Chrome pasan el saneo como etiquetas de la lista', () => {
  assert.equal(sanear('<p><strike>a</strike> <del>b</del> <s>c</s></p>'), '<p><s>a</s> <s>b</s> <s>c</s></p>');
  assert.equal(sanear('<p><font color="#ff0000">rojo</font><font color="red" face="x">r</font><font color="url(x)">n</font></p>'),
    '<p><span style="color:#ff0000">rojo</span><span style="color:red">r</span><span>n</span></p>');
  // Y la barra tacha con estilo (no con la etiqueta vieja).
  const acciones = leer('app/web-generator/editor/acciones-diseno.ts');
  assert.match(acciones, /if \(nombre === 'strike'\) comando\(doc, 'styleWithCSS', 'true'\);\n\s*return comando\(doc, CMD_MARCA\[nombre\]\);/);
});

test('2. un enlace a otra página se guarda y se publica con la dirección de esa página', async () => {
  assert.equal(sanear('<a href="pagina:p2">Precios</a>'), '<a href="pagina:p2">Precios</a>', 'el saneo se come el enlace a otra página');
  assert.equal(sanear('<a href="pagina:p2&quot;x">mal</a>'), '<a>mal</a>', 'un pagina: que no es un id no pasa');
  assert.equal(sanear('<a href="javascript:alert(1)">x</a>'), '<a>x</a>');
  // Al publicar: a su dirección; sin resolvedor o sin la página, `#`; lo demás, igual.
  assert.equal(conEnlacesDePaginas('<a href="pagina:p2">P</a>', (h) => (h === 'pagina:p2' ? 'https://s.com/precios?a=1&b=2' : null)), '<a href="https://s.com/precios?a=1&amp;b=2">P</a>');
  assert.equal(conEnlacesDePaginas('<a href="pagina:nada">P</a>', () => null), '<a href="#">P</a>');
  assert.equal(conEnlacesDePaginas('<a href="pagina:p2">P</a>'), '<a href="#">P</a>');
  assert.equal(conEnlacesDePaginas('<a href="https://x.com">X</a>', () => 'no'), '<a href="https://x.com">X</a>');
  const { htmlDePagina } = await import('../lib/editor-landing/render');
  const { NODO } = await import('../lib/editor-landing/doc');
  const { CONFIG_DEFAULT } = await import('../lib/editor-landing/api-tipos');
  const { TEMAS } = await import('../lib/editor-landing/temas');
  const pagina = { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [{ type: NODO.tarjeta, attrs: { id: 'tA' }, content: [{ type: NODO.htmlEditable, attrs: { id: 'eA', html: '<section><a href="pagina:p2">Ver precios</a></section>' } }] }] } };
  const html = htmlDePagina(pagina as never, CONFIG_DEFAULT, TEMAS[0], { modo: 'publico', urlBase: 'https://hola-mako.site/x', paginas: [{ id: 'p1', ruta: '' }, { id: 'p2', ruta: 'precios' }] } as never);
  assert.match(html, /<a href="https:\/\/hola-mako\.site\/x\/precios">Ver precios<\/a>/, 'la página publicada lleva un pagina: crudo');
  assert.doesNotMatch(html, /pagina:p2/);
});

test('3. el precio y los días con formato encima se siguen poniendo al día', () => {
  const planes = [{ id: 'esencial', precioUsd: 47 }, { id: 'pro', precioUsd: 97 }];
  assert.equal(conPreciosEnHtml('<span data-mako-precio="pro"><b>US$1</b></span>', planes), '<span data-mako-precio="pro"><b>US$97</b></span>');
  assert.equal(conPreciosEnHtml('<span data-mako-precio="pro"><a href="#p"><em>US$1</em></a></span>', planes), '<span data-mako-precio="pro"><a href="#p"><em>US$97</em></a></span>');
  assert.equal(conPreciosEnHtml('<span data-mako-desde=""><span style="color:red">US$1</span></span>', planes), '<span data-mako-desde=""><span style="color:red">US$47</span></span>', 'un span adentro del span marcado');
  // Formato sobre una PARTE: el número va al primer pedazo (el precio es el de hoy; lo que se pierde es el formato del pedazo).
  assert.equal(conPreciosEnHtml('<span data-mako-precio="pro">US$<b>1</b></span>', planes), '<span data-mako-precio="pro">US$97<b></b></span>');
  assert.equal(conPreciosEnHtml('<p>Son <span data-mako-prueba="dias"><strong>3</strong></span> días</p>', [], 7), '<p>Son <span data-mako-prueba="dias"><strong>7</strong></span> días</p>');
  // Lo que NO es formato adentro (una caja), queda como vino.
  const raro = '<span data-mako-precio="pro"><div>US$1</div></span>';
  assert.equal(conPreciosEnHtml(raro, planes), raro);
  // Lo de siempre sigue igual.
  assert.equal(conPreciosEnHtml('<p>Desde <span data-mako-desde="">US$1</span></p>', planes), '<p>Desde <span data-mako-desde="">US$47</span></p>');
});
