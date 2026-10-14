// =============================================================================
// Una sola moneda por defecto en el Ads Manager, y con ésa no se crea nada
// =============================================================================
// EL CASO (13/10/2026, del relevo del Ads Manager). Cuando Meta no decía la moneda de
// la cuenta (o no había conexión), la salud de la cuenta inventaba 'MXN' y el wizard
// 'USD': la misma cuenta podía verse en dos monedas. Y la creación de campañas y
// conjuntos usaba ese default para convertir el presupuesto, o sea que decidía plata
// con un dato inventado. Ahora el default es UNO (`MONEDA_META_POR_DEFECTO`, en
// lib/presupuesto-cambio.ts), sirve para dibujar, y `cuentaMeta()` dice si la moneda
// se LEYÓ: sin eso, crear con presupuesto se niega.
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 3 pasan, 0 fallan). Pasan / fallan:
//   · la salud de la cuenta vuelve a `?? 'MXN'`                              -> 2 / 1
//   · el wizard vuelve a `?? 'USD'` a mano                                   -> 2 / 1
//   · `aUnidadDeCuenta` sin el `if (!cuenta.monedaLeida)`                    -> 2 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MONEDA_META_POR_DEFECTO } from '../lib/presupuesto-cambio';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LECTORES = [
  '../lib/meta-health.ts',
  '../lib/meta-ads-create.ts',
  '../app/api/meta-health/route.ts',
  '../app/ads-manager/AgregarConjuntoModal.tsx',
  '../app/ads-manager/NuevaCampanaModal.tsx',
  '../app/ads-manager/CampanasBrowser.tsx',
];

test('el default es uno y es una moneda de verdad', () => {
  assert.match(MONEDA_META_POR_DEFECTO, /^[A-Z]{3}$/);
});

test('nadie en el Ads Manager inventa una moneda propia', () => {
  for (const p of LECTORES) {
    const src = sinComentarios(leer(p));
    assert.doesNotMatch(src, /(\?\?|\|\|)\s*'(MXN|USD)'/, `${p} tiene su propio default de moneda`);
  }
  // Sin conexión, la salud vacía también dibuja con el mismo default. (Un `currency:
  // 'USD'` en las opciones de Intl, para un monto YA pasado a dólares, no es un default.)
  assert.match(sinComentarios(leer('../app/api/meta-health/route.ts')), /currency: MONEDA_META_POR_DEFECTO,/);
});

test('crear con presupuesto se niega si la moneda de la cuenta no se leyó', () => {
  const src = sinComentarios(leer('../lib/meta-ads-create.ts'));
  assert.match(src, /const aUnidadDeCuenta = \(monto: number, cuenta: \{ currency: string; monedaLeida: boolean \}\): number => \{\n\s*if \(!cuenta\.monedaLeida\) throw new MetaWriteError\(/);
  assert.match(src, /const leida = typeof d\.currency === 'string' && d\.currency\.trim\(\) !== '';/);
  assert.match(src, /monedaLeida: leida,/);
  assert.equal((src.match(/aUnidadDeCuenta\([^)]*, (await cuentaMeta\(\)|cuenta)\)/g) ?? []).length, 2, 'la campaña y el conjunto pasan la cuenta entera');
});
