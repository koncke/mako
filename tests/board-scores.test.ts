// Tests de las funciones PURAS de scoring del Perro Guardián (app/plan/board/types.ts).
// Characterization tests: fijan el comportamiento ACTUAL (pirámide sana + spread sin
// empates) para que un refactor no lo rompa en silencio. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  curveTaskScores, spreadProjScores, prioFromScore,
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
