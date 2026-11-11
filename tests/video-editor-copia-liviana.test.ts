// =============================================================================
// La copia liviana de cada video: la vista previa decodifica 540 px, exportar el original (11/11/2026)
// =============================================================================
// Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md, banco scripts/banco-memoria-editor/): el navegador
// decodifica a la resolución del ARCHIVO. Achicar el lienzo de salida no baja nada (3 clips de 1080×1920: +297 → +264 MB);
// una copia de 540×960, sí (+86 MB), y en 4K el pico pasa de +529 a +26 MB. Fija:
//   · app/video-editor/_opencut/media/copia-liviana-reglas.ts (el tamaño, las claves y el archivo);
//   · que la VISTA PREVIA use la copia con OTRA clave del videoCache y que EXPORTAR use el original;
//   · que exportar suelte los decodificadores del original al terminar, y que borrar un medio suelte los de la copia;
//   · que la cola de copias se corte al cambiar de proyecto.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `claveLiviana` devolviendo la misma clave: rojo el de las claves (la exportación recibiría el decodificador de 540 px);
//   · en scene-builder, `const copia = mediaAsset.copiaLiviana` (sin mirar isPreview): rojo el de la escena;
//   · `isPreview: true` en el buildScene de `ejecutar` (exportar): rojo el de exportar;
//   · sin `cortarCopias()` en clearAllAssets: rojo el de la cola.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  archivoDeCopia,
  claveLiviana,
  clavesDeLaCopia,
  clavesDelOriginal,
  medidasDeCopia,
} from '../app/video-editor/_opencut/media/copia-liviana-reglas';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OC = 'app/video-editor/_opencut';

test('el tamaño: el lado corto a 540, la misma proporción y medidas pares', () => {
  assert.deepEqual(medidasDeCopia({ width: 1080, height: 1920 }), { width: 540, height: 960 });
  assert.deepEqual(medidasDeCopia({ width: 1920, height: 1080 }), { width: 960, height: 540 });
  assert.deepEqual(medidasDeCopia({ width: 3840, height: 2160 }), { width: 960, height: 540 });
  // Un iPhone (1284×2778): 2778·540/1284 = 1168,3 → 1168, par.
  assert.deepEqual(medidasDeCopia({ width: 1284, height: 2778 }), { width: 540, height: 1168 });
  for (const m of [medidasDeCopia({ width: 1284, height: 2778 })!, medidasDeCopia({ width: 1080, height: 1920 })!]) {
    assert.equal(m.width % 2, 0);
    assert.equal(m.height % 2, 0);
  }
});

test('un 720p o menos no lleva copia (ya decodifica poco), y sin medidas tampoco', () => {
  assert.equal(medidasDeCopia({ width: 720, height: 1280 }), null);
  assert.equal(medidasDeCopia({ width: 1280, height: 720 }), null);
  assert.equal(medidasDeCopia({ width: 480, height: 854 }), null);
  assert.equal(medidasDeCopia({ width: 0, height: 1920 }), null);
  assert.equal(medidasDeCopia({ width: Number.NaN, height: 1920 }), null);
});

test('las claves: la copia NUNCA comparte decodificador con el original (ni con el de la transición)', () => {
  const original = clavesDelOriginal('m1');
  const copia = clavesDeLaCopia('m1');
  assert.deepEqual(original, ['m1', 'm1#transicion']);
  assert.equal(copia.length, 2);
  for (const c of copia) assert.ok(!original.includes(c), `${c} es también una clave del original`);
  assert.equal(claveLiviana('m1'), copia[0]);
  assert.notEqual(archivoDeCopia('m1'), 'm1', 'la copia pisaría el original en el OPFS');
});

