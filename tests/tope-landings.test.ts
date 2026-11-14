// =============================================================================
// El tope del plan en Web Generator (lib/editor-landing/tope-landings.ts): publicar y conectar un dominio
// =============================================================================
// Pedido del Cerebro (23/10/2026) y regla de AGENTS.md («Hacer cumplir un tope del plan»): sólo a quien MaKo le cobra
// por la pasarela, nunca al ws1 ni al ws de la plataforma, sólo a lo NUEVO (republicar o re-verificar no suma).
// Esencial (`completo`): 1 landing publicada y SIN dominio propio (14/11/2026, Martín: las landings de 3 a 1 y el dominio de
// 1 a 0; con 0 el texto dice que es de Pro, `TEXTO_DOMINIO_SOLO_PRO`); Pro (`agencia`): sin tope.
// Probado rompiéndolo (23/10/2026): sin el `p.yaCuenta` del atajo, falla 1 de 5 («republicar no suma»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXTO_DOMINIO_SOLO_PRO, topeParaDominio, topeParaPublicar } from '../lib/editor-landing/tope-landings';
import { textoTope } from '../lib/topes-plan';

const base = { ws: 42, wsPlataforma: 9, capa: 'completo', cobradoPorPasarela: true, usadas: 0, yaCuenta: false };

test('Esencial: la segunda landing publicada no entra, con el cartel del tope', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 0 }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 1 }), { ok: false, tope: 1, texto: textoTope(1) });
});

test('republicar no suma (la landing ya está publicada)', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 1, yaCuenta: true }), { ok: true });
});

test('Esencial: sin dominio propio, ni el primero; el texto dice que es de Pro', () => {
  assert.deepEqual(topeParaDominio({ ...base, usadas: 0 }), { ok: false, tope: 0, texto: TEXTO_DOMINIO_SOLO_PRO });
  assert.equal(topeParaDominio({ ...base, usadas: 1 }).ok, false);
  // La landing que YA tenía su dominio lo conserva (re-verificar o reconectar el mismo no suma).
  assert.deepEqual(topeParaDominio({ ...base, usadas: 1, yaCuenta: true }), { ok: true });
});

test('Pro no tiene tope', () => {
  assert.deepEqual(topeParaPublicar({ ...base, capa: 'agencia', usadas: 50 }), { ok: true });
  assert.deepEqual(topeParaDominio({ ...base, capa: 'agencia', usadas: 50 }), { ok: true });
});

test('sin cobro por la pasarela, el ws1 y la plataforma: nunca', () => {
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, cobradoPorPasarela: false }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, ws: 1 }), { ok: true });
  assert.deepEqual(topeParaPublicar({ ...base, usadas: 99, ws: 9 }), { ok: true });
  assert.deepEqual(topeParaDominio({ ...base, cobradoPorPasarela: false }), { ok: true });
});
