// =============================================================================
// ¿El pago del comprobante ENTRÓ a la cuenta de Binance de MaKo? — el calce (lib/binance-pay-reglas.ts) y el candado de sólo lectura
// =============================================================================
// Martín (18/11/2026): un comprobante solo NUNCA activa nada; se busca el movimiento real. Medido el 19/11/2026: el número de 18 cifras
// del comprobante es `orderId` (no `transactionId`), y el pago de Código del 16/11 quedó anotado con un dígito de más: por eso existe el
// calce por monto + hora + quién paga. Los datos de abajo tienen la FORMA de lo que devuelve `GET /sapi/v1/pay/transactions`
// (nombres e ids inventados).
// Correr: node --import tsx --test tests/binance-pay-calce.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calzarConBinance, difiereEnUnDigito, HORAS_ANTES, HORAS_DESPUES, momentoDelComprobante, movimientoDeBinance, numerosUsados, seVencioLaEspera, type MovimientoBinance,
} from '../lib/binance-pay-reglas';

const H = 3_600_000;
const T0 = Date.parse('2026-11-16T16:17:58Z');

/** Una fila como la de Binance Pay. */
const fila = (o: { orderId: string; amount: string; currency?: string; at?: number; payer?: string; payerId?: number | null }) => ({
  uid: 11111111, counterpartyId: 2222, orderId: o.orderId, note: '', orderType: 'C2C', transactionId: `P_${o.orderId.slice(-8)}X`,
  transactionTime: o.at ?? T0, amount: o.amount, currency: o.currency ?? 'USDT', walletType: 1,
  payerInfo: { name: o.payer ?? 'AGENCIA_X', type: 'USER', ...(o.payerId === null ? {} : { binanceId: o.payerId ?? 300000001 }) },
  receiverInfo: { binanceId: 11111111 },
});
const mov = (o: Parameters<typeof fila>[0]): MovimientoBinance => movimientoDeBinance(fila(o))!;
const NADA = new Set<string>();

test('de la fila de Binance: el número es orderId (no transactionId), y sólo cuentan las ENTRADAS', () => {
  const m = movimientoDeBinance(fila({ orderId: '466000199987322880', amount: '59.54' }));
  assert.ok(m);
  assert.equal(m.orderId, '466000199987322880');
  assert.equal(m.monto, 59.54);
  assert.equal(m.moneda, 'USDT');
  assert.equal(m.pagadorId, '300000001');
  // Lo que SALIÓ de la cuenta (monto negativo) no es un pago recibido.
  assert.equal(movimientoDeBinance(fila({ orderId: '466000199987322881', amount: '-20' })), null);
  // Sin número o sin monto, nada.
  assert.equal(movimientoDeBinance({ ...fila({ orderId: '1', amount: '10' }), orderId: '' }), null);
  assert.equal(movimientoDeBinance({ ...fila({ orderId: '466000199987322882', amount: 'abc' }) }), null);
  assert.equal(movimientoDeBinance(null), null);
});

test('calza por el NÚMERO exacto y el mismo monto', () => {
  const movs = [mov({ orderId: '466000199987322880', amount: '59.54' }), mov({ orderId: '465149562572922880', amount: '15.67', at: T0 - 100 * H })];
  const c = calzarConBinance({ orden: '466000199987322880', monto: 59.54, at: T0 }, movs, { usadas: NADA });
  assert.equal(c.tipo, 'calza');
  assert.equal(c.tipo === 'calza' && c.por, 'orden');
});

test('el número calza pero el monto NO: a Martín (el comprobante dice una cosa y la cuenta otra)', () => {
  const c = calzarConBinance({ orden: '466000199987322880', monto: 97, at: T0 }, [mov({ orderId: '466000199987322880', amount: '59.54' })], { usadas: NADA });
  assert.equal(c.tipo, 'revisar');
});

test('un número YA USADO no se cuenta otra vez, aunque esté en la cuenta', () => {
  const c = calzarConBinance({ orden: '466000199987322880', monto: 59.54, at: T0 }, [mov({ orderId: '466000199987322880', amount: '59.54' })], { usadas: new Set(['466000199987322880']) });
  assert.notEqual(c.tipo, 'calza');
});

