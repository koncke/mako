// =============================================================================
// El DEBUG de un negocio desde el grupo de SuperAdmin (29/10/2026): `diagnosticar_negocio` y de qué negocio se habla
// =============================================================================
// Martín le reenvió a MaKo la consulta de un cliente que no podía conectar Facebook, y MaKo le dio un consejo genérico: ninguna
// herramienta podía leer OTRO negocio. Lo que fija este archivo:
//   1. `buscarNegocio` (lib/diagnostico-negocio.ts, puro): por número («11», «ws11»), por el nombre entero o por el del dueño; con dos
//      que calzan devuelve los dos (el que llama pregunta cuál); nunca adivina con palabras de relleno («el negocio de…»);
//   2. el cableado: la operación es sólo de la plataforma (gating y el runner mira el ws del grupo), no sale por HTTP, lee con las
//      MISMAS lecturas del negocio corridas con SU workspace, y cada parte falla por su lado.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buscarNegocio } from '../lib/diagnostico-negocio';
import { DEFS } from '../lib/api-mako/areas/operaciones.def';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const NEGOCIOS = [
  { ws: 9, nombre: 'MaKo' }, { ws: 10, nombre: 'Fiesta Music' }, { ws: 11, nombre: 'Leila Fittipaldi | Metacoach' },
  { ws: 13, nombre: 'Joan Dowd Inmobiliario' }, { ws: 15, nombre: 'Brigitte Eberlin' }, { ws: 21, nombre: 'Florencia Ayelen Carballo' },
  { ws: 22, nombre: 'Patricia Contreras' }, { ws: 30, nombre: 'Leila Pruebas' },
];
const ws = (p: string) => buscarNegocio(p, NEGOCIOS).map((n) => n.ws);

test('1. de qué negocio se habla', () => {
  assert.deepEqual(ws('11'), [11]);
  assert.deepEqual(ws('ws 13'), [13]);
  assert.deepEqual(ws('99'), [], 'un número que no existe no es otro negocio');
  assert.deepEqual(ws('Fiesta Music'), [10]);
  assert.deepEqual(ws('fiesta'), [10]);
  assert.deepEqual(ws('el negocio de Brigitte'), [15], 'las palabras de relleno no cuentan');
  assert.deepEqual(ws('Florencia'), [21]);
  assert.deepEqual(ws('metacoach'), [11]);
  assert.deepEqual(ws('Leila'), [11, 30], 'dos que calzan: los dos, para preguntar cuál');
  assert.deepEqual(ws('Leila Fittipaldi'), [11]);
  assert.deepEqual(ws('el negocio'), [], 'sólo relleno: ninguno');
  assert.deepEqual(ws('Tincho'), [], 'un nombre que no está: ninguno (se pregunta de cuál es)');
  assert.deepEqual(ws(''), []);
});

test('2. el cableado: sólo la plataforma, sin HTTP, con las lecturas del propio negocio', () => {
  const def = DEFS.find((d) => d.id === 'diagnosticar_negocio');
  assert.ok(def, 'no está la operación');
  assert.equal(def!.tipo, 'lectura');
  assert.deepEqual(def!.gating, { rolMinimo: 'admin', soloPlataforma: true });
  assert.ok(!(def!.canales as readonly string[]).includes('http'), 'los datos de cualquier negocio no salen por HTTP');
  const run = leer('lib/api-mako/areas/operaciones.run.ts');
  const cuerpo = run.slice(run.indexOf('diagnosticar_negocio: {'));
  assert.match(cuerpo, /if \(ctx\.ws !== \(await wsSuperAdmin\(\)\)\) return \{ content: 'Diagnosticar otro negocio es sólo de la plataforma\.', isError: true \};/);
  assert.match(cuerpo, /const ctxDelNegocio = \{ \.\.\.ctx, ws \};/);
  assert.match(cuerpo, /runWithWorkspace\(ws, \(\) => run\.leer\(\{\}, ctxDelNegocio\)\)/, 'las lecturas no corren con el workspace del negocio');
  assert.match(cuerpo, /if \(cand\.length !== 1\)/, 'con dos que calzan, eligió uno');
  assert.match(cuerpo, /\.contains\('afectados', \[\{ ws \}\]\)/, 'los errores no son los de ESE negocio');
});
