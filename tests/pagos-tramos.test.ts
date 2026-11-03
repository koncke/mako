// =============================================================================
// El plan de pagos POR TRAMOS (29/10/2026, ticket #13 de Leila, ws11)
// =============================================================================
// Martín (28/10): «No tiene libertad o diversidad de tipos de cobros». Los dos casos de Leila, con sus datos de verdad:
//   · Nadia H Tremari (lead 2605, leído de la base el 29/10, sólo lectura): 12 cuotas de US$4.235,29 los días 8 desde el
//     08/11/2026 (#91 a #102) y un pago suelto cobrado de US$423,53 (#113). Tiene que ser US$300 cada quincena, días 1 y 15.
//   · «6 meses de 12.000 y luego 10.000», en pesos (ws11 cobra en MXN).
// Copiado de las fases de un «subscription schedule» de Stripe y del plan de pagos de Kajabi (lib/pagos-campo.ts). Se prueba la
// cadena que corre «Guardar el plan»: `cuotasDelPlanPorTramos` → lo que manda `guardarCuotasAction` → `reconciliarCuotas`
// ('porId', con `vistos` y las protegidas del server), y lo que queda en la base después.
//
// Probado rompiéndolo (29/10/2026), una rotura por vez, sobre los 18 tests de este archivo:
//   · la cobrada no cubre su lugar (la lista la vuelve a pedir):            1 fallo (el server la saltea igual; la pantalla
//     decía 6 cuotas en vez de 5: la primera vez no falló nada y se sumó la aserción sobre `nuevas`)
//   · las impagas sin id (todo entra como nuevo):                            9 fallos
//   · cubiertas «las primeras» y no su lugar (la regla del plan libre):      4 fallos
//   · el tramo siguiente arranca en la última cuota del anterior:            1 fallo
//   · cambiar sólo los pesos no cuenta como cambio de plata:                 1 fallo
//   · la reconciliación no lleva la moneda al insertar:                      3 fallos
//   · lo de aparte no va (el resto de un cobro por menos se borra):          4 fallos
//   · el anticipo cobrado se vuelve a pedir:                                 1 fallo
//   · en pesos sin dólares se arma igual (una tasa inventada de 1):          1 fallo
//   · leer el plan sin la frecuencia de sus fechas (todo «cada mes»):        1 fallo (la primera vez, ninguno: los casos eran
//     mensuales; se sumó el de semana, quincena y fin de mes)
//   · el recordatorio en dólares:                                            1 fallo
//   · la suscripción no pasa a «Pago único» antes de las cuotas:             1 fallo
//   · mandar la lista entera, sin «tal cual» para lo que no se tocó:         1 fallo
// Y la revisión adversarial de 9fc4030dd (Integración, 29/10/2026), sobre los 24 tests, una rotura por vez:
//   · A1: la tasa da los dólares de la cuota entera / «Marcar pagada» sin la tasa / `cobrarCuota` sin la tasa:   1 fallo cada una
//   · A2: el anticipo del editor sale de la columna `cobro_inicial_usd`:                                         1 fallo
//   · M1: la protegida reasignada se lleva el «tal cual»:                                                         1 fallo
//   · M2: los cambios a mano sin la moneda:                                                                       1 fallo
//   · M3: `planCambiadoAfuera` no ve la otra pestaña / el server avisa y escribe igual:                           1 fallo cada una
//   · B4: el tope de 60 sin el anticipo / B5: el total en dos monedas que se lee doble:                           1 fallo cada una
// Y la tercera vuelta (3/11/2026), una rotura por vez:
//   · B8, la firma sin la fecha / sin la moneda:                                                                  1 fallo cada una
//   · B8, la firma sin el monto en su moneda: 2 fallos · sin los dólares: 3 fallos
//   · B13, la regla siempre en dólares:                                                                           1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  aplicarCambios, armadaDe, avisoDeConservadas, cambiosContra, cuotasDeTramos, cuotasDelPlanPorTramos, cuotasVistas, lineasDeCuotas, lugaresDelPlan, monedaDeCuota,
  planCambiadoAfuera, planCambioDesde, reconciliarCuotas, soloLoQueCambio, tramosDeCuotas, type AnticipoPlan, type CambioDeCuota, type CuotaArmada, type CuotaDelLead,
  type CuotaExistente, type PlanDeCuotas, type Proteccion, type TramoPlan,
} from '../lib/pagos-campo';
import { disparosDeCobranza } from '../lib/cobranza';
import { diferenciaPendiente, dolaresALaTasaDeLaCuota, restoEnLaMonedaDeLaCuota } from '../lib/pagos-diferencia';
import { noEsDeuda } from '../lib/cobrado-lead';

const raiz = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

/** Nadia (lead 2605), como está en la base el 29/10/2026. */
const NADIA: Fila[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: 91 + i, numero: i + 1, monto_usd: 4235.29, pagado: false,
    fecha_esperada: new Date(Date.UTC(2026, 10 + i, 8)).toISOString().slice(0, 10),
  })),
  { id: 113, numero: 13, monto_usd: 423.53, fecha_esperada: '2026-10-16', pagado: true, nacio_cobrada: true },
];

type Fila = CuotaDelLead & { moneda?: string | null; monto_original?: number | null };

/**
 * «Guardar el plan»: la lista de la ficha (`cuotasDelPlanPorTramos`), lo que hace con ella `guardarCuotasAction` (la moneda
 * limpia, `quedaComoEsta`) y la reconciliación POR ID con las protecciones que lee el server. Devuelve también la base después.
 */
