// La frontera de aislamiento del token de agenda: EN QUÉ WORKSPACE se escribe el
// refresh_token de Google de alguien. Antes de abrir el flujo a los clientes esto
// no se podía equivocar (era owner-only y siempre caía al ws1); ahora decide entre
// inquilinos, y por eso tiene test — el guard vivo es lo único que separa
// «conectar mi agenda» de «escribirla en el workspace de otro».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { armarEstadoGcal, destinoGcal, leerEstadoGcal, puedeEscribirAgenda } from '../lib/gcal-estado';

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

// ── 14/10/2026: el OAuth vuelve a la PANTALLA DE LA QUE SALIÓ ─────────────────────────────────────────────────────
// Martín: «para una integración jamás se debe salir de la tab». El modal de Google se abre en cualquier tab y el
// callback volvía siempre a /integraciones. Ahora vuelve a `gcal_volver`, saneado con la MISMA defensa del OAuth de Meta.
// Probado rompiéndolo (base en verde): ver los números al final del reporte de cada rotura, abajo de cada test.

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

// Rotura: `destinoGcal` devolviendo siempre '/integraciones?gcal=…' → 1 fallo.
test('vuelve a la tab de la que salió, con el resultado, y nunca a otro sitio', () => {
  assert.equal(destinoGcal('/calendario?vista=mes&fecha=2026-10-14', 'ok'), '/calendario?vista=mes&fecha=2026-10-14&gcal=ok');
  // El `?ws=` lo pone el callback (con el workspace que autorizó el paso 1), y un resultado viejo no se arrastra.
  assert.equal(destinoGcal('/calendario?ws=13&gcal=csrf', 'ok'), '/calendario?gcal=ok');
  // Sin cookie, o con un destino que no es de esta app: /integraciones, como siempre.
  for (const malo of [null, undefined, '', 'https://evil.tld/x', '//evil.tld/x', '/\\evil.tld']) {
    assert.equal(destinoGcal(malo, 'exchange'), '/integraciones?gcal=exchange', `dejó pasar ${String(malo)}`);
  }
});

// Rotura: el callback con el destino fijo (`destinoGcal(null, motivo)`) → 1 fallo; el modal sin `?volver=` → 1 fallo.
test('el paso 1 guarda a dónde volver, el callback lo usa y lo borra, y el modal lo manda', () => {
  const paso1 = leer('app/api/integraciones/google-calendar/route.ts');
  assert.match(paso1, /res\.cookies\.set\(\{ name: 'gcal_volver', value: volverSeguro\(volver\),/);
  const cb = leer('app/api/integraciones/google-calendar/callback/route.ts');
  assert.match(cb, /const volver = req\.cookies\.get\('gcal_volver'\)\?\.value \?\? null;/);
  assert.match(cb, /const destino = destinoGcal\(volver, motivo\);/);
  assert.match(cb, /res\.cookies\.set\(\{ name: 'gcal_volver', value: '', maxAge: 0, path: '\/' \}\);/);
  const modal = leer('app/integraciones/IntegracionesBoard.tsx');
  assert.match(modal, /const volver = volverDeLaPestana\(window\.location\.pathname, window\.location\.search\);\n\s+window\.location\.href = conWs\(`\/api\/integraciones\/google-calendar\?volver=\$\{encodeURIComponent\(volver\)\}`, wsPestana\);/);
});
