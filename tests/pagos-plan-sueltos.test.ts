// =============================================================================
// Lo cobrado suelto cuenta por PLATA, no por filas: el plan del asistente, la ficha y el plan uniforme (21/10/2026, Pagos,
// quinta revisión adversarial)
// =============================================================================
// Contando filas, un adelanto de US$1.500 en una suscripción de US$500 cubría UN mes: el asistente armaba 11 cuotas, dos
// por meses ya pagados, la ficha sumaba US$7.000 sobre 6.000 y la cobranza le reclamaba a quien pagó. Y una seña de US$100
// cubría un mes ENTERO: los 400 que faltaban no se cobraban nunca, en verde. Lo que se fija:
//   1. `mesesDePlata`: meses ENTEROS de una mensualidad, con un 10% por mes de tolerancia (el tipo de cambio);
//   2. `planDelAsistente` cuenta por plata, no arma con meses partidos ni con pagos de antes del cierre, y dice cuántas
//      armó; y la ficha (`cobradoDelLead`) cuenta lo cobrado IGUAL, así el adelantado no queda en «Falta registrar»;
//   3. qué es un plan (`pagosPrevios`): una cuota devuelta o de baja no lo es, y el cobro de un link suelto es plata;
//   4. el plan uniforme: una seña no tapa el número de una cuota (`reconciliarCuotas`, 'slots'), y sin plan no se arma.
//
// Probado rompiéndolo (21/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/pagos-plan-sueltos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobradoDelLead, mesesDePlata, sumarMeses } from '../lib/cobrado-lead';
import { avisoPlanUniforme, pagosPrevios, planDelAsistente, reconciliarCuotas, type FilaPrevia } from '../lib/pagos-campo';

const CIERRE = '2026-10-21';
const doce = Array.from({ length: 12 }, (_, i) => ({ monto_usd: 500, fecha_esperada: sumarMeses(CIERRE, i) }));
const suelto = (monto: number, f = CIERRE) => ({ pagado: true, nacio_cobrada: true, monto_usd: monto, fecha_esperada: f, fecha_pago: f });
const ficha = (hoy: string, pagos: Array<{ monto_usd: number; pagado: boolean; fecha_esperada: string | null; fecha_pago?: string | null; nacio_cobrada?: boolean }>) =>
  cobradoDelLead({
    ventaTipo: 'suscripcion', montoCierreUsd: null, suscripcionMontoUsd: 500, suscripcionMeses: 12, fechaCierre: CIERRE, suscripcionCanceladaAt: null,
    pagos: pagos.map((p, i) => ({ id: i + 1, fecha_pago: null, ...p })), cobros: [], hoy,
  });

test('1. `mesesDePlata`: meses enteros, con un 10% por mes de tolerancia', () => {
  assert.deepEqual(mesesDePlata(1500, 500), { meses: 3, enteros: true });
  assert.deepEqual(mesesDePlata(1450, 500), { meses: 3, enteros: true }, 'un cobro en pesos convertido');
  assert.deepEqual(mesesDePlata(500, 500), { meses: 1, enteros: true });
  assert.deepEqual(mesesDePlata(100, 500), { meses: 0, enteros: false }, 'una seña no es un mes');
  assert.deepEqual(mesesDePlata(300, 500), { meses: 0, enteros: false });
  assert.deepEqual(mesesDePlata(1200, 500), { meses: 2, enteros: false }, 'dos meses y algo: cubre dos, no son enteros');
  assert.deepEqual(mesesDePlata(0, 500), { meses: 0, enteros: true });
  assert.deepEqual(mesesDePlata(500, 0), { meses: 0, enteros: false });
});

