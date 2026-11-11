// =============================================================================
// «Sí, en el feed»: el resultado queda en el hilo de MaKo, y un archivo que falta no se lee como «sin voz» (11/11/2026)
// =============================================================================
// Probado en producción el 11/11/2026 (docs/pruebas/video-produccion-11-11.md):
//   · el resultado era un aviso que se iba a los segundos y el chat volvía a «Pídeme…»: si salían, se veían en la línea;
//     si no, nadie se enteraba de por qué (el motivo quedaba sólo abajo del botón del panel de Subtítulos);
//   · el proyecto perdió su archivo en el navegador y los subtítulos decían «no se reconoció la voz» de un clip que habla:
//     la línea se arma igual sin ese medio y su audio sale mudo.
// Fija chat/PanelChat.tsx (`ponerSubtitulos`), subtitles/resultado.ts (`faltaAlgunArchivo`, «falta-medio») y que
// subtitles/generar.ts lo mire antes de leer el audio.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `faltaAlgunArchivo` sin saltear la música de la biblioteca: rojo el de los archivos;
//   · en generar.ts, sin el `falla("falta-medio")`: rojo el del cableado;
//   · en PanelChat.tsx, el `toast(...)` de antes en vez del hilo: rojo el del hilo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { faltaAlgunArchivo, MOTIVO_SUBTITULOS, textoDeSubtitulos } from '../app/video-editor/_opencut/subtitles/resultado';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OC = 'app/video-editor/_opencut';

const pistas = (main: unknown[], audio: unknown[] = [], overlay: unknown[] = []) => ({
  main: { elements: main },
  overlay: [{ elements: overlay }],
  audio: [{ elements: audio }],
});

test('un clip que apunta a un archivo que no está, se nota; la música de la biblioteca no cuenta', () => {
  const ids = new Set(['m1']);
  assert.equal(faltaAlgunArchivo(pistas([{ type: 'video', mediaId: 'm1' }]), ids), false);
  assert.equal(faltaAlgunArchivo(pistas([{ type: 'video', mediaId: 'm2' }]), ids), true, 'el video que falta');
  assert.equal(faltaAlgunArchivo(pistas([], [{ type: 'audio', mediaId: 'a9', sourceType: 'upload' }]), ids), true, 'el audio subido que falta');
  assert.equal(faltaAlgunArchivo(pistas([], [{ type: 'audio', mediaId: 'lib-1', sourceType: 'library' }]), ids), false, 'la biblioteca viene por URL');
  assert.equal(faltaAlgunArchivo(pistas([{ type: 'text' }], [], [{ type: 'image', mediaId: 'img' }]), ids), false, 'textos e imágenes no suenan');
});

test('«falta-medio» dice qué pasó y qué hacer, y no es «sin voz»', () => {
  assert.match(MOTIVO_SUBTITULOS['falta-medio'], /^falta en este navegador el archivo de un video del proyecto: vuelve a importarlo/);
  assert.notEqual(MOTIVO_SUBTITULOS['falta-medio'], MOTIVO_SUBTITULOS['sin-voz']);
  assert.match(textoDeSubtitulos('falta-medio'), /^Falta en este navegador/);
});

test('el cableado: generar mira los archivos ANTES de leer el audio', () => {
  const gen = leer(`${OC}/subtitles/generar.ts`);
  const mira = gen.indexOf('return falla("falta-medio");');
  const lee = gen.indexOf('await extractTimelineAudio(');
  assert.ok(mira > 0, 'generar no mira si falta un archivo');
  assert.ok(mira < lee, 'mira DESPUÉS de leer el audio: ya habría dicho «sin voz»');
  assert.match(gen, /faltaAlgunArchivo\(editor\.scenes\.getActiveScene\(\)\.tracks, new Set\(editor\.media\.getAssets\(\)\.map\(\(a\) => a\.id\)\)\)/);
});

test('el hilo: la respuesta de la persona y lo que salió, como dos mensajes; sólo «ocupado» y «cancelado» quedan de aviso', () => {
  const chat = leer(`${OC}/chat/PanelChat.tsx`);
  const poner = chat.slice(chat.indexOf('const ponerSubtitulos = () => {'), chat.indexOf('const pildora ='));
  assert.match(poner, /if \(!r\.ok && \(r\.motivo === "ocupado" \|\| r\.motivo === "cancelado"\)\) \{\s*toast\(textoDeSubtitulos\(r\.motivo\)\);\s*return;/);
  assert.match(poner, /`Listo: puse \$\{r\.subtitulos\}/);
  assert.match(poner, /conId\(\{ de: "yo", texto: "Sí, en el feed", alcance: null \}\), conId\(\{ de: "mako", texto, error: !r\.ok \}\)/);
  assert.doesNotMatch(poner, /toast\("Subtítulos listos"\)/, 'volvió el aviso que se va solo');
});
