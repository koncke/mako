// =============================================================================
// Las dos CONDITION que el CRM automático tenía escondidas (14/10/2026): «Asistencia sin marcar a la reunión» (T1) y
// «Venció su nutrición manual» (T3)
// =============================================================================
// Pedido de Martín (14/10/2026 03:06, app/admin/dev/crm/bitacora.ts): «elimina el botón de "CRM Automático", para eso ya
// llevamos todo a Automations... Si quedó algo pendiente, llevalo como template a automations». Y la regla de la casa
// («MaKo nada por detrás», AGENTS.md): lo que el motor decidía solo (lib/crm-auto-plan.ts) pasa a una condición VISIBLE
// del catálogo (lib/condiciones-catalogo.ts), que el motor de flujos lee en batch (`hechosDeLeads`, lib/nutricion.ts).
//
// Lo que se fija (ejecutando las funciones puras, no regex sobre el fuente salvo el cableado del lector):
//   1. existen, en su sección, se pueden negar y se ofrecen con un CRON de venta (no con uno de entrega);
//   2. «Asistencia sin marcar»: sólo de las reuniones que YA pasaron; marcada = no; futura, cancelada o sin reunión = «no sé»
//      (ni la afirmada ni la negada se cumplen); acotada a una etapa de reunión, mira ESA;
//   3. dice lo MISMO que T1 del motor sobre los mismos leads;
//   4. «Venció su nutrición manual»: el día del plazo no venció, el siguiente sí, en el día del NEGOCIO; sin plazo o sin
//      saber qué día es, «no sé». Y dice lo MISMO que T3 del motor;
//   5. el lector del motor trae la columna y el día del negocio cuando la condición lo pide.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez y restaurada desde memoria (scratchpad romper.py). Como está:
// 6 pasan / 0 fallan. Cada rotura (pasan / fallan):
//   R1 `sinMarcarEntre` sin filtrar las que ya pasaron (una reunión de mañana «sin marcar»)  → 4 / 2 (la 2 y la 3)
//   R2 `sinMarcarEntre` contando una marcada en false como «sin marcar» (`!x.asistio`)       → 4 / 2 (la 2 y la 3)
//   R3 `plazoNutricionDe` con `<=` (el día del plazo ya «venció»)                           → 4 / 2 (la 4 y la 5)
//   R4 el lector sin `nutricion_manual_deadline` en COLS_CATALOGO                           → 5 / 1 (la 6)
//
// Correr: npx tsx --test tests/condiciones-crm-auto.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cumpleCatalogo, condicionPorId, seccionesDeCondiciones, textoCondicion, valorOpcion, type HechosCatalogo,
} from '../lib/condiciones-catalogo';
import { catalogoDeLead, plazoNutricionDe, type FilaLeadCatalogo } from '../lib/nutricion-grafo-motor';
import { planLeadAuto, type AutoLead } from '../lib/crm-auto-plan';
import type { FilaCondicion, HechosLead } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// 14/10/2026 a las 18:00 UTC = 12:00 en México.
const AHORA = Date.parse('2026-10-14T18:00:00Z');
const HOY = '2026-10-14';
const H = (lead: NonNullable<HechosCatalogo['lead']>, o: { ahoraMs?: number; etapasPorProducto?: Map<number, string>; reuniones?: Map<number, string[]> } = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo: false, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: o.ahoraMs ?? AHORA,
  ...(o.etapasPorProducto ? { etapasPorProducto: o.etapasPorProducto } : {}),
  catalogo: { lead, ...(o.reuniones ? { reuniones: o.reuniones } : {}) },
});
/** El veredicto de la fila: true / false, o «no sé» cuando ni la afirmada ni la negada se cumplen. */
function veredicto(fila: FilaCondicion, h: HechosLead): boolean | 'no sé' {
  const si = cumpleCatalogo(fila, h);
  const no = cumpleCatalogo({ ...fila, no: true }, h);
  if (si && no) throw new Error('se cumplen las dos');
  return si ? true : no ? false : 'no sé';
}
const SIN_MARCAR: FilaCondicion = { campo: 'asistencia_sin_marcar' };
const VENCIO: FilaCondicion = { campo: 'nutricion_vencida' };
const sinMarcar = (fila: FilaLeadCatalogo, ahoraMs = AHORA) => veredicto(SIN_MARCAR, H(catalogoDeLead(fila, ahoraMs), { ahoraMs }));