function guardar(pagos: Fila[], p: { desde: string; tramos: TramoPlan[]; anticipo?: AnticipoPlan | null; cambios?: Record<number, CambioDeCuota>; planConInicial?: boolean; abiertas?: Fila[] }, protegidas: Record<number, Proteccion[]> = {}) {
  const armado = cuotasDeTramos({ desde: p.desde, tramos: p.tramos });
  assert.ok(armado.ok, armado.ok ? '' : armado.error);
  const lista = aplicarCambios(armado.cuotas, p.cambios ?? {});
  const encima = cuotasDelPlanPorTramos({ pagos, protegidas: new Set(Object.keys(protegidas).map(Number)), anticipo: p.anticipo ?? null, lista, planConInicial: p.planConInicial });
  if (!encima.ok) return { encima, plan: null, filas: pagos, deuda: NaN, lista };
  // Lo que la persona no cambió va «tal cual» (`soloLoQueCambio`), contra las cuotas que la ficha leyó al abrir.
  const deseadas = [...soloLoQueCambio(encima.cuotas, p.abiertas ?? pagos), ...encima.aparte].map((c) => {
    const m = 'moneda' in c ? monedaDeCuota(c.moneda) : undefined;
    return {
      id: c.id, numero: c.numero, monto_usd: c.monto, fecha_esperada: c.fecha,
      ...('moneda' in c && c.moneda !== undefined ? { moneda: m ?? null, monto_original: m ? (c as { montoOriginal?: number | null }).montoOriginal ?? null : null } : {}),
      ...('quedaComoEsta' in c && c.quedaComoEsta ? { quedaComoEsta: true } : {}),
    };
  });
  const plan = reconciliarCuotas(existentesDe(pagos, protegidas), deseadas, 'porId', { vistos: new Set(encima.vistos), protegidasPrimero: true });
  return { encima, plan, filas: aplicar(pagos, plan), deuda: deudaDe(aplicar(pagos, plan)), lista };
}

/** Las cuotas como las lee el server (`cuotasParaReconciliar`), con las protecciones de la base. */
const existentesDe = (pagos: Fila[], protegidas: Record<number, Proteccion[]> = {}): CuotaExistente[] => pagos.map((q) => ({
  id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada, pagado: q.pagado, devuelta: noEsDeuda(q),
  nacio_cobrada: !!q.nacio_cobrada, resto_de: q.resto_de ?? null, protegida: protegidas[q.id] ?? [], moneda: q.moneda ?? null, monto_original: q.monto_original ?? null,
}));

/** «Abrir» el editor como `ArmarPlan`: los tramos que se leen y, de las impagas, lo que no encaja (un cambio a mano). */
function abrir(pagos: Fila[], planConInicial = false) {
  const lugares = lugaresDelPlan(pagos, planConInicial);
  const leido = tramosDeCuotas(lugares, '2026-10-29');
  assert.ok(leido, 'no leyó el plan');
  const a = cuotasDeTramos(leido);
  assert.ok(a.ok, a.ok ? '' : a.error);
  const cambios: Record<number, CambioDeCuota> = Object.fromEntries(Object.entries(cambiosContra(a.cuotas, lugares.map(armadaDe))).filter(([k]) => !lugares[Number(k)]?.pagado));
  return { ...leido, cambios };
}

/** La base después de escribir la reconciliación (actualizar por id, insertar, borrar). */
function aplicar(pagos: Fila[], plan: PlanDeCuotas): Fila[] {
  const out = pagos.map((q) => ({ ...q }));
  for (const u of plan.actualizar) {
    const q = out.find((x) => x.id === u.id) as Fila;
    q.monto_usd = u.monto_usd; q.fecha_esperada = u.fecha_esperada;
    if ('moneda' in u && u.moneda !== undefined) { q.moneda = u.moneda; q.monto_original = u.monto_original ?? null; }
  }
  let id = 1000;
  for (const i of plan.insertar) out.push({ id: id++, numero: i.numero, monto_usd: i.monto_usd, fecha_esperada: i.fecha_esperada, pagado: false, moneda: i.moneda ?? null, monto_original: i.monto_original ?? null });
  return out.filter((q) => !plan.borrar.some((b) => b.id === q.id));
}
const deudaDe = (filas: Fila[]) => Math.round(filas.filter((q) => !q.pagado).reduce((s, q) => s + Number(q.monto_usd), 0) * 100) / 100;
const impagas = (filas: Fila[]) => filas.filter((q) => !q.pagado).sort((a, b) => String(a.fecha_esperada).localeCompare(String(b.fecha_esperada)));
const nada = (plan: PlanDeCuotas | null) => !!plan && !plan.actualizar.length && !plan.insertar.length && !plan.borrar.length;

const QUINCENA_300: TramoPlan = { monto: 300, moneda: 'USD', cada: 'quincena', dias: [1, 15], cantidad: 24 };
const PESOS: TramoPlan[] = [
  { monto: 12000, moneda: 'MXN', montoUsd: 600, cada: 'mes', dias: [1], cantidad: 6 },
  { monto: 10000, moneda: 'MXN', montoUsd: 500, cada: 'mes', dias: [1], cantidad: 6 },
];

// ── Nadia (lead 2605) ─────────────────────────────────────────────────────────

test('Nadia: la ficha abre con SU plan (1 tramo de US$4.235,29 los 8, 12 cuotas) y guardarlo sin cambios no cambia nada', () => {
  const lugares = lugaresDelPlan(NADIA, false);
  assert.deepEqual(lugares.map((q) => q.id), [91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102], 'el pago suelto no es un lugar del plan');
  const leido = tramosDeCuotas(lugares, '2026-10-29');
  assert.deepEqual(leido, { desde: '2026-11-08', tramos: [{ monto: 4235.29, moneda: 'USD', montoUsd: null, cada: 'mes', dias: [8], cantidad: 12, hasta: null }] });
  const a = cuotasDeTramos(leido!);
  assert.ok(a.ok);
  assert.deepEqual(cambiosContra(a.cuotas, lugares.map(armadaDe)), {}, 'lo leído no reproduce sus cuotas');
  const r = guardar(NADIA, { ...leido!, planConInicial: false });
  assert.ok(nada(r.plan), 'abrir y guardar sin cambiar nada cambió cuotas');
});

test('Nadia: Leila arma US$300 cada quincena (1 y 15) y sus 12 cuotas se reescriben POR ID; el pago suelto no se toca', () => {
  const r = guardar(NADIA, { desde: '2026-11-01', tramos: [QUINCENA_300], planConInicial: false });
  assert.ok(r.plan);
  assert.equal(r.plan.actualizar.length, 12, 'las 12 que ya existían no se reusaron (quedarían al lado de las nuevas)');
  assert.deepEqual(r.plan.actualizar.map((u) => u.id), [91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102]);
  assert.equal(r.plan.insertar.length, 12);
  assert.equal(r.plan.borrar.length, 0);
  assert.equal(r.deuda, 7200, 'la deuda no es 24 × 300');
  const fechas = impagas(r.filas).map((q) => q.fecha_esperada);
  assert.deepEqual(fechas.slice(0, 4), ['2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15']);
  assert.equal(fechas[23], '2027-10-15');
  assert.ok(impagas(r.filas).every((q) => Number(q.monto_usd) === 300 && !q.moneda));
  assert.deepEqual(r.filas.find((q) => q.id === 113), NADIA[12], 'el pago suelto cambió');
});

