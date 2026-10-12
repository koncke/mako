// =============================================================================
// PRIORIDADES: UNA función para el tablero, el teléfono y la API de MaKo
// =============================================================================
// `prioridadesDelTablero` (app/plan/board/prioridades.ts) es la vista Prioridades de
// `BoardShell.tsx` sacada a un módulo puro (11/10/2026, MaKo Mobile). La pantalla de
// escritorio tiene que quedar IDÉNTICA, así que lo que se fija acá es la EQUIVALENCIA:
//
//  · `prioridadesInline` es una copia LITERAL del código que vivía en BoardShell (las
//    líneas del objetivo principal y las de `enPrio`, con `board.labelById` y
//    `pasaCliente` escritos como lo que eran). Es el oráculo: el comportamiento de antes.
//  · Se comparan las dos sobre 600 tableros armados al azar (con semilla fija): empates de
//    score, recurrentes, tareas sin proyecto o con un proyecto que ya no existe,
//    dependencias de tarea y de proyecto, y la mitad con el filtro de cliente puesto.
//  · Y los casos que la vista existe para contestar, escritos a mano.
//  · Más dos guards de fuente: que BoardShell y `ver_prioridades_plan` LLAMEN a la función
//    (un tercero con su propio orden es el bug que esto vino a cerrar).
//
// ⚠️ PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez, restaurando desde memoria
// (arnés que reemplaza el pedazo, corre y lo devuelve; nunca git).
// Base: 9 pasan, 0 fallan (`node --import tsx --test tests/plan-prioridades.test.ts`).
//   · sin el criterio «objetivo principal» en el sort de prioridades.ts → 7/2 (la
//     equivalencia al azar y «la banda manda»). Antes de agregarle a ese caso el proyecto
//     que se repite daba 8/1: el caso a mano no discriminaba ese criterio.
//   · `.slice(0, max)` → `.slice(0, max + 1)` → 7/2 (equivalencia y tope).
//   · `elegirObjetivo` sin la preferencia por lo arrancable → 7/2 (equivalencia y norte).
//   · las bloqueadas entrando a las pendientes → 7/2 (equivalencia y «bloqueadas»).
//   · BoardShell con `const enPrio = [...]` inline otra vez → 8/1 (el guard de fuente).
//   · `ver_prioridades_plan` reordenando por `b.score - a.score` → 8/1 (el guard de la API).
//   · BoardShell pasando `filtro: null` → 8/1 acá (y 18/1 en plan-filtro-cliente).
//   · prioridades.ts sin `(!filtro || filtro.tarea(t))` → 7/2 acá (y 18/1 en el otro).
// Además, sobre los tableros REALES (ws9 dueño con 423 tareas y 1 dependencia; ws1, ws11 y
// ws13 clientes), las cinco y el norte salieron iguales con el código de antes y con éste.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prioridadesDelTablero } from '../app/plan/board/prioridades';
import { resolverDeps, estaBloqueada, type Dep } from '../app/plan/board/dependencias';
import { PRIOS, MAX_PRIORIDAD, prioFromScore, type BoardTask, type Label } from '../app/plan/board/types';
import { sinRecurrentes } from '../lib/plan-recurrentes';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── El oráculo: lo que había en BoardShell, línea por línea ─────────────────────
type Filtro = { tarea: (t: BoardTask) => boolean; proyecto: (l: Label) => boolean } | null;
function prioridadesInline(tasks: BoardTask[], labels: Label[], deps: Dep[], filtroCli: Filtro) {
  const conFin = sinRecurrentes(tasks);
  const board = { labelById: (id: string) => labels.find((l) => l.id === id) ?? null };
  const pasaCliente = (t: BoardTask) => !filtroCli || filtroCli.tarea(t);
  const pasaClienteProy = (l: Label) => !filtroCli || filtroCli.proyecto(l);
  // BoardShell.tsx:566-612 (10/10/2026)
  const pendientesPorProy = new Map<string, number>();
  for (const t of conFin) if (t.progress < 100) for (const id of t.labels) pendientesPorProy.set(id, (pendientesPorProy.get(id) ?? 0) + 1);
  const estDeps = resolverDeps({ tareas: tasks, deps });
  const proyArrancable = (id: string) => conFin.some((t) => t.progress < 100 && t.labels.includes(id) && !estaBloqueada(t.id, estDeps));
  const porScore = sinRecurrentes(labels).slice().sort((a, b) => b.score - a.score || (pendientesPorProy.get(b.id) ?? 0) - (pendientesPorProy.get(a.id) ?? 0));
  const tienePendientes = (id: string) => (pendientesPorProy.get(id) ?? 0) > 0;
  const elegirObjetivo = (ls: Label[]) => ls.find((l) => proyArrancable(l.id)) ?? ls.find((l) => tienePendientes(l.id)) ?? ls[0] ?? null;
  const objetivoPrincipal = elegirObjetivo(porScore);
  // BoardShell.tsx:937-975 (10/10/2026)
  const scoreProy = (t: BoardTask) => Math.max(0, ...t.labels.map((id) => board.labelById(id)?.score ?? 0));
  const pendientesTodas = conFin.filter((t) => t.progress < 100 && !estaBloqueada(t.id, estDeps) && pasaCliente(t));
  const objetivoVista = filtroCli ? elegirObjetivo(porScore.filter(pasaClienteProy)) : objetivoPrincipal;
  const topVistaId = objetivoVista?.id ?? null;
  const urg = (t: BoardTask) => estDeps.urgencia[t.id] ?? t.score;
  const banda = (t: BoardTask) => PRIOS.indexOf(prioFromScore(urg(t)));
  const esDelTop = (t: BoardTask) => (topVistaId ? t.labels.includes(topVistaId) : false);
  const enPrio = [...pendientesTodas]
    .sort((a, b) => banda(a) - banda(b) || Number(esDelTop(b)) - Number(esDelTop(a)) || scoreProy(b) - scoreProy(a) || urg(b) - urg(a))
    .slice(0, MAX_PRIORIDAD);
  return { objetivoPrincipal, objetivoVista, enPrio };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const T = (id: string, extra: Partial<BoardTask> = {}): BoardTask => ({
  id, num: Number(id.replace(/\D/g, '')) || 1, emoji: '📌', title: id, detalle: '', priority: 'media', score: 50,
  progress: 0, deadline: '', labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, ...extra,
});
const L = (id: string, extra: Partial<Label> = {}): Label => ({ id, emoji: '📁', name: id, color: '#2F6FED', score: 50, detalle: '', historial: [], ...extra } as Label);
const D = (entidad: 'tarea' | 'proyecto', deId: string, aId: string, clase: 'bloquea' | 'ordena' = 'bloquea'): Dep =>
  ({ entidad, deId, aId, clase, razon: 'x', origen: 'user' });

/** Generador con semilla (mulberry32): el mismo tablero en cada corrida. */
function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function tableroAlAzar(semilla: number) {
  const r = azar(semilla);
  const ent = (n: number) => Math.floor(r() * n);
  // Scores en pocos valores, para que haya EMPATES (es donde se separan los criterios).
  const score = () => [12, 30, 49, 50, 51, 62, 74, 75, 76, 85, 90, 99][ent(12)];
  const nP = 1 + ent(8), nT = ent(40);
  const labels = Array.from({ length: nP }, (_, i) => L(`p${i}`, { score: score(), recurrente: r() < 0.12 }));
  const tasks = Array.from({ length: nT }, (_, i) => {
    const labs: string[] = [];
    const k = ent(4);   // 0..3 proyectos, a veces uno que no existe
    for (let j = 0; j < k; j++) labs.push(r() < 0.1 ? 'fantasma' : `p${ent(nP)}`);
    return T(`t${i + 1}`, { score: score(), progress: r() < 0.25 ? 100 : [0, 0, 30, 60][ent(4)], labels: [...new Set(labs)], recurrente: r() < 0.1 });
  });
  const deps: Dep[] = [];
  for (let i = 0, n = ent(8); i < n && nT > 1; i++) { const a = ent(nT), b = ent(nT); if (a !== b) deps.push(D('tarea', tasks[a].id, tasks[b].id, r() < 0.8 ? 'bloquea' : 'ordena')); }
  for (let i = 0, n = ent(3); i < n && nP > 1; i++) { const a = ent(nP), b = ent(nP); if (a !== b) deps.push(D('proyecto', labels[a].id, labels[b].id)); }
  let filtro: Filtro = null;
  if (r() < 0.5) {
    const proys = new Set(labels.filter(() => r() < 0.4).map((l) => l.id));
    filtro = { tarea: (t) => t.labels.some((x) => proys.has(x)), proyecto: (l) => proys.has(l.id) };
  }
  return { tasks, labels, deps, filtro };
}

const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

// ── La equivalencia ───────────────────────────────────────────────────────────
test('600 tableros al azar: la función contesta EXACTAMENTE lo que contestaba BoardShell', () => {
  let conTarjetas = 0, conFiltro = 0;
  for (let s = 1; s <= 600; s++) {
    const { tasks, labels, deps, filtro } = tableroAlAzar(s);
    const antes = prioridadesInline(tasks, labels, deps, filtro);
    const ahora = prioridadesDelTablero({ tareas: tasks, proyectos: labels, deps, filtro });
    assert.deepEqual(ids(ahora.prioridades), ids(antes.enPrio), `semilla ${s}: las tarjetas`);
    assert.equal(ahora.objetivoPrincipal?.id ?? null, antes.objetivoPrincipal?.id ?? null, `semilla ${s}: el objetivo principal`);
    assert.equal(ahora.objetivoVista?.id ?? null, antes.objetivoVista?.id ?? null, `semilla ${s}: el norte de la vista`);
    // Con el grafo ya resuelto (como lo pasa BoardShell, memoizado) da lo mismo.
    const conEst = prioridadesDelTablero({ tareas: tasks, proyectos: labels, estDeps: resolverDeps({ tareas: tasks, deps }), filtro });
    assert.deepEqual(ids(conEst.prioridades), ids(antes.enPrio), `semilla ${s}: con estDeps de afuera`);
    if (antes.enPrio.length > 1) conTarjetas++;
    if (filtro) conFiltro++;
  }
  // El generador tiene que producir casos que DISCRIMINEN: si casi todos salen vacíos, la
  // equivalencia es trivial.
  assert.ok(conTarjetas > 400, `sólo ${conTarjetas} tableros con más de una tarjeta`);
  assert.ok(conFiltro > 200, `sólo ${conFiltro} tableros con filtro`);
});

// ── Lo que la vista existe para contestar ─────────────────────────────────────
test('la banda manda: una ALTA de otro proyecto le gana a una BAJA del norte; empatada la banda, gana el norte', () => {
  // `rutina` se repite: no puede ser el norte, pero su score SÍ cuenta como «score del
  // proyecto» de t3. Así t3 le gana a t4 en el tercer criterio, y sólo el segundo (ser del
  // norte) pone a t4 adelante: sin él, este caso cambia de orden.
  const labels = [L('norte', { score: 99 }), L('otro', { score: 40 }), L('rutina', { score: 100, recurrente: true })];
  const tasks = [
    T('t1', { labels: ['norte'], score: 30 }),             // baja, del norte
    T('t2', { labels: ['otro'], score: 80 }),              // alta, de otro
    T('t3', { labels: ['otro', 'rutina'], score: 60 }),    // media, de otro (score de proyecto 100)
    T('t4', { labels: ['norte'], score: 55 }),             // media, del norte (score de proyecto 99)
  ];
  const r = prioridadesDelTablero({ tareas: tasks, proyectos: labels });
  assert.equal(r.objetivoPrincipal?.id, 'norte');
  assert.deepEqual(ids(r.prioridades), ['t2', 't4', 't3', 't1']);
});

test('tope: nunca más de MAX_PRIORIDAD (5), y `max` lo cambia', () => {
  const labels = [L('p')];
  const tasks = Array.from({ length: 9 }, (_, i) => T(`t${i + 1}`, { labels: ['p'], score: 90 - i }));
  assert.equal(prioridadesDelTablero({ tareas: tasks, proyectos: labels }).prioridades.length, MAX_PRIORIDAD);
  assert.equal(prioridadesDelTablero({ tareas: tasks, proyectos: labels, max: 8 }).prioridades.length, 8);
  assert.equal(prioridadesDelTablero({ tareas: tasks, proyectos: labels }).candidatas, 9);
});

test('las bloqueadas no entran, lo que las destraba sube por la urgencia heredada; con `incluirBloqueadas` sí entran', () => {
  const labels = [L('p', { score: 60 })];
  const tasks = [T('t1', { labels: ['p'], score: 90 }), T('t2', { labels: ['p'], score: 30 })];
  const deps = [D('tarea', 't1', 't2')];   // t1 espera a t2
  const r = prioridadesDelTablero({ tareas: tasks, proyectos: labels, deps });
  assert.deepEqual(ids(r.prioridades), ['t2']);
  assert.ok((r.estDeps.urgencia.t2 ?? 0) >= 90, 't2 hereda la urgencia de lo que destraba');
  assert.deepEqual(ids(prioridadesDelTablero({ tareas: tasks, proyectos: labels, deps, incluirBloqueadas: true }).prioridades).sort(), ['t1', 't2']);
});

test('las que se repiten y las hechas no compiten; un proyecto que se repite no es el norte', () => {
  const labels = [L('rutina', { score: 99, recurrente: true }), L('real', { score: 50 })];
  const tasks = [
    T('t1', { labels: ['rutina'], score: 95, recurrente: true }),
    T('t2', { labels: ['real'], score: 70 }),
    T('t3', { labels: ['real'], score: 99, progress: 100 }),
  ];
  const r = prioridadesDelTablero({ tareas: tasks, proyectos: labels });
  assert.equal(r.objetivoPrincipal?.id, 'real');
  assert.deepEqual(ids(r.prioridades), ['t2']);
});

test('el norte es el de mayor score con trabajo ARRANCABLE; empatado, el que tiene más abierto', () => {
  const labels = [L('a', { score: 90 }), L('b', { score: 80 }), L('c', { score: 80 })];
  const tasks = [
    T('t1', { labels: ['a'] }),                 // a: su única tarea está bloqueada
    T('t2', { labels: ['b'] }),
    T('t3', { labels: ['c'] }), T('t4', { labels: ['c'] }),
    T('t5', { labels: [] }),
  ];
  const deps = [D('tarea', 't1', 't5')];
  assert.equal(prioridadesDelTablero({ tareas: tasks, proyectos: labels, deps }).objetivoPrincipal?.id, 'c');
  // Sin nada abierto en ninguno, cae al de mayor score (no deja la card vacía).
  const hechas = tasks.map((t) => ({ ...t, progress: 100 }));
  assert.equal(prioridadesDelTablero({ tareas: hechas, proyectos: labels }).objetivoPrincipal?.id, 'a');
});

test('el filtro de cliente cambia el norte de la VISTA, no el del tablero', () => {
  const labels = [L('top', { score: 99 }), L('cli', { score: 40 })];
  const tasks = [T('t1', { labels: ['top'], score: 60 }), T('t2', { labels: ['cli'], score: 60 }), T('t3', { labels: ['cli'], score: 70 })];
  const filtro = { tarea: (t: BoardTask) => t.labels.includes('cli'), proyecto: (l: Label) => l.id === 'cli' };
  const r = prioridadesDelTablero({ tareas: tasks, proyectos: labels, filtro });
  assert.equal(r.objetivoPrincipal?.id, 'top');
  assert.equal(r.objetivoVista?.id, 'cli');
  assert.deepEqual(ids(r.prioridades), ['t3', 't2']);
});

// ── Que los llamadores LLAMEN ─────────────────────────────────────────────────
test('BoardShell calcula Prioridades con la función, no inline', () => {
  const SHELL = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
  assert.match(SHELL, /import \{ prioridadesDelTablero \} from '\.\/prioridades';/);
  const llamada = SHELL.slice(SHELL.indexOf('prioridadesDelTablero({'), SHELL.indexOf('});', SHELL.indexOf('prioridadesDelTablero({')) + 3);
  assert.match(llamada, /estDeps/, 'tiene que pasar el grafo memoizado del render');
  assert.match(llamada, /filtro: filtroCli/, 'tiene que pasar el filtro de cliente');
  assert.doesNotMatch(SHELL, /const enPrio = \[\.\.\.pendientesTodas\]/, 'volvió el cálculo inline');
  assert.doesNotMatch(SHELL, /const elegirObjetivo = /, 'volvió el criterio del norte inline');
  assert.match(SHELL, /const enPrio = prio\.prioridades;/);
  assert.match(SHELL, /const objetivoVista = prio\.objetivoVista;/);
});

test('ver_prioridades_plan (API de MaKo) ordena con la MISMA función', () => {
  const RUN = sinComentarios(leer('lib/api-mako/areas/plan.run.ts'));
  const ini = RUN.indexOf('ver_prioridades_plan: {');
  const cuerpo = RUN.slice(ini, RUN.indexOf('listar_tareas_paradas: {', ini));
  assert.ok(ini >= 0 && cuerpo.length > 200, 'no encontré el runner');
  assert.match(cuerpo, /prioridadesDelTablero\(/);
  assert.doesNotMatch(cuerpo, /\.sort\(\(a, b\) => b\.score - a\.score\)/, 'volvió el orden propio por score');
});
