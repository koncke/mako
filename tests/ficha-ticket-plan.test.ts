// =============================================================================
// La ficha de un ticket dice el PLAN que se vende, no la capa (12/11/2026, después del ticket #89)
// =============================================================================
// #89 llegó con «negocio «Sellers» (ws 24) · plan Completo», y se leyó como «un plan completo con tope 1». Completo es la
// CAPA: la capa `completo` es MaKo Esencial (1 usuario) y la `agencia`, Pro. Pero la misma capa la tienen el ws1 y los
// acuerdos a mano, que no pagan un plan ni tienen topes: lo que separa es si se le aplican los topes (`aplicanTopes`).
// Correr: node --import tsx --test tests/ficha-ticket-plan.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planDeLaFicha } from '../lib/tickets-reglas';
import { CAPA_DE_PLAN } from '../lib/agencia-cobro-reglas';

const fuente = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. con los topes de su plan: Esencial o Pro, como se vende', () => {
  // Sellers el 12/11: capa `completo`, Esencial elegido por su agencia.
  assert.equal(planDeLaFicha({ capa: 'completo', nombreCapa: 'Completo', rige: true }), 'Esencial');
  assert.equal(planDeLaFicha({ capa: 'agencia', nombreCapa: 'Agencia', rige: true }), 'Pro');
  // La misma tabla que usa la agencia para abrir y cambiar planes.
  assert.equal(CAPA_DE_PLAN.esencial, 'completo');
  assert.equal(CAPA_DE_PLAN.pro, 'agencia');
});

test('2. sin topes (ws1, un acuerdo a mano) no es Esencial aunque tenga la capa; sin leer, se dice', () => {
  const ws1 = planDeLaFicha({ capa: 'completo', nombreCapa: 'Completo', rige: false });
  assert.doesNotMatch(ws1, /Esencial|Pro/);
  assert.match(ws1, /sin cobro de MaKo, sin topes \(capa Completo\)/);
  assert.equal(planDeLaFicha({ capa: 'completo', nombreCapa: 'Completo', rige: null }), '? (capa Completo)');
  // Una capa que no es un plan (Project Manager, SuperAdmin): su nombre.
  assert.equal(planDeLaFicha({ capa: 'pm', nombreCapa: 'Project Manager', rige: null }), 'Project Manager');
});

test('3. la ficha lo lee así en los dos caminos (la app y WhatsApp), con los topes en import diferido', () => {
  const db = fuente('lib/tickets-db.ts');
  assert.match(db, /await import\('\.\/topes-plan-server'\)\.then\(\(m\) => m\.aplicanTopes\(ws\)\)\.catch\(\(\) => null\)/);
  assert.match(db, /return planDeLaFicha\(\{ capa, nombreCapa: capaDef\(capa\)\.nombre, rige \}\);/);
  assert.match(db, /const \[agencia, plan\] = await Promise\.all\(\[administraUnaAgencia\(u\), planDelNegocio\(ws, /);
  assert.match(db, /const plan = async \(\) => planDelNegocio\(ws, /);
  assert.doesNotMatch(db, /plan: w \? capaDef\(/, 'la capa como plan es lo que confundió el #89');
});
