// =============================================================================
// Admin › Revenue: los pagos de las agencias entran solos, por el libro de su mensualidad (10/11/2026)
// =============================================================================
// Martín: «recibimos un pago de Código por el cliente de Patricia y no se cargó automáticamente en admin». Revenue leía los
// `pagos` del CRM de la plataforma y los `cobros` de la pasarela; la mensualidad de una agencia entra por el libro de
// lib/agencia-mes.ts (app_settings de la plataforma), que no escribe `pagos`. Lo que fija, EJECUTANDO el código:
//   1. una orden del libro es un pago de Revenue, de la AGENCIA, por lo RECIBIDO (40, no 40,73) y con el día del libro;
//   2. lo aplicado a una entrada es cash, nunca MRR; lo aplicado a un mes, MRR; una orden repartida se parte según `aplicado`;
//   3. una orden atada a un pago del CRM (`recibo_pagos.pago_id`, mig 0408) no se cuenta dos veces; un recibo sin atar, sí cuenta;
//   4. lo marcado a mano sin orden (un mes, o una entrada `AMANO…`) no suma y se dice; una orden ilegible, también;
//   5. la mensualidad del libro reemplaza a la del CRM (`conElLibro`): el MRR no se cuenta dos veces, sale UN movimiento, «Por
//      cobrar» no reclama lo que se pagó por el libro (tampoco por la otra clave de la misma historia, ni con el libro pagado tarde),
//      otra suscripción que la agencia compró no se toca, y si el libro se apaga el CRM vuelve a contar;
//   6. el MRR del libro es el del MES: un mes pagado en dos partes vale el mes, y dos meses pagados juntos no valen el doble;
//   7. Customers (Top Customers) suma el total de la agencia con lo del libro;
//   8. Sales › Orders: el recibo de una orden del libro SUMA (Revenue ya la cuenta); un recibo a mano sin atar, no;
//   9. el lector REAL (`vistaDeIngresos`, tests/_admin-ingresos-libro-hijo.ts, sobre un PostgREST de mentira): la entrada de la
//      cliente aparece sola; atada, una vez; con el libro o los recibos caídos, un aviso y no un cero; diciembre en dos partes, el
//      MRR del mes; y no escribe nada.
// Los nombres son de mentira (AGENTS.md). Los montos, las fechas y la orden, los medidos en producción el 10/11.
// Los casos 4b, 5d, 5e, 5f, 6 y 8 salen de la revisión independiente del 10/11 (docs/relevo/nube-ingresos-agencia.md).
//
// Probado rompiéndolo: el detalle, al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularIngresos, conElLibro, suscripcionDelLibro, type ClienteIngreso, type Entrada, type PagoIngreso, type ProximoDeSuscripcion, type Tramo } from '../lib/admin-ingresos-reglas';
import { ordenesAtadas, pagosDelLibro, type FilaLibro } from '../lib/admin-ingresos-libro';
import { datosDeTop, topClientes } from '../app/admin/_polar/datos/clientes';
import { pedidosDe, type ReciboVenta } from '../app/admin/_polar/datos/ventas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDEN = '464765031875870720';
const fila = (ag: number, resto: string, v: unknown): FilaLibro => ({ key: `agencia.mensualidad.${ag}.${resto}`, value: JSON.stringify(v) });
const orden = (ag: number, num: string, montoUsd: number, fecha: string, aplicado: Array<{ clave: string; montoUsd: number }>): FilaLibro =>
  fila(ag, `orden.${num}`, { orden: num, monto: montoUsd, moneda: 'USDT', montoUsd, fecha, comprobante: null, aplicado });
const CONFIG = fila(13, 'config', { desde: '2026-12', entradasDesde: '2026-11-06', medio: 'Binance' });
const NOMBRES = new Map([[13, 'Agencia Norte'], [22, 'Cliente Sur']]);
const sinAtar = new Set<string>();
const libroDe = (filas: FilaLibro[], hoy: string, atadas: ReadonlySet<string> = sinAtar) => pagosDelLibro(filas, { atadas, nombreWs: NOMBRES, hoy });

