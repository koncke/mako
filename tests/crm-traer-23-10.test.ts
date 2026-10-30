// =============================================================================
// «Traer de otro funnel», el pedido de Martín del 23/10/2026 (captura del modal en el ws1)
// =============================================================================
// Textual, vía el Cerebro: «1. El botón "Traer de otro funnel" del "Nuevo lead" tiene que ser más visible. Hoy es un link
// chico al pie: que sea un botón claro. 2. Al abrir el pop-up, un loader mientras carga la lista, porque sin él parece
// roto. Al cambiar de funnel o de etapa, también. 3. Fuera el texto "Se ven 300 de 869; la casilla de arriba tilda a los
// 869. 300 ya están en este funnel y no se muestran." Si hace falta algo, que sea el número en la casilla, por ejemplo
// "Tildar los 869". 4. El pie con "← Atrás" y "Agregar aquí" queda pegado al fondo del pop-up, con fondo sólido. Hoy se
// ven leads por detrás y debajo, como "Sergio Fernando Zermeño", y parece roto».
// Lo de antes (tildar a TODOS, de a tandas, el deshacer) sigue en tests/crm-traer-todos.test.ts.
//
// PROBADO ROMPIÉNDOLO (23/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · «Traer de otro funnel» de vuelta a un link (`background: 'none'`, sin borde)           → 4 / 1
//   · sin el loader al abrir (`filas === null` sin el Spinner)                               → 4 / 1
//   · el filtro sin diferir (sin el loader al cambiar de etapa)                              → 4 / 1
//   · la línea «Se ven 300 de 869…» otra vez                                                 → 4 / 1
//   · la casilla sin su número                                                               → 4 / 1
//   · la vista sin medir el alto del cuerpo (`height: '100%'`)                               → 4 / 1
//   · el pie transparente                                                                    → 4 / 1
// Correr: node --import tsx --test tests/crm-traer-23-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const T = sinComentarios(leer('app/crm/TraerDeOtroProducto.tsx'));
const NF = sinComentarios(leer('app/crm/new/NewLeadForm.tsx'));

// ⚠️ 24/10/2026: Martín pidió los tres «traer» ARRIBA, en un bloque aparte y parejos («me imagino 3 botones mejores
//    diseñados arriba del formulario»). Lo que este test cuidaba sigue: un BOTÓN claro con borde y su ícono, nunca un link.
test('1. «De otro funnel» es un botón claro, con su ícono, en el bloque de arriba (con «Scraper» e «Importar», iguales)', () => {
  assert.match(NF, /<button type="button" className="nl-traer-btn" onClick=\{enModal\.onTraer\}>\s*<IconoMenu nombre="producto" size=\{18\} \/>\s*<span><strong>De otro funnel<\/strong>/);
  assert.match(NF, /\.nl-traer-btn \{[^}]*border: 1px solid var\(--border-strong\);/, 'sin borde es un link');
  assert.doesNotMatch(NF, /BTN_TRAER/, 'volvió el botón suelto del pie');
});

test('2. un loader al abrir y al cambiar de funnel (la lista viene del server), y otro mientras filtra', () => {
  assert.match(T, /\{filas === null && \(\s*<div role="status" aria-label="Cargando los leads"[^>]*>\s*<Spinner size=\{22\} \/>/);
  assert.doesNotMatch(T, />Cargando…</, 'el «Cargando…» chico al pie de una tabla vacía parecía roto');
  // Cambiar de funnel vacía la lista: vuelve el loader.
  assert.match(T, /setFilas\(null\);\s*setSel\(\[\]\);/);
  // Cambiar de etapa (o buscar) filtra 869 filas: diferido, con su ruedita y la tabla atenuada mientras.
  assert.match(T, /const qDiferida = useDeferredValue\(q\);\s*const etapaDiferida = useDeferredValue\(etapa\);\s*const filtrando = q !== qDiferida \|\| etapa !== etapaDiferida;/);
  assert.match(T, /filasParaTraer\(filas \?\? \[\], \{ q: qDiferida, etapa: etapaDiferida \}\)/);
  assert.match(T, /\{filtrando && <Spinner size=\{16\} \/>\}/);
  assert.match(T, /opacity: filtrando \? 0\.55 : 1/);
});

test('3. sin la línea de «Se ven 300 de 869…»: el número va en la casilla, «Tildar los 869»', () => {
  assert.doesNotMatch(T, /Se ven \$\{|la casilla de arriba tilda|no se \$\{yaEstan === 1/, 'volvió la línea');
  assert.match(T, /aria-label=\{`Tildar los \$\{miles\(candidatos\.length\)\}`\}/);
  assert.match(T, /\{ocultos > 0\s*\? <span style=\{TILDAR_TODOS\}>Tildar los \{miles\(candidatos\.length\)\}<\/span>\s*: 'Nombre'\}/);
  // La casilla y el rótulo ocupan las dos primeras columnas: un <label> entero se puede tocar.
  assert.match(T, /<th colSpan=\{2\}[^>]*>\s*<label/);
});

test('4. el pie es el último renglón, con fondo sólido: la vista mide el alto del cuerpo y la que scrollea es la tabla', () => {
  // Desde el 24/10/2026 la regla vive en UNA pieza, `VistaConPie`, que usan las dos vistas de «traer»: la de un grupo de
  // WhatsApp se había copiado de ésta antes del arreglo y se quedó con el pie flotando (tests/grupo-wa.test.ts).
  // Desde el 24/10/2026 las tres vistas de traer comparten el MOLDE (app/crm/MoldeTraer.tsx), que arma su pie adentro de
  // `VistaConPie` con el borde de la lista (tests/crm-molde-traer.test.ts).
  assert.match(T, /<MoldeTraer\b/);
  assert.match(sinComentarios(leer('app/crm/MoldeTraer.tsx')), /<VistaConPie cabecera=\{cabecera\} pie=\{pie\} lista=\{\{ border: '1px solid var\(--border\)', borderRadius: 12, \.\.\.lista \}\}>/);
  assert.doesNotMatch(T, /position: 'sticky', bottom: 0/, 'el pie volvió a armarse a mano, fuera de la pieza');
  const V = sinComentarios(leer('app/_ui/VistaConPie.tsx'));
  assert.match(V, /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, height: '100%' \}\}>/);
  assert.match(V, /<div style=\{\{ flex: 1, minHeight: 0, overflowY: 'auto', \.\.\.lista \}\}>/);
  const i = V.indexOf("position: 'sticky', bottom: 0");
  assert.ok(i > 0, 'sin el respaldo `sticky` (el importador no tiene alto)');
  const pie = V.slice(i, V.indexOf('}}>', i));
  assert.match(pie, /flex: 'none'/);
  assert.match(pie, /background: 'var\(--surface\)'/, 'el pie transparente deja ver las filas');
});

test('la misma vista sigue sirviendo al importador (un solo traedor)', () => {
  assert.match(sinComentarios(leer('app/crm/ImportarLeadsModal.tsx')), /<TraerDeOtroProducto/);
  // «Traer» va en su propio modal desde el 24/10/2026 (tests/crm-modales-encima.test.ts), con el alto fijo.
  assert.match(sinComentarios(leer('app/crm/CrmBoard.tsx')), /ancho=\{1040\}\s*alto="min\(88vh, 720px\)"/, 'sin alto fijo, `height: 100%` no mide nada');
});
