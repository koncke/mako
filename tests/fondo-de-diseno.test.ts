// =============================================================================
// El color de fondo de una sección de «Diseño editable» se lee y se cambia (25/10/2026)
// =============================================================================
// Martín (25/10): «tampoco puedo editar el color del bg de cada sección». En las landings de MaKo el fondo sale del
// `style` de la raíz, de una clase o una regla con `!important` de la hoja, o de nada (una columna angosta sobre el fondo
// de la página). Medido sobre las 9 secciones de la #32: las 9 toman el color y vuelven EXACTAS al del diseño. Lo que fija:
//   1. qué fondo se VE (la cascada: hoja < style < hoja !important < style !important) y el que puso MaKo;
//   2. raíz de ancho completo: el color al final de su `style`, con `!important` y la marca; columna angosta: una
//      envoltura de ancho completo; el encabezado pegajoso, nunca envuelto;
//   3. cambiar dos veces no apila, y «el del diseño» vuelve byte por byte;
//   4. el panel «Color de sección» del editor y la API usan ESTO (y nada que no llegue a lo publicado).
// Correr: node --import tsx --test tests/fondo-de-diseno.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conFondoDeDiseno, fondoPuestoDe, fondoVisibleDe, valorDeFondo } from '../lib/editor-landing/fondo-de-diseno';
import { DEGRADADOS } from '../lib/editor-landing/doc';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// Como las de la #32 y las 14 nuevas (recortadas).
const HISTORIA = '<section id="historia" style="margin-top:96px;background:#F5F7FA;border-top:1px solid #EEF0F3"><div style="max-width:1060px;margin:0 auto"><h2>De meses</h2></div></section>';
const HERO = '\n  <section id="top" style="max-width:1120px;margin:0 auto;padding:60px 28px 0"><div><h1>Hola</h1></div></section>\n';
const BETA = '<section id="beta" style="margin-top:40px;background:#F5F7FA" data-beta-on><div><h2>Beta</h2></div></section>';
const NAV = '<header style="position:sticky;top:0;max-width:100vw;background:rgba(255,255,255,.9)"><a href="#top">MaKo</a></header>';
const NUEVA = '<section class="mkv mkv-sec mkv-sec-gris" id="equipo"><div class="mkv-in"><h2>Equipo</h2></div></section>';
const CSS = [
  '.gm-libre { background: #FFFFFF; }',
  '.gm-libre #beta { background: linear-gradient(180deg,#2F6FED 0%,#2A63DE 100%) !important; }',
  '.mkv-sec-gris { background: #EFF1F4; }',
  '@media (max-width: 640px) { .mkv-sec-gris { background: #000; } }',
  '.mkv-in { max-width: 1120px; margin: 0 auto; }',
].join('\n');

test('qué fondo se ve: el style, la clase, la regla con !important, o ninguno (la columna sobre la página)', () => {
  assert.equal(fondoVisibleDe(HISTORIA, CSS), '#F5F7FA');
  assert.equal(fondoVisibleDe(BETA, CSS), 'linear-gradient(180deg,#2F6FED 0%,#2A63DE 100%)', 'la regla con !important le gana al style');
  assert.equal(fondoVisibleDe(NUEVA, CSS), '#EFF1F4', 'la clase de la hoja (sin lo de @media)');
  assert.equal(fondoVisibleDe(HERO, CSS), null, 'una columna sin fondo propio: se ve el de la página');
  assert.equal(fondoVisibleDe('<p>uno</p><p>dos</p>', CSS), null, 'varias cosas sueltas: no se sabe');
  assert.equal(fondoPuestoDe(HISTORIA), null);
});

test('raíz de ancho completo: el color al final del style, con !important y la marca; el resto, igual', () => {
  const con = conFondoDeDiseno(HISTORIA, { color: '#112233' }, CSS);
  assert.equal(con, HISTORIA.replace('#EEF0F3"', '#EEF0F3;background:#112233 !important" data-gm-fondo="#112233"'));
  assert.equal(fondoVisibleDe(con, CSS), '#112233');
  assert.deepEqual(fondoPuestoDe(con), { color: '#112233' });
  // Le gana a la regla con !important de la hoja (un style con !important gana siempre).
  assert.equal(fondoVisibleDe(conFondoDeDiseno(BETA, { color: '#112233' }, CSS), CSS), '#112233');
  assert.equal(fondoVisibleDe(conFondoDeDiseno(NUEVA, { degradado: 'noche' }, CSS), CSS), DEGRADADOS.noche);
  // El encabezado pegajoso no se envuelve (envuelto, dejaría de pegarse), aunque tenga max-width.
  assert.match(conFondoDeDiseno(NAV, { color: '#112233' }, CSS), /^<header style="position:sticky;[^"]*;background:#112233 !important" data-gm-fondo="#112233">/);
});