// ── «6 meses de 12.000 y luego 10.000», en pesos ──────────────────────────────

test('dos tramos en pesos: 6 de MXN 12.000 y 6 de MXN 10.000, el segundo arranca donde termina el primero', () => {
  const a = cuotasDeTramos({ desde: '2026-11-01', tramos: PESOS });
  assert.ok(a.ok);
  assert.equal(a.cuotas.length, 12);
  assert.deepEqual(a.cuotas[0], { monto_usd: 600, fecha: '2026-11-01', moneda: 'MXN', monto_original: 12000 });
  assert.deepEqual(a.cuotas[5], { monto_usd: 600, fecha: '2027-04-01', moneda: 'MXN', monto_original: 12000 });
  assert.deepEqual(a.cuotas[6], { monto_usd: 500, fecha: '2027-05-01', moneda: 'MXN', monto_original: 10000 }, 'el tramo 2 no arranca donde termina el 1');
  assert.equal(a.cuotas[11].fecha, '2027-10-01');
  // Guardado en un lead sin cuotas: cada una con su moneda y su monto en ella.
  const r = guardar([], { desde: '2026-11-01', tramos: PESOS });
  assert.equal(r.plan?.insertar.length, 12);
  assert.ok(r.plan?.insertar.every((i) => i.moneda === 'MXN' && (i.monto_original === 12000 || i.monto_original === 10000)), 'la cuota no lleva su moneda');
  assert.equal(r.deuda, 6600);
  assert.equal(lineasDeCuotas(r.plan!)[0].valor_nuevo, 'MXN 12000 (USD 600) · vence 01/11/2026', 'el historial no dice los pesos');
});

test('en pesos, los dólares los declara la persona: sin ellos no se arma (no hay tasa que inventar)', () => {
  const a = cuotasDeTramos({ desde: '2026-11-01', tramos: [{ ...PESOS[0], montoUsd: null }, PESOS[1]] });
  assert.ok(!a.ok);
  assert.match(a.ok ? '' : a.error, /^Tramo 1: ¿Cuánto es en dólares\? .*MXN/);
});

test('el plan en pesos vuelve a abrir igual: dos tramos, y guardarlo sin cambios no cambia nada', () => {
  const r = guardar([], { desde: '2026-11-01', tramos: PESOS });
  const filas = r.filas.map((q, i) => ({ ...q, id: 500 + i, numero: i + 1 }));
  const leido = tramosDeCuotas(lugaresDelPlan(filas), '2026-10-29');
  assert.deepEqual(leido?.tramos.map((t) => [t.monto, t.moneda, t.montoUsd, t.cada, t.dias, t.cantidad]), [
    [12000, 'MXN', 600, 'mes', [1], 6], [10000, 'MXN', 500, 'mes', [1], 6],
  ]);
  assert.ok(nada(guardar(filas, { ...leido! }).plan), 'guardar lo mismo cambió cuotas');
  // Y pasar el segundo tramo a 9.000 cambia SOLO esas seis, por id (no es moneda nueva: es otra plata).
  const otra = guardar(filas, { ...leido!, tramos: [leido!.tramos[0], { ...leido!.tramos[1], monto: 9000, montoUsd: 450 }] });
  assert.deepEqual(otra.plan?.actualizar.map((u) => u.id), [506, 507, 508, 509, 510, 511]);
  assert.ok(otra.plan?.actualizar.every((u) => u.monto_original === 9000 && u.monto_usd === 450));
});

test('cambiar sólo los pesos (mismos dólares) es cambiar la plata: con un link sin pagar no se toca', () => {
  const filas: Fila[] = [{ id: 1, numero: 1, monto_usd: 600, fecha_esperada: '2026-11-01', pagado: false, moneda: 'MXN', monto_original: 12000 }];
  const t: TramoPlan = { monto: 11000, moneda: 'MXN', montoUsd: 600, cada: 'mes', dias: [1], cantidad: 1 };
  assert.equal(guardar(filas, { desde: '2026-11-01', tramos: [t] }).plan?.actualizar[0]?.monto_original, 11000, 'MXN 12.000 → 11.000 con los mismos dólares no se guardó');
  const conLink = guardar(filas, { desde: '2026-11-01', tramos: [t] }, { 1: ['link'] });
  assert.deepEqual(conLink.plan?.conservar, [{ id: 1, numero: 1, motivo: 'link' }], 'el link cobraría otra plata');
});

// ── Duración, encadenado y topes ─────────────────────────────────────────────

test('un tramo hasta una fecha: las cuotas hasta ese día, y el siguiente arranca al otro día', () => {
  const a = cuotasDeTramos({ desde: '2026-11-03', tramos: [
    { monto: 100, cada: 'semana', hasta: '2026-11-24' },
    { monto: 400, cada: 'mes', cantidad: 2 },
  ] });
  assert.ok(a.ok);
  assert.deepEqual(a.cuotas.map((c) => [c.fecha, c.monto_usd]), [
    ['2026-11-03', 100], ['2026-11-10', 100], ['2026-11-17', 100], ['2026-11-24', 100], ['2026-11-25', 400], ['2026-12-25', 400],
  ]);
  const mal = cuotasDeTramos({ desde: '2026-11-03', tramos: [{ monto: 100, cada: 'mes', hasta: '2026-11-01' }] });
  assert.match(mal.ok ? '' : mal.error, /^Termina antes de empezar/);
  assert.match((cuotasDeTramos({ desde: '2026-11-01', tramos: [{ monto: 1, cada: 'semana', cantidad: 61 }] }) as { error: string }).error, /más de 60/);
  assert.match((cuotasDeTramos({ desde: '2026-11-01', tramos: [{ monto: 1, cada: 'mes', cantidad: 40 }, { monto: 1, cada: 'mes', cantidad: 21 }] }) as { error: string }).error, /más de 60/, 'el tope es del plan entero');
  assert.match((cuotasDeTramos({ desde: '2026-11-01', tramos: [{ monto: 1, cada: 'mes' }] }) as { error: string }).error, /cuántas cuotas o hasta qué fecha/);
  assert.equal(cuotasDeTramos({ desde: '2026-11-01', tramos: Array.from({ length: 11 }, () => ({ monto: 1, cada: 'mes' as const, cantidad: 1 })) }).ok, false, 'más de 10 tramos');
});

