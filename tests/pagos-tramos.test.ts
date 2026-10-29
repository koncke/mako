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
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  aplicarCambios, armadaDe, cambiosContra, cuotasDeTramos, cuotasDelPlanPorTramos, lineasDeCuotas, lugaresDelPlan, monedaDeCuota,
  reconciliarCuotas, soloLoQueCambio, tramosDeCuotas, type AnticipoPlan, type CuotaArmada, type CuotaDelLead, type CuotaExistente, type PlanDeCuotas,
  type Proteccion, type TramoPlan,
} from '../lib/pagos-campo';
import { disparosDeCobranza } from '../lib/cobranza';

const raiz = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

/** Nadia (lead 2605), como está en la base el 29/10/2026. */
const NADIA: CuotaDelLead[] = [
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
function guardar(pagos: Fila[], p: { desde: string; tramos: TramoPlan[]; anticipo?: AnticipoPlan | null; cambios?: Record<number, { monto_usd?: number; monto_original?: number; fecha?: string | null }>; planConInicial?: boolean; abiertas?: Fila[] }, protegidas: Record<number, Proteccion[]> = {}) {
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
  const existentes: CuotaExistente[] = pagos.map((q) => ({
    id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada, pagado: q.pagado,
    nacio_cobrada: !!q.nacio_cobrada, resto_de: q.resto_de ?? null, protegida: protegidas[q.id] ?? [], moneda: q.moneda ?? null, monto_original: q.monto_original ?? null,
  }));
  const plan = reconciliarCuotas(existentes, deseadas, 'porId', { vistos: new Set(encima.vistos), protegidasPrimero: true });
  return { encima, plan, filas: aplicar(pagos, plan), deuda: deudaDe(aplicar(pagos, plan)), lista };
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
  assert.match(ui, /await guardarCuotasAction\(l\.id, \[\.\.\.cuotas, \.\.\.aparte\], columnas, vistos, crm, \{ protegidasPrimero: true, conDeshacer: true \}\)/);
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
