// =============================================================================
// Admin › Revenue: los pagos de las agencias entran solos, por el libro de su mensualidad (10/11/2026)
// =============================================================================
// Martín: «recibimos un pago de Código por el cliente de Patricia y no se cargó automáticamente en admin». Revenue leía los
// `pagos` del CRM de la plataforma y los `cobros` de la pasarela; la mensualidad de una agencia entra por el libro de
// lib/agencia-mes.ts (app_settings de la plataforma), que no escribe `pagos`. Lo que fija, EJECUTANDO el código:
//   1. una orden del libro es un pago de Revenue, de la AGENCIA, por lo RECIBIDO (40, no 40,73) y con el día del libro;
//   2. lo aplicado a una entrada es cash, nunca MRR; lo aplicado a un mes, MRR; una orden repartida se parte según `aplicado`;
//   3. una orden atada a un pago del CRM (`recibo_pagos.pago_id`, mig 0408) no se cuenta dos veces; un recibo sin atar, sí cuenta;
//   4. un mes marcado a mano sin orden no suma y se dice;
//   5. la mensualidad del libro reemplaza a la del CRM (`conElLibro`): el MRR no se cuenta dos veces, sale UN movimiento y no un
//      corte y un vuelve, «Por cobrar» no dice que debe lo que pagó por el libro, y si el libro se apaga el CRM vuelve a contar;
//   6. Customers (Top Customers) suma el total de la agencia con lo del libro;
//   7. el lector REAL (`vistaDeIngresos`, tests/_admin-ingresos-libro-hijo.ts, sobre un PostgREST de mentira): la entrada de la
//      cliente aparece sola; atada, una vez; con el libro o los recibos caídos, un aviso y no un cero; diciembre, el MRR del libro;
//      y no escribe nada.
// Los nombres son de mentira (AGENTS.md). Los montos, las fechas y la orden, los medidos en producción el 10/11.
//
// Probado rompiéndolo (10/11/2026, el arnés restaura de memoria; con todo puesto, 0 fallos de 14). Cada rotura, sola:
//   · `pagosDelLibro` cuenta lo que se debía (`aplicado`, 40,73) en vez de lo recibido           → 6 fallos (1, 2, 6, 7a, 7c, 7f)
//   · `pagosDelLibro` le pone suscripción a una entrada (todo pasa a MRR)                         → 3 fallos (2, 7a, 7f)
//   · `partes` no reparte: la orden entera va a la primera clave                                   → 1 fallo (2)
//   · `ordenesAtadas` no mira `pago_id` (todo recibo ata su orden)                                 → 2 fallos (3, 7c)
//   · `ordenesAtadas` cuenta un recibo anulado                                                     → 1 fallo (3)
//   · `pagosDelLibro` no saltea las atadas                                                         → 2 fallos (3, 7b)
//   · sin el aviso de un mes a mano sin orden                                                      → 1 fallo (4)
//   · `conElLibro` no corta la suscripción del CRM (devuelve los tramos tal cual)                  → 4 fallos (5a, 5b, 5c, 7f)
//   · `conElLibro` corta también los tramos que vuelven después del libro                          → 1 fallo (5c)
//   · `porCobrarDe` no saltea las reemplazadas                                                     → 1 fallo (5b)
//   · el lector no suma los pagos del libro                                                        → 3 fallos (7a, 7c, 7f)
//   · el lector se traga el error del libro sin aviso                                              → 2 fallos (7d, 7e)
//   · el lector cuenta el libro aunque no pudo leer los recibos                                    → 1 fallo (7e)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularIngresos, conElLibro, suscripcionDelLibro, type ClienteIngreso, type Entrada, type PagoIngreso, type ProximoDeSuscripcion } from '../lib/admin-ingresos-reglas';
import { ordenesAtadas, pagosDelLibro, type FilaLibro } from '../lib/admin-ingresos-libro';
import { datosDeTop, topClientes } from '../app/admin/_polar/datos/clientes';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDEN = '464765031875870720';
const fila = (ag: number, resto: string, v: unknown): FilaLibro => ({ key: `agencia.mensualidad.${ag}.${resto}`, value: JSON.stringify(v) });
const orden = (ag: number, num: string, montoUsd: number, fecha: string, aplicado: Array<{ clave: string; montoUsd: number }>): FilaLibro =>
  fila(ag, `orden.${num}`, { orden: num, monto: montoUsd, moneda: 'USDT', montoUsd, fecha, comprobante: null, aplicado });
