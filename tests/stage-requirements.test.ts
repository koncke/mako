// Tests del motor de requisitos "Datos sin marcar" (lib/stage-requirements.ts).
// Clave: probar que la info del funnel DEFAULT no cambia NADA (ws1 intacto) y que
// funnels de 1 reunión / sin reunión ya no piden datos imposibles. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepsForStage, funnelReqInfo, type StageReqValues } from '../lib/stage-requirements';
import { DEFAULT_PIPELINE, FUNNEL_TEMPLATES } from '../lib/pipeline';

const ids = (stage: string, v: StageReqValues) => stepsForStage(stage, v).map((s) => s.id);

test('funnelReqInfo — el funnel DEFAULT reproduce NIVEL exacto', () => {
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'agenda'), { nivel: 1, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'agendaj2'), { nivel: 3, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'facturando'), { nivel: 4, numReuniones: 2, esVenta: false });
  assert.deepEqual(funnelReqInfo(DEFAULT_PIPELINE, 'ganado'), { nivel: 5, numReuniones: 2, esVenta: true });
});

test('DEFAULT-IDENTICAL: pasar la info del funnel default no cambia los pasos', () => {
  const base: StageReqValues = { hoyISO: '2026-07-05', setter: null, empresa: null, telefono: null, closer: null };
  const lleno: StageReqValues = {
    ...base, fechaJ1: '2026-01-01', asistioJ1: true, calificado: true, hasFathomUrl: true,
    fechaJ2: '2026-02-01', asistioJ2: true, monto: 1000, setter: 'x', empresa: 'x', telefono: 'x', closer: 'x',
    dealServicioOk: true, dealPromesaOk: true, dealFiscalOk: true, dealFiscalDocOk: true, dealObligacionesOk: true,
  };
  for (const stage of ['agenda', 'agendaj2', 'facturando', 'ganado', 'nutri', 'manual', 'noshow_r1']) {
    for (const v of [base, lleno]) {
      const conFunnel = { ...v, ...funnelReqInfo(DEFAULT_PIPELINE, stage) };
      assert.deepEqual(stepsForStage(stage, conFunnel), stepsForStage(stage, v), `difiere en ${stage}`);
    }
  }
});

test('funnel "Simple · 1 reunión": ganado NO pide una R2 inexistente', () => {
  const simple = FUNNEL_TEMPLATES.find((t) => t.id === 'simple')!.pipeline;
  const info = funnelReqInfo(simple, 'ganado');
  assert.equal(info.numReuniones, 1);
  assert.equal(info.esVenta, true);
  const got = ids('ganado', { hoyISO: '2026-07-05', monto: null, ...info });
  assert.ok(!got.includes('fechaJ2') && !got.includes('asistenciaR2') && !got.includes('fathomR2'), 'no debe pedir R2');
  assert.ok(got.includes('fechaJ1'), 'sí pide R1');
  assert.ok(got.includes('monto'), 'sí pide monto de venta');
});

test('funnel "Venta directa · sin reunión": ganado solo pide datos de venta', () => {
  const directa = FUNNEL_TEMPLATES.find((t) => t.id === 'directa')!.pipeline;
  const info = funnelReqInfo(directa, 'ganado');
  assert.equal(info.numReuniones, 0);
  const got = ids('ganado', { hoyISO: '2026-07-05', monto: null, dealServicioOk: false, ...info });
  assert.ok(!got.includes('fechaJ1') && !got.includes('fechaJ2'), 'no pide ninguna reunión');
  assert.ok(got.includes('monto') && got.includes('dealServicio'), 'pide la venta');
});

test('funnel "VSL": el webinar (reunión) y el cierre validan lo suyo', () => {
  const vsl = FUNNEL_TEMPLATES.find((t) => t.id === 'vsl')!.pipeline;
  assert.equal(funnelReqInfo(vsl, 'webinar').numReuniones, 1);
  assert.equal(funnelReqInfo(vsl, 'ganado').esVenta, true);
  // checkout es 'pago' → no exige venta (el cierre sí).
  assert.equal(funnelReqInfo(vsl, 'checkout').esVenta, false);
});
