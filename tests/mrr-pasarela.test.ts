// =============================================================================
// El MRR cuenta la suscripción de la pasarela de un cliente que compró como pago único (15/10/2026)
// =============================================================================
// Decidido el 15/10 (docs/hallazgos-planes-y-cobro.md, «Cuatro decisiones…»), copiando a Stripe: el MRR son las
// suscripciones activas. Un lead que ganó como pago único y después paga un link de suscripción sigue de pago único
// (pasarlo a suscripción sacaría su compra de lo vendido), y su mensualidad no la contaba nadie. Lo que se fija:
//   1. la suma (`mrrDeLaPasarela`, se EJECUTA): cuenta las de un lead que no es de suscripción, NO las de uno que sí
//      (ya las cuenta el lead, con su plazo: serían dos veces), y nada sin monto en USD o sin lead;
//   2. la lectura (`getMrrActivo`, se lee del fuente: es `server-only` y va por la caché de Next) pide sólo las
//      suscripciones PAGADAS y ACTIVAS de la pasarela, y su caché se invalida también con los pagos.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 3 pases, 0 fallos. Rota (pases / fallos):
//   · mrrDeLaPasarela sin excluir a los leads de suscripción (dos veces)       → 2 / 1
//   · getMrrActivo sin `.eq('suscripcion_estado', 'activa')` (las canceladas)  → 2 / 1
//   · getMrrActivo sin sumar lo de la pasarela                                  → 2 / 1
//   · la caché del MRR sin TAG.pagos (un cobro nuevo no lo movía por un rato)   → 2 / 1
// Correr: node --import tsx --test tests/mrr-pasarela.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mrrDeLaPasarela } from '../lib/cobros-reglas';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la suma: las de un lead que no es de suscripción sí; las de uno que sí, no (serían dos veces); sin monto o sin lead, no', () => {
  const deSuscripcion = new Set([2]);
  const r = mrrDeLaPasarela([
    { lead_id: 1, monto_usd: 49 },        // pagó único y después se suscribió: cuenta
    { lead_id: '3', monto_usd: '97.5' },  // los numeric de Postgres pueden llegar como texto
    { lead_id: 2, monto_usd: 120 },       // lead de suscripción: ya lo cuenta getMrrActivo por el lead
    { lead_id: 4, monto_usd: null },      // en otra moneda sin valor en USD: no se inventa
    { lead_id: null, monto_usd: 30 },     // sin lead: fuera del CRM
  ], deSuscripcion);
  assert.deepEqual(r, { mrr: 146.5, activas: 2 });
  assert.deepEqual(mrrDeLaPasarela([], deSuscripcion), { mrr: 0, activas: 0 });
});

test('la lectura: sólo las suscripciones PAGADAS y ACTIVAS de la pasarela, y se suman al MRR de los leads', () => {
  const q = fuente('lib/queries.ts');
  const ini = q.indexOf('async function _getMrrActivo(');
  const f = q.slice(ini, q.indexOf('\nexport const ', ini));
  assert.ok(ini > 0, 'no encontré _getMrrActivo');
  assert.match(f, /\.from\('cobros'\)\s*\.select\('lead_id, monto_usd'\)\s*\.eq\('tipo', 'suscripcion'\)\s*\.eq\('estado', 'pagado'\)\s*\.eq\('suscripcion_estado', 'activa'\)/,
    'una suscripción cancelada o un link sin pagar no es MRR');
  assert.match(f, /\.filter\(\(l\) => l\.venta_tipo === 'suscripcion'\)/, 'los leads de suscripción se excluyen por su tipo');
  assert.match(f, /const p = mrrDeLaPasarela\(cobros, deSuscripcion\);\s*mrr \+= p\.mrr;\s*activas \+= p\.activas;/);
});

test('la caché del MRR se invalida también con los pagos (un cobro nuevo lo mueve)', () => {
  assert.match(fuente('lib/queries.ts'), /cachedRead\('getMrrActivo', _getMrrActivo, \{ tags: \[TAG\.leads, TAG\.pagos\], revalidate: TTL\.user \}\)/);
});
