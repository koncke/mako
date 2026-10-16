// =============================================================================
// La ficha por bloques MIRADA: lo que se vio mal en el navegador el 16/10/2026 y quedó arreglado
// =============================================================================
// Nadie la había visto en una pantalla. Sin RAM para un `next dev` (1,4 a 4,9 GB libres durante la corrida),
// se miró en un BANCO: las dos puertas REALES (LeadSheet y LeadDetailBody, con FichaPorBloques, el armador, el
// panel y las tarjetas de siempre) armadas con esbuild y abiertas en Chrome sin ventana a 1440×900, 1024×768,
// 820×1180 y 390×844 (estas dos, táctiles), con datos de mentira y la ficha guardada por el MOTOR puro en
// memoria. Cinco cosas se veían mal, y cada una tiene acá su prueba:
//   1. «Información principal» era un 2×2 FIJO: a ½ en el pop-up cada celda medía ~200 px y el email se partía
//      letra por letra; en la tablet y en la vista «Celular», una letra por renglón.
//   2. El panel de «Personalizar» medía `100dvh - 120px`: en el pop-up terminaba 200 px por debajo del área
//      visible (la cabecera y el pie del pop-up se comen ~265 px) y los últimos avisos no se alcanzaban.
//   3. La barra del bloque elegido, anclada a la derecha, tapaba el rótulo: en todo bloque que no fuera de
//      ancho completo no se veía QUÉ bloque estaba elegido.
//   4. El marco punteado sale 6 px por fuera del bloque, y en el pop-up asomaba al lado de la fila de tabs.
//   5. El desplegable de la plantilla medía 190 px y cortaba su nombre («La de MaKo (Llamad…»).
// La grilla y el alto del panel son puros y se EJECUTAN; el cableado y la hoja se leen.
//
// Correr: node --import tsx --test tests/ficha-navegador.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 5/0), cada rotura restaurada de memoria antes de la siguiente
//    (un arnés que escribe el archivo roto y lo vuelve a escribir en un finally; `git status` quedó igual):
//   · InfoPrincipalCard de vuelta con `repeat(2, minmax(0, 1fr))`                                       → 4 / 1
//   · la grilla con un mínimo de 200 px por columna (a ½ en el pop-up quedaban dos)                      → 4 / 1
//   · `altoDelPanel` sin restar la fila de tabs (el panel vuelve a pasar el borde)                       → 4 / 1
//   · `.fb-panel` con el `max-height` de antes, sin la variable                                           → 4 / 1
//   · el panel sin medir lo que se ve (otra variable que la que lee la hoja)                              → 4 / 1
//   · el rótulo dibujado también en el elegido (la barra lo vuelve a tapar)                               → 4 / 1
//   · la barra anclada a la derecha otra vez                                                              → 4 / 1
//   · la grilla editando sin el aire de los costados                                                       → 4 / 1
//   · el desplegable de la plantilla de vuelta a 190 px                                                    → 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COLUMNA_MIN_INFO, GRILLA_INFO_PRINCIPAL, columnasInfoPrincipal } from '../app/crm/lead-view/info-principal-grilla';
import { ALTO_MINIMO_DEL_PANEL, ARRIBA_DEL_PANEL, altoDelPanel } from '../app/crm/lead-view/ficha/armar';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const css = sinComentarios(leer('app/crm/lead-view/ficha/ficha-css.ts'));
/** Las declaraciones de la PRIMERA regla cuyo texto empieza así (fuera de los @media que la repiten). */
const reglaQueEmpieza = (inicio: string): string => {
  const i = css.indexOf(inicio);
  assert.ok(i >= 0, `falta la regla «${inicio}»`);
  return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
};