const pagoCrm = (id: number, fecha: string, usd: number, suscripcion = 'lead:1:casa'): PagoIngreso =>
  ({ id: `p:${id}`, cliente: 'ws:13', suscripcion, fecha, usd, medio: 'cripto', concepto: null, mensualidad: true });
const CRM = [pagoCrm(115, '2026-10-20', 146), pagoCrm(135, '2026-11-03', 94), pagoCrm(136, '2026-11-04', 144)];
const QUIEN = new Map<string, ClienteIngreso>([['ws:13', { clave: 'ws:13', nombre: 'Agencia Norte', ws: 13, leadId: 1 }]]);
const ordenDic = (num: string, usd: number, fecha: string, mes = '2026-12') => orden(13, num, usd, fecha, [{ clave: `mes:${mes}`, montoUsd: usd }]);
/** Revenue con lo del CRM y lo del libro, como lo arma el lector (con la historia del libro en `proximos`). */
const revenue = (crm: PagoIngreso[], filas: FilaLibro[], hoy: string, historiasCrm?: Map<string, ProximoDeSuscripcion>) => {
  const l = libroDe(filas, hoy);
  const proximos = new Map([...(historiasCrm ?? []), ...l.proximos]);
  return calcularIngresos([...crm, ...l.pagos], QUIEN, hoy, 12, proximos);
};
const movimientosDeDic = (r: ReturnType<typeof calcularIngresos>) => r.movimientos.filter((m) => m.fecha.startsWith('2026-12')).map((m) => [m.fecha, m.tipo, m.delta]);

test('1 · una orden del libro es un pago de la AGENCIA, por lo recibido y con el día del libro', () => {
  const r = libroDe([
    orden(13, ORDEN, 40, '2026-11-09T22:40:00', [{ clave: 'entrada:22', montoUsd: 40.73 }]),
    CONFIG,
    fila(13, 'entrada.22', { ws: 22, desde: '2026-11-09', montoUsd: 40.73, pagadoUsd: 40.73, pagadoEl: '2026-11-09', ordenes: [ORDEN] }),
    { key: 'mako.timezone', value: 'America/Mexico_City' },
  ], '2026-11-10');
  assert.equal(r.pagos.length, 1, 'una orden, un pago');
  const [p] = r.pagos;
  assert.equal(p.cliente, 'ws:13', 'de la agencia que paga, no de la cliente');
  assert.equal(p.usd, 40, 'lo recibido: 40, no los 40,73 que se debían');
  // 22:40 sin zona en el comprobante: el día es el del libro (9/11), no el de pasarlo por UTC.
  assert.equal(p.fecha, '2026-11-09');
  assert.equal(p.suscripcion, null, 'una entrada no es MRR');
  assert.equal(p.medio, 'binance');
  assert.equal(p.proveedorPagoId, ORDEN, 'la orden de Binance: con ella Orders la ata a su recibo');
  assert.equal(p.concepto, 'Entrada de Cliente Sur');
  assert.equal(p.id, `a:13:${ORDEN}:entrada:22`);
  assert.deepEqual(r.agencias, [13]);
  assert.equal(r.proximos.size, 0, 'sin un mes pagado no hay mensualidad del libro');
  assert.deepEqual(r.avisos, []);
});

test('2 · la entrada es cash y el mes es MRR; una orden repartida se parte según lo aplicado, sin perder un centavo', () => {
  const r = libroDe([
    orden(13, '555555555555555555', 400, '2026-12-03T10:00:00', [{ clave: 'mes:2026-12', montoUsd: 300 }, { clave: 'entrada:22', montoUsd: 100 }]),
    orden(13, '666666666666666666', 40, '2026-12-04T10:00:00', [{ clave: 'entrada:22', montoUsd: 40.73 }, { clave: 'mes:2026-12', montoUsd: 10 }]),
  ], '2026-12-10');
  const de = (num: string) => r.pagos.filter((p) => p.id.includes(num));
  assert.deepEqual(de('555555555555555555').map((p) => [p.usd, p.suscripcion]), [[300, suscripcionDelLibro(13)], [100, null]]);
  assert.equal(de('555555555555555555')[0].concepto, 'Mensualidad de diciembre 2026');
  const partes = de('666666666666666666');
  assert.equal(Math.round(partes.reduce((s, p) => s + (p.usd ?? 0), 0) * 100) / 100, 40, 'las partes suman lo recibido');
  assert.deepEqual(partes.map((p) => p.usd), [32.12, 7.88], '40 × 40,73 / 50,73 y lo que queda');
});

