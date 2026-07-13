// Tests de los helpers de fecha en zona Tijuana (lib/date-utils.ts). Blindan la
// lógica de timezone que alimenta crons, cohortes y el auto-plan del CRM — bugs
// silenciosos de TZ mueven los números. Deterministas: pasan Date fijas.
// Enero = PST (UTC-8) sin ambigüedad de DST. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hoyEnTijuana, ayerEnTijuana, diasAntes, esFechaValida,
  lunesDeFecha, primerDiaDelMesDeFecha, finDeMesDeFecha, fmtDDMMYYYY,
} from '../lib/date-utils';

test('hoyEnTijuana — convierte el instante UTC al día calendario de Tijuana', () => {
  // 12:00 UTC del 15 = 04:00 en TJ (UTC-8) → sigue siendo el 15
  assert.equal(hoyEnTijuana(new Date('2026-01-15T12:00:00Z')), '2026-01-15');
  // 03:00 UTC del 15 = 19:00 del 14 en TJ → cae al día anterior
  assert.equal(hoyEnTijuana(new Date('2026-01-15T03:00:00Z')), '2026-01-14');
});

test('ayerEnTijuana — el día anterior al de TJ', () => {
  assert.equal(ayerEnTijuana(new Date('2026-01-15T12:00:00Z')), '2026-01-14');
});

test('diasAntes — resta días cruzando mes y año', () => {
  assert.equal(diasAntes('2026-03-01', 1), '2026-02-28');   // 2026 no bisiesto
  assert.equal(diasAntes('2024-03-01', 1), '2024-02-29');   // 2024 bisiesto
  assert.equal(diasAntes('2026-01-01', 1), '2025-12-31');   // cruce de año
  assert.equal(diasAntes('2026-07-10', 0), '2026-07-10');
});

test('esFechaValida — acepta fechas reales, rechaza formato/valores inválidos', () => {
  assert.equal(esFechaValida('2026-01-15'), true);
  assert.equal(esFechaValida('2026-13-40'), false);   // mes/día imposibles
  assert.equal(esFechaValida('2026-02-30'), false);   // 30 de feb no existe
  assert.equal(esFechaValida('2026-1-5'), false);     // sin zero-pad
  assert.equal(esFechaValida('hoy'), false);
});

test('lunesDeFecha — lunes de la semana (jueves → lunes previo; lunes → mismo)', () => {
  // 2026-01-15 es jueves → su lunes es 2026-01-12
  assert.equal(lunesDeFecha('2026-01-15'), '2026-01-12');
  assert.equal(lunesDeFecha('2026-01-12'), '2026-01-12'); // ya es lunes
  assert.equal(lunesDeFecha('2026-01-18'), '2026-01-12'); // domingo → lunes de ESA semana
});

test('primerDiaDelMesDeFecha / finDeMesDeFecha — bordes de mes', () => {
  assert.equal(primerDiaDelMesDeFecha('2026-07-19'), '2026-07-01');
  assert.equal(finDeMesDeFecha('2026-02-10'), '2026-02-28'); // feb no bisiesto
  assert.equal(finDeMesDeFecha('2024-02-10'), '2024-02-29'); // feb bisiesto
  assert.equal(finDeMesDeFecha('2026-12-05'), '2026-12-31'); // cruce de año interno
});

test('fmtDDMMYYYY — dd/mm/aaaa, guion si es nula/ inválida', () => {
  assert.equal(fmtDDMMYYYY('2026-07-19'), '19/07/2026');
  assert.equal(fmtDDMMYYYY('2026-07-19T10:00:00Z'), '19/07/2026');
  assert.equal(fmtDDMMYYYY(null), '—');
  assert.equal(fmtDDMMYYYY(''), '—');
});
