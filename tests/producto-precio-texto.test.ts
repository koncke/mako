// =============================================================================
// Confirmar un cambio de precio muestra el de antes y el de ahora (6/11/2026)
// =============================================================================
// `guardar_producto` es `costo: 'gratis'`, así que la tarjeta de la app lo propone como cualquier cambio, y su resumen
// decía sólo el precio nuevo. Ahora lo arma `precioDelResumen` (lib/producto-precio-texto.ts).
//
// PROBADO ROMPIÉNDOLO (base 2 / 0):
//   · `precioDelResumen` devolviendo siempre `queda` (lo de antes)                → 1 / 1
//   · `guardar_producto` volviendo a armar su precio a mano                         → 1 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { precioDelResumen } from '../lib/producto-precio-texto';

test('editar: dice lo que había y lo que queda; crear o sin cambio: sólo el que queda', () => {
  assert.equal(precioDelResumen({ antes: { monto_usd: 2000, suscripcion: false }, ahora: { monto_usd: 200, suscripcion: false } }), 'precio: 2000 USD → 200 USD');
  assert.equal(precioDelResumen({ antes: { monto_usd: null, suscripcion: false }, ahora: { monto_usd: 97, suscripcion: true } }), 'precio: sin precio → 97 USD al mes');
  assert.equal(precioDelResumen({ antes: { monto_usd: 500, suscripcion: false }, ahora: { monto_usd: 500, suscripcion: false } }), '500 USD');
  assert.equal(precioDelResumen({ ahora: { monto_usd: 1500, suscripcion: false } }), '1500 USD', 'al crear no hay antes');
});

test('CABLEADO: guardar_producto arma su precio con la regla', () => {
  const src = readFileSync(join(__dirname, '..', 'lib/api-mako/areas/crm.run.ts'), 'utf8').replace(/\r\n/g, '\n');
  const op = src.slice(src.indexOf('  guardar_producto: {'), src.indexOf('  proponer_leads: {'));
  assert.ok(op.length > 500, 'encontré guardar_producto');
  assert.match(op, /const precio = precioDelResumen\(\{\n\s*antes: existente \?/);
  assert.doesNotMatch(op, /const precio = payload\.monto_usd != null/, 'el precio a mano no vuelve');
});