test('3 · una orden atada a un pago del CRM no se cuenta dos veces; un recibo sin atar o anulado no la ata', () => {
  const ordenes = [orden(13, ORDEN, 40, '2026-11-09T14:20:00', [{ clave: 'entrada:22', montoUsd: 40.73 }])];
  const conRef = (pago_id: number | null, anulado = false) => ordenesAtadas([{ medio: 'binance', referencia: ORDEN, pago_id, anulado }]);
  const atada = libroDe(ordenes, '2026-11-10', conRef(200));
  assert.equal(atada.pagos.length, 0, 'ya la cuenta el pago del CRM');
  assert.equal(atada.atadas, 1);
  // La orden como la tipeó quien la marcó a mano (con espacios): la misma que la del recibo, que se guarda normalizada.
  const conEspacios = [orden(13, '4647 6503 1875 8707 20', 40, '2026-11-09T12:00:00Z', [{ clave: 'entrada:22', montoUsd: 40.73 }])];
  assert.equal(libroDe(conEspacios, '2026-11-10', conRef(200)).pagos.length, 0);
  assert.equal(libroDe(ordenes, '2026-11-10', conRef(null)).pagos.length, 1, 'el recibo del libro, sin pago del CRM');
  assert.equal(libroDe(ordenes, '2026-11-10', conRef(200, true)).pagos.length, 1, 'un recibo anulado ya no ata nada');
});

test('4 · un mes marcado a mano sin su orden no suma y se dice', () => {
  const aMano = fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-03', totalUsd: 300, pagadoUsd: 300, ordenes: [], aMano: true });
  const r = libroDe([aMano], '2026-12-10');
  assert.equal(r.pagos.length, 0);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /1 pago de agencia marcado a mano sin su orden/);
  const conOrden = fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-03', totalUsd: 300, pagadoUsd: 300, ordenes: ['555555555555555555'] });
  assert.deepEqual(libroDe([conOrden], '2026-12-10').avisos, [], 'con su orden, la cuenta la orden');
});