test('2. ⚠️ el asistente cuenta lo cobrado por plata, no arma con meses partidos, y dice cuántas armó; la ficha cuenta igual', () => {
  // Un adelanto de 3 meses en UN pago: los primeros 3 meses están pagados, se arman 9.
  const ad = planDelAsistente(doce, [suelto(1500)], { suscripcion: true, ancla: CIERRE });
  assert.equal(ad.yaCobradas, 3);
  assert.deepEqual([ad.cuotas.length, ad.cuotas[0].fecha_esperada, ad.cuotas[8].fecha_esperada], [9, '2027-01-21', '2027-09-21']);
  assert.equal(ad.aviso, 'Lo ya cobrado (US$ 1.500) cuenta como los primeros 3 meses: se armaron 9 cuotas.', 'se dice en pantalla');
  // La ficha, mes a mes: nunca roja ni en «Falta registrar» (cuenta el adelanto como 3 meses), y el total cuadra.
  const conPlan = (hoy: string) => [suelto(1500), ...ad.cuotas.map((c) => ({ ...c, pagado: (c.fecha_esperada ?? '') <= hoy, fecha_pago: (c.fecha_esperada ?? '') <= hoy ? c.fecha_esperada : null }))];
  for (const hoy of ['2026-10-22', '2026-11-22', '2026-12-22', '2027-01-22', '2027-03-25']) {
    const f = ficha(hoy, conPlan(hoy));
    assert.equal(f.semaforo.tono, 'verde', `${hoy}: ${f.semaforo.texto}`);
    assert.equal(f.suscripcion?.sinRegistrar, 0, `${hoy}: el adelanto cuenta como 3 meses`);
    assert.equal(f.cobradoUsd + f.pendienteUsd, 6000, `${hoy}: lo cobrado y lo pendiente suman la venta`);
  }
  // Mes a mes (tres sueltos de 500): lo de siempre, 9.
  const mesAMes = planDelAsistente(doce, [suelto(500, '2026-10-21'), suelto(500, '2026-11-21'), suelto(500, '2026-12-21')], { suscripcion: true, ancla: CIERRE });
  assert.equal(mesAMes.cuotas.length, 9);
  // Un pago en pesos convertido (1.450): 3 meses.
  assert.equal(planDelAsistente(doce, [suelto(1450)], { suscripcion: true, ancla: CIERRE }).yaCobradas, 3);
  // Una seña (100) o un pago de 300: no son meses enteros. No se arma, y se dice; la ficha reclama el mes entero.
  for (const monto of [100, 300, 1200]) {
    const p = planDelAsistente(doce, [suelto(monto)], { suscripcion: true, ancla: CIERRE });
    assert.equal(p.cuotas.length, 0, `${monto}`);
    assert.match(String(p.aviso), /no son meses enteros de US\$ 500: el plan no se armó/, `${monto}`);
  }
  const sena = ficha('2026-10-22', [suelto(100)]);
  assert.equal(sena.suscripcion?.sinRegistrar, 1, 'la seña no da por cobrado el mes: faltan los 400');
  // Un pago de otra venta (marzo): no se sabe si es de esta suscripción. Uno de días antes del cierre (la seña de la R2) sí.
  assert.match(String(planDelAsistente(doce, [suelto(500, '2026-03-15')], { suscripcion: true, ancla: CIERRE }).aviso), /de antes del cierre/);
  assert.equal(planDelAsistente(doce, [suelto(500, '2026-10-02')], { suscripcion: true, ancla: CIERRE }).cuotas.length, 11);
  // Lo cobrado cubre todo el plazo.
  const todo = planDelAsistente(doce, [suelto(6000)], { suscripcion: true, ancla: CIERRE });
  assert.deepEqual([todo.cuotas.length, todo.aviso], [0, 'Lo ya cobrado (US$ 6.000) cubre todo el plazo: no quedó ninguna cuota por armar.']);
  // Sin nada cobrado: las 12, sin aviso.
  assert.deepEqual([planDelAsistente(doce, [], { suscripcion: true, ancla: CIERRE }).cuotas.length, planDelAsistente(doce, [], { suscripcion: true, ancla: CIERRE }).aviso], [12, null]);
});

