// =============================================================================
// El nombre con el que se baja un clip
// =============================================================================
// Martín: «que se nombren bien, con número de toma y nombre de anuncio». Hasta
// hoy se bajaban como `toma-1-<uuid>.mp4` —el nombre de la ruta en storage—, así
// que siete clips en la carpeta de Descargas eran siete archivos indistinguibles.

import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreDeClip } from '../app/video-generator/video-pedido';

test('lleva el anuncio y el número de toma', () => {
  assert.equal(nombreDeClip('Los 4 sistemas', 3, 7), 'Los 4 sistemas - toma 3.mp4');
});

test('el número va con cero adelante segun cuantas tomas haya', () => {
  // Sin esto, en una carpeta ordenada alfabéticamente la toma 10 cae entre la 1
  // y la 2, que es justo donde nadie la busca.
  assert.equal(nombreDeClip('X', 2, 12), 'X - toma 02.mp4');
  assert.equal(nombreDeClip('X', 12, 12), 'X - toma 12.mp4');
  assert.equal(nombreDeClip('X', 2, 7), 'X - toma 2.mp4', 'con 7 tomas un dígito alcanza');
});

test('se sacan los caracteres que Windows rechaza', () => {
  // Un nombre inválido NO da error: el navegador lo reemplaza por el suyo, y
  // volvemos a los siete `toma-1-<uuid>.mp4` que esto vino a arreglar.
  const n = nombreDeClip('Los 4 sistemas: sin ti / con "todo" <ya>', 1, 7);
  assert.doesNotMatch(n.slice(0, -4), /[\\/:*?"<>|]/);
  assert.match(n, /^Los 4 sistemas sin ti con todo ya - toma 1\.mp4$/);
});

test('los espacios de más se colapsan', () => {
  assert.equal(nombreDeClip('  Dos   espacios  ', 1, 1), 'Dos espacios - toma 1.mp4');
});

test('sin título no queda un nombre que empieza con un guion', () => {
  assert.equal(nombreDeClip('', 1, 1), 'Anuncio - toma 1.mp4');
  assert.equal(nombreDeClip('   ', 1, 1), 'Anuncio - toma 1.mp4');
  assert.equal(nombreDeClip(':::', 1, 1), 'Anuncio - toma 1.mp4');
});

test('un título larguísimo se recorta y sigue siendo un nombre válido', () => {
  const n = nombreDeClip('a'.repeat(300), 1, 1);
  assert.ok(n.length < 90, `mide ${n.length}`);
  assert.match(n, /- toma 1\.mp4$/);
});

test('los acentos se conservan y se normalizan', () => {
  // Se conservan porque son parte del nombre que la persona reconoce; se
  // normalizan a NFC porque la misma «ó» escrita de dos formas da dos archivos.
  const n = nombreDeClip('Diagnóstico', 1, 1);
  assert.equal(n, 'Diagnóstico - toma 1.mp4');
  assert.equal(n, n.normalize('NFC'));
});