test('el plan que ya hay se lee con SU frecuencia: cada semana, quincena y fin de mes, sin cuotas «a mano» de más', () => {
  const filas = (fechas: string[]): CuotaDelLead[] => fechas.map((f, i) => ({ id: 70 + i, numero: i + 1, monto_usd: 100, fecha_esperada: f, pagado: false }));
  const leer = (fechas: string[]) => {
    const lugares = lugaresDelPlan(filas(fechas));
    const t = tramosDeCuotas(lugares, '2026-10-29')!;
    const a = cuotasDeTramos(t);
    return { tramo: [t.tramos[0].cada, t.tramos[0].dias], cambios: a.ok ? cambiosContra(a.cuotas, lugares.map(armadaDe)) : null };
  };
  assert.deepEqual(leer(['2026-11-03', '2026-11-10', '2026-11-17']), { tramo: ['semana', []], cambios: {} });
  assert.deepEqual(leer(['2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15']), { tramo: ['quincena', [1, 15]], cambios: {} });
  assert.deepEqual(leer(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']), { tramo: ['mes', [31]], cambios: {} }, 'el día 31 que cae en un mes corto');
});

// ── Lo cobrado, lo protegido y lo que no es del plan ─────────────────────────

/** 6 cuotas de US$500 los 10; la 3 COBRADA (no la primera), y un resto de un cobro por menos aparte. */
const CON_COBRADA: Fila[] = [
  ...['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10', '2027-03-10', '2027-04-10'].map((f, i) => ({ id: 21 + i, numero: i + 1, monto_usd: 500, fecha_esperada: f, pagado: i === 2 })),
  { id: 40, numero: 7, monto_usd: 80, fecha_esperada: '2026-12-20', pagado: false, resto_de: 23 },
];

test('una cobrada cubre SU lugar: subir el tramo a US$600 no le corre la fecha a nadie ni vuelve a pedir la cobrada', () => {
  const fechas = CON_COBRADA.slice(0, 6).map((q) => q.fecha_esperada);
  assert.deepEqual(fechas, ['2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10', '2027-03-10', '2027-04-10']);
  const r = guardar(CON_COBRADA, { desde: '2026-11-10', tramos: [{ monto: 600, cada: 'mes', dias: [10], cantidad: 6 }] });
  assert.ok(r.encima.ok && r.encima.cubiertas === 1);
  // La lista no manda la cobrada (el server igual la saltea): la pantalla dice 5 cuotas, no 6.
  assert.ok(r.encima.ok && r.encima.nuevas === 5 && !r.encima.cuotas.some((c) => c.id === 23), 'la cobrada se volvió a pedir en la lista');
  assert.deepEqual(r.plan?.actualizar.map((u) => [u.id, u.fecha_esperada]), [
    [21, '2026-11-10'], [22, '2026-12-10'], [24, '2027-02-10'], [25, '2027-03-10'], [26, '2027-04-10'],
  ], 'una impaga tomó la fecha de otra (con «las primeras» cubiertas, la 1 pasaba al 10/12)');
  assert.equal(r.plan?.insertar.length, 0, 'se volvió a pedir la cuota cobrada');
  assert.equal(r.deuda, 5 * 600 + 80, 'el resto de un cobro por menos se perdió o se contó en el plan');
  assert.deepEqual(r.filas.find((q) => q.id === 40), CON_COBRADA[6], 'el resto aparte cambió');
});

test('una cuota tocada a mano: abre como «a mano», guardar no la pisa, y cambiar el anticipo no la toca', () => {
  const movida = CON_COBRADA.map((q) => (q.id === 25 ? { ...q, fecha_esperada: '2027-03-20' } : q));
  const lugares = lugaresDelPlan(movida, false);
  const leido = tramosDeCuotas(lugares, '2026-10-29')!;
  const a = cuotasDeTramos(leido);
  assert.ok(a.ok);
  const cambios = cambiosContra(a.cuotas, lugares.map(armadaDe));
  assert.deepEqual(cambios, { 4: { fecha: '2027-03-20' } });
  assert.ok(nada(guardar(movida, { ...leido, cambios, planConInicial: false }).plan), 'guardar sin cambios devolvió la cuota movida al 10');
  const conAnticipo = guardar(movida, { ...leido, cambios, planConInicial: false, anticipo: { monto_usd: 250, moneda: null, monto_original: null, fecha: '2026-10-29' } });
  assert.equal(conAnticipo.plan?.actualizar.length, 0);
  assert.deepEqual(conAnticipo.plan?.insertar, [{ numero: 0, monto_usd: 250, fecha_esperada: '2026-10-29', moneda: null, monto_original: null }]);
});

test('lo que la persona no tocó va «tal cual»: una cuota que otra pestaña cambió en el medio no se pisa', () => {
  // Se abre el editor; en el medio, otra pestaña (o MaKo) pasa la cuota 5 a US$700. Acá sólo se agrega un anticipo.
  const abiertas = CON_COBRADA;
  const ahora = CON_COBRADA.map((q) => (q.id === 25 ? { ...q, monto_usd: 700 } : q));
  const leido = tramosDeCuotas(lugaresDelPlan(abiertas, false), '2026-10-29')!;
  const r = guardar(ahora, { ...leido, planConInicial: false, abiertas, anticipo: { monto_usd: 250, moneda: null, monto_original: null, fecha: '2026-10-29' } });
  assert.equal(r.filas.find((q) => q.id === 25)?.monto_usd, 700, 'el plan le reescribió los US$500 de cuando se abrió');
  assert.equal(r.plan?.actualizar.length, 0);
  // Y lo que la persona SÍ cambió se escribe aunque la base haya cambiado: subir el tramo pisa los 700 (es lo que pidió).
  const sube = guardar(ahora, { ...leido, tramos: [{ ...leido.tramos[0], monto: 550 }], planConInicial: false, abiertas });
  assert.equal(sube.filas.find((q) => q.id === 25)?.monto_usd, 550);
});

test('una cuota editada una por una antes de guardar: cambia sólo esa', () => {
  const lista = cuotasDeTramos({ desde: '2026-11-10', tramos: [{ monto: 500, cada: 'mes', dias: [10], cantidad: 6 }] });
  assert.ok(lista.ok);
  const r = guardar(CON_COBRADA, { desde: '2026-11-10', tramos: [{ monto: 500, cada: 'mes', dias: [10], cantidad: 6 }], cambios: { 4: { monto_usd: 750, fecha: '2027-03-25' } } });
  assert.deepEqual(r.plan?.actualizar.map((u) => [u.id, u.monto_usd, u.fecha_esperada]), [[25, 750, '2027-03-25']]);
  assert.equal(r.deuda, 4 * 500 + 750 + 80);
});

test('acortar el plan con la ÚLTIMA impaga protegida: se queda ella y se va una sin proteger (no se cuenta dos veces)', () => {
  const r = guardar(CON_COBRADA, { desde: '2026-11-10', tramos: [{ monto: 500, cada: 'mes', dias: [10], cantidad: 4 }] }, { 26: ['link'] });
  assert.ok(!r.plan?.borrar.some((b) => b.id === 26), 'se borró la cuota con link');
  assert.equal(r.deuda, 3 * 500 + 80, 'la deuda no es la del plan de 4 (con una cobrada) más el resto');
});

test('el anticipo: cobrado no se vuelve a pedir; impago y protegido, si el plan nuevo no lo pide, toma un lugar', () => {
  const base: Fila[] = [
    { id: 60, numero: 0, monto_usd: 1000, fecha_esperada: '2026-10-29', pagado: true },
    { id: 61, numero: 1, monto_usd: 500, fecha_esperada: '2026-11-29', pagado: false },
  ];
  const ant: AnticipoPlan = { monto_usd: 1000, moneda: null, monto_original: null, fecha: '2026-10-29' };
  const cobrado = guardar(base, { desde: '2026-11-29', tramos: [{ monto: 500, cada: 'mes', dias: [29], cantidad: 2 }], anticipo: ant });
  assert.ok(cobrado.encima.ok && cobrado.encima.inicialCobrado);
  assert.equal(cobrado.deuda, 1000, 'el anticipo cobrado se volvió a pedir');
  const impago = base.map((q) => (q.id === 60 ? { ...q, pagado: false } : q));
  const sinAnticipo = guardar(impago, { desde: '2026-11-29', tramos: [{ monto: 500, cada: 'mes', dias: [29], cantidad: 2 }] }, { 60: ['recordatorio'] });
  assert.ok(!sinAnticipo.plan?.borrar.some((b) => b.id === 60), 'se borró el anticipo con recordatorio');
  assert.equal(sinAnticipo.filas.filter((q) => !q.pagado).length, 2, 'el anticipo protegido quedó al lado de las dos cuotas');
});

// ── Lo que le llega al cliente y a la ficha ──────────────────────────────────

test('el recordatorio de una cuota en pesos dice los pesos, no los dólares', () => {
  const [d] = disparosDeCobranza({ vencidas: [], porVencer: [{ pago_id: 1, lead_id: 2, lead_nombre: 'Nadia', numero: 1, monto_usd: 600, fecha_esperada: '2026-11-01', dias: 1, moneda: 'MXN', monto_original: 12000 }] });
  assert.equal(d.datosEstables.cuota_monto, '$ 12.000 MXN', 'a quien le pactaron MXN 12.000 se le recordaba «US$ 600»');
  const [usd] = disparosDeCobranza({ vencidas: [], porVencer: [{ pago_id: 1, lead_id: 2, lead_nombre: 'Nadia', numero: 1, monto_usd: 300, fecha_esperada: '2026-11-01', dias: 1 }] });
  assert.equal(usd.datosEstables.cuota_monto, 'US$ 300');
  assert.match(fuente('lib/pagos.ts'), /'id, lead_id, numero, monto_usd, fecha_esperada, moneda, monto_original, leads\(nombre\)'/, 'la cobranza no lee la moneda de la cuota');
});

test('la ficha: el editor por tramos encima de lo que hay, con Deshacer, también en una suscripción', () => {
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /const leido = tramosDeCuotas\(lugares, ctx\.hoy\);/, 'el editor no abre con el plan que hay');
  assert.match(ui, /const encima = armado\.ok \? cuotasDelPlanPorTramos\(\{/);
  assert.match(ui, /await guardarCuotasAction\(l\.id, \[\.\.\.cuotas, \.\.\.aparte\], columnas, vistos, crm, \{ protegidasPrimero: true, conDeshacer: true, sobreLoVisto: true \}\)/);
  // «Armar el plan» ya no se esconde en una suscripción: la pasa a «Pago único» con su compare-and-set, antes de las cuotas.
  assert.doesNotMatch(ui, /lead\.venta_tipo !== 'suscripcion' && \(\s*<Button[^\n]*setArmando\(true\)/, 'el plan se volvió a esconder en una suscripción');
  const iVenta = ui.indexOf("await guardarVentaAction(l.id, { campo: 'tipo', valor: 'unico' }, { tipoVisto: 'suscripcion', crm })");
  assert.ok(iVenta > 0 && iVenta < ui.indexOf('await guardarCuotasAction(l.id, [...cuotas, ...aparte]'), 'la suscripción no pasa a pago único antes de guardar las cuotas');
  // Lo tocado a mano no se pierde callado al cambiar un tramo.
  assert.match(ui, /const rehacer = \(\) => \{ if \(Object\.keys\(cambios\)\.length\) \{ setCambios\(\{\}\); setRehechas\(true\); \} \};/);
  const acc = fuente('app/crm/[id]/pagos-campo-actions.ts');
  assert.match(acc, /const antes = como\?\.conDeshacer \? await loDeAntes\(leadId, trato\) : null;/, 'el Deshacer sale de lo que vio la pantalla');
  assert.ok(acc.indexOf('await loDeAntes(leadId, trato)') < acc.indexOf('const cambios = await guardarCuotasPorId('), 'lo de antes se lee después de escribir');
  assert.match(acc, /if \(c\?\.moneda != null && monedaDeCuota\(c\.moneda\) && !\(Number\(c\.montoOriginal\) > 0\)\) return \{ ok: false/, 'una cuota en pesos sin sus pesos pasa');
});

test('el editor dibujado con la ficha de Nadia: su plan leído, el aviso de la suscripción y sus 12 cuotas', () => {
  const lead = { id: 2605, nombre: 'Nadia H Tremari', estado_lead: 'ganado', venta_tipo: 'suscripcion', suscripcion_monto_usd: 4235.29, suscripcion_meses: 12, cobro_inicial_usd: null, monto_cuota_usd: null, total_cuotas: null, dia_de_pago: null };
  const html = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(raiz, 'tests/_plan-tramos-hijo.ts'), JSON.stringify({ lead, pagos: NADIA, hoy: '2026-10-29' })], { cwd: raiz, encoding: 'utf8', timeout: 120_000 });
  assert.match(html, /Es una suscripción: al guardar el plan pasa a «Pago único»\./);
  assert.match(html, /value="4235\.29"/, 'el monto del tramo no es el de sus cuotas');
  assert.match(html, /value="2026-11-08"/, 'la primera cuota no es la del 08/11');
  assert.match(html, /12 cuotas · se cobran US\$ 50\.823,48/);
  assert.equal((html.match(/<li /g) ?? []).length, 12, 'no dibujó una fila por cuota');
  assert.doesNotMatch(html, /a mano/, 'una cuota de su plan aparece tocada a mano');
});

test('cobrar una cuota en pesos: «Marcar pagada» y el link la proponen en su moneda, y en la ficha se editan sus dos montos', () => {
  const piezas = fuente('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.match(piezas, /useState<Plata>\(monedaCuota \? \{ moneda: monedaCuota, monto: String\(Number\(cuota\.monto_original\)\), usd: '' \}/);
  const link = fuente('app/crm/[id]/CobrarConLink.tsx');
  assert.match(link, /moneda === cuota\.moneda\.toUpperCase\(\) \? String\(cuota\.montoOriginal\) : ''/, 'el link propone los pesos en otra moneda');
  assert.match(fuente('app/crm/lead-view/ficha/pagos/cobrar.tsx'), /moneda: q\.moneda \?\? null, montoOriginal: q\.monto_original != null \? Number\(q\.monto_original\) : null/);
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /onGuardar=\{\(v\) => editar\(q, \{ montoOriginal: Number\(v\) \}\)\}/);
  const ed = fuente('lib/pagos.ts');
  assert.match(ed, /if \(!monedaPropia\) throw new Error\('Esa cuota es en dólares: cambia su monto\.'\);/);
});

// ── La verificación adversarial de 9fc4030dd (Integración, 29/10/2026) ────────
// Cada caso con la entrada del informe (C:/dev/revisiones/2910-verificacion-pagos-tramos-9fc4030dd.md).

const mes = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
const tresDe500 = (): Fila[] => [1, 2, 3].map((i) => ({ id: i, numero: i, monto_usd: 500, fecha_esperada: mes(2026, 9 + i, 10), pagado: false }));
/** El editor dibujado sin navegador (tests/_plan-tramos-hijo.ts) con ese lead y esas cuotas. */
const dibujar = (lead: Record<string, unknown>, pagos: Fila[]) =>
  execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(raiz, 'tests/_plan-tramos-hijo.ts'), JSON.stringify({ lead, pagos, hoy: '2026-10-29' })], { cwd: raiz, encoding: 'utf8', timeout: 120_000 });

test('A1 · cobrar a medias una cuota en pesos: los dólares vacíos van a la tasa de la cuota y la diferencia queda pendiente', () => {
  // MXN 12.000 = US$600; se cobraron 6.000 y «Cuánto es en dólares» quedó vacío.
  const cuota = { monto_usd: 600, moneda: 'MXN', monto_original: 12000 };
  const mitad = dolaresALaTasaDeLaCuota(cuota, { moneda: 'MXN', montoOriginal: 6000 });
  assert.equal(mitad, 300, 'la mitad de los pesos no es la mitad de los dólares');
  assert.equal(diferenciaPendiente(600, mitad, { yaPagada: false, resto: 'pendiente' }), 300, 'la cuota quedó cobrada entera: se perdían 6.000 pesos');
  assert.equal(dolaresALaTasaDeLaCuota(cuota, { moneda: 'mxn', montoOriginal: 12000 }), 600, 'los pesos enteros son la cuota entera');
  // Otra moneda que la de la cuota, o una cuota en dólares: no hay tasa, y vale lo de siempre (la cuota).
  assert.equal(dolaresALaTasaDeLaCuota(cuota, { moneda: 'ARS', montoOriginal: 6000 }), null);
  assert.equal(dolaresALaTasaDeLaCuota({ monto_usd: 600 }, { moneda: 'MXN', montoOriginal: 6000 }), null);
  assert.equal(dolaresALaTasaDeLaCuota(cuota, { moneda: 'USD', montoOriginal: null }), null);
  // «Marcar pagada» y el server la usan: la API de MaKo manda los pesos sin los dólares.
  assert.match(fuente('app/crm/lead-view/ficha/pagos/piezas.tsx'), /const aLaTasa = dolaresALaTasaDeLaCuota\(cuota, \{ moneda: plata\.moneda, montoOriginal: numero\(plata\.monto\) \}\);\n  const p = plataParaServer\(plata, aLaTasa \?\? valorUsd\);/, '«Marcar pagada» toma los dólares de la cuota entera');
  assert.match(fuente('lib/pagos.ts'), /\? centavos\(datos\.monto\) : dolaresALaTasaDeLaCuota\(fila, datos\);/, '`cobrarCuota` toma los dólares de la cuota entera');
});

test('A2 · el editor abre SIN el anticipo que se quitó o se devolvió (y el total en dos monedas no se lee doble)', () => {
  // `cobro_inicial_usd` 1000 sigue en el lead, pero el #0 se devolvió por la pasarela (impago, sin vencimiento, con proveedor).
  const pagos: Fila[] = [
    { id: 10, numero: 0, monto_usd: 1000, fecha_esperada: null, pagado: false, proveedor: 'stripe', cobro_id: 77 },
    { id: 1, numero: 1, monto_usd: 300, fecha_esperada: '2026-11-01', pagado: false },
    { id: 2, numero: 2, monto_usd: 300, fecha_esperada: '2026-12-01', pagado: false },
    { id: 3, numero: 3, monto_usd: 600, fecha_esperada: '2027-01-01', pagado: false, moneda: 'MXN', monto_original: 12000 },
    { id: 4, numero: 4, monto_usd: 600, fecha_esperada: '2027-02-01', pagado: false, moneda: 'MXN', monto_original: 12000 },
  ];
  const lead = { id: 77, nombre: 'Prueba', estado_lead: 'ganado', venta_tipo: 'unico', cobro_inicial_usd: 1000, monto_cuota_usd: 300, total_cuotas: 4, dia_de_pago: 1 };
  const html = dibujar(lead, pagos);
  assert.match(html, /placeholder="Sin anticipo" value=""/, 'el anticipo devuelto volvió (salía de la columna `cobro_inicial_usd`)');
  assert.doesNotMatch(html, /value="1000"/);
  // B5: los US$1.800 ya incluyen los pesos; «$ 24.000 MXN · US$ 1.800» se leía como si sumara dos veces.
  assert.match(html, /4 cuotas · se cobran US\$ 600 \+ \$ 24\.000 MXN \(US\$ 1\.800 en total\)/);
  // Y guardar lo que abrió no cobra nada de nuevo, con el #0 devuelto o quitado.
  assert.ok(nada(guardar(pagos, { ...abrir(pagos, true), anticipo: null, planConInicial: true }).plan), 'abrir y guardar cambió cuotas');
  const quitado = pagos.slice(1);
  assert.ok(nada(guardar(quitado, { ...abrir(quitado, true), anticipo: null, planConInicial: true }).plan), 'abrir y guardar cambió cuotas');
});

test('M1 · acortar el plan con la última impaga protegida: toma la fecha que pide el plan, o se avisa por qué no', () => {
  const plan2 = (cantidad: number): TramoPlan[] => [{ monto: 500, moneda: 'USD', cada: 'mes', dias: [10], cantidad }];
  // Con un link sin pagar, la fecha se puede mover: la del link pasa al 10/12 (antes quedaba el 10/01, sin aviso).
  const link = guardar(tresDe500(), { desde: '2026-11-10', tramos: plan2(2) }, { 3: ['link'] });
  assert.deepEqual(impagas(link.filas).map((q) => [q.id, q.fecha_esperada]), [[1, '2026-11-10'], [3, '2026-12-10']], 'la protegida no tomó su lugar en el plan');
  assert.equal(link.deuda, 1000);
  // Dos tramos (2 × 500 y 1 × 800 con link) y se quita el segundo: el link no deja bajar el monto, y se dice.
  const dos: Fila[] = [...tresDe500().slice(0, 2), { id: 3, numero: 3, monto_usd: 800, fecha_esperada: '2027-01-10', pagado: false }];
  const sinTramo2 = guardar(dos, { desde: '2026-11-10', tramos: plan2(2) }, { 3: ['link'] });
  assert.match(avisoDeConservadas(sinTramo2.plan as PlanDeCuotas) ?? '', /Cuota 3: tiene un link sin pagar/, 'la deuda quedó en US$1.300 para un plan de US$1.000, sin aviso');
  // Con un recordatorio corriendo no se toca nada de ella, y también se dice.
  const rec = guardar(tresDe500(), { desde: '2026-11-10', tramos: plan2(2) }, { 3: ['recordatorio'] });
  assert.match(avisoDeConservadas(rec.plan as PlanDeCuotas) ?? '', /Cuota 3: tiene un recordatorio en curso/);
});

test('M2 · más de 10 rachas con monedas mezcladas: abrir y guardar no le cambia la moneda a ninguna cuota', () => {
  // 12 cuotas los días 5 desde el 05/11/2026: de US$100 a US$900, MXN 9.000 (US$450), US$600 y MXN 9.000 (US$450).
  const base: Fila[] = Array.from({ length: 12 }, (_, i) => {
    const f = { id: 101 + i, numero: i + 1, fecha_esperada: mes(2026, 10 + i, 5), pagado: false };
    if (i < 9) return { ...f, monto_usd: 100 * (i + 1) };
    if (i === 10) return { ...f, monto_usd: 600 };
    return { ...f, monto_usd: 450, moneda: 'MXN', monto_original: 9000 };
  });
  const o = abrir(base);
  assert.equal(o.tramos.length, 10, 'el caso es el de más de 10 rachas');
  const r = guardar(base, { desde: o.desde, tramos: o.tramos, cambios: o.cambios });
  assert.ok(nada(r.plan), `abrir y guardar cambió cuotas: ${JSON.stringify(r.plan?.actualizar)}`);
  const once = r.filas.find((q) => q.id === 111) as Fila;
  assert.equal(once.moneda ?? null, null, 'la cuota de US$600 quedó en pesos');
  const [d] = disparosDeCobranza({ vencidas: [], porVencer: [{ pago_id: 111, lead_id: 1, lead_nombre: 'X', numero: 11, monto_usd: Number(once.monto_usd), fecha_esperada: once.fecha_esperada as string, dias: 1, moneda: once.moneda ?? null, monto_original: once.monto_original ?? null }] });
  assert.equal(d.datosEstables.cuota_monto, 'US$ 600', 'el recordatorio pasó a pedir pesos');
});

test('M3 · dos pestañas guardan el mismo plan: la segunda no duplica las cuotas nuevas, dice que el plan cambió', () => {
  const base = tresDe500();
  const cinco: TramoPlan[] = [{ monto: 500, moneda: 'USD', cada: 'mes', dias: [10], cantidad: 5 }];
  const a = guardar(base, { desde: '2026-11-10', tramos: cinco });
  assert.equal(impagas(a.filas).length, 5);
  // La pestaña B abrió antes de que A guardara: sus `vistos` son los 3 de antes, y el server lee la base de AHORA.
  const armado = cuotasDeTramos({ desde: '2026-11-10', tramos: cinco });
  assert.ok(armado.ok);
  const b = cuotasDelPlanPorTramos({ pagos: base, protegidas: new Set(), anticipo: null, lista: armado.cuotas, planConInicial: false });
  assert.ok(b.ok);
  assert.match(planCambiadoAfuera(existentesDe(a.filas), new Set(b.vistos)) ?? '', /cambió en otra pantalla .*«Cuota 4».*No se guardó nada/, 'B agregaba sus 2 al lado: 7 cuotas');
  // Lo que la pantalla vio entero pasa; y el resto de un cobro por menos que nació en el medio no frena nada (va aparte).
  const todas = new Set(impagas(a.filas).map((q) => q.id));
  assert.equal(planCambiadoAfuera(existentesDe(a.filas), todas), null);
  const conResto = [...a.filas, { id: 900, numero: 9, monto_usd: 100, fecha_esperada: '2026-12-10', pagado: false, resto_de: 2 }];
  assert.equal(planCambiadoAfuera(existentesDe(conResto), todas), null);
  // El server lo mira ANTES de escribir, y sólo para el editor por tramos (`sobreLoVisto`).
  const srv = fuente('lib/pagos.ts');
  assert.match(srv, /if \(opts\.sobreLoVisto && opts\.vistos\) \{\n    const cambio = planCambiadoAfuera\(existentes, opts\.vistos\);\n    if \(cambio\) throw new Error\(cambio\);/);
  assert.ok(srv.indexOf('planCambiadoAfuera(existentes, opts.vistos)') < srv.indexOf('const plan = reconciliarCuotas(existentes, deseadas, modo, opts);'), 'se mira después de reconciliar');
  assert.match(fuente('app/crm/[id]/pagos-campo-actions.ts'), /sobreLoVisto: como\?\.sobreLoVisto === true \}\);/);
});