const NOMBRES = new Map([[13, 'Agencia Norte'], [22, 'Cliente Sur']]);
const sinAtar = new Set<string>();

const pagoCrm = (id: number, fecha: string, usd: number): PagoIngreso =>
  ({ id: `p:${id}`, cliente: 'ws:13', suscripcion: 'lead:1:casa', fecha, usd, medio: 'cripto', concepto: null });
const CRM = [pagoCrm(115, '2026-10-20', 146), pagoCrm(135, '2026-11-03', 94), pagoCrm(136, '2026-11-04', 144)];
const QUIEN = new Map<string, ClienteIngreso>([['ws:13', { clave: 'ws:13', nombre: 'Agencia Norte', ws: 13, leadId: 1 }]]);

test('1 · una orden del libro es un pago de la AGENCIA, por lo recibido y con el día del libro', () => {
  const r = pagosDelLibro([
    orden(13, ORDEN, 40, '2026-11-09T22:40:00', [{ clave: 'entrada:22', montoUsd: 40.73 }]),
    fila(13, 'config', { desde: '2026-12' }),
    fila(13, 'entrada.22', { ws: 22, desde: '2026-11-09', montoUsd: 40.73, pagadoUsd: 40.73, pagadoEl: '2026-11-09', ordenes: [ORDEN] }),
    { key: 'mako.timezone', value: 'America/Mexico_City' },
    // Una orden guardada bajo otra clave que la suya no es de fiar: no entra.
    { key: 'agencia.mensualidad.13.orden.111111111111111111', value: JSON.stringify({ orden: '222222222222222222', monto: 50, moneda: 'USDT', montoUsd: 50, fecha: '2026-11-09', aplicado: [] }) },
  ], { atadas: sinAtar, nombreWs: NOMBRES });
  assert.equal(r.pagos.length, 1, 'una orden, un pago');
  const [p] = r.pagos;
  assert.equal(p.cliente, 'ws:13', 'de la agencia que paga, no de la cliente');
  assert.equal(p.usd, 40, 'lo recibido: 40, no los 40,73 que se debían');
  // 22:40 sin zona en el comprobante: el día es el del libro (9/11), no el de pasarlo por UTC.
  assert.equal(p.fecha, '2026-11-09');
  assert.equal(p.medio, 'binance');
  assert.equal(p.concepto, 'Entrada de Cliente Sur');
  assert.equal(p.id, `a:13:${ORDEN}:entrada:22`);
  assert.deepEqual(r.agencias, [13]);
  assert.deepEqual(r.avisos, []);
});

test('2 · la entrada es cash y el mes es MRR; una orden repartida se parte según lo aplicado, sin perder un centavo', () => {
  const r = pagosDelLibro([
    orden(13, '555555555555555555', 400, '2026-12-03T10:00:00', [{ clave: 'mes:2026-12', montoUsd: 300 }, { clave: 'entrada:22', montoUsd: 100 }]),
    orden(13, '666666666666666666', 40, '2026-12-04T10:00:00', [{ clave: 'entrada:22', montoUsd: 40.73 }, { clave: 'mes:2026-12', montoUsd: 10 }]),
  ], { atadas: sinAtar, nombreWs: NOMBRES });
  const de = (num: string) => r.pagos.filter((p) => p.id.includes(num));
  assert.deepEqual(de('555555555555555555').map((p) => [p.usd, p.suscripcion]), [[300, suscripcionDelLibro(13)], [100, null]]);
  assert.equal(de('555555555555555555')[0].concepto, 'Mensualidad de diciembre 2026');
  const partes = de('666666666666666666');
  assert.equal(Math.round(partes.reduce((s, p) => s + (p.usd ?? 0), 0) * 100) / 100, 40, 'las partes suman lo recibido');
  assert.deepEqual(partes.map((p) => p.usd), [32.12, 7.88], '40 × 40,73 / 50,73 y lo que queda');
});

