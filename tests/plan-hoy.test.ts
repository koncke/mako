// =============================================================================
// EL PLAN EN EL TELÉFONO: la cuenta del Hoy y la del «marcar hecha»
// =============================================================================
// `hoyDelTablero` y `cambioAlMarcar` (app/plan/board/hoy.ts) son puros: lo que lee la base
// (lib/plan-hoy.ts) y lo que escribe (lib/plan-marcar.ts) se apoyan en ellos. Se fija:
//
//  · Hoy = vencidas + vencen hoy, SIN las que ya están en Prioridades (Today pinta las dos
//    listas juntas); Semana = mañana … hoy + 6; las plantillas que se repiten no entran y
//    sus instancias sí; lo hecho no entra.
//  · Las prioridades son EXACTAMENTE las de `prioridadesDelTablero` (la vista del escritorio).
//  · Los ítems viajan compactos, y el #N sólo en el tablero del dueño.
//  · Las alertas cuentan con las funciones de siempre (vencimientos, quietud, ⚠ de alta).
//  · Marcar hecha es la semántica de `useBoard.toggleDone` (checklist entera, entrada
//    `user` con su undo) y Deshacer deja la tarea como estaba y saca la entrada.
//  · Y tres guards de fuente: `no_cumple` sale ANTES de `toBoard`, el marcado no toca el
//    score ni llama al Perro, y la server action exige sesión y la tab Plan.
//
// ⚠️ PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez, restaurando desde memoria
// (nunca git). Base: 13 pasan, 0 fallan (`node --import tsx --test tests/plan-hoy.test.ts`).
// Los números de cada rotura, al pie del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hoyDelTablero, cambioAlMarcar, proyectosConFecha, DIAS_PARADA, TEXTO_COMPLETADA, TEXTO_REABIERTA } from '../app/plan/board/hoy';
import { prioridadesDelTablero } from '../app/plan/board/prioridades';
import { HIST_CAP, type BoardTask, type Label, type Hist } from '../app/plan/board/types';
import type { Dep } from '../app/plan/board/dependencias';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const HOY = '2026-10-11';
const DIA = 86400000;
const AHORA = Date.parse('2026-10-11T15:00:00Z');

const T = (id: string, extra: Partial<BoardTask> = {}): BoardTask => ({
  id, num: Number(id.replace(/\D/g, '')) || 1, emoji: '📌', title: `Tarea ${id}`, detalle: '', priority: 'media', score: 50,
  progress: 0, deadline: '', labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false,
  // Nació ayer y una persona la tocó: no está «parada» salvo que el caso lo diga.
  creadaEn: AHORA - DIA, ...extra,
});
const L = (id: string, extra: Partial<Label> = {}): Label => ({ id, emoji: '🧭', name: `Proyecto ${id}`, color: '#2F6FED', score: 50, detalle: '', historial: [], ...extra } as Label);
const D = (deId: string, aId: string): Dep => ({ entidad: 'tarea', deId, aId, clase: 'bloquea', razon: 'x', origen: 'user' });
const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

/** Un tablero chico con un caso de cada cosa. */
function tablero() {
  const proyectos = [L('p1', { score: 90 }), L('p2', { score: 40, deadline: '2026-10-01' }), L('p3', { score: 30, deadline: '2026-10-14' }), L('rep', { score: 99, recurrente: true })];
  const tareas = [
    // Seis de prioridad alta en p1, para que las 5 de Prioridades se llenen y sobren.
    ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((id, i) => T(id, { labels: ['p1'], score: 95 - i, priority: 'alta' })),
    T('v1', { labels: ['p2'], score: 40, deadline: '2026-10-05' }),             // vencida
    T('h1', { labels: ['p2'], score: 45, deadline: HOY }),                        // vence hoy
    T('s1', { labels: ['p3'], score: 35, deadline: '2026-10-12' }),               // mañana
    T('s2', { labels: ['p3'], score: 36, deadline: '2026-10-17' }),               // hoy + 6
    T('f1', { labels: ['p3'], score: 33, deadline: '2026-10-18' }),               // hoy + 7: ya no es «semana»
    T('hecha', { labels: ['p2'], score: 99, deadline: '2026-10-01', progress: 100 }),
    T('plantilla', { labels: ['rep'], score: 98, recurrente: true }),
    T('inst', { labels: ['rep'], score: 20, deadline: HOY, fuente: { tipo: 'recurrente' } }),
    T('parada', { labels: ['p3'], score: 20, creadaEn: AHORA - 40 * DIA, historial: [] }),
    T('alta-sin-fecha', { labels: ['p3'], score: 10, priority: 'alta' }),
    T('frenada', { labels: ['p3'], score: 15 }),
    T('libera', { labels: ['p3'], score: 12 }),
  ];
  const deps = [D('frenada', 'libera')];
  return { tareas, proyectos, deps };
}