test('1. existen, en su sección, se niegan, y se ofrecen con un CRON de venta (no con uno de entrega)', () => {
  const a = condicionPorId('asistencia_sin_marcar')!;
  assert.equal(a.seccion, 'Agenda y llamadas');
  assert.deepEqual(a.rotulo, ['Asistencia sin marcar a la reunión', 'Asistencia marcada a la reunión']);
  assert.equal(a.negable, true);
  assert.equal(a.reuniones, true, 'no se puede acotar a una etapa de reunión');
  const v = condicionPorId('nutricion_vencida')!;
  assert.equal(v.seccion, 'Etapa y pipeline');
  assert.deepEqual(v.rotulo, ['Venció su nutrición manual', 'Su nutrición manual no venció']);
  assert.equal(v.negable, true);
  const ofrecidas = (ambito: 'adquisicion' | 'entrega') => seccionesDeCondiciones(ambito, {}).flatMap((s) => s.options.map((o) => o.value));
  for (const id of ['asistencia_sin_marcar', 'nutricion_vencida']) {
    assert.ok(ofrecidas('adquisicion').includes(valorOpcion(id, false)), `${id} no se ofrece con un CRON de venta`);
    assert.ok(ofrecidas('adquisicion').includes(valorOpcion(id, true)), `${id} no se ofrece negada`);
    assert.ok(!ofrecidas('entrega').includes(valorOpcion(id, false)), `${id} se ofrece con un CRON de entrega`);
  }
  assert.equal(textoCondicion(SIN_MARCAR), 'Asistencia sin marcar a la reunión');
  assert.equal(textoCondicion({ campo: 'nutricion_vencida', no: true }), 'Su nutrición manual no venció');
});

test('2. «Asistencia sin marcar»: sólo de la reunión que YA pasó; futura, cancelada o sin reunión = «no sé»', () => {
  // La R1 fue hoy a las 10:00 UTC (4 de la mañana de México): ya pasó.
  const pasada = { junta_1_at: '2026-10-14T10:00:00Z', fecha_junta_1: '2026-10-14' };
  assert.equal(sinMarcar({ ...pasada, asistio_j1: null }), true);
  assert.equal(sinMarcar({ ...pasada, asistio_j1: true }), false, 'marcada que vino');
  assert.equal(sinMarcar({ ...pasada, asistio_j1: false }), false, 'marcada que NO vino también es «marcada»');
  // Mañana: no está «sin marcar» (todavía no fue), y tampoco «marcada».
  assert.equal(sinMarcar({ junta_1_at: '2026-10-15T15:00:00Z', fecha_junta_1: '2026-10-15' }), 'no sé');
  // Cancelada (la hora quedó, la fecha no): no es una reunión sin marcar (el bug de T1 del 14/10).
  assert.equal(sinMarcar({ junta_1_at: '2026-10-14T10:00:00Z', fecha_junta_1: null }), 'no sé');
  assert.equal(sinMarcar({}), 'no sé', 'sin reunión');
  // Una fecha SIN hora vale todo su día: la de hoy todavía no pasó; la de ayer, sí.
  assert.equal(sinMarcar({ fecha_junta_1: HOY }), 'no sé');
  assert.equal(sinMarcar({ fecha_junta_1: '2026-10-13' }), true);
  // Con la R1 marcada y la R2 pasada sin marcar: sí (cualquiera de las dos, sin etapas elegidas).
  assert.equal(sinMarcar({ ...pasada, asistio_j1: true, fecha_junta_2: '2026-10-13' }), true);
  // Acotada a la etapa de la 2ª reunión del embudo 5: mira SÓLO la R2.
  const lead = catalogoDeLead({ ...pasada, asistio_j1: null, fecha_junta_2: '2026-10-20', junta_2_at: '2026-10-20T15:00:00Z' }, AHORA);
  const h = H(lead, { etapasPorProducto: new Map([[5, 'agendaj2']]), reuniones: new Map([[5, ['agenda', 'agendaj2']]]) });
  assert.equal(veredicto({ ...SIN_MARCAR, reuniones: ['5:agendaj2'] }, h), 'no sé', 'la R2 es la semana que viene');
  assert.equal(veredicto({ ...SIN_MARCAR, reuniones: ['5:agenda'] }, h), true, 'la R1 ya pasó sin marcar');
});

/** Un lead del motor con lo que T1 mira. */
const autoLead = (o: Partial<AutoLead>): AutoLead => ({
  id: 1, nombre: 'Lead', estado_lead: 'abierto', pipeline_stage: null, fecha_agenda: null,
  fecha_junta_1: null, fecha_junta_2: null, junta_1_at: null, junta_2_at: null, asistio_j1: null, asistio_j2: null,
  nutricion_manual_deadline: null, created_at: '2026-10-01T00:00:00Z', updated_at: null, ...o,
});

