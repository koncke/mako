// =============================================================================
// Image: «El archivo no es lo que dice» con una foto JPG que se llama .png (13/11/2026)
// =============================================================================
// El mismo caso de los tickets #95 y #96 del Web Generator (tests/web-generator-ticket-95.test.ts), en «Subidos» de Image
// (lib/image-editor/server.ts → registrarSubida): el navegador declara el tipo por la extensión y el servidor, por los bytes,
// rechazaba cualquier diferencia. Lo que fija:
//   1. dos imágenes: vale lo que la foto ES (lo decide `veredictoDeSubida` del Web, no una copia) y se guarda con su extensión;
//   2. dos audios: lo mismo (un M4A que se llama .mp3);
//   3. lo que no sirve sigue afuera, y el mensaje dice qué se vio y qué hacer (un HTML, un PDF, un audio con nombre de imagen);
//   4. una foto HEIC (la del iPhone) ya no pasa por un audio M4A, y el mensaje dice cómo subirla;
//   5. la ruta usa el veredicto, guarda con la extensión de lo que el archivo es, y Image no copia la función del Web.
// Correr: node --import tsx --test tests/image-editor-subida-tipo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatoVisto } from '../lib/editor-landing/server-reglas';
import { finalConSuTipo, sniffArchivo, subidaDelWs, validarSubida, veredictoDeImage } from '../lib/image-editor/reglas';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const texto = (t: string) => new TextEncoder().encode(t);
// Los primeros bytes de cada formato, como llegan del bucket.
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const HEIC = texto('\0\0\0\x18ftypheic\0\0\0\0mif1heic');
const M4A = texto('\0\0\0\x20ftypM4A \0\0\x02\0isom');
const MP3 = texto('ID3\x04\0\0\0\0\0\0');
const HTML = texto('<!DOCTYPE html><html><script>alert(1)</script>');
const PDF = texto('%PDF-1.7\n%\xe2\xe3');
/** Lo que hace registrarSubida con los bytes: el tipo real, lo que se vio si no es nada de Image, y el veredicto. */
const registrar = (dice: string, buf: Uint8Array) => {
  const real = sniffArchivo(buf);
  return veredictoDeImage(dice, real, real ? null : formatoVisto(buf));
};
const error = (r: { ok: boolean; error?: string }) => (r.ok ? '' : r.error ?? '');

test('1. la foto JPG con nombre .png: vale como JPG y se guarda como .jpg', () => {
  const sub = subidaDelWs('9/subidas/850187c6-e64c-4c4c-98bb-180204c6f645.png', 9)!;
  assert.equal(sub.tipo, 'image/png', 'lo que DICE: la extensión');
  assert.equal(sniffArchivo(JPG), 'image/jpeg', 'lo que ES: los bytes');
  assert.deepEqual(registrar(sub.tipo, JPG), { ok: true, tipo: 'image/jpeg' });
  assert.equal(finalConSuTipo(sub.final, 'image/jpeg'), '9/850187c6-e64c-4c4c-98bb-180204c6f645.jpg');
  assert.deepEqual(veredictoDeImage('image/webp', 'image/png'), { ok: true, tipo: 'image/png' }, 'cualquier par de imágenes');
  assert.deepEqual(veredictoDeImage('image/png', 'image/png'), { ok: true, tipo: 'image/png' });
});

test('2. un M4A con nombre .mp3 es un audio bueno: vale como M4A y se guarda como .m4a', () => {
  const sub = subidaDelWs('9/subidas/850187c6-e64c-4c4c-98bb-180204c6f645.mp3', 9)!;
  assert.equal(sub.tipo, 'audio/mpeg');
  assert.deepEqual(registrar(sub.tipo, M4A), { ok: true, tipo: 'audio/mp4' });
  assert.equal(finalConSuTipo(sub.final, 'audio/mp4'), '9/850187c6-e64c-4c4c-98bb-180204c6f645.m4a');
  assert.deepEqual(registrar('audio/mpeg', MP3), { ok: true, tipo: 'audio/mpeg' });
});

test('3. lo que no sirve sigue afuera, y el mensaje dice qué se vio y qué hacer', () => {
  const html = registrar('image/png', HTML);
  assert.equal(html.ok, false, 'un HTML disfrazado de PNG no pasa');
  assert.equal(error(html), 'Tiene nombre de PNG pero es un archivo SVG o HTML: súbelo como JPG, PNG, WebP o GIF.');
  assert.match(error(registrar('image/jpeg', PDF)), /es un archivo PDF/);
  assert.equal(error(registrar('image/png', MP3)), 'Tiene nombre de imagen PNG pero es un audio MP3: súbelo como audio.');
  assert.equal(error(registrar('audio/mpeg', JPG)), 'Tiene nombre de audio MP3 pero es una imagen JPG: súbela como imagen.');
  assert.equal(error(registrar('audio/mpeg', PDF)), 'Tiene nombre de audio MP3 pero es un archivo PDF: súbelo como MP3, OGG, WAV o M4A.');
  for (const r of [html, registrar('image/jpeg', PDF), registrar('image/png', MP3), registrar('audio/wav', HTML)]) {
    assert.ok(!r.ok && !/no es lo que dice/.test(error(r)), 'ya no el mensaje que no dice nada');
  }
});

test('4. una foto HEIC (iPhone) no pasa por un audio M4A, y el mensaje dice cómo subirla', () => {
  assert.equal(sniffArchivo(HEIC), null, 'antes: «audio/mp4» por la caja ftyp');
  assert.equal(sniffArchivo(M4A), 'audio/mp4', 'un M4A de verdad sigue siendo audio');
  assert.equal(error(registrar('image/jpeg', HEIC)), 'Es una foto HEIC (la del iPhone) con nombre de JPG: expórtala como JPG y vuelve a subirla.');
  const firma = validarSubida('image/heic', 2_000_000);
  assert.equal(!firma.ok && firma.error, 'Es una foto HEIC (la del iPhone): expórtala como JPG y vuelve a subirla.', 'declarada HEIC: lo mismo, antes de subir');
});

test('5. registrarSubida usa el veredicto, guarda con la extensión de lo que el archivo es, y no copia la función del Web', () => {
  const server = readFileSync(join(process.cwd(), 'lib/image-editor/server.ts'), 'utf8');
  const reglas = readFileSync(join(process.cwd(), 'lib/image-editor/reglas.ts'), 'utf8');
  assert.doesNotMatch(server, /'El archivo no es lo que dice'/, 'el mensaje de antes no vuelve');
  assert.match(server, /const veredicto = veredictoDeImage\(sub\.tipo, real, visto\);/);
  assert.match(server, /const final = tipo === sub\.tipo \? sub\.final : finalConSuTipo\(sub\.final, tipo\);/);
  assert.match(server, /await bucket\.move\(path, final\);/);
  assert.match(server, /ruta: final, url/, 'la fila apunta al archivo que quedó');
  assert.match(reglas, /return veredictoDeSubida\(dice, es, visto\);/, 'entre imágenes decide la función del Web');
  assert.doesNotMatch(reglas, /function veredictoDeSubida|function formatoVisto|MARCAS_FOTO/, 'sin copia de la función del Web');
});
