// =============================================================================
// La pila del celular (app/dashboard/pila.ts): qué mide lo que dibuja y qué número va a lo ancho (15/10/2026)
// =============================================================================
// Lo que se persigue falla EN SILENCIO, y sólo se ve en el teléfono:
//   · una tabla, unas tarjetas o unas barras con el alto del escritorio dejaban media pantalla en blanco abajo;
//   · unas barras de recharts (apiladas, desglosadas) sin alto propio se aplastarían a nada;
//   · el último número de un grupo impar quedaba solo en media fila.
//
// Verificado rompiéndolo, cada rotura contra una base de 4/0:
//   · sacar 'tabla' de ALTO_LIBRE_EN_PILA                              -> 3 / 1
//   · `esBarrasGordas` sin mirar el desglose                           -> 3 / 1
//   · `solosEnPila` sin cerrar la corrida al final                     -> 3 / 1
//
// Correr: npx tsx --test tests/dashboard-pila.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALTO_LIBRE_EN_PILA, esBarrasGordas, graficoAltoLibreEnPila, solosEnPila } from '../app/dashboard/pila';
import type { Grafico } from '../lib/graficos-catalogo';

const g = (extra: Partial<Grafico>): Grafico => ({ tipo: 'tabla', desglose: null, metricas: ['leads'], ...extra }) as Grafico;

test('las tablas, las tarjetas y los tramos miden lo que dibujan; una portada no', () => {
  for (const tipo of ['tabla', 'tabla_barras', 'tabla_calor', 'dinamica', 'tarjetas', 'tramos', 'numero']) {
    assert.ok(ALTO_LIBRE_EN_PILA.has(tipo), tipo);
    assert.equal(graficoAltoLibreEnPila(g({ tipo })), true, tipo);
  }
  assert.equal(graficoAltoLibreEnPila(g({ tipo: 'tabla', portada: 'cobranza' })), false, 'una portada mide sus filas de portada');
  for (const tipo of ['serie', 'columnas', 'circular', 'embudo', 'mapa']) assert.equal(graficoAltoLibreEnPila(g({ tipo })), false, tipo);
});

test('las barras horizontales son HTML sólo sin apilar, sin desglose y con hasta dos métricas (lo de Grafico.tsx)', () => {
  assert.equal(esBarrasGordas(g({ tipo: 'barras' })), true);
  assert.equal(esBarrasGordas(g({ tipo: 'barras', metricas: ['a', 'b'] })), true);
  assert.equal(esBarrasGordas(g({ tipo: 'barras', metricas: ['a', 'b', 'c'] })), false, 'tres métricas son de recharts');
  assert.equal(esBarrasGordas(g({ tipo: 'barras', desglose: 'closer' })), false, 'desglosadas son de recharts');
  assert.equal(esBarrasGordas(g({ tipo: 'barras_apiladas' })), false);
});

test('el último número de un grupo IMPAR queda solo y va a lo ancho; uno par, no', () => {
  const n = (id: string) => ({ id, kpi: true });
  const otro = (id: string) => ({ id, kpi: false });
  const deADos = (c: { kpi: boolean }) => c.kpi;
  assert.deepEqual([...solosEnPila([n('a'), n('b'), n('c'), otro('t'), n('d'), n('e')], deADos)], ['c']);
  assert.deepEqual([...solosEnPila([n('a'), n('b')], deADos)], []);
  assert.deepEqual([...solosEnPila([otro('t'), n('a')], deADos)], ['a'], 'el grupo que cierra la hoja también');
});

test('la pila del editor usa estas reglas (no una copia)', () => {
  const src = readFileSync(join(__dirname, '..', 'app', 'dashboard', 'EditorInforme.tsx'), 'utf8');
  assert.match(src, /from '\.\/pila'/);
  assert.match(src, /graficoAltoLibreEnPila\(c\)/);
  assert.match(src, /solosPila\.has\(c\.id\) && 'lk-comp--solo'/);
  assert.doesNotMatch(src, /const ALTO_LIBRE_EN_PILA/);
});