test('el número MAL LEÍDO (un 0 de más, el caso del 16/11) calza por monto + hora, y devuelve el número REAL', () => {
  const real = mov({ orderId: '466000199987322880', amount: '59.54' });
  const c = calzarConBinance({ orden: '4660001999873228880', monto: 59.54, at: T0 + 2 * H }, [real], { usadas: NADA });
  assert.equal(c.tipo, 'calza');
  assert.equal(c.tipo === 'calza' && c.mov.orderId, '466000199987322880');
  assert.equal(c.tipo === 'calza' && c.por, 'monto');
  // Sin número leído, igual.
  assert.equal(calzarConBinance({ orden: null, monto: 59.54, at: T0 }, [real], { usadas: NADA }).tipo, 'calza');
});

test('un número anotado con UN dígito de más (el 16/11) cuenta como el real ya usado: el mismo comprobante no se cuenta dos veces', () => {
  const real = mov({ orderId: '466000199987322880', amount: '59.54' });
  const otro = mov({ orderId: '465149562572922880', amount: '15.67', at: T0 - 100 * H });
  const usadas = numerosUsados(['4660001999873228880', '465149562572922880'], [real, otro]);
  assert.ok(usadas.has('466000199987322880'), 'el real del mal copiado queda usado');
  assert.equal(calzarConBinance({ orden: '4660001999873228880', monto: 59.54, at: T0 }, [real, otro], { usadas }).tipo, 'no-entro');
  // Un número anotado que SÍ existe en la cuenta no arrastra a sus vecinos (dos órdenes reales pueden diferir en un dígito).
  const vecino = mov({ orderId: '465149562572922881', amount: '15.67', at: T0 - 99 * H });
  assert.equal(numerosUsados(['465149562572922880'], [otro, vecino]).has('465149562572922881'), false);
  // Uno de menos, uno cambiado, y dos de diferencia (no es el mismo).
  assert.equal(difiereEnUnDigito('46600019998732288', '466000199987322880'), true);
  assert.equal(difiereEnUnDigito('466000199987322870', '466000199987322880'), true);
  assert.equal(difiereEnUnDigito('466000199987322770', '466000199987322880'), false);
});

test('TODAVÍA NO ENTRÓ: ningún movimiento de ese monto en la ventana → no se aplica (se espera)', () => {
  const movs = [mov({ orderId: '465149562572922880', amount: '15.67' }), mov({ orderId: '464765031875870720', amount: '40' })];
  assert.equal(calzarConBinance({ orden: '466000199987322880', monto: 97, at: T0 }, movs, { usadas: NADA }).tipo, 'no-entro');
  // Un pago del mismo monto pero FUERA de la ventana no es éste.
  const viejo = mov({ orderId: '461213098188603392', amount: '97', at: T0 - (HORAS_ANTES + 1) * H });
  const futuro = mov({ orderId: '461213098188603393', amount: '97', at: T0 + (HORAS_DESPUES + 1) * H });
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [viejo, futuro], { usadas: NADA }).tipo, 'no-entro');
  // Sin movimientos (la cuenta vacía), lo mismo.
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [], { usadas: NADA }).tipo, 'no-entro');
});

test('un centavo distinto NO es el mismo pago (el monto es exacto: Martín no quiere montos aproximados)', () => {
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [mov({ orderId: '466000199987322880', amount: '96.99' })], { usadas: NADA }).tipo, 'no-entro');
});

test('otra moneda (BTC, como el pago de octubre de una clienta) no se convierte sola', () => {
  const btc = mov({ orderId: '462143555612835840', amount: '0.00126859', currency: 'BTC' });
  assert.equal(calzarConBinance({ orden: '462143555612835840', monto: 0.00126859, at: T0 }, [btc], { usadas: NADA }).tipo, 'revisar');
  assert.equal(calzarConBinance({ orden: null, monto: 0.00126859, at: T0 }, [btc], { usadas: NADA }).tipo, 'no-entro');
});

