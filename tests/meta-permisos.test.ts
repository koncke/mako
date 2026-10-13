// =============================================================================
// La tarjeta de Meta dice «Faltan permisos de anuncios» cuando Meta lo dijo
// =============================================================================
// EL CASO (08-13/10/2026). Conectada con la app MaKo, ws9 traía la página y los leads
// pero no `ads_read`/`ads_management`, y Meta contestaba la cuenta con un (#200). La
// tarjeta de /integraciones decía «No se pudo leer el estado de Meta» y el porqué se
// tiraba. Ahora el código de error decide (lib/meta-permisos.ts: 10 y 200-299, la
// tabla de Meta), lib/meta-health.ts lo tira como MetaHealthPermisoError, y la página,
// la tarjeta y el incidente lo nombran.
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 5 pasan, 0 fallan). Pasan / fallan:
//   · `esErrorDePermisoMeta` sin el rango 200-299 (sólo el 10)              -> 4 / 1
//   · meta-health tira el error genérico también con permisos               -> 4 / 1
//   · la página vuelve a pasar el texto crudo de Meta                        -> 4 / 1
//   · el detalle de la tarjeta vuelve a «No se pudo leer…: <crudo>»          -> 4 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esErrorDePermisoMeta, FALTAN_PERMISOS_META } from '../lib/meta-permisos';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('10 y 200-299 son permisos; el token vencido, el rate limit y lo demás, no', () => {
  for (const c of [10, 200, 294, 299]) assert.equal(esErrorDePermisoMeta(c), true, String(c));
  for (const c of [190, 100, 17, 4, 1, 300, 2500, undefined, null, '200']) assert.equal(esErrorDePermisoMeta(c), false, String(c));
});

test('meta-health lo tira como su propio error, después del token vencido y antes del genérico', () => {
  const src = sinComentarios(leer('../lib/meta-health.ts'));
  const ini = src.indexOf('async function graphGet(');
  const b = src.slice(ini, src.indexOf('\n}\n', ini));
  const token = b.indexOf('if (code === 190) throw new MetaHealthTokenError(');
  const permiso = b.indexOf('if (esErrorDePermisoMeta(code)) throw new MetaHealthPermisoError(');
  const generico = b.indexOf('throw new Error(`Meta API error: ${message}`);');
  assert.ok(token > 0 && permiso > token && generico > permiso, 'el orden: 190, permisos, genérico');
});

test('la página nombra la falta de permiso en vez de pasar el texto crudo de Meta', () => {
  const src = sinComentarios(leer('../app/integraciones/page.tsx'));
  assert.match(src, /err instanceof Error && err\.name === 'MetaHealthPermisoError'\s*\?\s*FALTAN_PERMISOS_META/);
});

test('la tarjeta y su detalle lo dicen con el texto de lib/meta-permisos.ts', () => {
  const src = sinComentarios(leer('../app/integraciones/IntegracionesBoard.tsx'));
  assert.match(src, /metaError === FALTAN_PERMISOS_META \? FALTAN_PERMISOS_META : 'No se pudo leer el estado de Meta'/);
  assert.match(src, /alerta = metaError === FALTAN_PERMISOS_META \? AVISO_FALTAN_PERMISOS_META/);
  assert.equal(FALTAN_PERMISOS_META.split(' ').length <= 4, true, 'el rótulo es corto');
});

test('el incidente también se llama «Faltan permisos de anuncios», en ámbar y sin confirmar', () => {
  const src = sinComentarios(leer('../lib/meta-health-history.ts'));
  const ini = src.indexOf('export function problemaMeta(');
  const b = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.match(b, /statusLabel: sinPermiso \? FALTAN_PERMISOS_META : 'No se pudo leer el estado de Meta'/);
  assert.match(b, /if \(metaError\) \{[\s\S]*severidad: 'ambar'[\s\S]*confirmado: false/);
});