test('4b · una entrada marcada a mano (orden AMANO…, por lo que se debía) no suma como cobrado; una orden ilegible, se dice', () => {
  const r = libroDe([
    orden(13, 'AMANO2220261109', 40.73, '2026-11-09T12:00:00Z', [{ clave: 'entrada:22', montoUsd: 40.73 }]),
    { key: 'agencia.mensualidad.13.orden.111111111111111111', value: '{no es json' },
    { key: 'agencia.mensualidad.13.orden.222222222222222222', value: JSON.stringify({ orden: '333333333333333333', monto: 50, moneda: 'USDT', montoUsd: 50, fecha: '2026-11-09', aplicado: [] }) },
  ], '2026-11-10');
  assert.equal(r.pagos.length, 0, 'ni lo debido como cobrado, ni lo que no se pudo leer');
  assert.deepEqual(r.avisos.map((a) => a.replace(/ \(.*$/, '')), [
    'lo que entró en 1 pago de agencia marcado a mano sin su orden',
    '2 órdenes del libro de las agencias',
  ]);
});

test('5a · el libro reemplaza a la mensualidad del CRM: MRR 300, no 538, y UN movimiento', () => {
  const r = revenue(CRM, [CONFIG, ordenDic('555555555555555555', 300, '2026-12-03T10:00:00')], '2026-12-10');
  assert.equal(r.mrr, 300, 'el CRM vencía el 3/12 y su gracia seguía: sin el corte, 238 + 300');
  assert.deepEqual(movimientosDeDic(r), [['2026-12-03', 'sube', 62]], 'ni un «Se cortó» ni un «Volvió»');
  // Y la identidad de los meses sigue cerrando.
  for (let i = 1; i < r.meses.length; i++) {
    const a = r.meses[i - 1], m = r.meses[i];
    assert.equal(Math.round((a.mrr + m.nuevo + m.vuelve + m.sube - m.baja - m.corte) * 100) / 100, m.mrr, m.mes);
  }
});

// La historia de la ficha no ve el libro: diría que diciembre está atrasado. La de verdad (lib/suscripcion-meses.ts) se fija en
// tests/admin-ingresos.test.ts; acá alcanza con lo que diría.
const HISTORIA_CRM: ProximoDeSuscripcion = { sinCobro: false, atrasado: { fecha: '2026-12-03', usd: 238 }, siguiente: null };

test('5b · «Por cobrar» no le reclama a la historia del CRM lo que se pagó por el libro', () => {
  const historias = new Map([['lead:1:casa', HISTORIA_CRM]]);
  // El 4/12 sin diciembre pago, la historia del CRM manda (lo debe de verdad).
  assert.equal(revenue(CRM, [CONFIG], '2026-12-04', historias).porCobrar.filter((p) => p.atrasado).length, 1);
  const pago = revenue(CRM, [CONFIG, ordenDic('555555555555555555', 300, '2026-12-03T10:00:00')], '2026-12-04', historias);
  assert.equal(pago.porCobrar.filter((p) => p.atrasado).length, 0, 'lo pagó por el libro');
  // Lo próximo es enero, con el límite del libro (el 5): fuera de los 31 días de «Por cobrar» desde el 4/12.
  assert.deepEqual(pago.porCobrar, []);
  assert.equal(pago.clientes[0].estado, 'al-dia');
  assert.equal(pago.clientes[0].proximo, '2027-01-05');
});

test('5c · si el libro se apaga y la mensualidad vuelve al CRM, el CRM vuelve a contar; la del CRM que nace con el libro vivo, no', () => {
  const tramos: Tramo[] = [
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2026-11-03', fin: null, vence: '2026-12-03', cambios: [{ fecha: '2026-11-03', usd: 238 }] },
    { suscripcion: 'agencia:13', cliente: 'ws:13', inicio: '2026-12-03', fin: '2027-02-03', vence: '2027-02-03', cambios: [{ fecha: '2026-12-03', usd: 300 }] },
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2026-12-20', fin: null, vence: '2027-01-20', cambios: [{ fecha: '2026-12-20', usd: 90 }] },
    { suscripcion: 'lead:1:casa', cliente: 'ws:13', inicio: '2027-03-01', fin: null, vence: '2027-04-01', cambios: [{ fecha: '2027-03-01', usd: 238 }] },
    // Otra cuenta sin libro: ni la mira.
    { suscripcion: 'lead:2:casa', cliente: 'ws:30', inicio: '2026-11-01', fin: null, vence: '2026-12-01', cambios: [{ fecha: '2026-11-01', usd: 97 }] },
  ];
  const r = conElLibro(tramos, new Set(['lead:1:casa', 'lead:2:casa']));
  assert.deepEqual(r.tramos.map((t) => [t.suscripcion, t.inicio, t.fin]), [
    ['lead:1:casa', '2026-11-03', '2026-12-03'],
    ['agencia:13', '2026-12-03', '2027-02-03'],
    ['lead:1:casa', '2027-03-01', null],
    ['lead:2:casa', '2026-11-01', null],
  ]);
  assert.deepEqual([...r.reemplazadas], [], 'su último tramo es del CRM y vino después del libro: su historia vuelve a mandar');
});

test('5d · la otra clave de la misma historia (los pagos con y sin su CRM) tampoco reclama lo pagado por el libro', () => {
  // Los pagos viejos sin CRM (`casa`, una cuota del plan de agosto, no registrada como la mensualidad) y los nuevos con su CRM
  // (`7`) son la MISMA suscripción y comparten la historia; sus tramos no se pisan, así que no se juntan en uno.
  const cuota: PagoIngreso = { ...pagoCrm(90, '2026-08-01', 146), mensualidad: false };
  const crm = [cuota, pagoCrm(135, '2026-11-03', 94, 'lead:1:7'), pagoCrm(136, '2026-11-04', 144, 'lead:1:7')];
  const historias = new Map([['lead:1:casa', HISTORIA_CRM], ['lead:1:7', HISTORIA_CRM]]);
  const r = revenue(crm, [CONFIG, ordenDic('555555555555555555', 300, '2026-12-03T10:00:00')], '2026-12-04', historias);
  assert.equal(r.porCobrar.filter((p) => p.atrasado).length, 0);
});

test('5e · el libro pagado DESPUÉS de la gracia del CRM: un atraso de verdad, pero sin la deuda de la historia del CRM', () => {
  const historias = new Map([['lead:1:casa', HISTORIA_CRM]]);
  const r = revenue(CRM, [CONFIG, ordenDic('555555555555555555', 300, '2026-12-20T10:00:00')], '2026-12-22', historias);
  assert.equal(r.mrr, 300);
  assert.equal(r.porCobrar.filter((p) => p.atrasado).length, 0, 'diciembre se pagó por el libro: no se debe');
  assert.deepEqual(movimientosDeDic(r).map((m) => m[1]), ['vuelve', 'corte'], 'pagó 17 días tarde: se cortó y volvió, de verdad');
});

test('5f · otra suscripción que la agencia le compró a MaKo no la toca el libro', () => {
  const otra: PagoIngreso = { id: 'p:300', cliente: 'ws:13', suscripcion: 'lead:5:9', fecha: '2026-11-20', usd: 50, medio: 'cripto', concepto: 'Otra cosa', mensualidad: false };
  const r = revenue([...CRM, otra], [CONFIG, ordenDic('555555555555555555', 300, '2026-12-03T10:00:00')], '2026-12-10');
  assert.equal(r.mrr, 350, 'la mensualidad del libro (300) y la otra suscripción (50)');
});

test('6 · el MRR del libro es el del MES: en dos partes vale el mes, y dos meses pagados juntos no valen el doble', () => {
  const dosPartes = revenue(CRM, [CONFIG,
    ordenDic('555555555555555555', 150, '2026-12-03T10:00:00'), ordenDic('555555555555555556', 150, '2026-12-12T10:00:00'),
    fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-12', totalUsd: 300, pagadoUsd: 300, ordenes: ['555555555555555555', '555555555555555556'] }),
  ], '2026-12-14');
  assert.equal(dosPartes.mrr, 300, 'sin la historia del libro: 150, el último pago');
  assert.deepEqual(movimientosDeDic(dosPartes), [['2026-12-03', 'sube', 62]], 'ni un «Bajó −88» el 3/12');
  assert.equal(dosPartes.cobradoEsteMes, 300);
  // A medias: lo que falta del mes, con su límite.
  const aMedias = revenue(CRM, [CONFIG, ordenDic('555555555555555555', 150, '2026-12-03T10:00:00'),
    fila(13, 'pago.2026-12', { mes: '2026-12', pagadoEl: '2026-12-03', totalUsd: 300, pagadoUsd: 150, ordenes: ['555555555555555555'] }),
  ], '2026-12-04');
  assert.deepEqual(aMedias.porCobrar.map((p) => [p.fecha, p.usd]), [['2026-12-05', 150]]);
  const juntos = revenue(CRM, [CONFIG, orden(13, '777777777777777777', 600, '2026-12-20T10:00:00', [{ clave: 'mes:2026-12', montoUsd: 300 }, { clave: 'mes:2027-01', montoUsd: 300 }])], '2027-01-10');
  assert.equal(juntos.mrr, 300, 'dos meses de 300, no un mes de 600');
  assert.ok(!juntos.movimientos.some((m) => m.tipo === 'baja'), 'y sin un «Bajó» al mes siguiente');
});

test('7 · Customers (Top Customers): el total de la agencia suma lo que entró por el libro', () => {
  const libro = libroDe([orden(13, ORDEN, 40, '2026-11-09T14:20:00', [{ clave: 'entrada:22', montoUsd: 40.73 }])], '2026-11-10');
  const r = calcularIngresos([...CRM, ...libro.pagos], QUIEN, '2026-11-10');
  const top = topClientes(datosDeTop(r), null, null);
  assert.equal(top[0].clave, 'ws:13');
  assert.equal(top[0].totalCentavos, 42_400, '146 + 94 + 144 + 40');
  assert.equal(top[0].pagos, 4);
});

test('8 · Sales › Orders: el recibo de una orden del libro suma (Revenue ya la cuenta); un recibo a mano sin atar, no', () => {
  const recibo = (id: number, referencia: string): ReciboVenta => ({
    id, numero: id, estado: 'emitido', origen: 'manual', aNombre: 'Agencia Norte', destinoWs: 13, cobroId: null, emitidoAt: '2026-11-09T18:00:00Z',
    fechaPago: '2026-11-09T17:20:00Z', lineas: [{ concepto: 'Entrada de Cliente Sur', mes: null, monto: 40.73, moneda: 'USD' }], totalDetalle: 40.73, monedaDetalle: 'USD',
    totales: [{ moneda: 'USDT', monto: 40 }], impuesto: null, correoEstado: 'enviado', correoA: [], correoError: null, waEstado: 'enviado', waError: null,
    soloCorreo: false, devueltoAt: null, devueltoMonto: null, disputa: null, anuladoAt: null,
    pagos: [{ id, medio: 'binance', referencia, fecha: '2026-11-09T17:20:00Z', monto: 40, moneda: 'USDT', montoUsd: 40, de: null, comprobante: false, anulado: false }],
    historial: [],
  });
  const libro = libroDe([orden(13, ORDEN, 40, '2026-11-09T14:20:00', [{ clave: 'entrada:22', montoUsd: 40.73 }])], '2026-11-10');
  const r = calcularIngresos([...CRM, ...libro.pagos], QUIEN, '2026-11-10');
  const pedidos = pedidosDe({ entradas: r.entradas, recibos: [recibo(3, ORDEN), recibo(4, '999999999999999999')], clientes: new Map(), nombreDeWs: NOMBRES });
  const delRecibo = (id: number) => pedidos.find((p) => p.id === `r-${id}`);
  assert.equal(delRecibo(3)?.suma, true, 'el 0003 de la entrada: la misma plata que cuenta Revenue');
  assert.equal(delRecibo(4)?.suma, false, 'uno cargado a mano que no se ató a nada sigue sin sumar');
  assert.ok(!pedidos.some((p) => p.id.startsWith('a')), 'la orden no es un pedido aparte: es su recibo');
});

// ── El lector de verdad, sobre una base de mentira ─────────────────────────────────────────────────────────────────
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_admin-ingresos-libro-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'], timeout: 120_000,
});
type Escena = { mrr: number; cobradoEsteMes: number; cobradoTotal: number; avisos: string[]; clientes: Array<{ clave: string; total: number; mrr: number; leadId: number | null; estado: string }>; entradas: Entrada[]; movimientos: Array<{ fecha: string; tipo: string; delta: number }>; porCobrar: Array<{ atrasado: boolean }> };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Escena> & { noEscribio: { pagos: number; libroIgual: boolean } };
const deLaAgencia = (e: Escena) => e.clientes.find((c) => c.clave === 'ws:13')!;

