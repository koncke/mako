// =============================================================================
// Un video no se da por listo hasta que Meta lo procesó (tarea #59)
// =============================================================================
// El bug medido el 25/09 y vivo hasta el 07/10: creative-upload devolvía `processing` y `video_status`, el tipo SubidoCreativo
// no los declaraba y los TRES modales escribían `processing: false` sin mirar.
//
// ⚠️ 27/10/2026: los tests de la subida del navegador (subirCreativo, esperarVideoListo) y de las rutas (campaign-create,
// ad-add, adset-add, creative-upload) se fueron con ellas: eran del Ads Manager viejo, borrado el 25/10, y no las llamaba
// ninguna pantalla (docs/hallazgos-ads.md → «Las rutas viejas de app/api/ads-manager»). Queda lo que vive en la lib.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de
// un `//` abre un bloque que se come el código del medio).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (p: string) => sinComentarios(leer(p));

const LIB = codigo('lib/meta-ads-create.ts');

/** El cuerpo de una función: desde su firma hasta la primera línea que cierra en la
 *  columna 0 (`}`), que en estos archivos es el cierre de la función. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  return src.slice(i, fin < 0 ? undefined : fin);
}

test('withVideoThumb NO tira (la previa se dibuja igual); el creativo de verdad SÍ exige la miniatura', () => {
  const thumb = cuerpo(LIB, 'async function withVideoThumb(');
  assert.doesNotMatch(thumb, /throw /, 'withVideoThumb la usa generatePreviews: si tira, la previa del paso de revisión se rompe');
  assert.match(cuerpo(LIB, 'export async function generatePreviews('), /withVideoThumb\(creative\)/);
  const estricta = cuerpo(LIB, 'async function conMiniaturaParaPublicar(');
  assert.match(estricta, /if \(faltaMiniatura\(out\)\) \{\n\s*throw new MetaWriteError\(/);
  // Y el creativo pasa por la estricta ANTES del POST a adcreatives.
  const crear = cuerpo(LIB, 'export async function createAdCreative(');
  const a = crear.indexOf('conMiniaturaParaPublicar(creative)');
  const b = crear.lastIndexOf('/adcreatives');
  assert.ok(a > 0 && a < b, 'la miniatura se exige antes de crear el creativo');
  //   ROTO A PROPÓSITO (07/10/2026): con `withVideoThumb(creative)` de vuelta en
  //   createAdCreative, pass 6 / fail 1 — éste; y con un `throw` en withVideoThumb (la
  //   previa rota), pass 6 / fail 1 — éste.
});