test('«Información principal»: dos columnas como mucho y una cuando la tarjeta es angosta', () => {
  // Los anchos de CONTENIDO medidos en el banco (la tarjeta menos su padding de 24 + 24).
  const casos: Array<[string, number, number]> = [
    ['pop-up, ancho completo (1032)', 984, 2],
    ['pop-up editando, ancho completo (712)', 664, 2],
    ['/crm/[id] editando, ancho completo (780)', 732, 2],
    ['pop-up a 1024 editando (596)', 548, 1],
    ['pop-up, de ½ (507)', 459, 1],
    ['iPad parado, de ½ (346)', 298, 1],
    ['vista «Celular» (364)', 316, 1],
  ];
  for (const [donde, ancho, cols] of casos) assert.equal(columnasInfoPrincipal(ancho), cols, `${donde}: ${ancho} px`);
  // Nunca tres arriba y uno abajo, en ningún ancho (era lo que cuidaba el 2×2 fijo).
  for (let a = 0; a <= 3000; a += 7) assert.ok(columnasInfoPrincipal(a) <= 2, `${a} px dio ${columnasInfoPrincipal(a)} columnas`);
  // La hoja dice lo mismo que la cuenta: auto-fit con el mínimo y la mitad.
  assert.match(GRILLA_INFO_PRINCIPAL, /^repeat\(auto-fit, minmax\(min\(100%, max\(\d+px, calc\(\(100% - \d+px\) \/ 2\)\)\), 1fr\)\)$/);
  assert.ok(GRILLA_INFO_PRINCIPAL.includes(`max(${COLUMNA_MIN_INFO}px`), 'la hoja y la cuenta usan el mismo mínimo');
  assert.ok(COLUMNA_MIN_INFO >= 280, 'con menos, a ½ en el pop-up entran dos columnas y el email se parte');
  // Y la tarjeta la usa: el 2×2 fijo no vuelve.
  const card = sinComentarios(leer('app/crm/lead-view/InfoPrincipalCard.tsx'));
  assert.match(card, /gridTemplateColumns: GRILLA_INFO_PRINCIPAL/);
  assert.doesNotMatch(card, /repeat\(2, minmax\(0, 1fr\)\)/, 'volvió el 2×2 fijo');
});

test('el panel de «Personalizar» cabe en lo que se VE del contenedor que scrollea', () => {
  // El pop-up a 1440×900: el cuerpo que scrollea mide 635 px; el panel va pegado a 58 de su borde.
  assert.equal(altoDelPanel(635), 635 - ARRIBA_DEL_PANEL - 12);
  assert.ok(ARRIBA_DEL_PANEL + altoDelPanel(635) <= 635, 'el panel termina adentro del área visible');
  assert.ok(ARRIBA_DEL_PANEL + altoDelPanel(503) <= 503, 'y a 1024×768 (503 visibles)');
  assert.equal(altoDelPanel(100), ALTO_MINIMO_DEL_PANEL, 'en una ventana muy baja, un piso');
  // La hoja: el mismo «top» que la cuenta, y el alto desde la variable que mide el panel.
  const panel = reglaQueEmpieza('.fb-panel { position: sticky');
  assert.match(panel, new RegExp(`top: ${ARRIBA_DEL_PANEL}px`), 'la hoja y la cuenta tienen que decir el mismo «top»');
  assert.match(panel, /max-height: var\(--fb-panel-alto,/, 'el alto máximo sale de lo que se ve, no de la ventana');
  // El panel lo mide: el contenedor que scrollea (o la ventana) y `altoDelPanel`.
  const pf = sinComentarios(leer('app/crm/lead-view/ficha/PanelFicha.tsx'));
  assert.match(pf, /setProperty\('--fb-panel-alto', `\$\{altoDelPanel\(sc \? sc\.clientHeight : window\.innerHeight\)\}px`\)/);
  assert.match(pf, /<aside ref=\{ref\} className="fb-panel"/, 'la medida tiene que caer en el panel');
});

test('el bloque elegido lleva su nombre en la barra, que sale desde el rótulo y no lo tapa', () => {
  const arm = sinComentarios(leer('app/crm/lead-view/ficha/Armador.tsx'));
  assert.match(arm, /\{editando && !elegido && \(\s*<span className="fb-rotulo"/, 'el rótulo del elegido queda debajo de su barra');
  assert.match(arm, /<BarraBloque [^>]*titulo=\{titulo\}/, 'la barra recibe el nombre del bloque');
  assert.match(arm, /className="fb-barra-nombre"[\s\S]{0,200}\{titulo\}/, 'y lo dibuja primero');
  const barra = reglaQueEmpieza('.fb-barra-bloque {');
  assert.match(barra, /left: 10px/, 'la barra sale desde la izquierda, donde está el rótulo');
  assert.doesNotMatch(barra, /right: 10px/, 'anclada a la derecha tapaba el rótulo');
});

test('editando, la grilla le deja a los marcos el aire de los costados', () => {
  const marco = reglaQueEmpieza('.fb-marco {');
  const sale = Number(/inset: -(\d+)px/.exec(marco)?.[1]);
  assert.ok(sale > 0, 'el marco sale por fuera del bloque');
  const grilla = reglaQueEmpieza('.fb--editando .fb-grilla {');
  const pad = /padding: (\d+)px (\d+)px/.exec(grilla);
  assert.ok(pad, 'la grilla editando lleva su padding con los costados');
  assert.ok(Number(pad![2]) >= sale, `los costados (${pad![2]} px) tienen que cubrir lo que sale el marco (${sale} px)`);
});

test('la plantilla elegida se lee entera: el desplegable ocupa el ancho del panel', () => {
  const pf = sinComentarios(leer('app/crm/lead-view/ficha/PanelFicha.tsx'));
  assert.match(pf, /ariaLabel="Usar otra plantilla"\s*width="100%"/);
});