test('3 · una orden atada a un pago del CRM no se cuenta dos veces; un recibo sin atar o anulado no la ata', () => {
  const ordenes = [orden(13, ORDEN, 40, '2026-11-09T14:20:00', [{ clave: 'entrada:22', montoUsd: 40.73 }])];
  const conRef = (pago_id: number | null, anulado = false, referencia = ORDEN) => ordenesAtadas([{ medio: 'binance', referencia, pago_id, anulado }]);
  const atada = pagosDelLibro(ordenes, { atadas: conRef(200), nombreWs: NOMBRES });
  assert.equal(atada.pagos.length, 0, 'ya la cuenta el pago del CRM');
  assert.equal(atada.atadas, 1);
  // La referencia del recibo, como la escribió quien cargó el pago (con espacios): la misma orden.
  assert.equal(pagosDelLibro(ordenes, { atadas: conRef(200, false, '4647 6503 1875 8707 20'), nombreWs: NOMBRES }).pagos.length, 0);
  assert.equal(pagosDelLibro(ordenes, { atadas: conRef(null), nombreWs: NOMBRES }).pagos.length, 1, 'el recibo del libro, sin pago del CRM');
  assert.equal(pagosDelLibro(ordenes, { atadas: conRef(200, true), nombreWs: NOMBRES }).pagos.length, 1, 'un recibo anulado ya no ata nada');
});

test('4 · un mes marcado a mano sin su orden no suma y se dice', () => {
  const aMano = fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-03', totalUsd: 300, pagadoUsd: 300, ordenes: [], aMano: true });
  const r = pagosDelLibro([aMano], { atadas: sinAtar, nombreWs: NOMBRES });
  assert.equal(r.pagos.length, 0);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /1 mes de agencia marcado pagado a mano sin su orden/);
  const conOrden = fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-03', totalUsd: 300, pagadoUsd: 300, ordenes: ['555555555555555555'] });
  assert.deepEqual(pagosDelLibro([conOrden], { atadas: sinAtar, nombreWs: NOMBRES }).avisos, [], 'con su orden, la cuenta la orden');
});

const libroDic = (num: string, fecha: string, usd: number): PagoIngreso =>
  ({ id: `a:13:${num}:mes`, cliente: 'ws:13', suscripcion: suscripcionDelLibro(13), fecha, usd, medio: 'binance', concepto: null });

test('5a · el libro reemplaza a la mensualidad del CRM: MRR 300, no 538, y UN movimiento', () => {
  const r = calcularIngresos([...CRM, libroDic('555555555555555555', '2026-12-03', 300)], QUIEN, '2026-12-10');
  assert.equal(r.mrr, 300, 'el CRM vencía el 3/12 y su gracia seguía: sin el corte, 238 + 300');
  const dic = r.movimientos.filter((m) => m.fecha.startsWith('2026-12'));
  assert.deepEqual(dic.map((m) => [m.fecha, m.tipo, m.delta]), [['2026-12-03', 'sube', 62]], 'ni un «Se cortó» ni un «Volvió»');
  // Y la identidad de los meses sigue cerrando.
  for (let i = 1; i < r.meses.length; i++) {
    const a = r.meses[i - 1], m = r.meses[i];
    assert.equal(Math.round((a.mrr + m.nuevo + m.vuelve + m.sube - m.baja - m.corte) * 100) / 100, m.mrr, m.mes);
  }
});