test('3. dice lo MISMO que T1 del motor (lib/crm-auto-plan.ts) sobre los mismos leads, pasadas las 3 h', () => {
  const REUNION = '2026-10-14T10:00:00Z';
  const tresHorasDespues = Date.parse(REUNION) + 3 * 3_600_000 + 60_000;
  const casos: Array<[nombre: string, l: Partial<AutoLead>]> = [
    ['sin marcar', { junta_1_at: REUNION, fecha_junta_1: HOY }],
    ['marcada', { junta_1_at: REUNION, fecha_junta_1: HOY, asistio_j1: true }],
    ['marcada que no vino', { junta_1_at: REUNION, fecha_junta_1: HOY, asistio_j1: false }],
    ['cancelada', { junta_1_at: REUNION, fecha_junta_1: null }],
    ['mañana', { junta_1_at: '2026-10-15T10:00:00Z', fecha_junta_1: '2026-10-15' }],
    ['de ayer, sin hora', { fecha_junta_1: '2026-10-13' }],
  ];
  for (const [nombre, o] of casos) {
    const l = autoLead(o);
    const t1 = planLeadAuto(l, HOY, tresHorasDespues).some((a) => a.regla === 'T1');
    const v = sinMarcar(l, tresHorasDespues);
    assert.equal(v === true, t1, `${nombre}: el motor ${t1 ? 'propone' : 'no propone'} T1 y la condición dice ${String(v)}`);
  }
});

test('4. «Venció su nutrición manual»: el día del plazo no; el siguiente, sí; sin plazo o sin hoy, «no sé»', () => {
  assert.deepEqual(plazoNutricionDe('2026-10-13', HOY), { fecha: '2026-10-13', vencido: true });
  assert.deepEqual(plazoNutricionDe(HOY, HOY), { fecha: HOY, vencido: false }, 'el día del plazo todavía no venció');
  assert.deepEqual(plazoNutricionDe('2026-10-20', HOY), { fecha: '2026-10-20', vencido: false });
  assert.deepEqual(plazoNutricionDe('2026-10-13T00:00:00+00:00', HOY), { fecha: '2026-10-13', vencido: true }, 'una fecha con hora');
  assert.equal(plazoNutricionDe(null, HOY), null);
  assert.equal(plazoNutricionDe('mañana', HOY), null, 'una fecha que no es una fecha no es un plazo');
  assert.deepEqual(plazoNutricionDe('2026-10-13', null), { fecha: '2026-10-13', vencido: null }, 'sin hoy no se sabe');
  const v = (fila: FilaLeadCatalogo, hoy: string | null) => veredicto(VENCIO, H(catalogoDeLead(fila, AHORA, hoy)));
  assert.equal(v({ nutricion_manual_deadline: '2026-10-13' }, HOY), true);
  assert.equal(v({ nutricion_manual_deadline: HOY }, HOY), false);
  assert.equal(v({ nutricion_manual_deadline: null }, HOY), 'no sé');
  assert.equal(v({ nutricion_manual_deadline: '2026-10-13' }, null), 'no sé');
  // Un bloque `lead` armado sin el plazo (otro lector, «Probar»): «no sé», nunca «no venció».
  const { plazoNutricion: _p, ...sinPlazo } = catalogoDeLead({}, AHORA, HOY);
  void _p;
  assert.equal(veredicto(VENCIO, H(sinPlazo as NonNullable<HechosCatalogo['lead']>)), 'no sé');
  // El día del NEGOCIO, no el de UTC: a las 01:00 UTC del 15 en Buenos Aires todavía es el 14 (lo pasa quien lee).
  assert.equal(v({ nutricion_manual_deadline: HOY }, '2026-10-14'), false);
});

test('5. dice lo MISMO que T3 del motor sobre los mismos leads (en nutrición manual)', () => {
  for (const deadline of ['2026-10-10', '2026-10-13', HOY, '2026-10-15', null]) {
    const l = autoLead({ pipeline_stage: 'manual', nutricion_manual_deadline: deadline });
    const t3 = planLeadAuto(l, HOY, AHORA).some((a) => a.regla === 'T3');
    const v = veredicto(VENCIO, H(catalogoDeLead(l, AHORA, HOY)));
    assert.equal(v === true, t3, `plazo ${deadline}: el motor ${t3 ? 'propone' : 'no propone'} T3 y la condición dice ${String(v)}`);
  }
});

test('6. el lector del motor trae la columna y el día del NEGOCIO cuando la condición lo pide', () => {
  const src = sinComentarios(leer('lib/nutricion.ts'));
  const cols = /const COLS_CATALOGO = '([^']+)'/.exec(src)?.[1] ?? '';
  assert.ok(cols.split(',').map((c) => c.trim()).includes('nutricion_manual_deadline'), 'la lectura del catálogo no trae el plazo');
  assert.match(src, /const pideHoy = pide\('pagos'\) \|\| filas\.some\(\(f\) => f\.campo === 'nutricion_vencida'\);/);
  assert.match(src, /const leerHoy = async \(\): Promise<string> => \(pideHoy \? hoyEnTz\(await tzActual\(\)\) : ''\);/);
  // 24/10/2026: y la zona del negocio, la del ancla de la espera (tests/reunion-termino-una-regla.test.ts).
  assert.match(src, /lead: catalogoDeLead\(f, ahoraMs, hoy \|\| null, zona\)/);
});
