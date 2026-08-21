// Tests de las funciones PURAS de scoring del Perro Guardián (app/plan/board/types.ts).
// Characterization tests: fijan el comportamiento ACTUAL (pirámide sana + spread sin
// empates) para que un refactor no lo rompa en silencio. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  curveTaskScores, spreadProjScores, prioFromScore, scoreProyectoDerivado, sanearHist,
  clampScore, clampProj, clampPct, MAX_PROJ,
} from '../app/plan/board/types';

test('prioFromScore — cortes en 75 / 50 / 25', () => {
  assert.equal(prioFromScore(100), 'alta');
  assert.equal(prioFromScore(75), 'alta');
  assert.equal(prioFromScore(74), 'media');
  assert.equal(prioFromScore(50), 'media');
  assert.equal(prioFromScore(49), 'baja');
  assert.equal(prioFromScore(25), 'baja');
  assert.equal(prioFromScore(24), 'futuro');
  assert.equal(prioFromScore(0), 'futuro');
});

test('clampScore / clampProj / clampPct — saturan, redondean y toleran NaN', () => {
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(3.6), 4);
  assert.equal(clampScore(NaN), 0);
  assert.equal(clampScore(Infinity), 0);
  assert.equal(clampProj(0), 1);          // proyectos: piso 1
  assert.equal(clampProj(200), 100);
  assert.equal(clampProj(NaN), 50);       // default sano
  assert.equal(clampPct(120), 100);
  assert.equal(clampPct(-1), 0);
  assert.equal(clampPct(NaN), 0);
});

test('curveTaskScores — n=0 → {}, n<5 → sin tocar', () => {
  assert.deepEqual(curveTaskScores([]), {});
  const chicos = [
    { id: 'a', score: 90 }, { id: 'b', score: 80 }, { id: 'c', score: 10 },
  ];
  const out = curveTaskScores(chicos);
  assert.equal(out.a, 90);
  assert.equal(out.b, 80);
  assert.equal(out.c, 10);
});

test('curveTaskScores — n>=5 arma una PIRÁMIDE (Alta arriba, siempre hay Baja y A-futuro)', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, score: 100 - i }));
  const out = curveTaskScores(items);
  const scores = Object.values(out);
  // todos en 1-100
  assert.ok(scores.every((s) => s >= 1 && s <= 100));
  const prios = scores.map(prioFromScore);
  // la más importante queda en Alta; y SIEMPRE cae gente en Baja y en A-futuro
  assert.equal(prioFromScore(out.t0), 'alta');
  assert.ok(prios.includes('baja'), 'la pirámide debe tener tareas en Baja');
  assert.ok(prios.includes('futuro'), 'la pirámide debe tener tareas en A futuro');
  // menos "Alta" que "Baja"+"Futuro" juntas (pirámide, no un rectángulo)
  const alta = prios.filter((p) => p === 'alta').length;
  const bajaYfuturo = prios.filter((p) => p === 'baja' || p === 'futuro').length;
  assert.ok(alta < bajaYfuturo, `Alta(${alta}) debe ser menos que Baja+Futuro(${bajaYfuturo})`);
});

test('spreadProjScores — sin empates, estrictamente decreciente, respeta el ranking', () => {
  // tres proyectos EMPATADOS en 50 → tres números distintos
  const empatados = [{ id: 'a', score: 50 }, { id: 'b', score: 50 }, { id: 'c', score: 50 }];
  const out = spreadProjScores(empatados);
  const vals = [out.a, out.b, out.c];
  assert.equal(new Set(vals).size, 3, 'no puede haber dos proyectos con el mismo score');
  // estrictamente decreciente en orden de entrada (mismo score → estable por índice)
  assert.ok(out.a > out.b && out.b > out.c);
  assert.ok(vals.every((v) => v >= 1 && v <= MAX_PROJ));
});

test('spreadProjScores — n<=1 → MAX_PROJ; ranking por score preservado', () => {
  assert.deepEqual(spreadProjScores([{ id: 'solo', score: 5 }]), { solo: MAX_PROJ });
  const rankeados = [{ id: 'lo', score: 10 }, { id: 'hi', score: 90 }, { id: 'mid', score: 50 }];
  const out = spreadProjScores(rankeados);
  // el de mayor score queda arriba, el menor abajo
  assert.ok(out.hi > out.mid && out.mid > out.lo);
  assert.equal(new Set([out.hi, out.mid, out.lo]).size, 3);
});

// ── El score del proyecto sale de sus tareas ─────────────────────────────────────────
// El bug que cierran: «en Prioridades me sale que el proyecto más importante es de
// ciberseguridad, pero en el kanban hay muchas tareas más importantes que eso». El score de
// proyecto y el de tarea se producían en corridas distintas y nunca se reconciliaban: 154
// de 550 tareas puntuaban por encima de su propio proyecto, y 8 proyectos SIN una sola
// tarea abierta ocupaban de 50 a 80.

// Helper: en los casos CON tareas nunca devuelve null, pero el tipo lo permite.
const derivado = (ss: number[]): number => {
  const v = scoreProyectoDerivado(ss);
  assert.notEqual(v, null, 'con tareas abiertas siempre hay número');
  return v as number;
};

