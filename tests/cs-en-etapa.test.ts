// =============================================================================
// Hace cuánto que un cliente está en su etapa de entrega (app/customer-success/en-etapa.ts)
// =============================================================================
// La función la leen la columna «En la etapa» de la tabla de Customer Success y el chip de
// la tarjeta del kanban. Lo que se fija acá son los tres bordes que una
// pantalla no deja ver:
//  · SIN DATO NO SE INVENTA UN «recién». Un cliente sin fila nunca se movió y su reloj no
//    arrancó; una fecha del futuro es un reloj corrido. Las dos dan `null`, nunca «recién».
//  · el «hace» va en `frase` y NO en `corto`, y «recién» no lleva «hace» en ninguna de las
//    dos — con el prefijo puesto afuera, el caso corto salía «hace recién»;
//  · el umbral de «trabado» es >= 21 días, el mismo número que el kanban.
//
// PROBADO ROMPIÉNDOLO (05/10/2026): con `if (ms < 0) return null` borrado, cae «una fecha
// del futuro no dice nada» (1 fail, 4 pass); con `>= DIAS_TRABADO` cambiado a `>`, cae «el
// umbral» (1 fail, 4 pass). Restaurado: 5 pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiempoEnEtapa, DIAS_TRABADO } from '../app/customer-success/en-etapa';

const AHORA = Date.parse('2026-10-05T12:00:00Z');
const antes = (ms: number) => new Date(AHORA - ms).toISOString();
const H = 3_600_000;
const D = 86_400_000;

test('sin fecha, ilegible: no hay nada que decir', () => {
  assert.equal(tiempoEnEtapa(null, AHORA), null);
  assert.equal(tiempoEnEtapa(undefined, AHORA), null);
  assert.equal(tiempoEnEtapa('', AHORA), null);
  assert.equal(tiempoEnEtapa('no es una fecha', AHORA), null);
});

test('una fecha del futuro no dice nada (no es «recién»)', () => {
  assert.equal(tiempoEnEtapa(new Date(AHORA + 5 * 60_000).toISOString(), AHORA), null);
});

test('recién, horas y días: una sola unidad, y el «hace» sólo en la frase', () => {
  const recien = tiempoEnEtapa(antes(20 * 60_000), AHORA);
  assert.equal(recien?.corto, 'recién');
  assert.equal(recien?.frase, 'recién');

  const horas = tiempoEnEtapa(antes(5 * H + 10 * 60_000), AHORA);
  assert.equal(horas?.corto, '5 h');
  assert.equal(horas?.frase, 'hace 5 h');

  const uno = tiempoEnEtapa(antes(D + H), AHORA);
  assert.equal(uno?.corto, '1 día');
  assert.equal(uno?.frase, 'hace 1 día');

  const tres = tiempoEnEtapa(antes(3 * D + 2 * H), AHORA);
  assert.equal(tres?.corto, '3 días');
  assert.equal(tres?.frase, 'hace 3 días');
});

test('el umbral de «trabado» es el del kanban, y se cumple al llegar', () => {
  assert.equal(DIAS_TRABADO, 21);
  assert.equal(tiempoEnEtapa(antes(DIAS_TRABADO * D - H), AHORA)?.trabado, false);
  assert.equal(tiempoEnEtapa(antes(DIAS_TRABADO * D), AHORA)?.trabado, true);
  assert.equal(tiempoEnEtapa(antes(40 * D), AHORA)?.trabado, true);
});

test('los días vienen con decimales: el umbral no redondea', () => {
  const t = tiempoEnEtapa(antes(2.5 * D), AHORA);
  assert.ok(t && t.dias > 2.49 && t.dias < 2.51);
  assert.equal(t?.corto, '2 días');
});
