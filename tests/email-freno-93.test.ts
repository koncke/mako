// =============================================================================
// Ticket #93 (13/11/2026): el freno apagó el email de Mauricio —su único seguimiento de dos CRMs— por «5 de 100»
// =============================================================================
// Medido ese día en la base: a las 15:09:31 UTC el freno vio, de los últimos 100 enviados, 5 rebotes (5,0 %) y apagó. En
// los últimos 300 había 11 (3,7 %), y ninguna ventana de 300 de toda la campaña (1.030 enviados, 28 rebotes, 2,7 %) pasó de
// 3,7 %. Su lista «Fríos» rebota entre 2,7 % y 4,2 % por día: con 100 de muestra, el 5 % sale por azar. Ahora mira 300,
// avisa desde 5 % y apaga desde 10 % (lib/email-freno.ts).
// Correr: node --import tsx --test tests/email-freno-93.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conteoDeLosUltimos, decidirFrenoEmail, FRENO_EMAIL, type EnvioParaFreno } from '../lib/email-freno';

// Los 300 envíos de antes del corte, el más nuevo primero (un minuto entre cada uno), con 11 rebotes: 5 en los últimos 100.
const CORTE = Date.parse('2026-11-13T15:09:31Z');
const REBOTES = new Set([2, 19, 41, 63, 88, 121, 158, 190, 222, 251, 287]);
const filas: EnvioParaFreno[] = Array.from({ length: 300 }, (_, i) => {
  const t = new Date(CORTE - (i + 1) * 60_000).toISOString();
  return { created_at: t, rebotado_at: REBOTES.has(i) ? t : null, queja_at: null };
});

test('#93: con los números del 13/11, la regla de antes apagaba y la de ahora no apaga ni avisa', () => {
  // Lo que vio el freno de antes: los últimos 100, con 5 rebotes = 5 %, y su umbral era 5 %.
  const cien = conteoDeLosUltimos(filas, 100);
  assert.deepEqual(cien, { enviados: 100, rebotes: 5, quejas: 0 });
  assert.ok(cien.rebotes / cien.enviados >= 0.05, 'con la regla de antes, esto apagaba el email');
  // Lo de ahora: los últimos 300, 11 rebotes = 3,7 %.
  const c = conteoDeLosUltimos(filas);
  assert.deepEqual(c, { enviados: 300, rebotes: 11, quejas: 0 });
  assert.deepEqual(decidirFrenoEmail(c), { frena: false }, 'ni apaga ni avisa');
});

test('#93: la regla nueva — 300 de muestra desde 100 enviados, avisa desde 5 %, apaga desde 10 % o 0,3 % de quejas', () => {
  assert.equal(FRENO_EMAIL.ultimos, 300);
  assert.equal(FRENO_EMAIL.minimoEnviados, 100);
  assert.equal(FRENO_EMAIL.rebotesAviso, 0.05);
  assert.equal(FRENO_EMAIL.rebotes, 0.1);
  assert.equal(FRENO_EMAIL.quejas, 0.003, 'las quejas siguen igual: castigan más que un rebote');
  // El 5 % avisa y el envío sigue.
  const aviso = decidirFrenoEmail({ enviados: 300, rebotes: 16, quejas: 0 });
  assert.equal(aviso.frena, false);
  assert.equal(!aviso.frena && aviso.avisa, 'rebotes');
  // El 10 % apaga.
  const apaga = decidirFrenoEmail({ enviados: 300, rebotes: 30, quejas: 0 });
  assert.equal(apaga.frena && apaga.motivo, 'rebotes');
  // Una queja en 300 (0,33 %) apaga.
  const queja = decidirFrenoEmail({ enviados: 300, rebotes: 0, quejas: 1 });
  assert.equal(queja.frena && queja.motivo, 'quejas');
});