test('DOS pagos iguales a la vez: sólo calza si uno es de quien ya le pagó a MaKo por esta cuenta; si no, a Martín', () => {
  const a = mov({ orderId: '466000199987322880', amount: '97', payerId: 300000001 });
  const b = mov({ orderId: '466000199987322881', amount: '97', at: T0 + H, payerId: 400000002 });
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [a, b], { usadas: NADA }).tipo, 'revisar');
  const c = calzarConBinance({ orden: null, monto: 97, at: T0 }, [a, b], { usadas: NADA, conocidos: new Set(['400000002']) });
  assert.equal(c.tipo === 'calza' && c.mov.orderId, '466000199987322881');
  // Los dos conocidos: no se adivina.
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [a, b], { usadas: NADA, conocidos: new Set(['300000001', '400000002']) }).tipo, 'revisar');
  // Uno de los dos ya usado: queda uno, calza.
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: T0 }, [a, b], { usadas: new Set(['466000199987322880']) }).tipo, 'calza');
});

test('sin monto o sin fecha, no se busca: a Martín', () => {
  assert.equal(calzarConBinance({ orden: null, monto: 0, at: T0 }, [mov({ orderId: '466000199987322880', amount: '0' })], { usadas: NADA }).tipo, 'revisar');
  assert.equal(calzarConBinance({ orden: null, monto: 97, at: NaN }, [], { usadas: NADA }).tipo, 'revisar');
});

test('la hora del comprobante: fecha y hora de Argentina; sin fecha, la de llegada; una fecha del futuro no corre la ventana', () => {
  const llego = Date.parse('2026-11-16T18:00:00Z');
  assert.equal(momentoDelComprobante('2026-11-16', '13:17', llego), Date.parse('2026-11-16T16:17:00Z'));
  assert.equal(momentoDelComprobante('2026-11-16', null, llego), Date.parse('2026-11-16T15:00:00Z'));
  assert.equal(momentoDelComprobante(null, '13:17', llego), llego);
  assert.equal(momentoDelComprobante('2027-11-16', '13:17', llego), llego);
});

test('la espera se vence a las 48 h', () => {
  const desde = '2026-11-26T12:00:00.000Z';
  assert.equal(seVencioLaEspera(desde, Date.parse(desde) + 47 * H), false);
  assert.equal(seVencioLaEspera(desde, Date.parse(desde) + 48 * H), true);
  assert.equal(seVencioLaEspera('roto', Date.parse(desde)), true);
});

test('⚠️ CLAUDE NO MUEVE PLATA: lib/binance-pay-directo.ts llama a UN solo endpoint de Binance, de lectura, y sólo con GET', () => {
  // El único que habla con Binance (desde el 20/11, separado de lib/binance-pay.ts, que sólo elige el camino: tests/binance-pay-region.test.ts).
  // Sin los comentarios (la cabecera nombra lo que la clave PERMITE, para que nadie lo use).
  const src = readFileSync(join(__dirname, '..', 'lib', 'binance-pay-directo.ts'), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');
  const rutas = [...src.matchAll(/['"`](\/(?:sapi|api|fapi|dapi|papi|eapi)\/[^'"`?]*)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(rutas)], ['/sapi/v1/pay/transactions']);
  assert.match(src, /method:\s*'GET'/);
  assert.doesNotMatch(src, /method:\s*'(POST|PUT|DELETE|PATCH)'/i);
  // Ninguna palabra de las rutas que mueven fondos.
  assert.doesNotMatch(src, /withdraw|transfer|order\/|\/trade|asset\/transfer|universalTransfer/i);
});

test('⚠️ el comprobante del grupo NO se aplica sin pasar por la cuenta: atenderComprobanteDeAgencia verifica ANTES de anotar', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'agencia-mes-comprobante.ts'), 'utf8').replace(/\r\n/g, '\n');
  const inicio = src.indexOf('export async function atenderComprobanteDeAgencia');
  const fin = src.indexOf('\n}\n', inicio);
  const cuerpo = src.slice(inicio, fin);
  assert.ok(inicio > 0 && fin > inicio);
  // Lo único que anota un pago desde el comprobante es `aplicarPagoVerificado`, y se llama con lo que dio la cuenta (`mov`).
  assert.doesNotMatch(cuerpo, /aplicarPagoDeAgencia\(/);
  const verifica = cuerpo.indexOf('verificarEnBinance(');
  const aplica = cuerpo.indexOf('aplicarPagoVerificado(');
  assert.ok(verifica > 0 && aplica > verifica, 'verificarEnBinance tiene que ir antes de aplicar');
  assert.match(cuerpo, /ver\.tipo !== 'calza'/);
  assert.match(cuerpo, /orden: mov\.orderId, monto, moneda: mov\.moneda/);
});
