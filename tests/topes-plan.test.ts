// =============================================================================
// Los topes de cada plan de MaKo (docs/ofertas-mako.md, 23/10/2026): la tabla que leen las áreas
// =============================================================================
// Esencial (capa `completo`) y Pro (capa `agencia`) se diferencian por TOPES. Lo que se fija: los números de la oferta,
// que una capa que no es un plan no tiene topes, y que `cabeOtra` deja crear hasta el tope y no una más.
//
// Probado rompiéndolo (23/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · el Esencial con 3 funnels en vez de 1                               -> 2 / 1
//   · `cabeOtra` con `<=` (deja crear una más que el tope)                -> 2 / 1
//   · `topeDe` devuelve 0 para una capa que no es un plan                 -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPES, cabeOtra, topeDe } from '../lib/topes-plan';

test('los números de la oferta: Esencial con topes, Pro sin ellos salvo 3 líneas y 5 usuarios', () => {
  assert.deepEqual(TOPES.completo, {
    'crm.funnels': 1, 'crm.leads': 2000, 'chats.lineas_whatsapp': 1, 'automations.activas': 3,
    'web.landings_publicadas': 3, 'web.dominios': 1, 'cobros.cuentas': 1, 'equipo.usuarios': 1,
  });
  assert.equal(topeDe('agencia', 'crm.leads'), null);
  assert.equal(topeDe('agencia', 'chats.lineas_whatsapp'), 3);
  assert.equal(topeDe('agencia', 'equipo.usuarios'), 5);
});

test('hasta el tope se puede crear; una más, no', () => {
  assert.equal(cabeOtra('completo', 'automations.activas', 2), true);
  assert.equal(cabeOtra('completo', 'automations.activas', 3), false);
  assert.equal(cabeOtra('agencia', 'automations.activas', 999), true);
});

test('una capa que no es un plan (pm, superadmin) no tiene topes', () => {
  assert.equal(topeDe('pm', 'crm.leads'), null);
  assert.equal(topeDe('superadmin', 'equipo.usuarios'), null);
  assert.equal(cabeOtra('superadmin', 'equipo.usuarios', 50), true);
});
