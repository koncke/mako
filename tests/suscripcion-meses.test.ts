// =============================================================================
// tests/suscripcion-meses — la suscripción MES A MES (lib/suscripcion-meses.ts), con los casos reales del encargo
// =============================================================================
// docs/relevo/suscripciones-ficha-encargo.md: Código Inmobiliario paga 146 en octubre, 238 en noviembre en DOS pagos
// (94 el 4/11 y 144 el 5/11) y 426 en diciembre; además, pagos sueltos fuera del mes (el diferencial). Y los otros: el que
// paga siempre lo mismo, el que paga tarde, el que pagó dos veces en un mes, el que se corta y vuelve, el que baja.
// Los datos son inventados con la forma de los reales (AGENTS.md: nada de datos de clientes en tests/).
// ROMPIÉNDOLO (5/11/2026, base 11/0): sin la rama del ajuste → 1 fallo · sin la regla de compatibilidad (una mensualidad
// sin historia vale un mes) → 1 · sin repartir un adelanto → 1 · sin la cancelación vieja como corte → 1 · el monto de
// hoy para todos los meses → 6 · sin el monto inferido → 1 · ignorando el mes elegido → 1 · sin los cortes → 2. Y un
// cambio sin efecto (renombrar una variable local del módulo) → 11/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  historiaDeSuscripcion, montoVigente, montoPorLoPagado, mesSugerido, nombreDelMes,
  type MovimientoSuscripcion, type PagoDeSuscripcion,
} from '../lib/suscripcion-meses';

let id = 0;
const mensualidad = (monto: number, fecha: string, extra: Partial<PagoDeSuscripcion> = {}): PagoDeSuscripcion =>
  ({ id: ++id, monto_usd: monto, pagado: true, fecha_esperada: fecha, fecha_pago: fecha, nacio_cobrada: true, es_mensualidad: true, ...extra });
const suelto = (monto: number, fecha: string, extra: Partial<PagoDeSuscripcion> = {}): PagoDeSuscripcion =>
  ({ id: ++id, monto_usd: monto, pagado: true, fecha_esperada: fecha, fecha_pago: fecha, nacio_cobrada: true, ...extra });

// Código Inmobiliario, como lo tiene que dejar la pantalla nueva.
const CODIGO_MOVS: MovimientoSuscripcion[] = [
  { tipo: 'monto', desde: '2026-10-21', montoUsd: 146 },
  { tipo: 'monto', desde: '2026-11-01', montoUsd: 238, dia: 5 },
  { tipo: 'monto', desde: '2026-12-01', montoUsd: 426 },
];
const codigo = (pagos: PagoDeSuscripcion[], hoy = '2026-11-05') => historiaDeSuscripcion({
  inicio: '2026-10-21', montoUsd: 238, plazoMeses: null, movimientos: CODIGO_MOVS, pagos, hoy,
});

test('Código: 146 en octubre, 238 en dos pagos en noviembre y 426 esperado en diciembre', () => {
  const h = codigo([
    mensualidad(146, '2026-10-21'),
    mensualidad(94, '2026-11-04', { suscripcion_mes: '2026-11-01', metodo: 'cripto' }),
    mensualidad(144, '2026-11-05', { suscripcion_mes: '2026-11-01', metodo: 'cripto' }),
    // El diferencial de un cliente nuevo: sus días hasta el próximo 5. Suma a lo cobrado y no paga ningún mes.
    suelto(20, '2026-10-28', { suscripcion_ajuste: true, concepto: 'Diferencial' }),
  ]);
  assert.deepEqual(h.meses.map((m) => [m.mes, m.vence, m.esperadoUsd, m.pagadoUsd, m.estado, m.cambio]), [
    ['2026-10', '2026-10-21', 146, 146, 'pagado', 'empezo'],
    ['2026-11', '2026-11-05', 238, 238, 'pagado', 'subio'],
    ['2026-12', '2026-12-05', 426, 0, 'proximo', 'subio'],
  ]);
  assert.equal(h.meses[1].pagos.length, 2, 'noviembre se pagó en dos pagos, los dos en noviembre');
  assert.equal(h.meses[1].antesUsd, 146);
  assert.equal(h.meses[0].ajustes[0]?.montoUsd, 20, 'el diferencial va aparte, en su mes');
  assert.equal(h.montoHoyUsd, 238);
  assert.equal(h.diaDeCobro, 5);
  assert.deepEqual(h.proximo, { mes: '2026-12', vence: '2026-12-05', faltaUsd: 426, vencido: false });
  assert.equal(h.totalPagadoUsd, 404, 'lo cobrado suma los meses y el diferencial');
  assert.equal(h.ajustesUsd, 20);
  assert.equal(h.mesesSinPagar, 0);
});

