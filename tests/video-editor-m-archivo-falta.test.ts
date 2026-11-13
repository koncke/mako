// =============================================================================
// El teléfono avisa cuando falta el archivo de un clip, y deja volver a elegirlo (12/11/2026)
// =============================================================================
// Visto en producción el 12/11/2026: en el editor del teléfono (app/m/video-editor/EditorVideoM.tsx), con el OPFS vacío
// después de recargar y el proyecto todavía en IndexedDB, el reproductor quedaba NEGRO y mudo, sin ningún aviso:
// storageService.loadMediaAsset devuelve null para ese medio y el armado de la escena salta el clip.
// Ahora:
//   · media/archivos-faltantes.ts dice qué medios usa la línea y no están (uno por archivo) y el texto del aviso;
//   · el teléfono lo muestra ENCIMA del reproductor con «Elegir», que abre la galería con el tipo del clip;
//   · media/reenlazar.ts procesa el archivo como importar y MediaManager.reenlazarMedio lo guarda con el MISMO mediaId
//     (no uno nuevo: el clip conserva recorte, velocidad y efectos, y la línea no cambia).
// Lo puro se prueba; la pantalla y el motor (React, OPFS) no corren en node: se fija el fuente.
//
// Correr: node --import tsx --test tests/video-editor-m-archivo-falta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  aceptaDelFaltante,
  archivosFaltantes,
  AVISO_OTRO_TIPO,
  textoDelAviso,
} from '../app/video-editor/_opencut/media/archivos-faltantes';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const pistas = (main: unknown[], overlay: unknown[][] = [], audio: unknown[][] = []) => ({
  main: { elements: main },
  overlay: overlay.map((elements) => ({ elements })),
  audio: audio.map((elements) => ({ elements })),
});

test('A1: dice cada archivo que falta UNA vez, en el orden del video, y no los que están', () => {
  const tracks = pistas(
    [
      { type: 'video', mediaId: 'b', name: 'toma-b.mp4', startTime: 500 },
      { type: 'video', mediaId: 'a', name: 'toma-a.mp4', startTime: 0 },
      // Un clip dividido: dos clips, un archivo.
      { type: 'video', mediaId: 'b', name: 'toma-b.mp4', startTime: 900 },
      { type: 'video', mediaId: 'ok', name: 'esta.mp4', startTime: 1200 },
      { type: 'text', name: 'Hola', startTime: 0 },
    ],
    [[{ type: 'image', mediaId: 'f', name: 'logo.png', startTime: 300 }]],
  );
  const faltan = archivosFaltantes(tracks, new Set(['ok']));
  assert.deepEqual(faltan.map((f) => f.mediaId), ['a', 'f', 'b']);
  assert.deepEqual(faltan.map((f) => f.nombre), ['toma-a.mp4', 'logo.png', 'toma-b.mp4']);
  assert.deepEqual(faltan.map((f) => f.tipo), ['video', 'image', 'video']);
  assert.equal(faltan.find((f) => f.mediaId === 'b')?.clips, 2);
});

test('A2: el audio subido cuenta; la música de la biblioteca (por URL) no', () => {
  const tracks = pistas([], [], [[
    { type: 'audio', sourceType: 'upload', mediaId: 'voz', name: 'voz.m4a', startTime: 0 },
    { type: 'audio', sourceType: 'library', mediaId: 'musica', name: 'Tema', startTime: 0 },
  ]]);
  assert.deepEqual(archivosFaltantes(tracks, new Set()).map((f) => f.mediaId), ['voz']);
});

test('A3: con todo en su lugar no hay aviso; sin nombre, dice qué es', () => {
  assert.deepEqual(archivosFaltantes(pistas([{ type: 'video', mediaId: 'a', name: 'a.mp4', startTime: 0 }]), new Set(['a'])), []);
  assert.equal(textoDelAviso([]), '');
  const sinNombre = archivosFaltantes(pistas([{ type: 'video', mediaId: 'x', name: '  ', startTime: 0 }]), new Set());
  assert.equal(sinNombre[0].nombre, 'un video');
});

test('A4: el aviso nombra el archivo (uno) o dice cuántos (varios, cada uno en su fila), corto', () => {
  assert.equal(textoDelAviso([{ nombre: 'toma-a.mp4' }]), 'Falta «toma-a.mp4» en este teléfono');
  assert.equal(textoDelAviso([{ nombre: 'a.mp4' }, { nombre: 'b.mp4' }]), 'Faltan 2 archivos en este teléfono');
  assert.ok(textoDelAviso([{ nombre: 'a.mp4' }, { nombre: 'b.mp4' }]).length <= 40, 'el título entra en 375 px');
});