test('B4 · 60 cuotas y un anticipo: lo frena la pantalla, no el server con «Son demasiadas cuotas.»', () => {
  const a = cuotasDeTramos({ desde: '2026-11-01', tramos: [{ monto: 100, moneda: 'USD', cada: 'mes', cantidad: 60 }] });
  assert.ok(a.ok);
  const anticipo: AnticipoPlan = { monto_usd: 500, moneda: null, monto_original: null, fecha: '2026-10-29' };
  const con = cuotasDelPlanPorTramos({ pagos: [], protegidas: new Set(), anticipo, lista: a.cuotas, planConInicial: false });
  assert.ok(!con.ok && /Son más de 60 cuotas contando el anticipo/.test(con.error), 'la pantalla dejó pasar 61 cuotas');
  assert.ok(cuotasDelPlanPorTramos({ pagos: [], protegidas: new Set(), anticipo: null, lista: a.cuotas, planConInicial: false }).ok, 'sin anticipo, 60 entran');
});

test('B7 · con la única cuota del plan cobrada, el aviso está bien escrito', () => {
  const pagos: Fila[] = [{ id: 1, numero: 1, monto_usd: 500, fecha_esperada: '2026-11-10', pagado: true }];
  const a = cuotasDeTramos({ desde: '2026-11-10', tramos: [{ monto: 500, moneda: 'USD', cada: 'mes', cantidad: 1 }] });
  assert.ok(a.ok);
  const r = cuotasDelPlanPorTramos({ pagos, protegidas: new Set(), anticipo: null, lista: a.cuotas, planConInicial: false });
  assert.ok(!r.ok && r.error === 'La cuota del plan ya está cobrada: agrega cuotas para cobrar más.', r.ok ? 'armó' : r.error);
});

