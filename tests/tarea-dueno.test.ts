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

// Los invitados de Google Calendar ya no van al prompt (Uso Limitado, 07/10/2026): el
// modelo escribe el nombre como lo oyó y el email lo pone el código. Probado rompiéndolo,
// una rotura por vez y con todo en verde antes: sin `porPrefijo` caen 2 (éste y el del Meet
// improvisado); con `startsWith(dn)` sin el espacio, el de «Ju» (1); contando también a los
// sin email, el del Meet (1); y sin el `propuesto &&` de `emailReal`, el del Meet (1).
test('un primer nombre que arranca UN solo invitado con email le pone su email', () => {
  const cal = [...PARTICIPANTES, { nombre: 'Juan Pérez', email: 'juan@cliente.com' }];
  const r = resolverDueño({ dueño: 'Juan', esMio: false }, YO, cal);
  assert.equal(r.dueñoEmail, 'juan@cliente.com');
  assert.equal(r.esDeOtro, true);
});

test('con dos Juanes con email no se elige ninguno, y otro apellido no cuenta', () => {
  const dos = [...PARTICIPANTES, { nombre: 'Juan Pérez', email: 'juan@cliente.com' }, { nombre: 'Juan Ruiz', email: 'ruiz@cliente.com' }];
  assert.equal(resolverDueño({ dueño: 'Juan', esMio: false }, YO, dos).dueñoEmail, '');
  const uno = [...PARTICIPANTES, { nombre: 'Juan Pérez', email: 'juan@cliente.com' }];
  assert.equal(resolverDueño({ dueño: 'Juan Gómez', esMio: false }, YO, uno).dueñoEmail, '');
});

// El caso del Meet improvisado: Fathom trae «Juan» SIN email (el hablante) y el
// calendario trae a «Juan Pérez» con el suyo. Son la misma persona, no dos Juanes.
test('el mismo Juan, por Fathom sin email y por el calendario con email, no se anula', () => {
  const mezcla = [...PARTICIPANTES, { nombre: 'Juan', email: '' }, { nombre: 'Juan Pérez', email: 'juan@cliente.com' }];
  assert.equal(resolverDueño({ dueño: 'Juan', esMio: false }, YO, mezcla).dueñoEmail, 'juan@cliente.com');
});

test('un pedazo de nombre no es un nombre', () => {
  const cal = [...PARTICIPANTES, { nombre: 'Juan Pérez', email: 'juan@cliente.com' }];
  assert.equal(resolverDueño({ dueño: 'Ju', esMio: false }, YO, cal).dueñoEmail, '');
});

test('un email inventado (que no estuvo en la reunión) se descarta', () => {
  const r = resolverDueño({ dueño: 'Alguien', dueñoEmail: 'random@nadie.com', esMio: false }, YO, PARTICIPANTES);
  assert.equal(r.dueñoEmail, '');
});

// ⚠️ ESTE TEST ESTÁ INVERTIDO A PROPÓSITO (12/8/2026). Decía «si el modelo dice
// esMio:true, es mía y no se discute» y afirmaba `esDeOtro === false`: o sea codificaba
// el bug como si fuera la regla. Un `esMio` es un token que el modelo tira sin pensar;
// el email de un invitado REAL de la reunión es lo más caro de producir que hay acá, y
// AGENTS.md ya dice que ante dos señales que se contradicen gana la más cara.
test('el email de un invitado real le GANA a esMio:true — el flag ya no se lleva la tarea de otro', () => {
  const r = resolverDueño({ dueño: 'Francisco Hugo Di Giorno', dueñoEmail: 'fran@ejemplo.com', esMio: true }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, true);
  assert.equal(r.dueñoEmail, 'fran@ejemplo.com');
  // Y no se decide en silencio: la contradicción viaja hasta la fila.
  assert.equal(r.atribucionDudosa, true);
});

test('EL CASO REAL DEL 12/8: la tarea de Mauricio es de Mauricio, diga lo que diga el flag', () => {
  // 26 de las 37 tareas de «Mau <> Martin: CUSTOMER SUCCESS». Acá `resolverDueño` ya
  // acertaba —lo que las perdió fue el gate de reunion-auto—, pero el mismo input con
  // el flag en true habría entrado igual al tablero del dueño. Las dos puertas cerradas.
  const conMau = [...PARTICIPANTES, { nombre: 'Mauricio Bustos Eguia', email: 'mbustos@elevate.com.mx' }];
  for (const esMio of [true, false, undefined]) {
    const r = resolverDueño({ dueño: 'Mauricio Bustos Eguia', dueñoEmail: 'mbustos@elevate.com.mx', esMio }, YO, conMau);
    assert.equal(r.esDeOtro, true, `con esMio=${String(esMio)} la tarea de Mau quedó como del dueño`);
    assert.equal(r.dueñoEmail, 'mbustos@elevate.com.mx');
  }
});

test('esMio:true SIGUE mandando cuando no hay email que lo contradiga', () => {
  // No se volvió «nunca le creo al modelo»: hay tareas legítimamente del dueño que el
  // modelo atribuye a alguien que nombró de paso, y sin email duro el flag es lo único
  // que hay. Solo pierde contra evidencia, no contra el silencio.
  const r = resolverDueño({ dueño: 'Alguien Que No Estuvo', esMio: true }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
  assert.equal(r.atribucionDudosa, undefined);
});

test('y NO le gana al email cuando ese email soy yo: el apellido de Fathom sigue siendo mío', () => {
  // La regresión de julio, por la puerta nueva. «Martin Carballo» es el dueño con el
  // apellido de su cuenta de Fathom; si `otroPorEmail` no exigiera `!pareceMio`, este
  // arreglo le mandaría sus propias tareas a la tab de un desconocido.
  const r = resolverDueño({ dueño: 'Martin Carballo', dueñoEmail: 'martinkoncke@gmail.com', esMio: true }, YO, PARTICIPANTES);
  assert.equal(r.esDeOtro, false);
  assert.equal(r.dueñoEmail, '');
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
