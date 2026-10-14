// =============================================================================
// Un presupuesto de Meta viaja en la unidad mínima de SU moneda, y hay monedas sin centavos
// =============================================================================
// EL CASO (13/10/2026, del relevo del Ads Manager). Todo lo que escribía o leía un
// presupuesto de Meta multiplicaba o dividía por 100: la escritura de la tabla
// (lib/meta-write.ts), la creación de campañas y conjuntos (lib/meta-ads-create.ts), la
// lectura del árbol y del saldo (lib/meta-health.ts) y la serie de presupuestos
// (lib/meta-ads.ts). Meta publica una tabla de «offsets»: once monedas (COP, CLP, JPY…)
// tienen offset 1, o sea que su `daily_budget` va en la unidad entera. Para un cliente que
// cobre en pesos colombianos, la celda mostraba 100 veces menos y escribir 20.000 COP/día
// ponía 2.000.000. Ningún cliente cobraba en una de ésas: se arregló antes del primero.
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 6 pasan, 0 fallan). Pasan / fallan:
//   · `offsetMeta` devuelve siempre 100                                   -> 4 / 2
//   · `MONEDAS_SIN_CENTAVOS_META` pierde el COP                           -> 4 / 2
//   · meta-write vuelve a `Math.round(mxn * 100)`                        -> 5 / 1
//   · meta-write escribe sin saber la moneda (saco el `if (!moneda)`)     -> 5 / 1
//   · meta-health vuelve a dividir el saldo por 100                       -> 5 / 1
//   · el detalle de una campaña vuelve a escribir «MXN» a mano            -> 5 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aUnidadMeta, desdeUnidadMeta, MONEDAS_SIN_CENTAVOS_META, offsetMeta } from '../lib/presupuesto-cambio';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. la regla ──────────────────────────────────────────────────────────────

test('las monedas con centavos van ×100 y las once sin centavos van tal cual', () => {
  for (const m of ['USD', 'MXN', 'ARS', 'EUR', 'BRL']) assert.equal(offsetMeta(m), 100, m);
  for (const m of ['COP', 'CLP', 'JPY', 'KRW', 'TWD', 'VND', 'IDR', 'HUF', 'ISK', 'PYG', 'CRC']) assert.equal(offsetMeta(m), 1, m);
  assert.equal(MONEDAS_SIN_CENTAVOS_META.size, 11, 'la tabla de Meta del 13/10/2026 tiene once con offset 1');
  // Como la manda Meta, en minúsculas o con espacios.
  assert.equal(offsetMeta(' cop '), 1);
});

test('ida y vuelta: lo que se escribe es lo que se lee', () => {
  assert.equal(aUnidadMeta(865, 'MXN'), 86500);
  assert.equal(desdeUnidadMeta(86500, 'MXN'), 865);
  assert.equal(aUnidadMeta(20000, 'COP'), 20000, '20.000 pesos colombianos son 20.000, no 2.000.000');
  assert.equal(desdeUnidadMeta(20000, 'COP'), 20000);
  assert.equal(aUnidadMeta(12.345, 'USD'), 1235, 'redondea a la unidad mínima');
});

test('con la moneda desconocida se DIBUJA como siempre (×100); escribir no llega acá', () => {
  assert.equal(offsetMeta(null), 100);
  assert.equal(offsetMeta(undefined), 100);
  assert.equal(offsetMeta(''), 100);
});

// ── 2. los que escriben y leen pasan por la regla ────────────────────────────

test('la escritura de un presupuesto pregunta la moneda y se niega si no la sabe', () => {
  const src = sinComentarios(leer('../lib/meta-write.ts'));
  assert.doesNotMatch(src, /daily_budget['"]?\s*,\s*String\(Math\.round\([^)]*\*\s*100\)\)/, 'el ×100 a mano volvió');
  assert.match(src, /aUnidadMeta\(\s*mxn\s*,\s*moneda\s*\)/);
  assert.match(src, /if\s*\(\s*!moneda\s*\)\s*return\s*\{\s*ok:\s*false/, 'sin moneda tiene que negarse, no escribir con el default');
});

test('la creación, el árbol, el saldo y la serie leen con la moneda de la cuenta', () => {
  const crear = sinComentarios(leer('../lib/meta-ads-create.ts'));
  assert.doesNotMatch(crear, /Math\.round\(\s*\w+\s*\*\s*100\s*\)/);
  assert.equal((crear.match(/aUnidadDeCuenta\(/g) ?? []).length, 2, 'sus dos usos: la campaña y el conjunto');

  const salud = sinComentarios(leer('../lib/meta-health.ts'));
  assert.doesNotMatch(salud, /num\(raw\.(balance|amount_spent|spend_cap)\)\s*\/\s*100/, 'el saldo volvió a dividirse por 100');
  assert.match(salud, /desdeUnidadMeta\(num\(raw\.balance\),\s*currency\)/);
  assert.match(salud, /toNodo\(r, 'adset', 'campaign_id', account\.currency\)/);

  const serie = sinComentarios(leer('../lib/meta-ads.ts'));
  assert.doesNotMatch(serie, /Number\(a\.daily_budget\)\s*\/\s*100/);
  assert.match(serie, /desdeUnidadMeta\(Number\(a\.daily_budget\),\s*moneda\)/);
});

test('el resumen del detalle que lee MaKo dice la moneda de la cuenta, no «MXN» a mano', () => {
  const det = sinComentarios(leer('../app/ads-manager/EntityDetalle.tsx'));
  assert.doesNotMatch(det, /\bMXN\b/);
  assert.match(det, /montoCuenta\(presupuestoCuenta,\s*moneda\)/);
  const browser = leer('../app/ads-manager/CampanasBrowser.tsx');
  assert.match(browser, /moneda=\{health\?\.account\.currency/);
});
