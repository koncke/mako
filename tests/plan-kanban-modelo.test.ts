// =============================================================================
// El MODELO del kanban de flujo (16/10/2026): columnas, reglas y quién las escribe
// =============================================================================
// «Hacer el kanban un kanban» (Martín, 16/10/2026, sobre la reunión con Mauricio del 12/10 —
// Fathom 191993679): «el espíritu más importante del Kanban es el flujo… No la clasificación».
// Las columnas pasan de PRIORIDAD a ESTADO, la prioridad queda como filtro y chip, y las tareas
// nacen LIBRES («Sin priorizar»). Este archivo fija las funciones PURAS de ese modelo
// (lib/todo-estados.ts, app/plan/board/types.ts, desde-todo.ts) y el CABLEADO que no se ve en
// la base: quién manda qué. Lo que queda en la FILA lo mide tests/plan-kanban-server.test.ts.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026), base en verde primero (13 de 13), cada rotura restaurada de
// memoria; cada una tira SU test:
//    1. ESTADOS con «En seguimiento» otra vez                       → cae «las columnas» (1 de 13)
//    2. `columnasDelKanban` sin esconder «No cumplen» vacía          → cae «las columnas» (1 de 13)
//    3. el backfill de la 0294 con `progress > 50` para en_curso     → cae «el backfill» (1 de 13)
//    4. `estadoAlGuardar` sin comparar el avance                     → cae «estadoAlGuardar» (1 de 13)
//    5. `trasMover` conservando el motivo fuera de Atorada           → cae «trasMover» (1 de 13)
//    6. `ordenEntre` devolviendo `abajo + 1` al soltar primera       → cae «ordenEntre» (1 de 13)
//    7. `toBoard` convirtiendo el 0 con un `||` (como antes)          → cae «toBoard» (1 de 13)
//    8. `sinPriorizar` con `score < 25`                              → cae «Sin priorizar» (1 de 13)
//    9. `editPatch` mandando `progreso: d.progress` siempre          → cae «editPatch» (1 de 13)
//   10. `crearConGuardian` llamando a `priorizarNuevas` otra vez      → cae «el alta» (1 de 13)
//   11. la ruta del dueño escuchando 'mover' en vez de 'mover-tarea' → cae «el contrato» (1 de 13)
//   12. el enum de `mover_tarea_plan` con 'hecho'                    → cae «la API» (1 de 13)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ESTADOS, columnasDelKanban, etiquetaEstado, estadoDeAvance, estadoTrasProgreso, estadoAlGuardar, avanceAlMover,
  avanceSiCambio, trasMover, motivoAtoradaOk, motivoParaNoMover, alCrear, ordenEntre, MOTIVO_ATORADA_MAX, NO_SE_COMPLETA,
  type EstadoTarea,
} from '../lib/todo-estados';
import { prioFiltroDe, sinPriorizar, estadoDe, prioFromScore, PRIOS_FILTRO, PFILTRO_LABEL } from '../app/plan/board/types';
import { toBoard } from '../app/plan/board/desde-todo';
import type { Tarea } from '../lib/todo';
import { DEFS } from '../lib/api-mako/areas/plan.def';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` dentro de un `//`).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque entre `desde` y `hasta` (su cierre REAL, no un número de caracteres). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: el guard perdió su ancla`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el final de «${desde}»`);
  return src.slice(i, j);
}

const TODOS: EstadoTarea[] = ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho', 'no_cumple'];

