// La frontera de aislamiento del token de agenda: EN QUÉ WORKSPACE se escribe el
// refresh_token de Google de alguien. Antes de abrir el flujo a los clientes esto
// no se podía equivocar (era owner-only y siempre caía al ws1); ahora decide entre
// inquilinos, y por eso tiene test — el guard vivo es lo único que separa
// «conectar mi agenda» de «escribirla en el workspace de otro».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarEstadoGcal, leerEstadoGcal, puedeEscribirAgenda } from '../lib/gcal-estado';

test('el estado va y vuelve entero', () => {
  const e = leerEstadoGcal(armarEstadoGcal('abc123', 13));
  assert.deepEqual(e, { nonce: 'abc123', ws: 13 });
});

test('una cookie del formato VIEJO (sin .ws) no resuelve a ningún workspace', () => {
  // El caso real: quien arrancó el OAuth 10 min antes de un deploy. Tiene que
  // dar null y NO caer al workspace de la sesión — caer ahí es exactamente el
  // misrouting que este módulo cierra.
  assert.equal(leerEstadoGcal('abc123'), null);
});

test('sin cookie no hay destino', () => {
  assert.equal(leerEstadoGcal(''), null);
  assert.equal(leerEstadoGcal(null), null);
  assert.equal(leerEstadoGcal(undefined), null);
});

test('un workspace que no es un entero positivo no se acepta', () => {
  for (const malo of ['abc.0', 'abc.-1', 'abc.', 'abc.uno', 'abc.1.5', 'abc.NaN']) {
    assert.equal(leerEstadoGcal(malo), null, `debería rechazar "${malo}"`);
  }
});

test('una cookie con puntos de más se rechaza entera', () => {
  // El nonce es hex (crypto.randomBytes → toString('hex')), así que nunca trae
  // puntos: una cookie con dos es una cookie manoseada. Se corta por el PRIMER
  // punto y el resto tiene que ser el ws — "b.7" no lo es, y no se rescata nada.
  assert.equal(leerEstadoGcal('a.b.7'), null);
});

test('un cliente solo puede escribir en SU workspace', () => {
  assert.equal(puedeEscribirAgenda(false, 13, 13), true);
  // El corazón del asunto: el admin del ws13 apuntando al ws1 (Mauricio).
  assert.equal(puedeEscribirAgenda(false, 13, 1), false);
});

test('un cliente sin workspace resuelto no escribe en ningún lado', () => {
  // Fail-closed: caer a OWNER_WS acá escribiría adentro del workspace de
  // Mauricio, que es un CLIENTE y no la plataforma.
  assert.equal(puedeEscribirAgenda(false, null, 1), false);
  assert.equal(puedeEscribirAgenda(false, null, 13), false);
});

test('el super-admin de agencia escribe en cualquiera, incluso sin ws resuelto', () => {
  // En el callback NO hay `?ws=` ni pestaña que leer, así que su ws viene null
  // por estructura y no por sospecha: exigirle que resuelva lo rebotaría DESPUÉS
  // de que la persona ya le dio acceso a Google.
  assert.equal(puedeEscribirAgenda(true, null, 13), true);
  assert.equal(puedeEscribirAgenda(true, 9, 13), true);
});
