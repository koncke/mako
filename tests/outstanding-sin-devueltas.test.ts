// =============================================================================
// El Outstanding no cuenta como deuda las cuotas DEVUELTAS por un reembolso (15/10/2026)
// =============================================================================
// Un reembolso de la pasarela deja la cuota impaga, SIN vencimiento y con su proveedor (`desmarcarCobroDeProveedor`,
// lib/pagos.ts): queda en la tabla para el historial y no es deuda. Las lecturas que filtran por vencimiento ya la dejaban
// afuera; las que suman TODA cuota impaga, no: el Outstanding sin ventana, «A quién cobrarle» y el Revenue del Dashboard
// con «Todo» (que suma también las cuotas sin fecha, porque una cuota del plan sin fecha SÍ es deuda). Lo que se fija:
//   1. la regla (`esCuotaDevuelta`, se EJECUTA): devuelta = impaga + sin vencimiento + con pasarela; una cuota del plan
//      sin fecha y sin pasarela sigue siendo deuda;
//   2. las tres lecturas la usan, y piden las columnas que la regla necesita (sin `proveedor` ni `cobro_id` en el
//      select, la regla daría «no devuelta» para todas y no sacaría nada).
// El cableado se lee del FUENTE (lib/pagos.ts y lib/graficos-datos-extra.ts son `server-only`).
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 4 pases, 0 fallos. Rota (pases / fallos):
//   · getOutstandingDetalle sin `!esCuotaDevuelta(r)`                                → 3 / 1
//   · getOutstandingDetalle sin `proveedor, cobro_id` en el select                   → 3 / 1
//   · getOutstandingTotal sin el filtro                                              → 3 / 1
//   · el Revenue del Dashboard sumando `sinFecha` en vez de `sinFechaDeuda`          → 3 / 1
//   · esCuotaDevuelta sin pedir la pasarela (saca también la deuda del plan sin fecha)→ 3 / 1
// Correr: node --import tsx --test tests/outstanding-sin-devueltas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esCuotaDevuelta } from '../lib/cobrado-lead';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función, hasta la siguiente declaración de primer nivel. */
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}
const PAGOS = fuente('lib/pagos.ts');

test('la regla: devuelta es impaga, sin vencimiento y con pasarela; la cuota del plan sin fecha sigue siendo deuda', () => {
  assert.equal(esCuotaDevuelta({ pagado: false, fecha_esperada: null, proveedor: 'stripe', cobro_id: 7 }), true);
  assert.equal(esCuotaDevuelta({ pagado: false, fecha_esperada: null, proveedor: null, cobro_id: 7 }), true, 'un link sin proveedor anotado');
  assert.equal(esCuotaDevuelta({ pagado: false, fecha_esperada: null, proveedor: null, cobro_id: null }), false, 'la cuota del plan sin fecha es deuda');
  assert.equal(esCuotaDevuelta({ pagado: false, fecha_esperada: '2026-11-01', proveedor: 'stripe', cobro_id: 7 }), false, 'con vencimiento, es deuda');
  assert.equal(esCuotaDevuelta({ pagado: true, fecha_esperada: null, proveedor: 'stripe', cobro_id: 7 }), false);
});

// ⚠️ Desde el 17/10/2026 (#871) las tres lecturas filtran con `noEsDeuda` (devuelta O de un cliente dado de baja: las dos
// quedan impagas y sin vencimiento) y piden también `baja_at`. La regla de la baja se ejecuta en tests/pagos-baja.test.ts.

test('Outstanding y «A quién cobrarle» (getOutstandingDetalle): sin las devueltas, y con las columnas que la regla mira', () => {
  const f = cuerpo(PAGOS, '_getOutstandingDetalle');
  assert.match(f, /\.select\('id, lead_id, numero, monto_usd, fecha_esperada, pagado, proveedor, cobro_id, baja_at, leads\(/,
    'sin proveedor ni cobro_id la regla da «no devuelta» para todas');
  assert.match(f, /let noPagados = rows\.filter\(\(r\) => !r\.pagado && !noEsDeuda\(r\)\);/);
});

test('el Outstanding global (getOutstandingTotal): la misma regla', () => {
  const f = cuerpo(PAGOS, 'getOutstandingTotal');
  assert.match(f, /\.select\('monto_usd, pagado, fecha_esperada, proveedor, cobro_id, baja_at'\)/);
  assert.match(f, /\.filter\(\(p\) => !noEsDeuda\(p\)\)/);
});

test('el Revenue del Dashboard con «Todo»: las sin fecha son deuda, salvo las devueltas', () => {
  const g = fuente('lib/graficos-datos-extra.ts');
  const f = cuerpo(g, 'filasRevenue');
  assert.match(f, /'id, lead_id, monto_usd, fecha_pago, fecha_esperada, proveedor, cobro_id, baja_at', \{ \.\.\.rg, sinRango: true \}/);
  assert.match(f, /const sinFechaDeuda = sinFecha\.filter\(\(x\) => !noEsDeuda\(/);
  assert.match(f, /for \(const x of \[\.\.\.pendientes, \.\.\.sinFechaDeuda\]\)/, 'se suman las sin fecha sin sacar las devueltas');
});
