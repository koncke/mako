// Tests de buildJourney (lib/journey.ts): la línea de tiempo del recorrido del lead.
// Función pura (solo depende de fmtDDMMYYYY). Blinda qué hitos aparecen y su estado
// según las fechas/asistencias. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJourney, type JourneyInput, type JourneyStep } from '../lib/journey';

const base = (p: Partial<JourneyInput> = {}): JourneyInput => ({
  createdISO: '2026-01-15', fechaAgenda: null, fechaJ1: null, asistioJ1: null,
  fechaJ2: null, asistioJ2: null, fechaConfirmacion: null, fechaPrimerPago: null,
  fechaCierre: null, estadoLead: 'abierto', monto: 0, hoyISO: '2026-02-01', ...p,
});
const byKey = (steps: JourneyStep[], k: string) => steps.find((s) => s.key === k);

test('buildJourney — primer paso siempre "form"/done con fecha dd/mm/aaaa', () => {
  const s = buildJourney(base());
  assert.equal(s[0].key, 'form');
  assert.equal(s[0].state, 'done');
  assert.equal(s[0].date, '15/01/2026');
});

test('buildJourney — lead abierto termina en "En proceso"/upcoming', () => {
  const s = buildJourney(base());
  const open = byKey(s, 'open')!;
  assert.equal(open.label, 'En proceso');
  assert.equal(open.state, 'upcoming');
  assert.equal(byKey(s, 'r1'), undefined); // sin datos de reunión, no hay R1
  assert.equal(byKey(s, 'r2'), undefined);
});

test('buildJourney — R1: asistió / no-show', () => {
  const asistio = byKey(buildJourney(base({ fechaJ1: '2026-01-20', asistioJ1: true })), 'r1')!;
  assert.equal(asistio.state, 'done');
  assert.equal(asistio.sub, 'Asistió');
  assert.equal(asistio.date, '20/01/2026');
  const noshow = byKey(buildJourney(base({ fechaJ1: '2026-01-20', asistioJ1: false })), 'r1')!;
  assert.equal(noshow.state, 'failed');
  assert.equal(noshow.sub, 'No-show');
});

test('buildJourney — R1 sin marcar: futura = "Agendada", pasada = "falta marcar"', () => {
  const futura = byKey(buildJourney(base({ fechaJ1: '2026-03-01', hoyISO: '2026-02-01' })), 'r1')!;
  assert.equal(futura.state, 'upcoming');
  assert.equal(futura.sub, 'Agendada');
  const pasada = byKey(buildJourney(base({ fechaJ1: '2026-01-10', hoyISO: '2026-02-01' })), 'r1')!;
  assert.equal(pasada.sub, 'Agendada · falta marcar asistencia');
});

test('buildJourney — R1 aparece por fechaAgenda; R2 solo si hay fechaJ2/asistioJ2', () => {
  assert.ok(byKey(buildJourney(base({ fechaAgenda: '2026-01-20' })), 'r1'), 'r1 debe aparecer por fechaAgenda');
  assert.equal(byKey(buildJourney(base({})), 'r2'), undefined);
  assert.ok(byKey(buildJourney(base({ fechaJ2: '2026-02-10' })), 'r2'), 'r2 debe aparecer con fechaJ2');
  assert.ok(byKey(buildJourney(base({ asistioJ2: false })), 'r2'), 'r2 debe aparecer con asistioJ2 marcado');
});

test('buildJourney — conf y pago solo si vienen sus fechas', () => {
  const s = buildJourney(base({ fechaConfirmacion: '2026-02-05', fechaPrimerPago: '2026-02-06' }));
  assert.equal(byKey(s, 'conf')!.state, 'done');
  assert.equal(byKey(s, 'pago')!.date, '06/02/2026');
  assert.equal(byKey(buildJourney(base({})), 'conf'), undefined);
});

test('buildJourney — cierre ganado con monto formateado; monto 0 → sin sub', () => {
  const conMonto = byKey(buildJourney(base({ estadoLead: 'ganado', monto: 1000, fechaCierre: '2026-02-08' })), 'cierre')!;
  assert.equal(conMonto.label, 'Cierre ganado');
  assert.equal(conMonto.state, 'done');
  assert.equal(conMonto.sub, '$1,000');
  const sinMonto = byKey(buildJourney(base({ estadoLead: 'ganado', monto: 0 })), 'cierre')!;
  assert.equal(sinMonto.sub, undefined);
});

test('buildJourney — perdido / descalificado → state lost', () => {
  assert.equal(byKey(buildJourney(base({ estadoLead: 'perdido' })), 'cierre')!.state, 'lost');
  assert.equal(byKey(buildJourney(base({ estadoLead: 'descalificado' })), 'cierre')!.state, 'lost');
});
