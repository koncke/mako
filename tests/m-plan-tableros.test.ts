// =============================================================================
// MaKo Mobile — /m/plan v3: los tableros de Tareas y Proyectos (app/m/plan/tableros.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · el Kanban de Tareas es por ESTADO desde el 16/10/2026 (ver abajo), sin las recurrentes;
//   · el avance de un proyecto ignora sus tareas recurrentes (el `projProgress` de escritorio):
//     una recurrente al 0 % para siempre lo dejaría eternamente a medio hacer;
//   · un proyecto TERMINADO (con tareas y todas al 100) no va al tablero, y uno sin tareas sí;
//   · la lista de Recurrentes es sólo lo que se repite, con su frase.
//
// Verificado ROMPIÉNDOLO (14/10/2026), restaurando después de cada rotura:
//   · sin `sinRecurrentes` en tareasDelTablero            → 1 de 4 en rojo (la tarea «r» entra)
//   · sin `!esRecurrente(t)` en avanceProyecto            → 1 de 4 en rojo (P1 da 25 % de 4 y no 33 % de 3)
//   · sin el filtro de terminados en proyectosDelTablero  → 1 de 4 en rojo (entra P2)
//
// ⚠️ ACTUALIZADO A PROPÓSITO EL 16/10/2026 («hacer el kanban un kanban», decisión 5: el teléfono
// con el MISMO kanban por estado que escritorio). El test «Tareas: sin recurrentes ni hechas, la
// de mayor score arriba, en la columna de su score» fijaba el kanban por PRIORIDAD (columnas
// Alta · Media · Baja · A futuro, sólo abiertas, ordenadas por score) y se reemplazó por los de
// abajo: columnas por estado, orden manual, «Completada» recortada con su conteo real, «Sin
// priorizar» en el chip y el motivo de «Atorada». La regla de no llevar recurrentes se mantiene.
// Re-probado ROMPIÉNDOLO (16/10/2026), base en verde (7 de 7), cada rotura restaurada:
//   · `columnasPorEstado(tareas, …)` sin `sinRecurrentes`  → 1 de 7 (entra «r» en En proceso)
//   · sin el recorte de «Completada»                       → 1 de 7 (viajan 35, no 30)
//   · «vencida» también en las completadas                  → 1 de 7
//   · `prioridad: prioFromScore(…)` en vez de `prioFiltroDe` → 1 de 7 (la libre dice «futuro»)
//   · la marca del teléfono contando las de «Completada» como «todavía la manda» → 1 de 7
//   · `moverTareaAction` sin el guard de `puedeVerKey`      → 1 de 7
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BoardTask, Label } from '../app/plan/board/types';
import { avanceProyecto, proyectosDelTablero, recurrentesDelTablero, tareasDelTablero, COMPLETADAS_EN_EL_TELEFONO } from '../app/m/plan/tableros';

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

// ── El kanban de Tareas POR ESTADO (16/10/2026) ──────────────────────────────────
const KANBAN = [
  tarea('a', { score: 90, labels: ['P1'], estado: 'por_hacer', orden: 2 }),
  tarea('libre', { score: 0, estado: 'por_hacer', orden: 1 }),
  tarea('c', { score: 60, estado: 'en_curso', orden: 1, deadline: '2026-10-10' }),
  tarea('at', { score: 40, estado: 'en_seguimiento', orden: 1, motivoAtorada: 'el cliente no paga' }),
  tarea('r', { score: 80, estado: 'en_curso', recurrente: true, recurrencia: 'FREQ=WEEKLY;BYDAY=MO' }),
  ...Array.from({ length: 35 }, (_, i) => tarea(`h${i}`, { score: 50, progress: 100, estado: 'hecho', orden: i, deadline: '2026-10-01' })),
];
const tk = () => tareasDelTablero({ tareas: KANBAN, proyectos: PROYECTOS, hoy: HOY, conNum: true });

test('Tareas: las columnas son el ESTADO, con cuántas hay de verdad, y sin las recurrentes', () => {
  const r = tk();
  assert.deepEqual(r.columnas.map((c) => [c.key, c.titulo, c.cuantos]), [
    ['por_hacer', 'Por iniciar', 2], ['en_curso', 'En proceso', 1], ['en_seguimiento', 'Atorada', 1], ['hecho', 'Completada', 35],
  ]);
  assert.ok(!r.tareas.some((t) => t.id === 'r'), 'la recurrente tiene su propia vista');
  // El orden MANUAL de la columna, no el score: «libre» (orden 1) arriba de «a» (orden 2, score 90).
  assert.deepEqual(r.tareas.filter((t) => t.estado === 'por_hacer').map((t) => t.id), ['libre', 'a']);
  assert.equal(r.tareas.find((t) => t.id === 'a')?.proyecto?.nombre, 'Proyecto P1');
  // «No cumplen tu criterio» sólo si hay.
  const con = tareasDelTablero({ tareas: [...KANBAN, tarea('n', { estado: 'no_cumple' })], proyectos: PROYECTOS, hoy: HOY, conNum: true });
  assert.deepEqual(con.columnas.map((c) => c.key), ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho', 'no_cumple']);
});

test('Tareas: «Completada» viaja recortada (las más recientes) y no se marca «vencida»', () => {
  const hechas = tk().tareas.filter((t) => t.estado === 'hecho');
  assert.equal(hechas.length, COMPLETADAS_EN_EL_TELEFONO);
  assert.equal(hechas[0].id, 'h0', 'la de menor orden (la última completada) primero');
  assert.ok(hechas.every((t) => !t.vencida), 'lo completado no pide nada aunque su plazo haya pasado');
  assert.equal(tk().tareas.find((t) => t.id === 'c')?.vencida, true, 'lo abierto sí');
});

test('Tareas: el chip dice «Sin priorizar» en la libre, y «Atorada» trae su motivo', () => {
  const r = tk().tareas;
  assert.equal(r.find((t) => t.id === 'libre')?.prioridad, 'sin_priorizar');
  assert.equal(r.find((t) => t.id === 'a')?.prioridad, 'alta');
  assert.equal(r.find((t) => t.id === 'at')?.motivo, 'el cliente no paga');
  assert.equal(r.find((t) => t.id === 'c')?.motivo, null);
});

const RAIZ = resolve(fileURLToPath(import.meta.url), '..', '..');
const fuente = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el teléfono MUEVE de columna (con su guard) y lo completado no se queda escondido', () => {
  const L = fuente('app', 'm', 'plan', 'ListaPlan.tsx');
  assert.match(L, /col: marcas\.has\(it\.id\) \? 'hecho' : it\.estado,/);
  // La marca de «se fue» se suelta cuando el kanban ya la trae en Completada.
  assert.match(L, /for \(const it of listas\.tareas\) if \(it\.estado !== 'hecho'\) ids\.add\(it\.id\);/);
  assert.doesNotMatch(L, /for \(const l of Object\.values\(listas\)\)/);
  assert.match(L, /onMover=\{mover\}/);
  const A = fuente('app', 'm', 'plan', 'acciones.ts');
  const mover = A.slice(A.indexOf('export async function moverTareaAction('));
  assert.match(mover, /if \(!\(await getUsuarioActual\(\)\)\) return/);
  assert.match(mover, /if \(!puedeVerKey\('todo', rol, capa\)\) return/);
  assert.match(mover, /await moverDesdeElTelefono\(id, estado, desh\)/);
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
