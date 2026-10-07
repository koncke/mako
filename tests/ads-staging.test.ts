// =============================================================================
// El staging de los creativos se limpia sin depender de una pestaña (revisión de la #59)
// =============================================================================
// Con la espera del POST de creative-upload en 25 s, el staging de un video lo borraba
// sólo el GET del navegador. Cerrar el modal o quitar la tarjeta cortaba el sondeo y el
// archivo quedaba para siempre (nada más limpia ese bucket). Ahora cada subida barre lo
// que ya sobra, leyendo la hora del propio nombre (lib/ads-staging.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPathDeStaging, pathNuevoDeStaging, stagingVencido, STAGING_CARPETA, VIDA_STAGING_MS } from '../lib/ads-staging';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const codigo = (p: string) => leer(p).replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const AHORA = Date.parse('2026-10-07T22:00:00Z');
const nombre = (path: string) => path.slice(STAGING_CARPETA.length + 1);

test('un archivo nuevo NO sobra; uno de hace más de 6 h, sí', () => {
  const recien = pathNuevoDeStaging('video.mp4', AHORA, () => 0.123456789);
  assert.ok(esPathDeStaging(recien), recien);
  assert.equal(stagingVencido(nombre(recien), AHORA), false);
  // Meta lo baja de una URL firmada por 1 h: a la hora todavía no sobra.
  assert.equal(stagingVencido(nombre(recien), AHORA + 60 * 60_000), false);
  assert.equal(stagingVencido(nombre(recien), AHORA + VIDA_STAGING_MS + 1), true);
  //   ROTO A PROPÓSITO (07/10/2026): con `ahoraMs - t < vidaMs`, pass 2 / fail 1 — éste
  //   (y el barrido habría borrado justo lo que Meta todavía estaba bajando).
});

test('lo que no tiene la forma de pathNuevoDeStaging no se borra', () => {
  for (const n of ['carpeta', 'creativo.mp4', '170000000000-abc-x.mp4', 'abc-1700000000000-x.mp4', '']) {
    assert.equal(stagingVencido(n, AHORA + 10 * VIDA_STAGING_MS), false, n);
  }
  assert.equal(esPathDeStaging('nueva/../otro/x.mp4'), false);
  assert.equal(esPathDeStaging('otra/1700000000000-abc-x.mp4'), false);
});

test('creative-upload barre en cada subida, y signurl nombra con el mismo formato', () => {
  const upload = codigo('app/api/ads-manager/creative-upload/route.ts');
  const post = upload.slice(upload.indexOf('export async function POST('), upload.indexOf('export async function GET('));
  assert.match(post, /after\(\(\) => barrerStagingViejo\(limpiar\)\);/, 'el barrido corre en after() de cada subida');
  assert.match(upload, /\.filter\(\(n\) => stagingVencido\(n, ahora\)\)/);
  const firma = codigo('app/api/ads-manager/creative-signurl/route.ts');
  assert.match(firma, /const path = pathNuevoDeStaging\(filename\);/, 'un nombre armado a mano el barrido no lo reconoce');
  //   ROTO A PROPÓSITO (07/10/2026): sin la línea del after() del barrido, pass 2 / fail 1 — éste.
});