test('5b · «Por cobrar» no le reclama a la historia del CRM lo que se pagó por el libro', () => {
  // La historia de la ficha no ve el libro: diría que diciembre está atrasado. La de verdad (lib/suscripcion-meses.ts) se fija
  // en tests/admin-ingresos.test.ts; acá alcanza con lo que diría.
  const historia: ProximoDeSuscripcion = { sinCobro: false, atrasado: { fecha: '2026-12-03', usd: 238 }, siguiente: null };
  const proximos = new Map([['lead:1:casa', historia]]);
  // El 1/12 la agencia todavía no pagó diciembre: la historia del CRM manda (lo debe de verdad).
  assert.equal(calcularIngresos(CRM, QUIEN, '2026-12-04', 12, proximos).porCobrar.filter((p) => p.atrasado).length, 1);
  const pago = calcularIngresos([...CRM, libroDic('555555555555555555', '2026-12-03', 300)], QUIEN, '2026-12-04', 12, proximos);
  assert.equal(pago.porCobrar.filter((p) => p.atrasado).length, 0, 'lo pagó por el libro');
  assert.deepEqual(pago.porCobrar.map((p) => [p.fecha, p.usd, p.atrasado]), [['2027-01-03', 300, false]], 'lo que viene es el próximo mes del libro');
  assert.equal(pago.clientes[0].estado, 'al-dia');
});

test('5c · si el libro se apaga y la mensualidad vuelve al CRM, el CRM vuelve a contar; la del CRM que nace con el libro vivo, no', () => {
  const tramos = [
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2026-11-03', fin: null, vence: '2026-12-03', cambios: [{ fecha: '2026-11-03', usd: 238 }] },
    { suscripcion: 'agencia:13', cliente: 'ws:13', inicio: '2026-12-03', fin: '2027-02-03', vence: '2027-02-03', cambios: [{ fecha: '2026-12-03', usd: 300 }] },
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2026-12-20', fin: null, vence: '2027-01-20', cambios: [{ fecha: '2026-12-20', usd: 90 }] },
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2027-03-01', fin: null, vence: '2027-04-01', cambios: [{ fecha: '2027-03-01', usd: 238 }] },
    // Otra cuenta sin libro: ni la mira.
    { suscripcion: 'lead:2:casa', cliente: 'ws:30', inicio: '2026-11-01', fin: null, vence: '2026-12-01', cambios: [{ fecha: '2026-11-01', usd: 97 }] },
  ];
  const r = conElLibro(tramos);
  assert.deepEqual(r.tramos.map((t) => [t.suscripcion, t.inicio, t.fin]), [
    ['lead:1:casa', '2026-11-03', '2026-12-03'],
    ['agencia:13', '2026-12-03', '2027-02-03'],
    ['lead:1:casa', '2027-03-01', null],
    ['lead:2:casa', '2026-11-01', null],
  ]);
  assert.deepEqual([...r.reemplazadas], [], 'su último tramo es del CRM y no lo tocó el libro: su historia vuelve a mandar');
});

test('6 · Customers (Top Customers): el total de la agencia suma lo que entró por el libro', () => {
  const libro = pagosDelLibro([orden(13, ORDEN, 40, '2026-11-09T14:20:00', [{ clave: 'entrada:22', montoUsd: 40.73 }])], { atadas: sinAtar, nombreWs: NOMBRES });
  const r = calcularIngresos([...CRM, ...libro.pagos], QUIEN, '2026-11-10');
  const top = topClientes(datosDeTop(r), null, null);
  assert.equal(top[0].clave, 'ws:13');
  assert.equal(top[0].totalCentavos, 42_400, '146 + 94 + 144 + 40');
  assert.equal(top[0].pagos, 4);
});

