// =============================================================================
// El tope del plan en Web Generator (lib/editor-landing/tope-landings.ts): publicar y conectar un dominio
// =============================================================================
// Pedido del Cerebro (23/10/2026) y regla de AGENTS.md («Hacer cumplir un tope del plan»): sólo a quien MaKo le cobra
// por la pasarela, nunca al ws1 ni al ws de la plataforma, sólo a lo NUEVO (republicar o re-verificar no suma).
// Esencial (`completo`): 3 landings publicadas y 1 dominio; Pro (`agencia`): sin tope.
// Probado rompiéndolo (23/10/2026): sin el `p.yaCuenta` del atajo, falla 1 de 5 («republicar no suma»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topeParaDominio, topeParaPublicar } from '../lib/editor-landing/tope-landings';
import { textoTope } from '../lib/topes-plan';

const base = { ws: 42, wsPlataforma: 9, capa: 'completo', cobradoPorPasarela: true, usadas: 0, yaCuenta: false };

test('Esencial: la cuarta landing publicada no entra, con el cartel del tope', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 2 }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 3 }), { ok: false, tope: 3, texto: textoTope(3) });
});

test('republicar no suma (la landing ya está publicada)', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 3, yaCuenta: true }), { ok: true });
});

test('Esencial: un dominio; el segundo no entra', () => {
  assert.deepEqual(topeParaDominio({ ...base, usadas: 0 }), { ok: true });
  assert.equal(topeParaDominio({ ...base, usadas: 1 }).ok, false);
});

test('Pro no tiene tope', () => {
  assert.deepEqual(topeParaPublicar({ ...base, capa: 'agencia', usadas: 50 }), { ok: true });
  assert.deepEqual(topeParaDominio({ ...base, capa: 'agencia', usadas: 50 }), { ok: true });
});

test('sin cobro por la pasarela, el ws1 y la plataforma: nunca', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, cobradoPorPasarela: false }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, ws: 1 }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, ws: 9 }), { ok: true });
});
