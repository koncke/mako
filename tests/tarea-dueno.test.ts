// =============================================================================
// ¿La tarea es MÍA o de otro? La regla que se rompió dos veces, en silencio
// =============================================================================
// Caso real que motivó estos tests: una consultoría de 122 min dejó 72 tareas y 59
// —todas de Martín— aparecieron en la tab de "otra persona", porque Fathom etiqueta
// al hablante con el nombre de SU cuenta ("Martin Carballo") y en la app es "Martin
// Koncke". El match por nombre falla y hay que ganar por email.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverDueño } from '../lib/tarea-dueno';

const YO = { nombre: 'Martin Koncke', email: 'martinkoncke@gmail.com' };
// Como viene de Fathom: el nombre es el de su cuenta, distinto del de la app.
const PARTICIPANTES = [
  { nombre: 'Martin Carballo', email: 'martinkoncke@gmail.com' },
  { nombre: 'Francisco Hugo Di Giorno', email: 'fran@ejemplo.com' },
];

test('el apellido distinto NO la hace de otro: gana el email', () => {
  const r = resolverDueño({ dueño: 'Martin Carballo', dueñoEmail: 'martinkoncke@gmail.com', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
  assert.equal(r.dueñoEmail, ''); // mi propio email no viaja como "de otro"
});

test('sin email, el primer nombre alcanza si nadie más lo comparte', () => {
  const r = resolverDueño({ dueño: 'Martin', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
});

test('con DOS Martines en la reunión, el primer nombre no alcanza', () => {
  const dos = [...PARTICIPANTES, { nombre: 'Martin Perez', email: 'otro@ejemplo.com' }];
  const r = resolverDueño({ dueño: 'Martin Perez', dueñoEmail: 'otro@ejemplo.com', esMio: false }, YO, dos);
  assert.equal(r.esDeOtro, true);
  assert.equal(r.dueñoEmail, 'otro@ejemplo.com');
});

test('la tarea del consultor SÍ es de otro', () => {
  const r = resolverDueño({ dueño: 'Francisco Hugo Di Giorno', dueñoEmail: 'fran@ejemplo.com', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, true);
  assert.equal(r.dueñoEmail, 'fran@ejemplo.com');
});

test('un email inventado (que no estuvo en la reunión) se descarta', () => {
  const r = resolverDueño({ dueño: 'Alguien', dueñoEmail: 'random@nadie.com', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.dueñoEmail, '');
});

test('si el modelo dice esMio:true, es mía y no se discute', () => {
  const r = resolverDueño({ dueño: 'Francisco Hugo Di Giorno', dueñoEmail: 'fran@ejemplo.com', esMio: true }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
});

test('sin dueño identificado queda como mía (es mi tablero)', () => {
  const r = resolverDueño({ dueño: '', esMio: undefined }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
  assert.equal(r.dueño, '');
});

test('sin lista de participantes, el nombre completo todavía decide', () => {
  const r = resolverDueño({ dueño: 'Martin Koncke', esMio: false }, YO, []);
  assert.equal(r.esDeOtro, false);
});

test('el email del dueño se rescata por nombre cuando el modelo no lo dio', () => {
  const r = resolverDueño({ dueño: 'Francisco Hugo Di Giorno', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.dueñoEmail, 'fran@ejemplo.com');
});
