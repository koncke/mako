// =============================================================================
// El freno de scope del Perro por tipo de reunión (punto 8)
// =============================================================================
// Regla de Martín: cargar una llamada de VENTAS o de ENTREGA al plan de ejecución
// mete tareas fuera de scope. El Perro avisa y pide confirmación (no bloquea).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frenoDeScope } from '../lib/reunion-gate';

test('reunión de ventas → el Perro frena', () => {
  const f = frenoDeScope('ventas');
  assert.ok(f && f.frena);
  assert.match(f.titulo, /VENTAS/);
});

test('reunión de entrega → el Perro frena', () => {
  const f = frenoDeScope('entrega');
  assert.ok(f && f.frena);
  assert.match(f.titulo, /ENTREGA/);
});

test('reunión de equipo → no frena (es la que SÍ deja tareas del plan)', () => {
  assert.equal(frenoDeScope('equipo'), null);
});

test('reunión otra → no frena (el usuario decide en el form)', () => {
  assert.equal(frenoDeScope('otra'), null);
});
