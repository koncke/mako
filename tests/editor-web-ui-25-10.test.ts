// =============================================================================
// El editor web del 25/10/2026: tooltips encima de todo, controles en el margen, Compartir partido y los paneles iguales
// =============================================================================
// Martín (25/10, ~11:30 y ~11:40, capturas 20, 21 y 23 del Cerebro):
//   · «Los placeholder... se siguen ocultando detrás de otras secciones y no se leen» (el «Editor de texto» tapado por la
//     barra de formato) y el «Volver al ch…» cortado del panel Páginas → UN tooltip en un portal (TooltipsFlotantes);
//   · «Los botones... se siguen superponiendo» (el «+ ⠿» del bloque encima del logo) → al margen, al lado del ⋮;
//   · «El desplegable al lado de "compartir" no debe ser redondo» → el botón partido con clases propias;
//   · «La "tira de imagenes" y "pagina" no deben cambiar el ancho de la sidebar del chat», «con un botón de flecha para
//     regresar... No la X» y «el botón de "texto" debe estar al principio de todo».
// Correr: node --import tsx --test tests/editor-web-ui-25-10.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('el tooltip flotante: del lado pedido, dado vuelta si no entra, y siempre adentro de la ventana', async () => {
  const { ubicarTooltip } = await import('../app/web-generator/editor/TooltipsFlotantes');
  const vista = { ancho: 1280, alto: 800 };
  const boton = (left: number, top: number, w = 32, h = 32) => ({ left, top, right: left + w, bottom: top + h, width: w, height: h });
  // Abajo y centrado, como el CSS de siempre.
  assert.deepEqual(ubicarTooltip(boton(600, 20), 100, 22, 'abajo', vista), { left: 566, top: 58, lado: 'abajo' });
  // Sin lugar abajo, va arriba.
  assert.equal(ubicarTooltip(boton(600, 780), 100, 22, 'abajo', vista).lado, 'arriba');
  // El «Volver al chat» del panel, pegado al borde: corrido para que no se salga (antes se cortaba a la mitad).
  const borde = ubicarTooltip(boton(1250, 20), 120, 22, 'abajo', vista);
  assert.ok(borde.left + 120 <= 1280 - 8, `se sale por la derecha: ${borde.left}`);
  // La columna de la sección: a la derecha, y a la izquierda si no entra.
  assert.equal(ubicarTooltip(boton(100, 300, 28, 28), 200, 22, 'derecha', vista).lado, 'derecha');
  assert.equal(ubicarTooltip(boton(1200, 300, 28, 28), 200, 22, 'derecha', vista).lado, 'izquierda');
});