// El test 13 de tests/api-mako-plan-tramos.test.ts cambia monto y moneda A LA VEZ: sacándole a la firma la fecha, o la moneda con
// su monto, seguía verde (3/11/2026). Correr la fecha de una cuota es la edición más común de la ficha.
test('B8 · cada dato de la cuota cuenta para el «sí»: la fecha sola, los dólares solos, la moneda sola, el monto en ella solo', () => {
  const cuota: Fila = { id: 32, numero: 2, monto_usd: 600, fecha_esperada: '2026-12-01', pagado: false, moneda: 'MXN', monto_original: 12000 };
  const otra: Fila = { id: 33, numero: 3, monto_usd: 600, fecha_esperada: '2027-01-01', pagado: false, moneda: 'MXN', monto_original: 12000 };
  const vistas = cuotasVistas([cuota, otra], [cuota.id, otra.id]);
  assert.equal(planCambioDesde([cuota, otra], vistas), null, 'sin cambios, el «sí» pasa');
  const ediciones: Array<[string, Partial<Fila>]> = [
    ['la fecha', { fecha_esperada: '2026-12-15' }],
    ['los dólares', { monto_usd: 650 }],
    ['la moneda', { moneda: 'ARS' }],
    ['el monto en su moneda', { monto_original: 15000 }],
  ];
  for (const [que, edicion] of ediciones) {
    assert.match(planCambioDesde([{ ...cuota, ...edicion }, otra], vistas) ?? '', /cambió «Cuota 2»/, `editar sólo ${que} se pisaba`);
  }
});