test('Código, con noviembre registrado sin decir el mes: los dos pagos completan noviembre, no «adelantan» diciembre', () => {
  const h = codigo([mensualidad(146, '2026-10-21'), mensualidad(94, '2026-11-04'), mensualidad(144, '2026-11-05')]);
  assert.deepEqual(h.meses.map((m) => [m.mes, m.pagadoUsd, m.estado]), [
    ['2026-10', 146, 'pagado'], ['2026-11', 238, 'pagado'], ['2026-12', 0, 'proximo'],
  ]);
});

test('Código antes de cargar noviembre: el 5/11 vence noviembre, con 238', () => {
  const h = codigo([mensualidad(146, '2026-10-21')]);
  assert.equal(h.meses[1].estado, 'vence-hoy');
  assert.equal(h.mesesSinPagar, 1);
  assert.equal(h.deudaUsd, 238);
  // Y con uno de los dos pagos, el mes queda a medias, con lo que falta.
  const medio = codigo([mensualidad(146, '2026-10-21'), mensualidad(94, '2026-11-04', { suscripcion_mes: '2026-11-01' })]);
  assert.equal(medio.meses[1].estado, 'parcial');
  assert.equal(medio.meses[1].faltaUsd, 144);
  assert.equal(medio.mesesParciales, 1);
});

test('el que paga siempre lo mismo, y el que paga tarde: el pago va al mes más viejo que falta', () => {
  const hoy = '2026-11-05';
  const base = { inicio: '2026-08-18', montoUsd: 97, plazoMeses: null, hoy };
  const alDia = historiaDeSuscripcion({ ...base, pagos: [mensualidad(97, '2026-08-18'), mensualidad(97, '2026-09-18'), mensualidad(97, '2026-10-18')] });
  assert.deepEqual(alDia.meses.map((m) => m.estado), ['pagado', 'pagado', 'pagado', 'por-cobrar', 'proximo']);
  assert.equal(alDia.proximaFecha, '2026-11-18');
  assert.equal(alDia.mesesSinPagar, 0);
  // Octubre lo pagó el 2 de noviembre: es octubre, no noviembre.
  const tarde = historiaDeSuscripcion({ ...base, pagos: [mensualidad(97, '2026-08-18'), mensualidad(97, '2026-09-18'), mensualidad(97, '2026-11-02')] });
  assert.deepEqual(tarde.meses.map((m) => m.estado), ['pagado', 'pagado', 'pagado', 'por-cobrar', 'proximo']);
  // El mes que se ELIGE al registrar manda: pagó noviembre por adelantado y octubre sigue vencido.
  const elegido = historiaDeSuscripcion({ ...base, pagos: [mensualidad(97, '2026-08-18'), mensualidad(97, '2026-09-18'), mensualidad(97, '2026-11-02', { suscripcion_mes: '2026-11-01' })] });
  assert.deepEqual(elegido.meses.map((m) => m.estado), ['pagado', 'pagado', 'vencido', 'pagado', 'proximo']);
  // Y si no pagó octubre todavía, está vencido.
  const debe = historiaDeSuscripcion({ ...base, pagos: [mensualidad(97, '2026-08-18'), mensualidad(97, '2026-09-18')] });
  assert.equal(debe.meses[2].estado, 'vencido');
  assert.deepEqual(debe.proximo, { mes: '2026-10', vence: '2026-10-18', faltaUsd: 97, vencido: true });
});

test('se corta y vuelve (con otro monto): los meses del corte no se cobran, y la vuelta se ve', () => {
  const h = historiaDeSuscripcion({
    inicio: '2026-06-10', montoUsd: 120, plazoMeses: null, hoy: '2026-11-05',
    movimientos: [
      { tipo: 'monto', desde: '2026-06-10', montoUsd: 100 },
      { tipo: 'corte', desde: '2026-08-01' },
      { tipo: 'vuelta', desde: '2026-10-01', montoUsd: 120 },
    ],
    pagos: [mensualidad(100, '2026-06-10'), mensualidad(100, '2026-07-10'), mensualidad(120, '2026-10-10')],
  });
  assert.deepEqual(h.meses.map((m) => [m.mes, m.estado, m.cambio]), [
    ['2026-06', 'pagado', 'empezo'], ['2026-07', 'pagado', null], ['2026-08', 'cortado', 'se-corto'], ['2026-09', 'cortado', null],
    ['2026-10', 'pagado', 'volvio'], ['2026-11', 'por-cobrar', null], ['2026-12', 'proximo', null],
  ]);
  assert.equal(h.meses[4].antesUsd, 100, 'volvió con otro monto: se ve de cuánto a cuánto');
  assert.equal(h.cortadaDesde, null);
  assert.equal(h.montoHoyUsd, 120);
  assert.equal(h.mesesSinPagar, 0, 'los meses cortados no se deben');
});

