// Tests de las funciones PURAS del funnel (lib/pipeline.ts). Blindan el
// comportamiento con el funnel default Y con funnels custom (venta directa / VSL),
// que es donde un CRM por-cliente se rompe. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFunnel, deriveStageKey, pipelineStageOf, terminalEstadoFor, nutricionPositivaDe,
  DEFAULT_PIPELINE, FUNNEL_TEMPLATES, NUTRI_KEYS,
  type StageDerivable,
} from '../lib/pipeline';

// Lead mínimo para deriveStageKey (todos los campos, defaults en null).
const L = (p: Partial<StageDerivable>): StageDerivable => ({
  estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null,
  fecha_junta_2: null, asistio_j1: null, asistio_j2: null, nutricion_realizada: false, ...p,
});

test('deriveStageKey — desenlaces terminales', () => {
  assert.equal(deriveStageKey(L({ estado_lead: 'ganado' })), 'ganado');
  assert.equal(deriveStageKey(L({ estado_lead: 'perdido' })), 'perdido');
  assert.equal(deriveStageKey(L({ estado_lead: 'descalificado' })), 'descal');
  assert.equal(deriveStageKey(L({ estado_lead: 'no_responde' })), 'noresp');
});

test('deriveStageKey — abierto según fechas/asistencias', () => {
  assert.equal(deriveStageKey(L({})), 'lead');
  assert.equal(deriveStageKey(L({ nutricion_realizada: true })), 'nutri');
  assert.equal(deriveStageKey(L({ fecha_agenda: '2026-01-01' })), 'agenda');
  assert.equal(deriveStageKey(L({ asistio_j1: false })), 'noshow_r1');
  assert.equal(deriveStageKey(L({ fecha_junta_2: '2026-02-01' })), 'agendaj2');
  assert.equal(deriveStageKey(L({ fecha_junta_2: '2026-02-01', asistio_j2: true })), 'facturando');
  assert.equal(deriveStageKey(L({ fecha_junta_2: '2026-02-01', asistio_j2: false })), 'noshow_r2');
});

test('pipelineStageOf — override manual gana a la derivación', () => {
  assert.equal(pipelineStageOf(L({ pipeline_stage: 'manual', fecha_agenda: '2026-01-01' })), 'manual');
  assert.equal(pipelineStageOf(L({ pipeline_stage: null, fecha_agenda: '2026-01-01' })), 'agenda');
});

test('terminalEstadoFor — mapa etapa → estado', () => {
  assert.equal(terminalEstadoFor('ganado'), 'ganado');
  assert.equal(terminalEstadoFor('perdido'), 'perdido');
  assert.equal(terminalEstadoFor('descal'), 'descalificado');
  assert.equal(terminalEstadoFor('noresp'), 'no_responde');
  assert.equal(terminalEstadoFor('reactivacion'), 'abierto');
  assert.equal(terminalEstadoFor('nutri'), 'abierto');
  assert.equal(terminalEstadoFor('agenda'), 'abierto');
});

test('nutricionPositivaDe — ventanas post-agenda / post-reunión', () => {
  // Post-agenda: R1 futura sin marcar.
  const pa = nutricionPositivaDe(L({ fecha_junta_1: '2026-07-10' }), '2026-07-05');
  assert.equal(pa?.tipo, 'post-agenda');
  assert.equal(pa?.hasta, '2026-07-10');
  // Post-reunión: asistió R1, R2 futura sin marcar.
  const pr = nutricionPositivaDe(L({ asistio_j1: true, fecha_junta_2: '2026-07-12' }), '2026-07-05');
  assert.equal(pr?.tipo, 'post-reunion');
  // Sin reunión futura → null.
  assert.equal(nutricionPositivaDe(L({}), '2026-07-05'), null);
  // Lead cerrado → null.
  assert.equal(nutricionPositivaDe(L({ estado_lead: 'ganado', fecha_junta_1: '2026-07-10' }), '2026-07-05'), null);
});

test('generateFunnel — default high-ticket: etapas y transiciones esperadas', () => {
  const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE, []);
  const keys = new Set(stages.map((s) => s.key));
  for (const k of ['lead', 'agenda', 'agendaj2', 'facturando', 'ganado', 'nutri', 'noshow_r1', 'noshow_r2', 'nopaga', 'perdido', 'descal', 'noresp', 'reactivacion']) {
    assert.ok(keys.has(k), `falta la etapa ${k}`);
  }
  // Reactivación: entra desde noresp/perdido, sale reagendando a la 1ª reunión.
  assert.ok(transitions.some((t) => t.to === 'reactivacion' && (t.from === 'noresp' || t.from === 'perdido')));
  assert.ok(transitions.some((t) => t.from === 'reactivacion' && t.to === 'agenda'));
});

test('generateFunnel — suprimir una nutrición la quita', () => {
  const { stages } = generateFunnel(DEFAULT_PIPELINE, ['noresp>reactivacion', 'perdido>reactivacion']);
  assert.ok(!stages.some((s) => s.key === 'reactivacion'));
});

test('generateFunnel — funnel "venta directa" (sin reunión) no rompe', () => {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === 'directa')!;
  const { stages, transitions } = generateFunnel(tpl.pipeline, []);
  const keys = new Set(stages.map((s) => s.key));
  // Tiene pago + cierre + nutrición de No Paga; NO tiene etapas de reunión.
  assert.ok(keys.has('facturando') && keys.has('ganado') && keys.has('nopaga'));
  assert.ok(!keys.has('noshow_r1') && !keys.has('agendaj2'));
  // Todas las transiciones apuntan a etapas que existen (no cuelgan).
  for (const t of transitions) {
    assert.ok(keys.has(t.from), `transición desde etapa inexistente: ${t.from}`);
    assert.ok(keys.has(t.to), `transición hacia etapa inexistente: ${t.to}`);
  }
});

test('generateFunnel — funnel "VSL + Webinar" produce grupo/webinar/checkout', () => {
  const tpl = FUNNEL_TEMPLATES.find((t) => t.id === 'vsl')!;
  const { stages } = generateFunnel(tpl.pipeline, []);
  const keys = new Set(stages.map((s) => s.key));
  for (const k of ['registro', 'grupo', 'webinar', 'checkout', 'ganado']) assert.ok(keys.has(k), `falta ${k}`);
});

test('NUTRI_KEYS incluye reactivacion (etapa de nutrición negativa)', () => {
  assert.ok(NUTRI_KEYS.includes('reactivacion'));
});
