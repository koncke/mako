// =============================================================================
// El token del puente vence si deja de usarse
// =============================================================================
// El token del puente es un BEARER: sirve fuera del navegador, desde cualquier
// lado, y no lo mata cerrar sesión — eso último es a propósito, porque el puente
// tiene que trabajar mientras la persona no está. Un secreto así, sin
// vencimiento, es válido para siempre desde el día que se filtra.
//
// El vencimiento es POR INACTIVIDAD y no absoluto, y esa diferencia es lo que lo
// hace aplicable: un puente que trabaja todos los días nunca se corta, así que
// esto no puede sorprender a nadie con el navegador andando; y un token que quedó
// copiado en algún lado muere solo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenVencido, VENCE_SIN_USO_DIAS } from '../lib/flow-protocolo';

const AHORA = Date.parse('2026-08-31T12:00:00Z');
const haceDias = (d: number) => new Date(AHORA - d * 24 * 3600_000).toISOString();

test('un puente que late todos los días NO vence nunca', () => {
  // Es la mitad que importa: el arreglo no puede cortarle el trabajo a nadie.
  assert.equal(tokenVencido(haceDias(0), haceDias(400), AHORA), false);
  assert.equal(tokenVencido(haceDias(1), haceDias(400), AHORA), false);
});

test('uno abandonado vence', () => {
  assert.equal(tokenVencido(haceDias(VENCE_SIN_USO_DIAS + 1), haceDias(400), AHORA), true);
});

test('manda el ÚLTIMO USO, no la antigüedad del token', () => {
  // Un token de hace un año que se usó ayer es un puente sano. Vencer por
  // antigüedad cortaría justo al cliente que más lo usa.
  assert.equal(tokenVencido(haceDias(1), haceDias(365), AHORA), false);
});

test('un token acuñado y NUNCA usado también muere', () => {
  // Sin esta rama quedaría un secreto vivo para siempre por una conexión que
  // nunca ocurrió — que es exactamente la forma de un token filtrado y guardado.
  assert.equal(tokenVencido(null, haceDias(VENCE_SIN_USO_DIAS + 1), AHORA), true);
  assert.equal(tokenVencido(undefined, haceDias(3), AHORA), false);
});

test('sin ninguna fecha NO se vence: abstenerse, no cortar', () => {
  // No saber cuándo se usó es una razón para no decidir, no para dejar a alguien
  // sin puente. Es la regla de la casa: «no puedo hacer X con este dato» no es
  // «este dato es falso».
  assert.equal(tokenVencido(null, null, AHORA), false);
  assert.equal(tokenVencido('no es una fecha', '', AHORA), false);
});

test('el borde: justo en el día no vence, un minuto después sí', () => {
  const justo = new Date(AHORA - VENCE_SIN_USO_DIAS * 24 * 3600_000).toISOString();
  assert.equal(tokenVencido(justo, null, AHORA), false);
  assert.equal(tokenVencido(justo, null, AHORA + 60_000), true);
});
