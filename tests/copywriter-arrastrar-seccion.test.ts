// =============================================================================
// tests/copywriter-arrastrar-seccion — arrastrar un título del Copywriter se lleva lo que tiene debajo (6/11/2026)
// =============================================================================
// Llamada con Leila del 5/11 (pendientes-30-10.md 1.8): un Título y lo de abajo son bloques hermanos en BlockNote, así que
// el asa ⋮⋮ movía sólo el título. Ahora el título se lleva su sección (lib/copywriter/seccion-arrastre.ts), que el editor
// selecciona antes del arrastre de BlockNote (app/copywriter/editor/CuerpoNotion.tsx, `MenuLateral`). El gesto se vio en un
// navegador con el editor de verdad: docs/recorrido-visual/copywriter-arrastre-*.png.
//
// Probado rompiéndolo (6/11/2026), base 6 pasan / 0 fallan:
//   · la sección corta en CUALQUIER título (no mira el nivel) ... 1 falla
//   · la sección no corta en un título del mismo nivel .......... 1 falla
//   · `hasta` sin saltear lo que no tiene texto ................. 1 falla
//   · el editor sin el menú lateral que selecciona la sección ... 1 falla
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seccionDe, nivelDeTitulo, type BloqueArrastre } from '../lib/copywriter/seccion-arrastre';

const t = (id: string, level: number): BloqueArrastre => ({ id, type: 'heading', props: { level }, content: [] });
const p = (id: string): BloqueArrastre => ({ id, type: 'paragraph', content: [] });
const div = (id: string): BloqueArrastre => ({ id, type: 'divider' });
const tabla = (id: string): BloqueArrastre => ({ id, type: 'table', content: { type: 'tableContent', rows: [] } });

const DOC = [t('h1', 2), p('a'), p('b'), t('h2', 3), p('c'), t('h3', 2), p('d'), div('x')];

test('un Título 2 se lleva todo hasta el próximo Título 2, Títulos 3 incluidos', () => {
  assert.deepEqual(seccionDe(DOC, 'h1'), { desde: 'h1', hasta: 'c', cuantos: 5 });
});

test('un Título 3 se lleva lo suyo y corta en un título de su nivel o más alto', () => {
  assert.deepEqual(seccionDe(DOC, 'h2'), { desde: 'h2', hasta: 'c', cuantos: 2 });
});

test('lo que no tiene texto al final de la sección (un divisor, una tabla) no puede ser el extremo de la selección', () => {
  assert.deepEqual(seccionDe(DOC, 'h3'), { desde: 'h3', hasta: 'd', cuantos: 2 });
  assert.equal(seccionDe([t('h', 2), div('x'), tabla('y')], 'h'), null, 'sin un bloque con texto debajo, se arrastra solo');
});

test('un bloque que no es un título, o un título sin nada debajo, se arrastra como siempre', () => {
  assert.equal(seccionDe(DOC, 'a'), null);
  assert.equal(seccionDe([p('a'), t('h', 2)], 'h'), null);
  assert.equal(seccionDe([t('h', 2), t('g', 1)], 'h'), null, 'un título más alto corta la sección');
  assert.equal(seccionDe(DOC, 'no-existe'), null);
});

test('el nivel: 1 a 3; uno raro cuenta como Título 2', () => {
  assert.equal(nivelDeTitulo(t('h', 1)), 1);
  assert.equal(nivelDeTitulo({ id: 'h', type: 'heading', props: { level: 9 } }), 2);
  assert.equal(nivelDeTitulo(p('a')), null);
});

test('el editor monta el menú lateral que selecciona la sección antes del arrastre de BlockNote', () => {
  const src = readFileSync(join(import.meta.dirname, '../app/copywriter/editor/CuerpoNotion.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /<SideMenuController sideMenu=\{\(s\) => <MenuLateral \{\.\.\.s\} dragHandleMenu=\{MenuDelAsa\} \/>\} \/>/, 'el asa no pasa por MenuLateral');
  assert.match(src, /onDragStartCapture=\{alEmpezar\}/, 'la sección no se selecciona en captura (antes del arrastre de BlockNote)');
  assert.match(src, /editor\.setSelection\(tramo\.desde, tramo\.hasta\)/);
});
