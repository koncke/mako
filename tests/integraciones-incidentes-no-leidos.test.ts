// =============================================================================
// /integraciones no dice «Todo en orden» cuando no pudo leer los incidentes (17/10/2026)
// =============================================================================
// docs/hallazgos-comunicacion.md (16/09/2026): `getIncidentes` devolvía `[]` cuando la lectura FALLABA, y con la lista
// vacía la pantalla afirmaba «Todo en orden.». La regla de ese hallazgo: «no pude leer» llega como error o como un campo
// aparte, nunca como lista vacía. Ahora `leerIncidentes` devuelve `null` en ese caso; la pantalla y la API lo dicen.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `leerIncidentes` con `return []` en el catch ......................................... 1 fallo
//   2. la pantalla sin la rama de `leidos === null` ............................................ 1 fallo
//   3. la página otra vez con `getIncidentes` ................................................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('la lectura que falla devuelve null, no una lista vacía', () => {
  const src = leer('lib/meta-health-history.ts');
  const f = src.slice(src.indexOf('export async function leerIncidentes('), src.indexOf('export async function leerIncidentes(') + 2500);
  assert.match(f, /console\.error\(`\[incidentes\] leer: [^\n]*\n\s*return null;/);
});

test('la pantalla dice «No pude leer» en vez de «Todo en orden», y la página le pasa el null', () => {
  const board = leer('app/integraciones/IntegracionesBoard.tsx');
  const h = board.slice(board.indexOf('function ProblemasHistorial('));
  assert.ok(h.indexOf('leidos === null') >= 0 && h.indexOf('leidos === null') < h.indexOf('>Todo en orden.'), 'el caso «no pude leer» va antes que «Todo en orden»');
  assert.match(h, /No pude leer el historial de problemas/);
  const page = leer('app/integraciones/page.tsx');
  assert.match(page, /const incidentes: Incidente\[\] \| null = await leerIncidentes\(30\);/);
  const api = leer('lib/api-mako/areas/ads.run.ts');
  assert.match(api, /if \(inc === null\) return fallo\(/);
});
