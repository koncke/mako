// =============================================================================
// EL JUEZ DE LAS PRUEBAS A/B NO INVENTA GANADORES: pruebas A/A con el calendario real de lecturas (25/10/2026)
// =============================================================================
// El Cerebro (25/10, tanda A1): «el test que simula pruebas A/A con el calendario real de lecturas y exige ≤ 5 % de
// falsos ganadores, probado rompiéndolo. Sin ese test no sigue nada». La crítica (docs/diseno-pruebas-ab.md, Anexo 2, A.1)
// midió que mirar todos los días con «95 % dos días seguidos» daba entre 10 y 35 % de falsos ganadores.
//
// El simulador (tests/_simular-pruebas.ts) hace entrar gente cada día, la deja madurar su ventana y le pasa UNA
// lectura por día al juez REAL (lib/pruebas/juez.ts), que puede seguir, cortar una rama o concluir. Lo que fija:
//   · A/A (sin diferencia real): «gana B» + «gana el control» ≤ 5 %, en una automatización (10 %, 12 por rama y por
//     día, ventana de 7 días), con 3 ramas, y en una landing (5 %, 34 por día, ventana de 1);
//   · A/A: los cortes por daño (que dejan de servir una rama sin razón) ≤ 5 %;
//   · con el efecto que pide el plan (10 % → 18 %), B gana 70 % de las veces o más: un juez que nunca decide también
//     pasaría el A/A, y no sirve;
//   · con B mucho peor (10 % → 5 %), B nunca gana, y la mayoría de las veces se corta o pierde.
// Semilla fija: los números son siempre los mismos (los medidos van en cada test).
// Correr: node --import tsx --test tests/pruebas-juez-aa.test.ts   (~30 s)
// ROTURAS (25/10/2026, una por vez y restaurada; base 5 / 0): ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simular, type Escenario } from './_simular-pruebas';
import { nPorRama } from '../lib/pruebas/volumen';

const escenario = (tasas: number[], ritmoPorRama: number, ventanaDias: number, mdeRel: number, maxDias: number): Escenario => ({
  tasas, ritmoPorRama, ventanaDias,
  regla: { nPorRama: nPorRama({ base: tasas[0], mdeRel, ramas: tasas.length }), minDias: 7, maxDias, mdeRel },
});
const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;

test('A/A en una automatización (10 %, 12 por rama y por día, ventana de 7): ≤ 5 % de falsos ganadores y de cortes', () => {
  const e = escenario([0.1, 0.1], 12, 7, 0.8, 60);
  assert.equal(e.regla.nPorRama, 315, 'el plan de 10 % → 18 % cambió');
  const r = simular(e, 1000, 20261025);
  const falsos = r.ganaVariante + r.ganaControl;
  assert.ok(falsos <= 0.05, `falsos ganadores ${pct(falsos)} (B ${pct(r.ganaVariante)}, control ${pct(r.ganaControl)})`);
  assert.ok(r.conCorte <= 0.05, `cortes sin razón ${pct(r.conCorte)}`);
});

test('A/A con 3 ramas (Bonferroni): ≤ 5 % de falsos ganadores', () => {
  const e = escenario([0.1, 0.1, 0.1], 12, 7, 0.8, 60);
  const r = simular(e, 400, 7);
  const falsos = r.ganaVariante + r.ganaControl;
  assert.ok(falsos <= 0.05, `falsos ganadores ${pct(falsos)}`);
  assert.ok(r.conCorte <= 0.05, `cortes sin razón ${pct(r.conCorte)}`);
});

test('A/A en una landing (5 %, 34 por día, ventana de 1, llega al horizonte): ≤ 5 % de falsos ganadores', () => {
  const e = escenario([0.05, 0.05], 34, 1, 0.5, 60);
  const r = simular(e, 400, 11);
  assert.ok(r.daLoMismo + r.ganaVariante + r.ganaControl > 0.5, 'casi ninguna llegó al horizonte: el escenario no mide nada');
  const falsos = r.ganaVariante + r.ganaControl;
  assert.ok(falsos <= 0.05, `falsos ganadores ${pct(falsos)}`);
});

test('con el efecto del plan (10 % → 18 %), B gana 70 % de las veces o más: el juez decide', () => {
  const e = escenario([0.1, 0.18], 12, 7, 0.8, 60);
  const r = simular(e, 300, 3);
  assert.ok(r.ganaVariante >= 0.7, `B ganó ${pct(r.ganaVariante)}`);
  assert.equal(r.ganaControl, 0);
});

test('con B mucho peor (10 % → 5 %), B nunca gana y casi siempre se corta o pierde', () => {
  const e = escenario([0.1, 0.05], 12, 7, 0.8, 60);
  const r = simular(e, 300, 5);
  assert.equal(r.ganaVariante, 0);
  assert.ok(r.conCorte + r.ganaControl >= 0.5, `cortes ${pct(r.conCorte)}, gana el control ${pct(r.ganaControl)}`);
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-a1.cjs`, una por vez y restaurada; base 5 / 0):
//   · UMBRAL_GANA 0,98 → 0,9                                  → 1 / 4 (los tres A/A y el «B mucho peor»)
//   · «mirar todos los días»: gana antes del horizonte          → 2 / 3
//   · el corte con 95 % en vez de 99,5 %                       → 3 / 2 (los cortes sin razón)
//   · el juez nunca declara ganadora                           → 4 / 1 (la potencia: un juez mudo pasa el A/A)
// Medido con estas semillas: automatización A/A 1,3 % «gana B» + 0,7 % «gana el control», 0,9 % con corte; 3 ramas 1 % y
// 3,5 % con corte; landing 2 % + 1,3 %; con el efecto del plan B gana 78 %; con B a la mitad, 50 % se corta antes.