test('scoreProyectoDerivado — NINGUNA tarea puede puntuar por encima de su proyecto', () => {
  // Es LA invariante. Se prueba sobre todo el rango, no sobre un caso lindo.
  for (let max = 1; max <= 100; max++) {
    for (const cola of [[], [max - 1, max - 2], [1, 1], [max, max]]) {
      const scores = [max, ...cola.filter((c) => c >= 1 && c <= max)];
      assert.ok(derivado(scores) >= max, `max ${max} con cola ${cola} quedó por debajo`);
    }
  }
});

test('scoreProyectoDerivado — un proyecto vale por su MEJOR tarea, no por su promedio', () => {
  const unaCritica = derivado([93, 10, 8]);
  const veinteChicas = derivado(Array(20).fill(40));
  assert.ok(unaCritica > veinteChicas, 'el promedio dejaría ganar al que tiene volumen de trabajo chico');
});

test('scoreProyectoDerivado — a igual tarea top, gana el que tiene más trabajo importante detrás', () => {
  assert.ok(derivado([90, 88, 85]) > derivado([90]));
});

test('scoreProyectoDerivado — una sola tarea NO cobra bonus de tres', () => {
  // Las que faltan valen 0: si contaran como el máximo, un proyecto de una tarea empataría
  // con uno que tiene tres igual de importantes.
  assert.ok(derivado([60]) < derivado([60, 60, 60]));
});

test('scoreProyectoDerivado — sin tareas abiertas devuelve null, NO un número bajo', () => {
  // La corrección del dueño: «si se creó un proyecto es por algo… lo que se debe hacer es
  // cargarle tareas». Un proyecto vacío no es poco importante, es DESCONOCIDO — y fabricar
  // un número donde no hay evidencia es el modo de falla que este módulo vino a cerrar.
  // `null` = «no lo toques»; el caller conserva el score que le puso el Perro.
  assert.equal(scoreProyectoDerivado([]), null);
});

test('scoreProyectoDerivado — nunca se sale de 1..MAX_PROJ', () => {
  assert.equal(derivado([100, 100, 100]), MAX_PROJ);
  assert.ok(derivado([1]) >= 1);
});

// ── El historial que viene de la base ────────────────────────────────────────────────
// 418 entradas reales tenían `ts` como string ISO y `actor: 'MaKo'` (un cuarto valor que no
// existe en el union). Las escribió un script sobre un `Row`, donde el compilador no mira.
// La fecha se DIBUJABA bien, así que el bug era invisible; lo que rompía era la aritmética.

test('sanearHist — un ts ISO se convierte a epoch, no se descarta', () => {
  const [h] = sanearHist([{ id: 'a', ts: '2026-08-06T14:55:22.894Z', actor: 'MaKo', text: 'x' }]);
  assert.equal(typeof h.ts, 'number');
  assert.equal(h.ts, Date.parse('2026-08-06T14:55:22.894Z'));
});

test('sanearHist — un actor fuera del tipo cae en «ia», que es lo que MaKo es', () => {
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'MaKo', text: 'x' }])[0].actor, 'ia');
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'user', text: 'x' }])[0].actor, 'user');
  assert.equal(sanearHist([{ id: 'a', ts: 1, actor: 'code', text: 'x' }])[0].actor, 'code');
});

test('sanearHist — LA razón de existir: Math.max sobre lo saneado nunca da NaN', () => {
  // Es el modo de falla exacto que se midió: NaN en una comparación es siempre false, así
  // que la regla de «30 días sin tocar» se evaluaba sobre 362 de 550 tareas y no lo decía.
  const sucio = [
    { id: 'a', ts: '2026-08-06T14:55:22.894Z', actor: 'MaKo', text: 'x' },
    { id: 'b', ts: 1785935073901, actor: 'ia', text: 'y' },
    { id: 'c', ts: null, actor: 'ia', text: 'z' },
    { id: 'd', ts: 'no es una fecha', actor: 'ia', text: 'w' },
  ];
  assert.ok(Number.isNaN(Math.max(...sucio.map((h) => h.ts as number))), 'el crudo SÍ da NaN');
  const limpio = Math.max(...sanearHist(sucio).map((h) => h.ts));
  assert.ok(Number.isFinite(limpio), 'lo saneado nunca');
  assert.equal(limpio, Date.parse('2026-08-06T14:55:22.894Z'), 'y el más reciente es el que estaba en ISO');
});

test('sanearHist — lo que no se puede fechar se descarta, no se inventa', () => {
  // Una entrada sin fecha usable ordenaría mal el historial y envenenaría la cuenta de días.
  assert.equal(sanearHist([{ id: 'a', ts: null, actor: 'ia', text: 'x' }]).length, 0);
  assert.equal(sanearHist([{ id: 'a', ts: 'pomelo', actor: 'ia', text: 'x' }]).length, 0);
});

test('sanearHist — basura de entrada devuelve lista vacía, nunca explota', () => {
  assert.deepEqual(sanearHist(null), []);
  assert.deepEqual(sanearHist('no soy un array'), []);
  assert.deepEqual(sanearHist([null, 3, 'x']), []);
});

test('sanearHist — conserva undo y kind, que son lo que hace deshacible una entrada', () => {
  const [h] = sanearHist([{ id: 'a', ts: 1, actor: 'user', text: 'x', undo: { field: 'score', prev: 32 }, kind: 'task' }]);
  assert.deepEqual(h.undo, { field: 'score', prev: 32 });
  assert.equal(h.kind, 'task');
});
