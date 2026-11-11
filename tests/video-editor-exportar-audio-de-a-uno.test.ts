// =============================================================================
// Exportar decodifica el audio de a una fuente, y suelta las copias antes de remuestrear (11/11/2026)
// =============================================================================
// Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md §13, banco `exportar-audio-4`, con el
// collectAudioElements REAL): el audio de 4 clips de 60 s pedía +450 MB de pico para quedarse con 88 MB, porque se
// decodificaban todas las fuentes a la vez y cada una pide unas 4 veces su audio mientras dura. Ahora: +200 MB, mismos
// 4 elementos y mismos 88 MB.
//
// Sin navegador no se puede decodificar, así que esto fija el CABLEADO de app/video-editor/_opencut/media/audio.ts.
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `pendiente = resolveAudioBufferForAsset(...)` sin la fila (todas a la vez): rojo el de la fila;
//   · sin `chunks.length = 0`: rojo el de soltar;
//   · sin `nativeChannels.length = 0`: rojo el de soltar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const audio = readFileSync(new URL('../app/video-editor/_opencut/media/audio.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('las fuentes se decodifican en FILA, una detrás de la otra, y cada archivo una sola vez', () => {
  const coleccion = audio.slice(audio.indexOf('export async function collectAudioElements'), audio.indexOf('const resolvedElements'));
  assert.match(coleccion, /let fila: Promise<unknown> = Promise\.resolve\(\);/);
  assert.match(coleccion, /pendiente = fila\.then\(\(\) => resolveAudioBufferForAsset\(\{ asset, audioContext \}\)\);/);
  assert.match(coleccion, /fila = pendiente\.catch\(\(\) => null\);/, 'una fuente que falla trabaría la fila');
  assert.match(coleccion, /porArchivo\.set\(asset\.id, pendiente\);/);
});

test('cada fuente suelta sus trozos y sus canales antes de remuestrear', () => {
  const fuente = audio.slice(audio.indexOf('const nativeChannels = Array.from('), audio.indexOf('return await offlineContext.startRendering();'));
  const trozos = fuente.indexOf('chunks.length = 0;');
  const canales = fuente.indexOf('nativeChannels.length = 0;');
  const render = fuente.indexOf('const sourceNode = offlineContext.createBufferSource();');
  assert.ok(trozos > 0, 'los trozos quedan vivos mientras se remuestrea');
  assert.ok(canales > 0, 'los canales quedan vivos mientras se remuestrea');
  assert.ok(trozos < render && canales < render, 'se sueltan DESPUÉS de remuestrear: no ahorra nada');
});