test('cortada hoy: no paga nada, no tiene próximo y lo de antes sigue debiéndose', () => {
  const h = historiaDeSuscripcion({
    inicio: '2026-08-20', montoUsd: 50, plazoMeses: null, hoy: '2026-11-05', canceladaAt: '2026-10-15T12:00:00Z',
    pagos: [mensualidad(50, '2026-08-20')],
  });
  // La cancelación vieja corta desde el primer mes que vence DESPUÉS: octubre vencía el 20 → se corta en octubre.
  assert.equal(h.cortadaDesde, '2026-10');
  assert.deepEqual(h.meses.map((m) => m.estado), ['pagado', 'vencido', 'cortado', 'cortado', 'cortado']);
  assert.equal(h.montoHoyUsd, null);
  assert.equal(h.proximo, null);
  assert.equal(h.mesesSinPagar, 1, 'septiembre se debe aunque después se haya cortado');
});

test('baja el plan desde un mes: el de antes no cambia (no se reescribe el pasado)', () => {
  const h = historiaDeSuscripcion({
    inicio: '2026-09-01', montoUsd: 300, plazoMeses: null, hoy: '2026-10-20',
    movimientos: [{ tipo: 'monto', desde: '2026-09-01', montoUsd: 500 }, { tipo: 'monto', desde: '2026-10-01', montoUsd: 300 }],
    pagos: [mensualidad(500, '2026-09-01'), mensualidad(300, '2026-10-01')],
  });
  assert.deepEqual(h.meses.map((m) => [m.esperadoUsd, m.estado, m.cambio]), [[500, 'pagado', 'empezo'], [300, 'pagado', 'bajo'], [300, 'proximo', null]]);
});

test('⚠️ sin monto cargado el MRR no es 0: sale de lo que pagó el último mes, y se dice que es una estimación', () => {
  const h = historiaDeSuscripcion({ inicio: '2026-10-21', montoUsd: null, plazoMeses: null, hoy: '2026-11-05', pagos: [mensualidad(146, '2026-10-21')] });
  assert.equal(h.montoHoyUsd, 146);
  assert.equal(h.montoInferido, true);
  assert.equal(h.meses[0].estado, 'pagado', 'sin monto, un mes con pagos está pagado');
  assert.equal(montoPorLoPagado([mensualidad(94, '2026-11-04'), mensualidad(144, '2026-11-05'), mensualidad(146, '2026-10-21')]), 238);
  assert.equal(montoVigente(null, [], '2026-11-05'), null);
  assert.equal(montoVigente(null, CODIGO_MOVS, '2026-11-05'), 238, 'el cambio de diciembre todavía no vale');
  assert.equal(montoVigente(238, CODIGO_MOVS, '2026-12-02'), 426);
});

test('un adelanto en un solo pago se reparte entre los meses que cubre', () => {
  const h = historiaDeSuscripcion({ inicio: '2026-09-10', montoUsd: 500, plazoMeses: null, hoy: '2026-10-01', pagos: [suelto(1500, '2026-09-10')] });
  assert.deepEqual(h.meses.map((m) => [m.mes, m.pagadoUsd, m.estado]), [['2026-09', 500, 'pagado'], ['2026-10', 500, 'pagado'], ['2026-11', 500, 'pagado']]);
  assert.equal(h.meses[2].pagos[0]?.totalUsd, 1500, 'cada parte dice de qué pago salió');
});

test('compatibilidad: sin cambios guardados, una mensualidad registrada vale un mes aunque el monto de hoy sea otro', () => {
  // La regla de `mesesDeUnaCobrada`: con la mensualidad de hoy (1.000) escrita encima de la de antes (500), contar por plata
  // juntaba dos meses en uno e inventaba deuda.
  const pagos = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((f) => mensualidad(500, f));
  const h = historiaDeSuscripcion({ inicio: '2026-04-01', montoUsd: 1000, plazoMeses: null, hoy: '2026-10-15', pagos });
  assert.equal(h.mesesPagados, 6);
  assert.equal(h.mesesSinPagar, 1, 'octubre: el 1/10 vencía y no hay pago');
});

test('plazo fijo: termina, y lo que se elige al registrar es el mes más viejo que falta', () => {
  const h = historiaDeSuscripcion({ inicio: '2026-06-10', montoUsd: 100, plazoMeses: 3, hoy: '2026-11-05', pagos: [mensualidad(100, '2026-06-10')] });
  assert.deepEqual(h.meses.map((m) => m.mes), ['2026-06', '2026-07', '2026-08']);
  assert.equal(h.terminada, true);
  assert.equal(h.montoHoyUsd, null);
  assert.equal(mesSugerido(h, '2026-11-05'), '2026-07');
  assert.equal(nombreDelMes('2026-07', '2026-11-05'), 'julio');
  assert.equal(nombreDelMes('2027-01', '2026-11-05'), 'enero 2027');
});