test('3. qué es un plan: una cuota devuelta o de baja no lo es, y el cobro de un link suelto es plata', () => {
  const devuelta: FilaPrevia = { pagado: false, fecha_esperada: null, proveedor: 'stripe', cobro_id: 9 };
  const deBaja: FilaPrevia = { pagado: false, fecha_esperada: '2026-09-01', baja_at: '2026-09-15' };
  const link: FilaPrevia = { pagado: true, nacio_cobrada: false, monto_usd: 500, fecha_pago: '2026-10-20', fecha_esperada: '2026-10-20', proveedor: 'stripe', cobro_id: 7 };
  // Antes decían «Ya tenía un plan» y no se armaba nada; ahora no cuentan, y el link es un mes cobrado.
  assert.equal(planDelAsistente(doce, [devuelta], { suscripcion: true, ancla: CIERRE }).cuotas.length, 12);
  assert.equal(planDelAsistente(doce, [deBaja], { suscripcion: true, ancla: CIERRE }).cuotas.length, 12);
  assert.equal(planDelAsistente(doce, [link], { suscripcion: true, ancla: CIERRE }).cuotas.length, 11);
  assert.deepEqual(pagosPrevios([devuelta, deBaja, link]), { hayPlan: false, sueltos: [link], cobradoUsd: 500 });
  // Un plan de verdad: una cuota viva sin cobrar, o una cobrada que no nació cobrada ni vino de la pasarela.
  assert.equal(pagosPrevios([{ pagado: false, fecha_esperada: '2026-11-01' }]).hayPlan, true);
  assert.equal(pagosPrevios([{ pagado: true, nacio_cobrada: false, fecha_esperada: '2026-10-01' }]).hayPlan, true);
  assert.match(String(planDelAsistente(doce, [{ pagado: false, fecha_esperada: '2026-11-01' }], { suscripcion: true, ancla: CIERRE }).aviso), /Ya tenía un plan de pagos/);
  // El pago único con un link suelto: no se arma (como con un pago suelto).
  assert.match(String(planDelAsistente([{ monto_usd: 3000, fecha_esperada: CIERRE }], [link], { suscripcion: false, ancla: CIERRE }).aviso), /Ya tenía pagos cobrados/);
});

test('4. ⚠️ el plan uniforme: una seña no tapa el número de una cuota, y sin plan no se arma encima de ella', () => {
  const sena = { id: 1, numero: 1, monto_usd: 100, fecha_esperada: '2026-10-05', pagado: true, nacio_cobrada: true };
  const deseadas = [0, 1, 2, 3].map((n) => ({ numero: n, monto_usd: 1000, fecha_esperada: sumarMeses('2026-10-05', n) }));
  const plan = reconciliarCuotas([sena], deseadas, 'slots');
  assert.equal(plan.insertar.length, 4, 'la cuota 1 se arma: la seña no la tapa');
  assert.equal(plan.insertar.reduce((s, q) => s + q.monto_usd, 0), 4000);
  assert.equal(new Set([1, ...plan.insertar.map((q) => q.numero)]).size, 5, 'ningún número choca con el de la seña');
  // Una cuota del plan cobrada (no nació cobrada) SÍ cubre su número: la regla de siempre.
  const cobrada = { ...sena, monto_usd: 1000, nacio_cobrada: false };
  assert.equal(reconciliarCuotas([cobrada], deseadas, 'slots').insertar.length, 3);
  // Sin plan y con plata suelta, no se arma: lo dice, como el asistente.
  assert.match(String(avisoPlanUniforme([sena])), /Ya tenía pagos cobrados: el plan no se armó/);
  assert.equal(avisoPlanUniforme([sena, { pagado: false, fecha_esperada: '2026-11-05' }]), null, 'con un plan, se ajusta');
  assert.equal(avisoPlanUniforme([]), null);
});

// ROTURAS (21/10/2026). Base: 4 pases, 0 fallos. Rota (pases / fallos):
//   · el asistente vuelve a contar filas                                  → 3 / 1 (2)
//   · sin tolerancia de cambio                                            → 2 / 2 (1 y 2)
//   · una seña cuenta como un mes                                         → 2 / 2 (1 y 2)
//   · no dice cuántas armó                                                → 3 / 1 (2)
//   · acepta pagos de antes del cierre                                    → 3 / 1 (2)
//   · la ficha vuelve a contar filas                                      → 3 / 1 (2)
//   · una devuelta o de baja vuelve a ser «plan»                          → 3 / 1 (3)
//   · el cobro de un link suelto es «plan»                                → 3 / 1 (3)
//   · una seña tapa el número de una cuota (slots)                        → 3 / 1 (4)
//   · el plan uniforme se arma encima de plata suelta                     → 3 / 1 (4)