test('9a · el lector: la entrada de la cliente aparece sola, como cash de la agencia, y no escribe nada', () => {
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

test('9b · el lector: con la orden atada a un pago del CRM, entra una sola vez', () => {
  const e = R.atada;
  assert.equal(e.entradas.filter((x) => x.fecha === '2026-11-09').length, 1);
  assert.ok(!e.entradas.some((x) => x.id?.startsWith('a:')), 'la cuenta el pago del CRM, no el libro');
  assert.equal(e.cobradoTotal, 424);
});

test('9c · el lector: el recibo del libro sin pago del CRM no ata la orden', () => {
  assert.equal(R.reciboSinAtar.cobradoTotal, 424);
  assert.ok(R.reciboSinAtar.entradas.some((x) => x.id === `a:13:${ORDEN}:entrada:22`));
});

test('9d · el lector: si el libro no se lee, un aviso y no un cero escondido', () => {
  const e = R.libroCaido;
  assert.equal(e.cobradoTotal, 384, 'lo del CRM sigue');
  assert.equal(e.avisos.length, 1);
  assert.match(e.avisos[0], /^los pagos de las agencias por su mensualidad: /);
});

test('9e · el lector: sin saber qué órdenes ya están en el CRM, no cuenta el libro (contaría dos veces), y lo dice', () => {
  const e = R.recibosCaidos;
  assert.ok(!e.entradas.some((x) => x.id?.startsWith('a:')));
  assert.match(e.avisos.join(' | '), /los pagos de las agencias por su mensualidad: no pude ver cuáles ya están en el CRM/);
});

test('9f · el lector, en diciembre pagado en dos partes: el MRR es el del mes (300), sin contar la mensualidad del CRM dos veces', () => {
  const e = R.diciembre;
  assert.equal(e.mrr, 300);
  assert.equal(deLaAgencia(e).mrr, 300);
  assert.equal(deLaAgencia(e).total, 724, '146 + 94 + 144 + 40 + 150 + 150');
  assert.equal(e.entradas.filter((x) => x.id?.endsWith(':mes:2026-12') && x.recurrente).length, 2);
  const deDic = e.movimientos.filter((m) => m.fecha >= '2026-12-02' && m.fecha <= '2026-12-31');
  assert.deepEqual(deDic.map((m) => [m.fecha, m.tipo, m.delta]), [['2026-12-03', 'sube', 62]]);
  assert.ok(!e.movimientos.some((m) => m.tipo === 'corte' || m.tipo === 'vuelve' || m.tipo === 'baja'));
  assert.equal(e.porCobrar.filter((p) => p.atrasado).length, 0);
});

// Probado rompiéndolo (10/11/2026, después de la revisión; el arnés restaura de memoria; con todo puesto, 0 fallos de 20). Cada
// rotura, sola:
//   · cuenta lo que se debía (`aplicado`, 40,73) en vez de lo recibido                       → 6 fallos (1, 2, 7, 9a, 9c, 9f)
//   · le pone suscripción a una entrada (todo pasa a MRR)                                    → 4 fallos (1, 2, 9a, 9f)
//   · `partes` no reparte: la orden entera a la primera clave                                → 2 fallos (2, 6)
//   · `ordenesAtadas` no mira `pago_id` / cuenta un recibo anulado                           → 2 (3, 9c) / 1 (3)
//   · no saltea las órdenes atadas                                                            → 2 fallos (3, 9b)
//   · sin el aviso de lo hecho a mano / cuenta la entrada AMANO / calla las ilegibles         → 2 (4, 4b) / 1 (4b) / 1 (4b)
//   · sin la historia del libro (el MRR del último pago)                                     → 3 fallos (5b, 6, 9f)
//   · lo próximo el 1 y no el día límite del libro (el 5)                                     → 1 fallo (5b)
//   · `conElLibro` no corta                                                                   → 8 fallos (5a-5f, 6, 9f)
//   · `conElLibro` corta cualquier suscripción de la agencia                                  → 1 fallo (5f)
//   · `conElLibro` corta también lo que vuelve después del libro                              → 1 fallo (5c)
//   · reemplazada sólo si el libro la cortó (no si arrancó después de la gracia)              → 1 fallo (5e)
//   · «Por cobrar» no saltea por la historia / no saltea las reemplazadas                     → 1 (5d) / 3 (5b, 5d, 5e)
//   · Orders no suma el recibo del libro                                                      → 1 fallo (8)
//   · el lector no suma los pagos del libro / no pasa su historia / no marca la mensualidad    → 3 (9a, 9c, 9f) / 1 (9f) / 1 (9f)
//   · el lector se traga el error del libro / cuenta el libro sin los recibos                 → 2 (9d, 9e) / 1 (9e)
