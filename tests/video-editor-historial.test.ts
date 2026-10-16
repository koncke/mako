// =============================================================================
// El deshacer es de UN proyecto: cambiar de proyecto vacía el historial
// =============================================================================
// Encontrado leyendo el código el 15/10/2026 (tanda 3 de las plantillas):
// `CommandManager.clear()` no lo llamaba nadie. Los comandos guardan las pistas de ANTES
// del proyecto en el que se ejecutaron; abriendo otro en la misma pestaña (y «Utilizar
// plantilla» abre uno nuevo), un Ctrl+Z las escribía en el proyecto nuevo y le borraba el
// trabajo. CapCut tampoco conserva el deshacer entre proyectos.
//
// El test 1 REPRODUCE el problema con el CommandManager de verdad (carga en node: sólo
// importa tipos) y un editor de mentira; el 2 fija que ProjectManager lo vacía al crear,
// abrir y cerrar un proyecto (ese archivo llega al WASM y no carga en node: se lee el fuente).
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CommandManager } from '../app/video-editor/_opencut/core/managers/commands';

/** Un editor de mentira: una escena con pistas (un string alcanza) y una selección vacía. */
function editorFalso() {
  const estado = { proyecto: 'A', pistas: 'pistas de A' };
  const editor = {
    selection: { getSnapshot: () => ({}), applySelectionPatch: () => ({}), restoreSnapshot: () => {} },
    scenes: { getActiveSceneOrNull: () => ({ tracks: estado.pistas }) },
  };
  /** Como TracksSnapshotCommand: guarda las pistas de antes y las de después. */
  const cambiar = (despues: string) => {
    let antes = '';
    return {
      execute: () => { antes = estado.pistas; estado.pistas = despues; return undefined; },
      undo: () => { estado.pistas = antes; },
      redo: () => { estado.pistas = despues; return undefined; },
    };
  };
  return { estado, editor, cambiar };
}

test('1: sin vaciar el historial, un Ctrl+Z en el proyecto B le escribe las pistas de A; vaciándolo, no', () => {
  const { estado, editor, cambiar } = editorFalso();
  const comandos = new CommandManager(editor as never);
  comandos.execute({ command: cambiar('A con un corte') as never });

  // Se abre B en la misma pestaña sin vaciar: el deshacer de A sigue ahí.
  estado.proyecto = 'B';
  estado.pistas = 'pistas de B';
  assert.equal(comandos.canUndo(), true);
  comandos.undo();
  assert.equal(estado.pistas, 'pistas de A', 'el problema: B quedó con las pistas de A');

  // Lo que hace ahora ProjectManager al cambiar de proyecto.
  const otro = new CommandManager(editor as never);
  estado.pistas = 'pistas de A';
  otro.execute({ command: cambiar('A con un corte') as never });
  estado.pistas = 'pistas de B';
  otro.clear();
  assert.equal(otro.canUndo(), false);
  otro.undo();
  assert.equal(estado.pistas, 'pistas de B', 'B queda como estaba');
});

test('2: ProjectManager vacía el historial al crear, abrir y cerrar un proyecto', () => {
  const f = readFileSync(new URL('../app/video-editor/_opencut/core/managers/project-manager.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');
  const cuerpo = (firma: string) => {
    const i = f.indexOf(firma);
    assert.ok(i >= 0, `falta ${firma}`);
    return f.slice(i, i + 900);
  };
  for (const firma of ['async createNewProject(', 'async loadProject(', 'closeProject(): void {']) {
    assert.ok(cuerpo(firma).includes('this.editor.command.clear();'), `${firma} vacía el historial`);
  }
});

// Antes del arreglo: 1/1 (cae 2, nadie vaciaba el historial). Roturas, base 2 de 2, restauradas:
// · abrir un proyecto no vacía el historial → 1/1 (2) · cerrarlo tampoco → 1/1 (2)
// · `clear()` no vacía → 1/1 (1)