test('A5: el selector pide el MISMO tipo del clip, y un archivo de otro tipo se rechaza con su aviso', () => {
  assert.equal(aceptaDelFaltante('video'), 'video/*');
  assert.equal(aceptaDelFaltante('image'), 'image/*');
  assert.equal(aceptaDelFaltante('audio'), 'audio/*');
  assert.equal(AVISO_OTRO_TIPO.video, 'Ese archivo no es un video');
  const reenlazar = sinComentarios(leer('app/video-editor/_opencut/media/reenlazar.ts'));
  assert.match(reenlazar, /processMediaAssets\(\{ files: \[file\] \}\)/, 'se procesa como importar (miniatura, duración, tamaño)');
  assert.match(reenlazar, /if \(asset\.type !== tipo\) \{[\s\S]*?toast\.error\(AVISO_OTRO_TIPO\[tipo\]\)/);
  assert.match(reenlazar, /editor\.media\.reenlazarMedio\(\{ projectId: proyecto\.metadata\.id, id: mediaId, asset \}\)/);
});

test('A6: el motor reenlaza con el MISMO mediaId (un id nuevo deja al clip sin su archivo)', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/core/managers/media-manager.ts'));
  const cuerpo = /async reenlazarMedio\([\s\S]*?\n\t\}\n/.exec(src)?.[0] ?? '';
  assert.ok(cuerpo, 'MediaManager ya no tiene reenlazarMedio');
  assert.match(cuerpo, /const nuevo: MediaAsset = \{ \.\.\.asset, id \};/);
  assert.doesNotMatch(cuerpo, /generateUUID/, 'reenlazar no inventa un id');
  assert.match(cuerpo, /storageService\.saveMediaAsset\(\{ projectId, mediaAsset: nuevo \}\)/, 'se guarda en el almacenamiento del proyecto');
  assert.match(cuerpo, /this\.notify\(\)/, 'avisa: el reproductor rearma la escena con el medio');
  assert.doesNotMatch(cuerpo, /command\.execute|updateTracks/, 'no toca la línea ni el historial');
});

test('A7: el teléfono muestra el aviso ENCIMA del reproductor y el «Elegir» reenlaza con la función del motor', () => {
  const src = sinComentarios(leer('app/m/video-editor/EditorVideoM.tsx'));
  assert.ok(
    /<div className="m-video-editor-escenario">\s*<PreviewPanel .*\/>\s*<ArchivosFaltantes \/>\s*<\/div>/.test(src),
    'el aviso va adentro del escenario, sobre el reproductor',
  );
  assert.match(src, /archivosFaltantes\(tracks, new Set\(medios\.map\(\(m\) => m\.id\)\)\)/, 'mira la línea contra la biblioteca cargada');
  assert.match(src, /cargando \? \[\] :/, 'mientras carga la biblioteca no avisa');
  assert.match(src, /\{textoDelAviso\(faltan\)\}/);
  assert.match(src, /input\.accept = aceptaDelFaltante\(f\.tipo\);\s*input\.click\(\);/, 'abre la galería con el tipo del clip, en el mismo toque');
  assert.match(src, /reenlazarArchivo\(\{ editor, mediaId: f\.mediaId, tipo: f\.tipo, file \}\)/);
  assert.match(src, /<input ref=\{entrada\} type="file" hidden/);
  // Ninguna copia propia del reenlace en la pantalla.
  assert.doesNotMatch(src, /saveMediaAsset|addMediaAsset\(/, 'la pantalla no guarda medios por su cuenta');
  // Y la tira marca el clip sin archivo.
  assert.match(src, /data-falta=\{falta \|\| undefined\}/);
  const css = leer('app/m/video-editor/video-editor.css');
  assert.match(css, /\.m-video-editor-escenario \{ position: relative;/, 'el escenario es la referencia del aviso');
  assert.match(css, /\.m-video-editor-falta \{\s*position: absolute;/);
  assert.match(css, /\.m-video-editor-clip\[data-falta\] \{/);
});

test('A8: el teléfono pide el almacenamiento persistente, como la computadora (sin él, el navegador borra los archivos)', () => {
  const src = readFileSync(new URL('../app/m/video-editor/EditorVideoM.tsx', import.meta.url), 'utf8');
  assert.match(src, /<StoragePersistenceDialog \/>/);
  assert.match(readFileSync(new URL('../app/video-editor/_opencut/editor-page.tsx', import.meta.url), 'utf8'), /<StoragePersistenceDialog \/>/);
});
