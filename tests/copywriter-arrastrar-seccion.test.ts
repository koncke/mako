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
//
// LA COLA (18/11/2026, F98): un título con sólo una tabla debajo se arrastraba solo y dejaba la tabla atrás, y cuatro
// plantillas de fábrica tienen esa forma. La tabla (o un divisor) al final de la sección es la `cola`: no puede ser el extremo
// de la selección, y `llevarCola` la pone detrás al soltar. Se prueba contra un BlockNote DE VERDAD (headless, en jsdom), con
// el soltar hecho a mano (mover el título como lo deja BlockNote) porque el arrastre en sí es interno de BlockNote.
// Probado rompiéndolo (18/11/2026), base 8/0:
//   · `seccionDe` sin la cola (la tabla del final no se devuelve) ............... 3 fallan
//   · `llevarCola` sin mirar si la cola ya va detrás (mueve en cada `dragend`) .. 1 falla
//   · el editor sin llamar a `llevarCola` después de soltar ...................... 1 falla
// ⚠️ Sin verificar arrastrando con el dedo o el mouse en un navegador (la nube no lo abre): falta mirarlo en uno.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { llevarCola, seccionDe, nivelDeTitulo, type BloqueArrastre, type EditorCola } from '../lib/copywriter/seccion-arrastre';

const t = (id: string, level: number): BloqueArrastre => ({ id, type: 'heading', props: { level }, content: [] });
const p = (id: string): BloqueArrastre => ({ id, type: 'paragraph', content: [] });
const div = (id: string): BloqueArrastre => ({ id, type: 'divider' });
const tabla = (id: string): BloqueArrastre => ({ id, type: 'table', content: { type: 'tableContent', rows: [] } });

const DOC = [t('h1', 2), p('a'), p('b'), t('h2', 3), p('c'), t('h3', 2), p('d'), div('x')];

test('un Título 2 se lleva todo hasta el próximo Título 2, Títulos 3 incluidos', () => {
  assert.deepEqual(seccionDe(DOC, 'h1'), { desde: 'h1', hasta: 'c', cola: [], cuantos: 5 });
});

test('un Título 3 se lleva lo suyo y corta en un título de su nivel o más alto', () => {
  assert.deepEqual(seccionDe(DOC, 'h2'), { desde: 'h2', hasta: 'c', cola: [], cuantos: 2 });
});

test('lo que no tiene texto al final de la sección (un divisor, una tabla) no es el extremo de la selección: es la cola', () => {
  assert.deepEqual(seccionDe(DOC, 'h3'), { desde: 'h3', hasta: 'd', cola: ['x'], cuantos: 3 });
  assert.deepEqual(seccionDe([t('h', 2), div('x'), tabla('y')], 'h'), { desde: 'h', hasta: null, cola: ['x', 'y'], cuantos: 3 },
    'sin texto debajo, el título se arrastra solo y su tabla lo sigue');
  // La forma de cuatro plantillas de fábrica (lib/copywriter/plantillas.ts): un título y una tabla, y el título siguiente.
  assert.deepEqual(seccionDe([t('g', 2), tabla('tb'), t('cta', 2), p('a')], 'g'), { desde: 'g', hasta: null, cola: ['tb'], cuantos: 2 });
  // Una tabla en el MEDIO va adentro de la selección (BlockNote se lleva todo lo que hay entre los dos extremos).
  assert.deepEqual(seccionDe([t('h', 2), tabla('tb'), p('a')], 'h'), { desde: 'h', hasta: 'a', cola: [], cuantos: 3 });
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
  assert.match(src, /if \(tramo\.hasta\) \{ try \{ editor\.setSelection\(tramo\.desde, tramo\.hasta\); \}/);
  assert.match(src, /if \(tramo\.cola\.length\) despuesDeSoltar\(\(\) => \{ llevarCola\(editor as unknown as EditorCola, tramo\); \}\);/, 'la cola no sigue a la sección al soltar');
});

// ── La cola contra un BlockNote de verdad (headless, en jsdom) ─────────────────────────────────────────────────────────

async function editorDePrueba(contenido: unknown[]) {
  const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (h: string, o: { pretendToBeVisual?: boolean }) => { window: Record<string, unknown> } };
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'DOMParser', 'Text']) g[k] = dom.window[k];
  const { BlockNoteEditor } = await import('@blocknote/core');
  return BlockNoteEditor.create({ initialContent: contenido as never });
}
const ids = (e: { document: readonly { id: string }[] }) => e.document.map((b) => b.id);

test('al soltar, la tabla sigue al título que se movió; y si nada se movió, no se toca', async () => {
  const e = await editorDePrueba([
    { id: 'g', type: 'heading', props: { level: 2 }, content: 'Ganchos' },
    { id: 'tb', type: 'table', content: { type: 'tableContent', rows: [{ cells: ['Gancho', 'Por qué'] }, { cells: ['1', 'a'] }] } },
    { id: 'cta', type: 'heading', props: { level: 2 }, content: 'CTA' },
    { id: 'a', type: 'paragraph', content: 'Escríbeme' },
  ]);
  const tramo = seccionDe(e.document as unknown as BloqueArrastre[], 'g')!;
  assert.equal(llevarCola(e as unknown as EditorCola, tramo), 0, 'sin soltar (o soltado en el mismo lugar), la cola ya va detrás');
  // Lo que deja el soltar de BlockNote cuando la selección es el título solo: el título abajo y la tabla atrás.
  const titulo = e.getBlock('g')!;
  e.transact(() => { e.removeBlocks(['g']); e.insertBlocks([titulo], 'a', 'after'); });
  assert.deepEqual(ids(e), ['tb', 'cta', 'a', 'g'], 'el soltar de mentira');
  assert.equal(llevarCola(e as unknown as EditorCola, tramo), 1);
  assert.deepEqual(ids(e), ['cta', 'a', 'g', 'tb'], 'la tabla quedaba atrás');
  assert.equal(e.getBlock('tb')?.type, 'table', 'es la misma tabla, con su id');
  assert.equal(llevarCola(e as unknown as EditorCola, tramo), 0, 'el `drop` y el `dragend` la llaman dos veces: la segunda no mueve');
});

test('la cola va detrás del último bloque con texto que se llevó la selección, y no se adivina si algo ya no está', async () => {
  const e = await editorDePrueba([
    { id: 'h', type: 'heading', props: { level: 2 }, content: 'Historia' },
    { id: 'p', type: 'paragraph', content: 'Escena' },
    { id: 'tb', type: 'table', content: { type: 'tableContent', rows: [{ cells: ['1', 'x'] }] } },
    { id: 'z', type: 'heading', props: { level: 2 }, content: 'Moraleja' },
  ]);
  const tramo = seccionDe(e.document as unknown as BloqueArrastre[], 'h')!;
  assert.deepEqual([tramo.hasta, tramo.cola], ['p', ['tb']]);
  const [bh, bp] = [e.getBlock('h')!, e.getBlock('p')!];
  e.transact(() => { e.removeBlocks(['h', 'p']); e.insertBlocks([bh, bp], 'z', 'after'); });
  assert.equal(llevarCola(e as unknown as EditorCola, tramo), 1);
  assert.deepEqual(ids(e), ['z', 'h', 'p', 'tb']);
  // Lo movido ya no está (se soltó en otro editor): la cola se queda donde está.
  e.removeBlocks(['p']);
  assert.equal(llevarCola(e as unknown as EditorCola, { ...tramo }), 0);
  assert.deepEqual(ids(e), ['z', 'h', 'tb']);
});