// ── El lector de verdad, sobre una base de mentira ─────────────────────────────────────────────────────────────────
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_admin-ingresos-libro-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'], timeout: 120_000,
});
type Escena = { mrr: number; cobradoEsteMes: number; cobradoTotal: number; avisos: string[]; clientes: Array<{ clave: string; total: number; mrr: number; leadId: number | null; estado: string }>; entradas: Entrada[]; movimientos: Array<{ fecha: string; tipo: string; delta: number }>; porCobrar: Array<{ atrasado: boolean }> };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Escena> & { noEscribio: { pagos: number; libroIgual: boolean } };
const deLaAgencia = (e: Escena) => e.clientes.find((c) => c.clave === 'ws:13')!;

test('7a · el lector: la entrada de la cliente aparece sola, como cash de la agencia, y no escribe nada', () => {
  const nov = R.noviembre;
  const libro = nov.entradas.filter((e) => e.id?.startsWith('a:'));
  assert.deepEqual(libro.map((e) => [e.id, e.usd, e.recurrente, e.fecha, e.cliente]), [[`a:13:${ORDEN}:entrada:22`, 40, false, '2026-11-09', 'ws:13']]);
  assert.equal(nov.mrr, 238, 'una entrada no es MRR');
  assert.equal(nov.cobradoEsteMes, 278, 'noviembre: 94 + 144 + 40');
  assert.equal(deLaAgencia(nov).total, 424);
  assert.equal(deLaAgencia(nov).leadId, 1, 'con su ficha del CRM');
  assert.deepEqual(nov.avisos, []);
  assert.deepEqual(R.noEscribio, { pagos: 3, libroIgual: true }, 'al leer, sin escribir en pagos ni en el libro');
});

test('7b · el lector: con la orden atada a un pago del CRM, entra una sola vez', () => {
  const e = R.atada;
  assert.equal(e.entradas.filter((x) => x.fecha === '2026-11-09').length, 1);
  assert.ok(!e.entradas.some((x) => x.id?.startsWith('a:')), 'la cuenta el pago del CRM, no el libro');
  assert.equal(e.cobradoTotal, 424);
});

test('7c · el lector: el recibo del libro sin pago del CRM no ata la orden', () => {
  assert.equal(R.reciboSinAtar.cobradoTotal, 424);
  assert.ok(R.reciboSinAtar.entradas.some((x) => x.id === `a:13:${ORDEN}:entrada:22`));
});

test('7d · el lector: si el libro no se lee, un aviso y no un cero escondido', () => {
  const e = R.libroCaido;
  assert.equal(e.cobradoTotal, 384, 'lo del CRM sigue');
  assert.equal(e.avisos.length, 1);
  assert.match(e.avisos[0], /^los pagos de las agencias por su mensualidad: /);
});

test('7e · el lector: sin saber qué órdenes ya están en el CRM, no cuenta el libro (contaría dos veces), y lo dice', () => {
  const e = R.recibosCaidos;
  assert.ok(!e.entradas.some((x) => x.id?.startsWith('a:')));
  assert.match(e.avisos.join(' | '), /los pagos de las agencias por su mensualidad: no pude ver cuáles ya están en el CRM/);
});

test('7f · el lector, en diciembre: el mes pagado por el libro es el MRR (300), sin contar la mensualidad del CRM dos veces', () => {
  const e = R.diciembre;
  assert.equal(e.mrr, 300);
  assert.equal(deLaAgencia(e).mrr, 300);
  assert.equal(deLaAgencia(e).total, 724, '146 + 94 + 144 + 40 + 300');
  assert.ok(e.entradas.some((x) => x.id === 'a:13:555555555555555555:mes:2026-12' && x.recurrente && x.usd === 300));
  const deDic = e.movimientos.filter((m) => m.fecha.startsWith('2026-12-0') && m.fecha >= '2026-12-02');
  assert.deepEqual(deDic.map((m) => [m.fecha, m.tipo, m.delta]), [['2026-12-03', 'sube', 62]]);
  assert.ok(!e.movimientos.some((m) => m.tipo === 'corte' || m.tipo === 'vuelve'));
  assert.equal(e.porCobrar.filter((p) => p.atrasado).length, 0);
});
