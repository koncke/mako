// =============================================================================
// El staging de los creativos se limpia sin depender de una pestaña (revisión de la #59)
// =============================================================================
// Con la espera del POST de creative-upload en 25 s, el staging de un video lo borraba
// sólo el GET del navegador. Cerrar el modal o quitar la tarjeta cortaba el sondeo y el
// archivo quedaba para siempre (nada más limpia ese bucket). Ahora cada subida barre lo
// que ya sobra, leyendo la hora del propio nombre (lib/ads-staging.ts). Desde el 27/10/2026
// el barrido vive en creative-signurl (creative-upload se borró con el Ads Manager viejo).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPathDeStaging, nombreSeguroDeStaging, pathNuevoDeStaging, stagingVencido, STAGING_CARPETA, VIDA_STAGING_MS } from '../lib/ads-staging';

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

test('cada firma barre lo que sobra, y la firma nombra con el mismo formato', () => {
  // Desde el 27/10/2026 creative-upload está borrada (era del Ads Manager viejo) y cada subida del Media Buyer empieza
  // firmando: el barrido corre en la ruta de la firma. La firma y el barrido viven en lib/ads-staging-firma.ts (los usa
  // también la API de MaKo): sin el barrido, nada más limpia ese bucket.
  const ruta = codigo('app/api/ads-manager/creative-signurl/route.ts');
  const post = ruta.slice(ruta.indexOf('export async function POST('));
  assert.match(post, /after\(\(\) => barrerStagingViejo\(\)\);/, 'el barrido corre en after() de cada firma');
  assert.match(post, /firmarSubidaDeStaging\(/, 'la ruta firma con la función compartida');
  const lib = codigo('lib/ads-staging-firma.ts');
  assert.match(lib, /\.filter\(\(n\) => stagingVencido\(n, ahora\)\)/);
  assert.match(lib, /const path = pathNuevoDeStaging\(nombreSeguroDeStaging\(nombre\)\);/, 'un nombre armado a mano el barrido no lo reconoce');
  assert.equal(nombreSeguroDeStaging('mi video (final).mp4'), 'mi_video_final_.mp4');
  assert.equal(nombreSeguroDeStaging('¿¿'), '_');
  assert.equal(nombreSeguroDeStaging(''), 'creativo');
  //   ROTO A PROPÓSITO (27/10/2026): sin la línea del after() del barrido, pass 2 / fail 1 — éste; y la firma con
  //   `` `nueva/${nombre}` `` a mano, también.
});