test('las columnas: Por iniciar · En proceso · Atorada · Completada, y «No cumplen» al final sólo con tareas', () => {
  // El valor en la base NO cambia (en_seguimiento); cambia lo que se dibuja (decisión 1).
  assert.deepEqual(ESTADOS.map((e) => [e.key, e.label]), [
    ['por_hacer', 'Por iniciar'], ['en_curso', 'En proceso'], ['en_seguimiento', 'Atorada'],
    ['hecho', 'Completada'], ['no_cumple', 'No cumplen tu criterio'],
  ]);
  assert.equal(etiquetaEstado('en_seguimiento'), 'Atorada');
  assert.deepEqual(columnasDelKanban(() => false), ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho'], 'vacía, «No cumplen» no ocupa lugar');
  assert.deepEqual(columnasDelKanban((e) => e === 'no_cumple'), ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho', 'no_cumple']);
  // Las cuatro de flujo están SIEMPRE, vacías o no: una columna que aparece y desaparece mueve
  // el tablero entero en cada arrastre.
  assert.deepEqual(columnasDelKanban((e) => e === 'hecho').slice(0, 4), ['por_hacer', 'en_curso', 'en_seguimiento', 'hecho']);
});

test('el backfill de la 0294 y `estadoDeAvance` son la MISMA regla, y el CHECK del dueño es el del cliente', () => {
  const sql = leer('supabase/migrations/0294_plan_kanban_estado.sql').split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  const m = /set estado = case when progress >= (\d+) then 'hecho' when progress > (\d+) then 'en_curso' else 'por_hacer' end/.exec(sql);
  assert.ok(m, 'no encontré el backfill del estado en la 0294');
  const [lleno, empezado] = [Number(m[1]), Number(m[2])];
  for (const p of [0, 1, 49, 50, 99, 100]) {
    const delSql = p >= lleno ? 'hecho' : p > empezado ? 'en_curso' : 'por_hacer';
    assert.equal(estadoDeAvance(p), delSql, `avance ${p}`);
  }
  const check = /check \(estado in \(([^)]*)\)\)/.exec(sql);
  assert.ok(check, 'no encontré el CHECK de plan_tareas.estado');
  assert.deepEqual(check[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort(), ESTADOS.map((e) => e.key).sort());
  // Y es una migración que VA ANTES del deploy: el código nuevo escribe la columna en cada guardado.
  assert.match(leer('supabase/migrations/0294_plan_kanban_estado.sql'), /VA \*\*ANTES\*\* DEL DEPLOY/);
});

test('estadoAlGuardar: el avance mueve la columna SÓLO si cambió (decisión 10)', () => {
  // El mismo avance que está guardado: la columna que eligió la persona se queda, sea cual sea.
  for (const estado of TODOS) assert.equal(estadoAlGuardar({ estado, progreso: 0 }, 0), estado, estado);
  assert.equal(estadoAlGuardar({ estado: 'en_curso', progreso: 0 }, 0), 'en_curso', 'arrastrada a En proceso al 0%: no vuelve');
  assert.equal(estadoAlGuardar({ estado: 'por_hacer', progreso: 40 }, 40), 'por_hacer', 'devuelta a Por iniciar al 40%: no vuelve');
  // Si cambió, manda la derivación de siempre (que respeta Atorada y No cumplen salvo al 100%).
  assert.equal(estadoAlGuardar({ estado: 'por_hacer', progreso: 0 }, 30), 'en_curso');
  assert.equal(estadoAlGuardar({ estado: 'en_seguimiento', progreso: 10 }, 60), 'en_seguimiento');
  assert.equal(estadoAlGuardar({ estado: 'en_curso', progreso: 70 }, 100), 'hecho');
  assert.equal(estadoAlGuardar({ estado: 'hecho', progreso: 100 }, 40), 'en_curso');
  for (const estado of TODOS) for (const [a, b] of [[0, 30], [30, 100], [100, 0]]) {
    assert.equal(estadoAlGuardar({ estado, progreso: a }, b), estadoTrasProgreso(estado, b), `${estado} ${a}→${b}`);
  }
});

test('avanceSiCambio: el patch del cliente lleva el avance sólo si cambió', () => {
  assert.deepEqual(avanceSiCambio(0, 0), {});
  assert.deepEqual(avanceSiCambio(40, 0), { progreso: 40 });
  assert.deepEqual(avanceSiCambio(40, undefined), { progreso: 40 }, 'sin saber qué hay guardado, va y decide el server');
});

test('trasMover: Completada = 100%, reabrir = 0%, y el motivo sólo vive en Atorada', () => {
  const de = (estado: EstadoTarea, progreso: number, motivo: string | null = null) => ({ estado, progreso, motivo });
  assert.deepEqual(trasMover(de('por_hacer', 30), 'hecho'), { estado: 'hecho', progreso: 100, motivo: null });
  assert.deepEqual(trasMover(de('hecho', 100), 'en_curso'), { estado: 'en_curso', progreso: 0, motivo: null });
  assert.deepEqual(trasMover(de('en_curso', 40), 'por_hacer'), { estado: 'por_hacer', progreso: 40, motivo: null }, 'entre abiertas el avance no se toca');
  assert.deepEqual(trasMover(de('en_curso', 40), 'en_seguimiento', 'el cliente no da'), { estado: 'en_seguimiento', progreso: 40, motivo: 'el cliente no da' });
  assert.deepEqual(trasMover(de('en_seguimiento', 40, 'sin plata'), 'en_seguimiento'), { estado: 'en_seguimiento', progreso: 40, motivo: 'sin plata' }, 'reordenar adentro lo conserva');
  assert.deepEqual(trasMover(de('en_seguimiento', 40, 'sin plata'), 'en_seguimiento', null), { estado: 'en_seguimiento', progreso: 40, motivo: null }, 'null lo borra');
  assert.deepEqual(trasMover(de('en_curso', 40), 'en_seguimiento'), { estado: 'en_seguimiento', progreso: 40, motivo: null }, 'entra sin motivo si no se dijo');
  assert.deepEqual(trasMover(de('en_seguimiento', 40, 'sin plata'), 'en_curso'), { estado: 'en_curso', progreso: 40, motivo: null }, 'destrabada: el motivo se va');
  assert.equal(avanceAlMover('no_cumple', 100), 0);
});

test('motivoAtoradaOk / motivoParaNoMover / alCrear', () => {
  assert.equal(motivoAtoradaOk('  falta   el\nlogo '), 'falta el logo');
  assert.equal(motivoAtoradaOk('   '), null);
  assert.equal(motivoAtoradaOk(42), null);
  assert.equal(motivoAtoradaOk('x'.repeat(500))?.length, MOTIVO_ATORADA_MAX);
  assert.equal(motivoParaNoMover({ recurrente: true }, 'hecho'), NO_SE_COMPLETA);
  assert.equal(motivoParaNoMover({ recurrente: true }, 'en_seguimiento'), null);
  assert.equal(motivoParaNoMover({ recurrente: false }, 'hecho'), null);
  assert.deepEqual(alCrear(undefined, 0), { estado: 'por_hacer', progreso: 0 });
  assert.deepEqual(alCrear(undefined, 100), { estado: 'hecho', progreso: 100 });
  assert.deepEqual(alCrear('hecho', 0), { estado: 'hecho', progreso: 100 }, 'el «＋» de Completada nace al 100%');
  assert.deepEqual(alCrear('en_seguimiento', 20), { estado: 'en_seguimiento', progreso: 20 });
  assert.deepEqual(alCrear('inventado', 20), { estado: 'en_curso', progreso: 20 });
});

test('ordenEntre: el lugar al soltar, sin renumerar', () => {
  assert.equal(ordenEntre(1, 2), 1.5);
  assert.equal(ordenEntre(null, 5), 4, 'soltada primera: arriba de la primera');
  assert.equal(ordenEntre(5, null), 6, 'soltada última: abajo de la última');
  assert.equal(ordenEntre(), 0);
  assert.equal(ordenEntre(3, 3), 3);
  assert.equal(ordenEntre(Number.NaN, 2), 1);
});

test('«Sin priorizar» es el 0, y NO es «A futuro» (aunque la banda del número lo sea)', () => {
  assert.equal(sinPriorizar({ score: 0 }), true);
  assert.equal(sinPriorizar({ score: 1 }), false);
  assert.equal(prioFiltroDe({ score: 0 }), 'sin_priorizar');
  assert.equal(prioFiltroDe({ score: 12 }), 'futuro');
  assert.equal(prioFiltroDe({ score: 85 }), 'alta');
  // La BANDA del número sigue diciendo 'futuro' para el 0 (la usan el reparto y las cuentas); lo
  // que lee la persona —el chip y el filtro— pregunta por `prioFiltroDe`.
  assert.equal(prioFromScore(0), 'futuro');
  assert.deepEqual([...PRIOS_FILTRO], ['alta', 'media', 'baja', 'futuro', 'sin_priorizar']);
  assert.equal(PFILTRO_LABEL.sin_priorizar, 'Sin priorizar');
  assert.equal(estadoDe({ progress: 100 }), 'hecho', 'sin estado, sale del avance');
  assert.equal(estadoDe({ estado: 'en_seguimiento', progress: 100 }), 'en_seguimiento', 'con estado, manda el estado');
});

const tarea = (o: Partial<Tarea>): Tarea => ({
  id: 7, titulo: 't', detalle: null, estado: 'por_hacer', motivo_atorada: null, prioridad: 'media', progreso: 0, deadline: null,
  quarter: null, recurrente: false, recurrencia: null, categorias: [], checklist: [], historial: [], en_prioridad: false,
  score: 0, score_razon: null, score_manual: false, notas: '', deadline_razon: null, hacelo_en: null, impacto: null, esfuerzo: null,
  origen: 'manual', fuente: null, experimento_id: null, retro_id: null, orden: 3, hecho_at: null, created_at: '', updated_at: '',
  responsable: null, responsable_email: null, responsable_tipo: null, cliente_nombre: null, cliente_lead_id: null, tema: null,
  criterio_veredicto: null, criterio_regla: null, criterio_razon: null, cita: null, ...o,
});

test('toBoard: el 0 se queda en 0, y la columna, el motivo y el lugar entran', () => {
  const b = toBoard(tarea({ score: 0, prioridad: 'media' }));
  assert.equal(b.score, 0, 'hasta el 16/10 un 0 se dibujaba como 62 («Media»)');
  assert.equal(prioFiltroDe(b), 'sin_priorizar');
  assert.equal(toBoard(tarea({ score: 77 })).score, 77);
  const a = toBoard(tarea({ estado: 'en_seguimiento', motivo_atorada: 'sin plata', orden: -4 }));
  assert.deepEqual([a.estado, a.motivoAtorada, a.orden], ['en_seguimiento', 'sin plata', -4]);
});

const TODO_BOARD = sinComentarios(leer('app/plan/TodoBoard.tsx'));

test('editPatch: el avance sólo si cambió, y el estado NUNCA (lo escribe `mover`)', () => {
  const ep = bloque(TODO_BOARD, 'const editPatch =', '\n});');
  assert.ok(ep.length < 3000, `el bloque de editPatch mide ${ep.length}: está mirando otra cosa`);
  assert.match(ep, /\.\.\.avanceSiCambio\(d\.progress, progresoGuardado\)/);
  assert.doesNotMatch(ep, /progreso:\s*d\.progress/, 'el avance volvió a viajar siempre: es el retroceso del kanban');
  assert.doesNotMatch(ep, /\bestado\b/, 'el estado no viaja en el guardado');
  // Y el guardado le pasa lo último que confirmó la base.
  const save = bloque(TODO_BOARD, 'saveTask: async (d) => {', '\n    },');
  assert.match(save, /editPatch\(d, progresoGuardado\.current!\.get\(d\.id\)\)/);
});

test('el alta: nace libre y SIN el Perro (decisión 6)', () => {
  const shell = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
  const alta = bloque(shell, 'const crearConGuardian = async', '\n  };');
  assert.ok(alta.length < 4000, `el bloque del alta mide ${alta.length}: está mirando otra cosa`);
  assert.doesNotMatch(alta, /priorizarNuevas/, 'el alta volvió a llamar al Perro del server');
  assert.doesNotMatch(alta, /mako-guardian/, 'el alta volvió a debatir con el Perro del navegador');
  assert.match(alta, /board\.create\([^;]*\{[^}]*score[^}]*\}/, 'el alta tiene que pasarle el score (0 = libre) al tablero');
  assert.match(alta, /const score = fija \? [^:]+ : 0;/, 'sin prioridad fijada a mano, nace en 0');
});

test('el contrato del mover: cada Repo pega a la acción que su ruta escucha, y la ruta valida el estado', () => {
  const plan = sinComentarios(leer('app/plan/board/repo-plan.ts'));
  const rutaPlan = sinComentarios(leer('app/api/plan-board/route.ts'));
  const rutaTodo = sinComentarios(leer('app/api/todo/route.ts'));
  const accPlan = /mover: async[\s\S]*?action: '([^']+)'/.exec(plan)?.[1];
  const accTodo = /mover: async[\s\S]*?action: '([^']+)'/.exec(TODO_BOARD)?.[1];
  assert.ok(accPlan && accTodo, 'los dos tableros implementan `mover`');
  for (const [acc, ruta, quien] of [[accPlan, rutaPlan, 'dueño'], [accTodo, rutaTodo, 'cliente']] as const) {
    const rama = bloque(ruta, `if (action === '${acc}') {`, '\n    }');
    assert.match(rama, /if \(!esEstado\(estado\)\) return/, `${quien}: un estado inventado tiene que ser un 400, no «Por iniciar»`);
  }
});

test('la API de MaKo: mover de columna existe, por las dos mitades, y no completa', () => {
  const def = DEFS.find((d) => d.id === 'mover_tarea_plan');
  assert.ok(def, 'mover_tarea_plan no está declarada en plan.def.ts');
  const estado = def.parametros.find((p) => p.nombre === 'estado');
  assert.deepEqual([...(estado?.enum ?? [])].sort(), ['en_curso', 'en_seguimiento', 'no_cumple', 'por_hacer'], 'completar pasa por proponer_cierre_tareas, que pide la evidencia');
  assert.equal(def.tipo, 'accion');
  const run = sinComentarios(leer('lib/api-mako/areas/plan.run.ts'));
  const cuerpo = bloque(run, 'mover_tarea_plan: {', '\n  },');
  assert.match(cuerpo, /moverPlanTarea\(/, 'el dueño mueve por la misma función que el arrastre');
  assert.match(cuerpo, /moverTarea\(/, 'el cliente mueve por la misma función que el arrastre');
});