test('columna angosta o varias cosas sueltas: una envoltura de ancho completo', () => {
  const con = conFondoDeDiseno(HERO, { color: '#112233' }, CSS);
  assert.equal(con, `<div data-gm-fondo="#112233" data-gm-envoltura="" style="background:#112233">${HERO}</div>`);
  assert.equal(fondoVisibleDe(con, CSS), '#112233');
  assert.match(conFondoDeDiseno('<p>uno</p><p>dos</p>', { color: '#abc' }, CSS), /^<div data-gm-fondo="#abc" data-gm-envoltura=""/);
});

test('cambiar dos veces no apila nada, y «el del diseño» vuelve byte por byte', () => {
  for (const html of [HISTORIA, HERO, BETA, NAV, NUEVA]) {
    const dos = conFondoDeDiseno(conFondoDeDiseno(html, { color: '#112233' }, CSS), { degradado: 'aurora' }, CSS);
    assert.deepEqual(fondoPuestoDe(dos), { degradado: 'aurora' });
    assert.equal(dos.split('data-gm-fondo=').length, 2, 'una sola marca');
    assert.equal(dos.split('!important').length, html === HERO ? 1 : 2, 'una sola declaración (la columna va envuelta, sin !important)');
    assert.equal(conFondoDeDiseno(dos, null, CSS), html, 'no vuelve exacto');
  }
  assert.equal(conFondoDeDiseno(HISTORIA, null, CSS), HISTORIA, 'sin nada puesto, sacarlo no cambia nada');
});

test('un fondo inválido no toca nada, y lo escrito no abre otro atributo', () => {
  assert.equal(conFondoDeDiseno(HISTORIA, { color: 'red" onclick="x' }, CSS), HISTORIA);
  assert.equal(conFondoDeDiseno(HISTORIA, { degradado: 'inventado' as never }, CSS), HISTORIA);
  assert.equal(valorDeFondo({ color: '#ABCDEF' }), '#abcdef');
  assert.equal(valorDeFondo({ color: 'blue' }), null);
});

test('el panel del editor y la API cambian el fondo con ESTO, sobre el HTML que se publica', () => {
  const panel = leer('app/web-generator/editor/paneles/EstiloSeccion.tsx');
  assert.match(panel, /tr\.setNodeMarkup\(t\.pos \+ 1 \+ offset, undefined, \{ \.\.\.hijo\.attrs, html: nuevo \}\);/);
  assert.match(panel, /const nuevo = conFondoDeDiseno\(html, fondo, css\);/);
  // En una sección de diseño, el panel es sólo «Color de sección»: lo demás (acento, ancho, alto) no llega a lo publicado.
  assert.match(panel, /if \(diseno !== null\) \{/);
  assert.match(panel, /aria-pressed=\{!puesto\} onClick=\{\(\) => poner\(null\)\}>\s*<i style=\{\{ background: original \?\? 'transparent' \}\} \/>Del diseño\s*</);
  assert.match(panel, /const diseno = esDeDiseno\(t\.node\) \? String\(t\.node\.firstChild\?\.attrs\.html \?\? ''\) : null;/);
  const api = leer('lib/api-mako/areas/landing-contenido.helpers.ts');
  assert.match(api, /if \(esTarjetaEditable\(u\.tarjeta\)\) return planFondoDeSeccionDeDiseno\(c, u, e, op\.css \?\? ''\);/);
  // El menú de la sección (⋮ y el clic derecho, que abre el MISMO) ya trae «Cambiar el color de fondo».
  assert.match(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'), /<FilaMenu icono="paleta" texto="Cambiar el color de fondo" onClick=\{\(\) => setPanel\(\{ tipo: 'estilo', ancla: anclaSub\(\) \}\)\} \/>/);
});
