// Tests de «A quién cobrarle» y del Outstanding (punto 5 del feedback de Martín del 11/10/2026: «En
// Comercial está diferente la parte de "A quién cobrarle", antes era un desplegable... Y con las
// opciones de "Marcar como cobrada"»). Lo que se prueba es lo PURO (lib/datos-comercial.ts): cómo se arma
// «A quién cobrarle» (el orden por vencimiento, el URGENTE, el total) y la ventana del Outstanding. Lo
// usan el conjunto «Clientes por cobrar» del Dashboard (lib/graficos-datos-extra.ts) y la hoja Comercial
// del teléfono (lib/datos-comercial-server.ts).
//
// Hasta el 13/10/2026 era tests/graficos-bloques.test.ts y probaba también los BLOQUES de Comercial. Los
// bloques se fueron en v5 y su código se borró; con él salieron los tests de la barra cobrado/pendiente, de
// las cohortes, de la línea del SCL y del reparto a los bloques de Analysts (no quedaba nada que probaran).
//
// Correr: npx tsx --test tests/datos-comercial.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026), cada rotura sola, restaurada a mano y con la base en verde
// (13 de 13) antes de cada una. Cada rotura dio 1 fallo y 12 pases, en el test que la nombra. Las que
// siguen valiendo (las otras cuatro perseguían código de los bloques, que ya no existe):
//   1. El orden de armarCobranza dado vuelta (`fa < fb ? 1 : -1`).
//   2. La urgencia con `dias <= 0` como vencida (lo que vence HOY salía URGENTE).
//   3. El total sumando lo COBRADO en vez de lo pendiente.
//   7. ventanaOutstanding sin el fin de mes (hasta = el último día del período).
// Vueltas a medir el 13/10/2026 sobre este archivo, con un arnés que restaura DE MEMORIA y compara byte a
// byte: base 7 de 7; cada una de las cuatro dio 6 pases y 1 fallo, en el test que la nombra; la vuelta, 7 de 7.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OutstandingLead } from '../lib/pagos';
import { rangoDe } from '../lib/graficos-catalogo';
import { DESDE_TODO, armarCobranza, diasHasta, hastaHoy, urgenciaDe, ventanaOutstanding } from '../lib/datos-comercial';

const HOY = '2026-10-11';

const lead = (id: number, nombre: string, pendiente: number, vence: string | null, extra: Partial<OutstandingLead> = {}): OutstandingLead => ({
  lead_id: id,
  lead_nombre: nombre,
  vendido_usd: 3000,
  cobrado_usd: 1000,
  pendiente_usd: pendiente,
  proxima_cuota: { pago_id: id * 10, numero: 2, monto_usd: pendiente, fecha_esperada: vence },
  dias_desde_cierre: 40,
  fecha_cierre: '2026-09-01',
  ...extra,
});

// ── «A quién cobrarle» ────────────────────────────────────────────────────────────────────────

test('A quién cobrarle: ordena por el vencimiento más cercano, lo vencido hace más tiempo arriba y lo sin fecha al final', () => {
  // La lectura llega ordenada por lo que más se debe (getOutstandingDetalle): el orden de la tabla es otro.
  const items = [
    lead(1, 'Ana', 9000, '2026-11-20'),
    lead(2, 'Beto', 5000, null),
    lead(3, 'Caro', 4000, '2026-10-01'),
    lead(4, 'Dani', 3000, '2026-10-13'),
    lead(5, 'Eli', 2000, '2026-09-15'),
  ];
  const { filas } = armarCobranza(items, HOY);
  assert.deepEqual(filas.map((f) => f.nombre), ['Eli', 'Caro', 'Dani', 'Ana', 'Beto']);
  // Y la fila trae lo que dibuja la tabla vieja: lo vendido, lo cobrado TOTAL y la cuota a marcar.
  assert.deepEqual(filas[0].cuota, { pagoId: 50, numero: 2, monto: 2000, vence: '2026-09-15' });
  assert.equal(filas[0].cobrado, 1000);
  assert.equal(filas[0].vendido, 3000);
});

test('A quién cobrarle: un empate de vencimiento va por lo que más se debe, y después por nombre', () => {
  const { filas } = armarCobranza([
    lead(1, 'Zoe', 100, '2026-10-20'),
    lead(2, 'Ana', 900, '2026-10-20'),
    lead(3, 'Bruno', 100, '2026-10-20'),
  ], HOY);
  assert.deepEqual(filas.map((f) => f.nombre), ['Ana', 'Bruno', 'Zoe']);
});