test('los tooltips van en un portal encima de todo, y los pseudo-elementos se apagan mientras está montado', () => {
  const comp = sinComentarios(leer('app/web-generator/editor/TooltipsFlotantes.tsx'));
  assert.match(comp, /createPortal\(/);
  assert.match(comp, /document\.body,\n\s*\);/, 'el portal va en body: ningún overflow ni capa lo tapa');
  assert.match(comp, /const SELECTOR = '\.gma-tip\[data-tip\], \.gmc-tip\[data-tip\]';/, 'los dos sistemas de tooltip de la tab');
  assert.match(comp, /html\.setAttribute\('data-tips-flotantes', ''\);/);
  const gamma = leer('app/web-generator/gamma.css');
  assert.match(gamma, /html\[data-tips-flotantes\] \.gma-tip::after,\nhtml\[data-tips-flotantes\] \.gmc-tip::before \{ display: none !important; \}/);
  assert.match(gamma, /\.gma-tip-flotante \{\n\s*position: fixed;\n\s*z-index: 2147483000;/);
  // Montado una vez para toda la tab (el editor, el Panel y sus paneles).
  assert.match(sinComentarios(leer('app/web-generator/layout.tsx')), /return <>\{children\}<TooltipsFlotantes \/><\/>;/);
});

test('el «+ ⠿» del bloque va al margen, al lado del ⋮ de la sección, sin pisarlo ni pisar el contenido', async () => {
  const { ASA_FUERA_DE_LA_SECCION } = await import('../app/web-generator/editor/AsaBloque');
  const ANCHO_ASA = 22 + 2 + 22; // dos botones de 22 px con 2 de separación (CSS_ASA)
  const ANCHO_COLUMNA = 28 + 6; // el ⋮ (28 px) y su aire a la derecha (`.gmc-lado`)
  const margen = Number(/> \.gm-doc:not\(\[data-formato="presentacion"\]\) \{ margin-left: (\d+)px; \}/.exec(leer('app/web-generator/gamma.css'))?.[1]);
  assert.ok(ASA_FUERA_DE_LA_SECCION <= margen, `el asa (a ${ASA_FUERA_DE_LA_SECCION} px) se sale del margen (${margen})`);
  assert.ok(ASA_FUERA_DE_LA_SECCION - ANCHO_ASA >= ANCHO_COLUMNA, 'el asa pisa la columna ⋮');
  const asa = sinComentarios(leer('app/web-generator/editor/AsaBloque.tsx'));
  assert.match(asa, /left = Math\.min\(left, tarjeta\.getBoundingClientRect\(\)\.left - ASA_FUERA_DE_LA_SECCION\);/);
  assert.match(asa, /x < rt\.left - ALCANCE_IZQ/, 'el puntero tiene que poder llegar al asa');
});

test('«Compartir ▾» es UNA pastilla: cada mitad con su clase (el puntito de cambios ya no le cambia la forma al ▾)', () => {
  const ed = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(ed, /className="gma-boton gma-boton--primario gma-partido-principal gma-tip"/);
  assert.match(ed, /className="gma-boton gma-boton--primario gma-partido-flecha"/);
  const gamma = leer('app/web-generator/gamma.css');
  assert.match(gamma, /\.gma-partido > \.gma-partido-principal \{ border-radius: var\(--gma-radio-pildora\) 0 0 var\(--gma-radio-pildora\);/);
  // Sin la raya del medio desde el 30/10/2026: se ve como un solo botón (tests/editor-web-como-automations.test.ts).
  assert.match(gamma, /\.gma-partido > \.gma-partido-flecha \{\n\s*width: 26px;\n\s*padding: 0 4px 0 0;\n\s*border-radius: 0 var\(--gma-radio-pildora\) var\(--gma-radio-pildora\) 0;\n\}/);
  assert.doesNotMatch(gamma, /\.gma-partido > \.gma-boton:(first|last)-child/, 'con :last-child el puntito azul deja al ▾ suelto');
});

test('«Páginas» y la tira miden lo mismo que el chat, vuelven con «←» arriba a la izquierda, y «Texto» va primero', () => {
  const gamma = leer('app/web-generator/gamma.css');
  assert.doesNotMatch(sinComentarios(gamma), /\.gma-izq\[data-panel="[a-z]+"\] \{ width:/, 'un panel de la izquierda con su propio ancho hace saltar el lienzo');
  for (const rel of ['app/web-generator/editor/PanelPaginas.tsx', 'app/web-generator/editor/TiraSecciones.tsx']) {
    const src = sinComentarios(leer(rel));
    const volver = src.indexOf('<button type="button" className="gma-izq-volver gma-tip" data-tip="Volver al chat" aria-label="Volver al chat" onClick={onCerrar}>←</button>');
    assert.ok(volver > 0, `${rel}: sin la flecha para volver`);
    assert.ok(volver < src.indexOf('className="gma-izq-titulo"'), `${rel}: la flecha va antes del título (arriba a la izquierda)`);
    assert.doesNotMatch(src, /<Ico n="(x|cerrar)"[^>]*\/>\s*<\/button>/, `${rel}: volvió la X para cerrar`);
  }
  // La barra ENTRA a 1280 (medido en producción el 25/10: pedía 872 px en 848 y el «⋯» quedaba afuera): el título cede
  // hasta su mínimo de 160 px. Con `flex: 0 0 auto` no cedía nada.
  assert.match(sinComentarios(gamma), /\.gma-herramientas \.gma-titulo \{ flex: 0 1 auto; max-width: 320px; min-width: 160px; \}/);
  const ed = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  const texto = ed.indexOf('data-tip="Editor de texto"');
  for (const otro of ['data-tip="Páginas"', 'data-tip="Tira de imágenes"', 'data-tip="Agregar bloque"', 'data-tip="Animar"']) {
    assert.ok(texto > 0 && texto < ed.indexOf(otro), `«Texto» va antes de ${otro}`);
  }
});
