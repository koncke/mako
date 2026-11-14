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
import { RUTA_CAMBIAR_PLAN, TOPES, cabeOtra, topeDe } from '../lib/topes-plan';

test('los números de la oferta: Esencial con topes, Pro sin ellos salvo 3 líneas y 5 usuarios', () => {
  assert.deepEqual(TOPES.completo, {
    // 14/11/2026 (Martín): 2 automatizaciones activas (eran 3), 1 landing publicada (eran 3) y SIN dominio propio (era 1).
    'crm.funnels': 1, 'crm.leads': 2000, 'chats.lineas_whatsapp': 1, 'automations.activas': 2,
    'web.landings_publicadas': 1, 'web.dominios': 0, 'cobros.cuentas': 1, 'equipo.usuarios': 1,
    // 25/10/2026: el media buyer de Esencial propone 2 recomendaciones por día (el Cerebro).
    'ads.recomendaciones_dia': 2,
    // 14/11/2026: 1 competidor en Competitor Spy y 1 curso en Classroom.
    'spy.competidores': 1, 'classroom.cursos': 1,
  });
  assert.equal(topeDe('agencia', 'crm.leads'), null);
  assert.equal(topeDe('agencia', 'ads.recomendaciones_dia'), null);
  assert.equal(topeDe('agencia', 'chats.lineas_whatsapp'), 3);
  assert.equal(topeDe('agencia', 'equipo.usuarios'), 5);
});

test('hasta el tope se puede crear; una más, no', () => {
  assert.equal(cabeOtra('completo', 'automations.activas', 1), true);
  assert.equal(cabeOtra('completo', 'automations.activas', 2), false);
  // Un tope en 0 es «no lo trae»: ni el primero (el dominio propio de Esencial, 14/11/2026).
  assert.equal(cabeOtra('completo', 'web.dominios', 0), false);
  assert.equal(cabeOtra('agencia', 'automations.activas', 999), true);
});

test('una capa que no es un plan (pm, superadmin) no tiene topes', () => {
  assert.equal(topeDe('pm', 'crm.leads'), null);
  assert.equal(topeDe('superadmin', 'equipo.usuarios'), null);
  assert.equal(cabeOtra('superadmin', 'equipo.usuarios', 50), true);
});

test('«Pasar a Pro» tiene UNA ruta: «Tu plan»', () => {
  assert.equal(RUTA_CAMBIAR_PLAN, '/configuraciones/plan');
});