test('A quién cobrarle: URGENTE es lo ya vencido; lo que vence hoy o en 5 días es «pronto»; lo demás, nada', () => {
  const { filas } = armarCobranza([
    lead(1, 'Ayer', 100, '2026-10-10'),
    lead(2, 'Hoy', 100, '2026-10-11'),
    lead(3, 'Cinco', 100, '2026-10-16'),
    lead(4, 'Seis', 100, '2026-10-17'),
    lead(5, 'Sin fecha', 100, null),
  ], HOY);
  const por = Object.fromEntries(filas.map((f) => [f.nombre, { dias: f.dias, urgencia: f.urgencia }]));
  assert.deepEqual(por['Ayer'], { dias: -1, urgencia: 'vencida' });
  assert.deepEqual(por['Hoy'], { dias: 0, urgencia: 'pronto' });
  assert.deepEqual(por['Cinco'], { dias: 5, urgencia: 'pronto' });
  assert.deepEqual(por['Seis'], { dias: 6, urgencia: null });
  assert.deepEqual(por['Sin fecha'], { dias: null, urgencia: null });
  // Un cambio de mes y de año no se come un día (UTC, no la hora local).
  assert.equal(diasHasta('2027-01-01', '2026-12-31'), 1);
  assert.equal(urgenciaDe(-30), 'vencida');
});

test('A quién cobrarle: el total es la suma de lo PENDIENTE de las filas que se dibujan', () => {
  const { filas, total } = armarCobranza([lead(1, 'A', 1500, '2026-10-01'), lead(2, 'B', 250.5, null), lead(3, 'C', 0, '2026-10-30')], HOY);
  assert.equal(total, 1750.5);
  assert.equal(total, filas.reduce((s, f) => s + f.pendiente, 0));
  // Sin cuota no hay «Marcar cobrado» (la fila se dibuja igual).
  const sin = armarCobranza([lead(9, 'Sin cuota', 300, null, { proxima_cuota: null })], HOY).filas[0];
  assert.equal(sin.cuota, null);
  assert.equal(armarCobranza([], HOY).total, 0);
});

// ── La ventana y el período ───────────────────────────────────────────────────────────────────

test('la ventana del Outstanding mira hasta el FIN DE MES del período; con «Todo», el pipeline entero', () => {
  const ult30 = rangoDe('ult30', HOY);
  assert.deepEqual(ventanaOutstanding(ult30.desde, ult30.hasta), { desde: ult30.desde, hasta: '2026-10-31' });
  const todo = rangoDe('todo', HOY);
  assert.equal(todo.desde, DESDE_TODO);
  assert.deepEqual(ventanaOutstanding(todo.desde, todo.hasta), { desde: null, hasta: null });
  // «Últimos 12 meses» arranca el 1/11/2025: con la vara de la vieja (<= 2025-11-01) era «todo el pipeline».
  const doce = rangoDe('ult12m', HOY);
  assert.equal(doce.desde, '2025-11-01');
  assert.deepEqual(ventanaOutstanding(doce.desde, doce.hasta), { desde: '2025-11-01', hasta: '2026-10-31' });
});

test('Sold y Cash se miden hasta hoy; un período que termina después se acota, y uno futuro no se da vuelta', () => {
  assert.equal(hastaHoy('2026-10-01', '2026-10-31', HOY), HOY);
  assert.equal(hastaHoy('2026-09-01', '2026-09-30', HOY), '2026-09-30');
  assert.equal(hastaHoy('2026-11-01', '2026-11-30', HOY), '2026-11-01');
});

// Martín, 11/10/2026, sobre «Marcar cobrada»: «Cualquiera con acceso a esa tab». La action no tenía guarda
// (la llamaba cualquiera con su id) ni miraba que la cuota fuera del lead que recibe.
// Probado rompiéndolo (base 15 / 0): sin la llamada a la guarda -> 14 / 1; sin el chequeo del lead -> 14 / 1.
test('«Marcar cobrada»: sesión, acceso a la tab (CRM o Dashboard) y la cuota tiene que ser de ese lead', () => {
  const src = readFileSync(resolve(__dirname, '../app/crm/actions.ts'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('export async function marcarPagoAction(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(cuerpo, /\): Promise<void> \{\n  await exigirAccesoAMarcarPago\(pagoId, leadId\);\n  await marcarPago\(/, 'la guarda va ANTES de escribir');
  const g = src.slice(src.indexOf('async function exigirAccesoAMarcarPago('), src.indexOf('\n}\n', src.indexOf('async function exigirAccesoAMarcarPago(')));
  assert.match(g, /if \(rol == null\) throw/);
  assert.match(g, /tabEnCapa\('crm', capa\)/);
  assert.match(g, /rol === 'admin' && tabEnCapa\('graphics', capa\)/);
  assert.match(g, /\.eq\('id', pagoId\)\.eq\('workspace_id', ws \?\? -1\)/);
  assert.match(g, /!== Number\(leadId\)\) throw/);
  assert.doesNotMatch(src, /export async function exigirAccesoAMarcarPago/, 'un archivo use server sólo exporta las actions');
});