test('las prioridades son las de la vista del escritorio, y Hoy no las repite', () => {
  const b = tablero();
  const r = hoyDelTablero({ ...b, hoy: HOY, ahora: AHORA });
  const esc = prioridadesDelTablero({ tareas: b.tareas, proyectos: b.proyectos, deps: b.deps });
  assert.deepEqual(ids(r.prioridades), ids(esc.prioridades));
  assert.deepEqual(ids(r.prioridades), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.equal(r.objetivo?.id, 'p1');
  for (const p of r.prioridades) assert.ok(!r.hoy.some((h) => h.id === p.id), `${p.id} sale dos veces`);
});

test('Hoy = vencidas + vencen hoy (las instancias sí, las plantillas y las hechas no); Semana = mañana … hoy + 6', () => {
  const r = hoyDelTablero({ ...tablero(), hoy: HOY, ahora: AHORA });
  assert.deepEqual(ids(r.hoy), ['v1', 'h1', 'inst'], 'lo vencido arriba, después lo de hoy, a igual fecha el de mayor score');
  assert.deepEqual(ids(r.semana), ['s1', 's2']);
  assert.ok(!ids(r.hoy).includes('plantilla') && !ids(r.hoy).includes('hecha'));
  assert.equal(r.hoy.find((x) => x.id === 'inst')?.esInstancia, true);
  assert.equal(r.hoy.find((x) => x.id === 'v1')?.vencida, true);
  assert.equal(r.hoy.find((x) => x.id === 'h1')?.vencida, false);
  // compiten: todas menos la hecha y la plantilla.
  assert.equal(r.abiertas, tablero().tareas.length - 2);
});

test('el ítem es compacto: sin detalle ni historial, con la banda del Kanban y el link de escritorio', () => {
  const r = hoyDelTablero({ ...tablero(), hoy: HOY, ahora: AHORA, tablero: 'dueno' });
  const v1 = r.hoy.find((x) => x.id === 'v1')!;
  assert.deepEqual(Object.keys(v1).sort(), ['banda', 'cuando', 'deadline', 'esInstancia', 'id', 'linkEscritorio', 'num', 'proyecto', 'titulo', 'vencida']);
  assert.deepEqual(v1.proyecto, { nombre: 'Proyecto p2', emoji: '🧭' });
  assert.equal(v1.banda, 'baja');
  assert.equal(v1.cuando, 'hoy');
  assert.equal(v1.linkEscritorio, '/plan?tarea=v1');
  // En el tablero del cliente el «número» es el id de la base: no viaja.
  const c = hoyDelTablero({ ...tablero(), hoy: HOY, ahora: AHORA, tablero: 'cliente' });
  assert.equal('num' in c.hoy[0], false);
  // Una tarea con un proyecto que ya no existe toma el siguiente que sí.
  const otro = hoyDelTablero({ tareas: [T('x', { labels: ['fantasma', 'p1'], deadline: HOY })], proyectos: [L('p1')], deps: [], hoy: HOY, ahora: AHORA });
  assert.equal(otro.prioridades[0].proyecto?.nombre, 'Proyecto p1');
});

test('la banda del ítem es la COLUMNA del Kanban (su score), no la urgencia que hereda', () => {
  // `traba` (score 10, A FUTURO) frena a `grande` (95): hereda su urgencia, así que en
  // Prioridades sube —es lo que la destraba—, pero en el Kanban sigue en «a futuro», y la
  // fila del teléfono dice la columna que la persona ya ve en el escritorio.
  const r = hoyDelTablero({
    tareas: [T('traba', { labels: ['p1'], score: 10, deadline: HOY }), T('grande', { labels: ['p1'], score: 95 })],
    proyectos: [L('p1')], deps: [D('grande', 'traba')], hoy: HOY, ahora: AHORA,
  });
  const traba = r.prioridades.find((x) => x.id === 'traba');
  assert.ok(traba, 'la que destraba entra a Prioridades por la urgencia heredada');
  assert.equal(traba.banda, 'futuro');
  assert.equal(r.alertas.bloqueadas, 1);
});

test('alertas: vencidas, proyectos que deben fecha, paradas, altas sin fecha y bloqueadas', () => {
  const r = hoyDelTablero({ ...tablero(), hoy: HOY, ahora: AHORA });
  assert.equal(r.alertas.vencidas, 1);
  assert.deepEqual(r.alertas.proyectosAtrasados.map((p) => [p.nombre, p.dias]), [['Proyecto p2', 10]]);
  assert.deepEqual(r.alertas.proyectosPorVencer.map((p) => [p.nombre, p.dias]), [['Proyecto p3', 3]]);
  assert.equal(r.alertas.paradas, 1);
  assert.equal(r.alertas.altasSinFecha, 6 + 1, 'las seis altas de p1 no tienen fecha, más la de p3');
  assert.equal(r.alertas.bloqueadas, 1);
  assert.equal(DIAS_PARADA, 30);
});

test('proyectosConFecha: sin los proyectos que se repiten, y las recurrentes de cada uno aparte', () => {
  const ps = proyectosConFecha(
    [L('a', { deadline: '2026-10-01' }), L('r', { deadline: '2026-10-01', recurrente: true })],
    [T('t1', { labels: ['a'] }), T('t2', { labels: ['a'], recurrente: true }), T('t3', { labels: ['a'], progress: 100 })],
  );
  assert.deepEqual(ps, [{ nombre: 'Proyecto a', deadline: '2026-10-01', abiertas: 1, recurrentes: 1 }]);
});

// ── Marcar hecha ─────────────────────────────────────────────────────────────────
const H = (id: string, text = 'algo'): Hist => ({ id, ts: AHORA - DIA, actor: 'ia', text });

test('marcar hecha SIN checklist: 100, entrada de persona con el avance de antes', () => {
  const t = { progress: 40, checklist: [], historial: [H('h0')] };
  const c = cambioAlMarcar(t, true, { ahora: AHORA, nuevoId: 'hN' });
  assert.ok(c.ok && !c.yaEstaba);
  assert.equal(c.progress, 100);
  assert.equal(c.prev, 40);
  assert.equal(c.entryId, 'hN');
  assert.equal(c.checklistCambio, false);
  assert.deepEqual(c.historial[0], { id: 'hN', ts: AHORA, actor: 'user', text: TEXTO_COMPLETADA, undo: { field: 'progress', prev: 40 } });
  assert.equal(c.historial[1].id, 'h0');
});

test('marcar hecha CON checklist: la tilda entera y la entrada guarda la checklist de antes (como setChecklist)', () => {
  const lista = [{ id: 'c1', text: 'uno', done: true }, { id: 'c2', text: 'dos', done: false }];
  const c = cambioAlMarcar({ progress: 50, checklist: lista, historial: [] }, true, { ahora: AHORA, nuevoId: 'hN' });
  assert.ok(c.ok);
  assert.equal(c.progress, 100);
  assert.deepEqual(c.checklist.map((x) => x.done), [true, true]);
  assert.equal(c.checklistCambio, true);
  assert.deepEqual(c.historial[0].undo, { field: 'checklist', prev: lista });
});

test('deshacer deja la tarea como estaba y saca la entrada; el avance sale de la ENTRADA, no del teléfono', () => {
  const lista = [{ id: 'c1', text: 'uno', done: true }, { id: 'c2', text: 'dos', done: false }];
  for (const antes of [{ progress: 40, checklist: [], historial: [H('h0')] }, { progress: 50, checklist: lista, historial: [H('h0')] }]) {
    const m = cambioAlMarcar(antes, true, { ahora: AHORA, nuevoId: 'hN' });
    assert.ok(m.ok);
    const despues = { progress: m.progress, checklist: m.checklist, historial: m.historial };
    const d = cambioAlMarcar(despues, false, { ahora: AHORA, nuevoId: 'otro', deshacer: { prev: m.prev, entryId: m.entryId } });
    assert.ok(d.ok);
    assert.deepEqual({ progress: d.progress, checklist: d.checklist, historial: d.historial }, antes);
    assert.equal(d.entryId, '', 'deshacer no escribe una entrada nueva');
  }
  // Sin checklist, un `prev` adulterado desde el teléfono no gana: manda la entrada.
  const m = cambioAlMarcar({ progress: 40, checklist: [], historial: [] }, true, { ahora: AHORA, nuevoId: 'hN' });
  assert.ok(m.ok);
  const d = cambioAlMarcar({ progress: 100, checklist: [], historial: m.historial }, false, { ahora: AHORA, nuevoId: 'x', deshacer: { prev: 7, entryId: 'hN' } });
  assert.ok(d.ok);
  assert.equal(d.progress, 40);
});

test('lo que no se puede: una plantilla que se repite, un deshacer sin su entrada; y lo que ya estaba no se escribe', () => {
  assert.deepEqual(cambioAlMarcar({ progress: 0, checklist: [], historial: [], recurrente: true }, true, { ahora: AHORA, nuevoId: 'x' }), { ok: false, error: 'Se repite: no se completa' });
  const sin = cambioAlMarcar({ progress: 100, checklist: [], historial: [H('h0')] }, false, { ahora: AHORA, nuevoId: 'x', deshacer: { prev: 0, entryId: 'nunca' } });
  assert.equal(sin.ok, false);
  const ya = cambioAlMarcar({ progress: 100, checklist: [], historial: [] }, true, { ahora: AHORA, nuevoId: 'x' });
  assert.ok(ya.ok && ya.yaEstaba && ya.entryId === '');
  const abierta = cambioAlMarcar({ progress: 30, checklist: [], historial: [] }, false, { ahora: AHORA, nuevoId: 'x' });
  assert.ok(abierta.ok && abierta.yaEstaba);
});

test('reabrir: a 0 con «Reabrió la tarea»; y el historial respeta el tope del tablero', () => {
  const muchas = Array.from({ length: HIST_CAP }, (_, i) => H(`h${i}`));
  const c = cambioAlMarcar({ progress: 100, checklist: [], historial: muchas }, false, { ahora: AHORA, nuevoId: 'hN' });
  assert.ok(c.ok);
  assert.equal(c.progress, 0);
  assert.equal(c.historial[0].text, TEXTO_REABIERTA);
  assert.equal(c.historial.length, HIST_CAP);
  // Los textos son los del tablero: si el escritorio los cambia, éste se entera.
  const BOARD = leer('app/plan/board/useBoard.ts');
  assert.ok(BOARD.includes(`'${TEXTO_COMPLETADA}'`) && BOARD.includes(`'${TEXTO_REABIERTA}'`));
});

// ── Guards de fuente ─────────────────────────────────────────────────────────────
test('la lectura saca `no_cumple` ANTES de `toBoard` (que pierde el estado)', () => {
  const SRC = sinComentarios(leer('lib/plan-hoy.ts'));
  const i = SRC.indexOf('tareas: ts');
  const bloque = SRC.slice(i, SRC.indexOf('proyectos: cs.map(toLabel)', i));
  assert.ok(i >= 0 && bloque.length > 20, 'no encontré la lectura del cliente');
  const filtro = bloque.indexOf('.filter((t) => estaPendiente(t.estado) || t.estado === \'hecho\')');
  assert.ok(filtro >= 0, 'falta el filtro de no_cumple');
  assert.ok(filtro < bloque.indexOf('toBoard('), 'el filtro tiene que ir ANTES de toBoard');
  assert.match(SRC, /const que = await tableroActual\(\);/, 'el tablero lo decide la sesión, como /plan');
  assert.match(SRC, /hoyEnWorkspace\(\)/, 'el «hoy» es el del negocio, no el del dispositivo');
});

test('marcar hecha: relee la fila, no toca el score ni llama al Perro; la action exige sesión y la tab Plan', () => {
  const M = sinComentarios(leer('lib/plan-marcar.ts'));
  assert.match(M, /from\('plan_tareas'\)\.select\('\*'\)\.eq\('id', id\)/);
  assert.match(M, /from\('experimento_tareas'\)\.select\('\*'\)\.eq\('id', n\)/);
  assert.match(M, /guardarPlanTarea\(\{ \.\.\.t, progress: c\.progress, checklist: c\.checklist, historial: c\.historial \}\)/);
  assert.doesNotMatch(M, /recurvar|priorizar|score_manual|scoreManual|score:|priority:/, 'marcar hecha no decide prioridades');
  const A = sinComentarios(leer('app/m/plan/acciones.ts'));
  assert.match(A, /^'use server';/);
  assert.match(A, /if \(!\(await getUsuarioActual\(\)\)\) return/);
  assert.match(A, /puedeVerKey\('todo', rol, capa\)/);
  assert.ok(A.indexOf('getUsuarioActual()') < A.indexOf('marcarHecha(id'), 'la sesión se mira ANTES de escribir');
});

// ── La tabla de roturas ─────────────────────────────────────────────────────────
// Corrida el 11/10/2026 con un arnés que aplica UNA rotura, corre este archivo y la deshace
// desde memoria.
//
//  #  Qué se rompió                                                               pasan/fallan
//  1  `hoy` sin sacar las que están en prioridades (`!enPrio.has`)                     11/1
//  2  la semana con `cuandoDe(...) === 'quarter'`                                       11/1
//  3  `compite` sin `sinRecurrentes` (la plantilla compite)                             10/2
//  4  la banda del ítem con la urgencia en vez de `t.score`                             12/1
//     (con la base de 12 daba 12/0: ningún caso tenía una tarea que heredara urgencia. Se
//     agregó «la banda del ítem es la COLUMNA del Kanban»; las demás se midieron con 12.)
//  5  `cambioAlMarcar` sin el `undo` de checklist (siempre `progress`)                  10/2
//  6  deshacer sin sacar la entrada del historial                                       11/1
//  7  plan-hoy.ts sin el filtro de `no_cumple`                                          11/1
//  8  la action sin `getUsuarioActual()`                                                11/1
