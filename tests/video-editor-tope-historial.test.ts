// =============================================================================
// El historial de deshacer tiene tope, y la cuenta de «Deshacer todo» no se rompe (11/11/2026)
// =============================================================================
// docs/editor-video/memoria-del-editor.md §5: el historial no tenía tope y cada paso guarda una versión de las pistas.
// Fija que core/managers/commands.ts se quede con los últimos MAX_PASOS_DESHACER y que `profundidad()` siga contando
// los olvidados: la «Edición automática» (enjambre/correr.ts) resta la profundidad de antes y la de después, y con el
// historial lleno esa resta daba 0 (entra uno, sale el más viejo) y «Deshacer todo» no deshacía nada.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · sin `this.recortar()` en execute: rojo el del tope;
//   · `profundidad()` sin `this.olvidados`: rojo el de la Edición automática;
//   · `clear()` sin volver `olvidados` a 0: rojo el de clear.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommandManager, MAX_PASOS_DESHACER } from '../app/video-editor/_opencut/core/managers/commands';

const deshechos: number[] = [];
const paso = (n: number) => ({ execute: () => undefined, undo: () => void deshechos.push(n), redo: () => undefined });
const editorFalso = {
  scenes: { getActiveSceneOrNull: () => null },
  selection: { getSnapshot: () => ({}), restoreSnapshot: () => {} },
};
const nuevo = () => new CommandManager(editorFalso as never);
const correr = (c: CommandManager, desde: number, cuantos: number) => {
  for (let i = desde; i < desde + cuantos; i++) c.execute({ command: paso(i) as never });
};

test('se queda con los últimos pasos: pasado el tope, el más viejo se olvida', () => {
  const c = nuevo();
  deshechos.length = 0;
  correr(c, 0, MAX_PASOS_DESHACER + 50);
  let n = 0;
  while (c.canUndo()) {
    c.undo();
    n++;
  }
  assert.equal(n, MAX_PASOS_DESHACER);
  assert.equal(deshechos[0], MAX_PASOS_DESHACER + 49, 'el primero que se deshace es el último que se hizo');
  assert.equal(deshechos.at(-1), 50, 'los 50 más viejos se olvidaron');
});

test('con el historial lleno, la Edición automática cuenta bien sus pasos y «Deshacer todo» deshace ésos', () => {
  const c = nuevo();
  deshechos.length = 0;
  correr(c, 0, MAX_PASOS_DESHACER);
  const antes = c.profundidad();
  correr(c, 1000, 10); // diez agentes, un paso cada uno
  const pasos = c.profundidad() - antes;
  assert.equal(pasos, 10);
  for (let i = 0; i < pasos; i++) c.undo();
  assert.deepEqual(deshechos, [1009, 1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001, 1000]);
});

test('clear vuelve todo a cero (abrir otro proyecto)', () => {
  const c = nuevo();
  correr(c, 0, MAX_PASOS_DESHACER + 5);
  c.clear();
  assert.equal(c.profundidad(), 0);
  assert.equal(c.canUndo(), false);
});
