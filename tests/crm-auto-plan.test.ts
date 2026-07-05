// Tests del planificador PURO del CRM automático (lib/crm-auto-plan.ts): las
// reglas T1/T2/T3/T6 que deciden cuándo MaKo mueve un lead solo. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLeadAuto, type AutoLead } from '../lib/crm-auto-plan';

const HOY = '2026-07-05';
const NOW = Date.parse('2026-07-05T20:00:00Z'); // 20:00 UTC del "hoy"

const AL = (p: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead Test', estado_lead: 'abierto', pipeline_stage: null,
  fecha_agenda: null, fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, nutricion_realizada: false, nutricion_manual_deadline: null,
  created_at: '2026-07-05T00:00:00Z', updated_at: null, ...p,
});
const reglas = (l: AutoLead) => planLeadAuto(l, HOY, NOW).map((a) => a.regla);

test('T2 — lead estancado en instant form sin agendar (>= 2 días)', () => {
  assert.deepEqual(reglas(AL({ created_at: '2026-07-01T00:00:00Z' })), ['T2']);
  // Recién llegado (< 2 días) → no dispara.
  assert.deepEqual(reglas(AL({ created_at: '2026-07-04T00:00:00Z' })), []);
});

test('T1 — reunión pasada por FECHA (lead viejo sin hora)', () => {
  const acc = planLeadAuto(AL({ fecha_junta_1: '2026-07-03' }), HOY, NOW);
  assert.equal(acc.length, 1);
  assert.equal(acc[0].regla, 'T1');
  assert.equal(acc[0].which, 'j1');
  // Reunión de hoy (no pasó el día) → todavía no dispara.
  assert.deepEqual(reglas(AL({ fecha_junta_1: '2026-07-05' })), []);
});

test('T1 — precisión por HORA (junta_1_at): 3 h exactas', () => {
  // Reunión hace 5 h → ya pasaron las 3 h → dispara.
  assert.deepEqual(reglas(AL({ junta_1_at: '2026-07-05T15:00:00Z', fecha_junta_1: '2026-07-05' })), ['T1']);
  // Reunión hace 2 h → todavía no pasaron las 3 h → NO dispara (aunque sea el mismo día).
  assert.deepEqual(reglas(AL({ junta_1_at: '2026-07-05T18:00:00Z', fecha_junta_1: '2026-07-05' })), []);
});

test('T1 — R2: solo tras asistir R1 y con R2 pasada', () => {
  const acc = planLeadAuto(AL({ asistio_j1: true, fecha_junta_2: '2026-07-03' }), HOY, NOW);
  assert.equal(acc.length, 1);
  assert.equal(acc[0].which, 'j2');
});

test('T3 — nutrición manual vencida', () => {
  assert.deepEqual(reglas(AL({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-07-01' })), ['T3']);
  // Deadline en el futuro → no dispara.
  assert.deepEqual(reglas(AL({ pipeline_stage: 'manual', nutricion_manual_deadline: '2026-07-10' })), []);
});

test('T6 — reactivación de fríos (>= 30 días enfriado)', () => {
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', updated_at: '2026-05-01T00:00:00Z' })), ['T6']);
  assert.deepEqual(reglas(AL({ estado_lead: 'perdido', updated_at: '2026-05-01T00:00:00Z' })), ['T6']);
  // Ya está en reactivación → no re-dispara.
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', pipeline_stage: 'reactivacion', updated_at: '2026-05-01T00:00:00Z' })), []);
  // Recién enfriado (< 30 días) → no dispara.
  assert.deepEqual(reglas(AL({ estado_lead: 'no_responde', updated_at: '2026-07-01T00:00:00Z' })), []);
});

test('sin acciones para un lead sano en curso', () => {
  // Asistió R1, R2 futura sin marcar → nada que hacer (está en ventana positiva).
  assert.deepEqual(reglas(AL({ asistio_j1: true, fecha_junta_1: '2026-07-01', fecha_junta_2: '2026-07-10' })), []);
});

test('T2 no dispara si ya agendó (tiene fecha_agenda)', () => {
  assert.deepEqual(reglas(AL({ fecha_agenda: '2026-07-05', created_at: '2026-07-01T00:00:00Z' })), []);
});