test('B13 · la diferencia de un cobro a medias en pesos se dice en pesos: la misma regla que la 0347, en la ficha y en la API', () => {
  const cuota = { monto_usd: 600, moneda: 'MXN', monto_original: 12000 };
  assert.deepEqual(restoEnLaMonedaDeLaCuota(cuota, { moneda: 'MXN', montoOriginal: 6000 }), { moneda: 'MXN', monto: 6000 });
  assert.deepEqual(restoEnLaMonedaDeLaCuota(cuota, { moneda: 'mxn', montoOriginal: 4000.5 }), { moneda: 'MXN', monto: 7999.5 });
  // Lo que la 0347 deja en dólares: cobrada en otra moneda, la cuota sin pesos, o los pesos enteros (aunque a otra tasa).
  assert.equal(restoEnLaMonedaDeLaCuota(cuota, { moneda: 'USD', montoOriginal: 300 }), null);
  assert.equal(restoEnLaMonedaDeLaCuota({ moneda: 'MXN', monto_original: null }, { moneda: 'MXN', montoOriginal: 6000 }), null);
  assert.equal(restoEnLaMonedaDeLaCuota(cuota, { moneda: 'MXN', montoOriginal: 12000 }), null);
  assert.equal(restoEnLaMonedaDeLaCuota({ moneda: null, monto_original: null }, { moneda: null, montoOriginal: null }), null);
  // El modal «Marcar pagada» y lo que contesta la ficha al guardar la dicen así (decían «Faltan $300»).
  const modal = fuente('app/crm/lead-view/ficha/pagos/piezas.tsx');
  assert.match(modal, /const faltaEnSuMoneda = falta > 0 && p\.ok \? restoEnLaMonedaDeLaCuota\(cuota, p\) : null;/);
  assert.match(modal, /Faltan \{faltaEnSuMoneda \? `\$\{formatoMonto\(faltaEnSuMoneda\.monto, faltaEnSuMoneda\.moneda\)\}/);
  assert.match(fuente('lib/pagos.ts'), /pendienteEnSuMoneda: pend > 0 \? restoEnLaMonedaDeLaCuota\(fila, \{ moneda: enMoneda\?\.moneda, montoOriginal: enMoneda\?\.montoOriginal \}\) : null,/);
  assert.match(fuente('app/crm/[id]/deal-actions.ts'), /return \{ pendiente: r\.pendiente, pendienteEnSuMoneda: r\.pendienteEnSuMoneda, porLink: null, yaEstaba: false \};/);
});