test('la escena: la vista previa decodifica la copia con su clave; sin isPreview, el original', () => {
  const sb = leer(`${OC}/services/renderer/scene-builder.ts`);
  assert.match(sb, /const copia = isPreview \? mediaAsset\.copiaLiviana : undefined;/);
  assert.match(sb, /copia \? \{ mediaId: claveLiviana\(clave\), file: copia \} : \{ mediaId: clave, file: mediaAsset\.file \}/);
  // El clip y su fondo desenfocado pasan por la misma regla (y el fondo recibe isPreview).
  assert.match(sb, /new VideoNode\(\{\s*\.\.\.fuenteDeVideo\(\{ mediaAsset, clave: tr\?\.claveDecodificador \?\? mediaAsset\.id, isPreview \}\)/);
  assert.match(sb, /fuenteDeVideo\(\{ mediaAsset, clave: mediaAsset\.id, isPreview \}\)/);
  assert.match(sb, /buildBlurBackgroundNodes\(\{[\s\S]*?isPreview,\s*\}\);/);
  assert.doesNotMatch(sb, /file: mediaAsset\.file,\s*duration/, 'quedó un VideoNode que decodifica el original en la vista previa');
});

test('exportar: el video sale del ORIGINAL y al terminar suelta sus decodificadores', () => {
  const ex = leer(`${OC}/export/exportar.ts`);
  const ejecutar = ex.slice(ex.indexOf('async ejecutar('), ex.indexOf('export function refrescarReproductor'));
  const escena = ejecutar.match(/const escena = buildScene\(\{[\s\S]*?\}\);/);
  assert.ok(escena, 'no encontré la escena de exportar');
  assert.doesNotMatch(escena![0], /isPreview/, 'exportar con isPreview saldría en 540 px');
  assert.match(ejecutar, /videoCache\.empezarExportacion\(\);\s*try \{/);
  assert.match(ejecutar, /\} finally \{\s*videoCache\.terminarExportacion\(\);\s*soltarOriginales\(editor\);/);
  assert.match(ex, /function soltarOriginales[\s\S]*?if \(!asset\.copiaLiviana\) continue;[\s\S]*?clavesDelOriginal\(asset\.id\)/);
  // La portada y la miniatura del proyecto, chicas: con la copia.
  assert.match(ex, /export async function portada[\s\S]*?isPreview: true,/);
  assert.match(leer(`${OC}/core/managers/project-manager.ts`), /updateThumbnailFromTimeline[\s\S]*?buildScene\(\{[\s\S]*?isPreview: true,/);
});

test('borrar un medio suelta también su copia (decodificadores y archivo)', () => {
  assert.match(leer(`${OC}/commands/media/remove-media-asset.ts`), /for \(const clave of clavesDeLaCopia\(this\.assetId\)\) videoCache\.clearVideo/);
  assert.match(leer(`${OC}/services/storage/service.ts`), /async deleteMediaAsset[\s\S]*?mediaAssetsAdapter\.remove\(archivoDeCopia\(id\)\)/);
});

test('la cola: se arma al importar y al abrir, se corta al cambiar de proyecto y espera a que termine una exportación', () => {
  const mm = leer(`${OC}/core/managers/media-manager.ts`);
  assert.match(mm, /async addMediaAsset[\s\S]*?if \(convieneCopia\(newAsset\)\) this\.encolarCopia/);
  assert.match(mm, /async loadProjectMedia[\s\S]*?this\.cortarCopias\(\);[\s\S]*?void this\.recuperarCopias/);
  assert.match(mm, /async clearProjectMedia[\s\S]*?this\.cortarCopias\(\);/);
  assert.match(mm, /clearAllAssets\(\): void \{\s*this\.cortarCopias\(\);/);
  assert.match(mm, /while \(videoCache\.estaExportando\(\) && !senal\.aborted\) await esperar/);
  // Al llegar la copia, el original se suelta sólo si no está exportando.
  assert.match(mm, /private ponerCopia[\s\S]*?if \(videoCache\.estaExportando\(\)\) return;[\s\S]*?clavesDelOriginal\(id\)/);
});

test('la conversión: sin audio, con el giro dibujado y desde el 0 del original', () => {
  const cl = leer(`${OC}/media/copia-liviana.ts`);
  assert.match(cl, /audio: \{ discard: true \}/);
  assert.match(cl, /allowTransformationMetadata: false/);
  assert.match(cl, /trim: \{ start: 0 \}/);
  assert.match(cl, /keyFrameInterval: 1/);
  assert.match(cl, /finally \{\s*input\.dispose\(\);/);
});
