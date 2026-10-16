// Tests del motor de requisitos "Datos sin marcar" (lib/stage-requirements.ts).
// Clave: probar que la info del funnel DEFAULT no cambia NADA (ws1 intacto) y que
// funnels de 1 reunión / sin reunión ya no piden datos imposibles. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  // ⚠️ CAMBIADO A PROPÓSITO el 14/10/2026: el webinar y el checkout usan las claves canónicas
  // (`agenda` y `facturando`), renombradas. Con las viejas este test pasaba igual sobre claves que
  // el pipeline ya no tenía: preguntaba por una etapa que no existe.
  const vsl = FUNNEL_TEMPLATES.find((t) => t.id === 'vsl')!.pipeline;
  assert.equal(funnelReqInfo(vsl, 'agenda').numReuniones, 1);
  assert.equal(funnelReqInfo(vsl, 'ganado').esVenta, true);
  // checkout es 'pago' → no exige venta (el cierre sí).
  assert.equal(funnelReqInfo(vsl, 'facturando').esVenta, false);
  assert.equal(vsl.find((s) => s.key === 'facturando')?.label, 'Oferta / Checkout');
});

// ─────────────────────────────────────────────────────────────────────────────
// El motivo de una salida NO se hereda de la pérdida anterior
// ─────────────────────────────────────────────────────────────────────────────
// `motivo_perdida` es una sola columna y un lead se puede perder dos veces. El
// corte miraba solo "¿hay texto?", así que la segunda pérdida se registraba con
// el motivo de la primera. Lo que distingue los dos casos es el MOVIMIENTO
// (`etapaActual`), no el valor — y esa distinción tiene que dejar intacto al
// worklist "Completar datos", que evalúa la etapa ACTUAL y no manda origen.

test('salida — sin origen (Completar datos): el motivo cargado alcanza, NO repregunta', () => {
  // faltantesDeLead evalúa la etapa donde el lead YA está y no pasa etapaActual:
  // si acá pidiera el motivo, todo lead perdido quedaría pendiente para siempre.
  assert.deepEqual(ids('perdido', { motivo: 'Sin presupuesto' }), []);
  assert.deepEqual(ids('descal', { motivo: 'No es el perfil' }), []);
  // Y si de verdad no hay motivo, lo sigue pidiendo.
  assert.deepEqual(ids('perdido', { motivo: null }), ['motivo']);
  assert.deepEqual(ids('perdido', { motivo: '   ' }), ['motivo']);
});

test('salida — ENTRA ahora: el motivo viejo no cuenta, se repregunta', () => {
  const viejo = { motivo: 'Sin presupuesto (pérdida de marzo)' };
  // Drag del board / dropdown de la ficha / backstop del server: viene de otra etapa.
  assert.deepEqual(ids('perdido', { ...viejo, etapaActual: 'agenda' }), ['motivo']);
  assert.deepEqual(ids('perdido', { ...viejo, etapaActual: 'agendaj2' }), ['motivo']);
  // Cambiar de salida también es entrar: perdido → descalificado.
  assert.deepEqual(ids('descal', { ...viejo, etapaActual: 'perdido' }), ['motivo']);
});

test('salida — ENTRA ahora y ya contestó: no se pregunta dos veces', () => {
  // El wizard manda la respuesta en `motivoNuevo`; con eso el server valida OK
  // (si no, mover a Perdido sería imposible: pediría el motivo para siempre).
  assert.deepEqual(ids('perdido', { motivo: 'viejo', motivoNuevo: 'Eligió a la competencia', etapaActual: 'agenda' }), []);
  // …pero una respuesta vacía no lo da por contestado.
  assert.deepEqual(ids('perdido', { motivo: 'viejo', motivoNuevo: '  ', etapaActual: 'agenda' }), ['motivo']);
});

test('salida — YA estaba ahí: completar otra cosa no repregunta el motivo', () => {
  assert.deepEqual(ids('perdido', { motivo: 'Sin presupuesto', etapaActual: 'perdido' }), []);
  assert.deepEqual(ids('descal', { motivo: 'No es el perfil', etapaActual: 'descal' }), []);
  // Sigue pidiéndolo si nunca se cargó (el lead cayó a perdido por derivación).
  assert.deepEqual(ids('perdido', { motivo: null, etapaActual: 'perdido' }), ['motivo']);
});

test('salida — noresp no pide motivo, venga de donde venga', () => {
  assert.deepEqual(ids('noresp', { etapaActual: 'agenda' }), []);
  assert.deepEqual(ids('noresp', { motivo: null, etapaActual: 'perdido' }), []);
});

test('CABLEADO: valoresDeRequisitos manda origen y motivo por separado', () => {
  // La regla vive acá, pero solo se activa si el server le pasa los tres datos.
  // `valoresDeRequisitos` es la fuente única de los TRES caminos que sufrían el
  // bug (drag del board, dropdown de la ficha y el backstop de setLeadStageAction),
  // así que si alguien vuelve a fusionar el motivo en un solo campo, se repite.
  // Normalizado a \n: en Windows el archivo viene con CRLF y el corte por '\n}\n'
  // no encontraría el final de la función (se leería medio actions.ts de más).
  const src = readFileSync(new URL('../app/crm/actions.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = src.slice(src.indexOf('function valoresDeRequisitos'));
  const fn = cuerpo.slice(0, cuerpo.indexOf('\n}\n'));
  assert.ok(fn.includes('etapaActual:'), 'sin etapaActual el motivo viejo vuelve a heredarse');
  assert.ok(fn.includes('motivoNuevo:'), 'sin motivoNuevo el wizard pediría el motivo para siempre');
  assert.ok(!/motivo:\s*d\.motivo/.test(fn), 'el motivo aportado ahora no puede viajar como `motivo`');
});

test('el origen no se cuela en las etapas del pipeline', () => {
  // etapaActual solo gobierna el corte de las salidas: mover a 'agenda' pide lo
  // mismo venga de donde venga.
  const v: StageReqValues = { hoyISO: '2026-07-05', ...funnelReqInfo(DEFAULT_PIPELINE, 'agenda') };
  assert.deepEqual(ids('agenda', v), ids('agenda', { ...v, etapaActual: 'lead' }));
  assert.deepEqual(ids('agenda', v), ids('agenda', { ...v, etapaActual: 'perdido', motivo: 'x' }));
});
