// =============================================================================
// El quinto feedback del 12/10/2026 sobre el editor del funnel: la tabla de campañas
// (un botón «Asignar a este funnel», el filtro de siempre, cinco y «Ver más») y las etapas
// como tarjetas
// =============================================================================
// «Elimina el desplegable de "asignar a funnel", si estoy editando un funnel siempre se asigna
// a ese que estoy parado... En su lugar un botón de "Asignar a este funnel" Y elimina los 2
// filtros de las campañas, en su lugar pon el ícono de filtro de siempre y obvio no va el filtro
// de "todos los funnels". 2. Que las campañas sean pocas, unas 5... y el botón abajo de "ver
// más"... 4. No hagas tan parecido la lista de etapas a la lista de camapañs... tal vez que sean
// tarjetas más gordas.»
//
// Verificado ROMPIÉNDOLO, una rotura por vez (base: 4 pass / 0 fail):
//   · el lote vuelve a ser `<Dropdown … placeholder="Asignar a funnel">` → 3 / 1
//   · la tabla vuelve a dibujar `filas.map` (todas) → 3 / 1
//   · la selección de «todas» cuenta `filas` en vez de `filasVistas` → 3 / 1
//   · la caja de la etapa vuelve a `background: 'var(--surface-2)'` → 3 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const CAMP = sinComentarios(leer('app/crm/CampanasModal.tsx'));
const ETAPAS = sinComentarios(leer('app/crm/EtapasModal.tsx'));

test('el lote asigna AL FUNNEL QUE SE EDITA: un botón, sin desplegable de funnels', () => {
  assert.doesNotMatch(CAMP, /<Dropdown/, 'en la tabla de campañas ya no hay desplegables');
  assert.doesNotMatch(CAMP, /Asignar a funnel"/);
  assert.match(CAMP, />\s*Asignar a este funnel\s*</);
  // Por el MISMO camino que antes (la previa y su pregunta), con el funnel abierto.
  assert.match(CAMP, /onClick=\{\(\) => void elegirProductoLote\(valorDeProducto\(funnelId\)\)\}/);
});

test('los dos filtros son UNO, con el ícono de filtro de siempre, y sin «Todos»', () => {
  assert.match(CAMP, /<IconoMenu nombre="filtro"/);
  assert.doesNotMatch(CAMP, /Todos los funnels/);
  assert.doesNotMatch(CAMP, /Todos los estados/);
  // Cada opción se prende y se apaga con un clic: sin nada prendido, se ven todas.
  assert.match(CAMP, /onClick=\{\(\) => g\.set\(on \? '' : o\.v\)\}/);
  // Las opciones de los dos grupos siguen siendo las que el filtro de las filas entiende.
  for (const v of ['ACTIVE', 'otra', 'este', 'otro', 'sin']) assert.match(CAMP, new RegExp(`v: '${v}'`));
});

test('se ven cinco campañas y el «Ver más» de la casa; la casilla de «todas» tilda lo que se ve', () => {
  assert.match(CAMP, /useVerMas\(filas, \{ inicial: 5 \}\)/);
  assert.match(CAMP, /\{filasVistas\.map\(\(c\) => \[/, 'la tabla dibuja las que se ven, no todas');
  assert.doesNotMatch(CAMP, /\{filas\.map\(/);
  assert.match(CAMP, /for \(const c of filasVistas\) \{/, 'tildar «todas» no se lleva las escondidas');
  assert.match(CAMP, /\{verMas && /);
});

test('las etapas son TARJETAS: fondo blanco con anillo y sombra, y más altas que una fila de campañas', () => {
  assert.match(ETAPAS, /const caja: CSSProperties = \{ borderRadius: 12, background: 'var\(--surface\)', boxShadow: SOMBRA_TARJETA/);
  assert.match(ETAPAS, /padding: '12px 12px 12px 12px'/);
  // La marca del arrastre suma su raya a la sombra: si la pisara, la tarjeta destino perdería el borde.
  assert.match(ETAPAS, /const MARCA: CSSProperties = \{ boxShadow: `inset 0 3px 0 0 var\(--primary\), \$\{SOMBRA_TARJETA\}` \}/);
  // Ganado y descartes siguen punteados y sin sombra.
  assert.match(ETAPAS, /\.\.\.caja, background: 'transparent', boxShadow: 'none', border: '1px dashed var\(--border-strong\)'/);
});
