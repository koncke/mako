// =============================================================================
// MaKo Mobile — /m/plan v3: los tableros de Tareas y Proyectos (app/m/plan/tableros.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · el Kanban de Tareas NO lleva las recurrentes ni las hechas (lo mismo que `hoyDelTablero`),
//     y cada tarea cae en la columna de su score (prioFromScore);
//   · el avance de un proyecto ignora sus tareas recurrentes (el `projProgress` de escritorio):
//     una recurrente al 0 % para siempre lo dejaría eternamente a medio hacer;
//   · un proyecto TERMINADO (con tareas y todas al 100) no va al tablero, y uno sin tareas sí;
//   · la lista de Recurrentes es sólo lo que se repite, con su frase.
//
// Verificado ROMPIÉNDOLO (14/10/2026), restaurando después de cada rotura:
//   · sin `sinRecurrentes` en tareasDelTablero            → 1 de 4 en rojo (la tarea «r» entra)
//   · sin `!esRecurrente(t)` en avanceProyecto            → 1 de 4 en rojo (P1 da 25 % de 4 y no 33 % de 3)
//   · sin el filtro de terminados en proyectosDelTablero  → 1 de 4 en rojo (entra P2)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import type { BoardTask, Label } from '../app/plan/board/types';
import { avanceProyecto, proyectosDelTablero, recurrentesDelTablero, tareasDelTablero } from '../app/m/plan/tableros';

const tarea = (id: string, p: Partial<BoardTask>): BoardTask => ({
  id, num: 1, emoji: '', title: `Tarea ${id}`, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '',
  labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, ...p,
} as BoardTask);
const proyecto = (id: string, score: number, p: Partial<Label> = {}): Label => ({
  id, emoji: '', name: `Proyecto ${id}`, color: '#2F6FED', score, detalle: '', historial: [], ...p,
} as Label);

const HOY = '2026-10-14';
const TAREAS = [
  tarea('a', { score: 90, labels: ['P1'] }),
  tarea('b', { score: 30, labels: ['P1'], progress: 100 }),
  tarea('c', { score: 60, labels: ['P1'], deadline: '2026-10-10' }),
  tarea('r', { score: 80, labels: ['P1'], recurrente: true, recurrencia: 'FREQ=WEEKLY;BYDAY=MO' }),
  tarea('d', { score: 10, labels: ['P2'], progress: 100 }),
];
const PROYECTOS = [proyecto('P1', 80), proyecto('P2', 40), proyecto('P3', 20), proyecto('PR', 90, { recurrente: true })];

test('Tareas: sin recurrentes ni hechas, la de mayor score arriba, en la columna de su score', () => {
  const r = tareasDelTablero({ tareas: TAREAS, proyectos: PROYECTOS, hoy: HOY, conNum: true });
  assert.deepEqual(r.map((t) => [t.id, t.banda]), [['a', 'alta'], ['c', 'media']]);
  assert.equal(r[1].vencida, true, 'el plazo pasado se marca');
  assert.equal(r[0].proyecto?.nombre, 'Proyecto P1');
});

test('el avance de un proyecto no cuenta sus recurrentes (projProgress de escritorio)', () => {
  assert.deepEqual(avanceProyecto(TAREAS, 'P1'), { pct: 33, total: 3, hechas: 1 });
  assert.deepEqual(avanceProyecto(TAREAS, 'P3'), { pct: 0, total: 0, hechas: 0 });
});

test('Proyectos: sin recurrentes ni terminados; uno sin tareas sí va', () => {
  const r = proyectosDelTablero({ tareas: TAREAS, proyectos: PROYECTOS });
  assert.deepEqual(r.map((p) => [p.id, p.banda]), [['P1', 'alta'], ['P3', 'futuro']]);
  assert.equal(r[0].hechas, 1);
});

test('Recurrentes: sólo lo que se repite, con cada cuánto', () => {
  const r = recurrentesDelTablero({ tareas: TAREAS, proyectos: PROYECTOS });
  assert.deepEqual(r.map((x) => x.id), ['r']);
  assert.ok(r[0].repite && r[0].repite.length > 0, `la frase: ${r[0].repite}`);
});
