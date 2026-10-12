// «Today» de MaKo Mobile: lo puro (lib/hoy-movil-modelo.ts) y dos cables del compositor.
//
// Verificado ROMPIENDO cada cosa que persigue (11/10/2026), con la base en 0 fallos:
//   · `composicionHoy` sin `deLaAgencia` en `pulso` (superadmin con Pulso): 1 fallo.
//   · `sumaDe` devolviendo 0 en vez de null para una bandeja sin leer: 1 fallo.
//   · `horaEnZona` con la zona del proceso en vez de `tz`: 1 fallo.
//   · lib/hoy-movil.ts llamando `getPendientesDeMarcar` dos veces: 1 fallo.
// (v2, 11/10/2026: se borraron fraseHeroe, textoLampara, alertasRestantes y diasQueQuedan con sus
// tests —Today ya no los dibuja—; las guardas del #165 viven ahora en tests/m-hoy.test.ts.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composicionHoy, horaEnZona, sumaDe } from '../lib/hoy-movil-modelo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('composición por rol: la capa de la agencia no ve el Pulso aunque `general` la deje pasar', () => {
  const sa = composicionHoy('admin', 'superadmin');
  assert.deepEqual(sa, { pulso: false, reuniones: false, leadsPorDecidir: false, plan: true, vencimientos: true });
  const cliente = composicionHoy('admin', 'completo');
  assert.deepEqual(cliente, { pulso: true, reuniones: true, leadsPorDecidir: false, plan: true, vencimientos: false });
  const closer = composicionHoy('closer', 'completo');
  assert.deepEqual(closer, { pulso: false, reuniones: true, leadsPorDecidir: true, plan: true, vencimientos: false });
  const pm = composicionHoy('admin', 'pm');
  assert.equal(pm.pulso, false);
  assert.equal(pm.reuniones, false);
  assert.equal(pm.vencimientos, true);
  // Sin rol (sin sesión): nada gateado.
  assert.equal(composicionHoy(null, 'completo').pulso, false);
});

test('sumaDe: una bandeja sin leer es null, una que el rol no ve no suma', () => {
  assert.equal(sumaDe({ pendiente: 2, accion: 1 }, ['pendiente', 'accion', 'confirmacion']), 3);
  assert.equal(sumaDe({ pendiente: 2, accion: null }, ['pendiente', 'accion']), null);
  assert.equal(sumaDe({}, ['pendiente']), 0);
});

test('la hora de una reunión es la del NEGOCIO, no la del teléfono', () => {
  const iso = '2026-10-11T17:00:00Z';
  assert.equal(horaEnZona(iso, 'America/Tijuana'), '10:00');
  assert.equal(horaEnZona(iso, 'America/Argentina/Buenos_Aires'), '14:00');
  assert.equal(horaEnZona(null, 'America/Tijuana'), null);
  assert.equal(horaEnZona('no-es-fecha', 'America/Tijuana'), null);
});

test('el compositor llama UNA sola vez a getPendientesDeMarcar (escribe en la base)', () => {
  const src = sinComentarios(leer('lib/hoy-movil.ts'));
  assert.equal((src.match(/getPendientesDeMarcar\(/g) ?? []).length, 1);
  // Y el Inbox se CUENTA (no escribe), nunca se lee entero desde Today.
  assert.doesNotMatch(src, /leerParaDecidir/);
});

test('la página tiene su guard y su maxDuration', () => {
  const src = sinComentarios(leer('app/m/hoy/page.tsx'));
  assert.match(src, /await requireMovil\(/);
  assert.match(src, /export const maxDuration = 60;/);
  assert.doesNotMatch(src, /from 'next\/link'|from 'next\/navigation'/);
});
