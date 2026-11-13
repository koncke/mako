// =============================================================================
// Tickets #95 y #96 (13/11/2026): «El archivo no es lo que dice» al cambiar una imagen en el Web Generator
// =============================================================================
// Martín, en /web-generator/119: «intenté cambiar una imagen, pero hay un error que no me está permitiendo poner la imagen que
// yo quería». El registro de Vercel (21:11:32 UTC): «descarté 9/subidas/….png: dice image/png y es image/jpeg». Era una foto
// JPG con nombre .png: el navegador declara el tipo por la extensión y el servidor, por los bytes, la rechazaba. Lo que fija:
//   1. dos imágenes raster: vale lo que la foto ES, y se guarda con su extensión;
//   2. lo que NO es una imagen (un HTML disfrazado, un PDF) sigue afuera, y el mensaje dice qué se vio y qué hacer;
//   3. una foto HEIC (la del iPhone) ya no se toma por un video MP4, y el mensaje dice cómo subirla;
//   4. la ruta usa el veredicto (sin esto, el mismo «El archivo no es lo que dice» de antes).
// Correr: node --import tsx --test tests/web-generator-ticket-95.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finalConTipo, formatoVisto, sniffMedia, subidaDelWs, veredictoDeSubida } from '../lib/editor-landing/server-reglas';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const texto = (t: string) => new TextEncoder().encode(t);
// Los primeros bytes de cada formato, como llegan del bucket.
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const HEIC = texto('\0\0\0\x18ftypheic\0\0\0\0mif1heic');
const AVIF = texto('\0\0\0\x1cftypavif\0\0\0\0avifmif1');
const MP4 = texto('\0\0\0\x20ftypisom\0\0\x02\0isom');
const HTML = texto('<!DOCTYPE html><html><script>alert(1)</script>');
const PDF = texto('%PDF-1.7\n%\xe2\xe3');

test('1. la foto JPG con nombre .png (el caso de Martín): vale como JPG y se guarda como .jpg', () => {
  const sub = subidaDelWs('9/subidas/850187c6-e64c-4c4c-98bb-180204c6f645.png', 9)!;
  assert.equal(sub.tipo, 'image/png', 'lo que DICE: la extensión');
  const real = sniffMedia(JPG);
  assert.equal(real, 'image/jpeg', 'lo que ES: los bytes');
  assert.deepEqual(veredictoDeSubida(sub.tipo, real), { ok: true, tipo: 'image/jpeg' });
  assert.equal(finalConTipo(sub.final, 'image/jpeg'), '9/850187c6-e64c-4c4c-98bb-180204c6f645.jpg');
  assert.deepEqual(veredictoDeSubida('image/webp', 'image/png'), { ok: true, tipo: 'image/png' }, 'cualquier par de imágenes');
  assert.deepEqual(veredictoDeSubida('image/png', 'image/png'), { ok: true, tipo: 'image/png' });
});

test('2. lo que NO es una imagen sigue afuera, y el mensaje dice qué se vio y qué hacer', () => {
  const html = veredictoDeSubida('image/png', sniffMedia(HTML), formatoVisto(HTML));
  assert.equal(html.ok, false);
  assert.match(!html.ok ? html.error : '', /^Tiene nombre de PNG pero es un archivo SVG o HTML: súbelo como JPG, PNG, WebP o GIF\.$/);
  const pdf = veredictoDeSubida('image/jpeg', sniffMedia(PDF), formatoVisto(PDF));
  assert.match(!pdf.ok ? pdf.error : '', /es un archivo PDF/);
  const video = veredictoDeSubida('image/png', sniffMedia(MP4), formatoVisto(MP4));
  assert.match(!video.ok ? video.error : '', /^Tiene nombre de imagen PNG pero es un video MP4: súbelo como video\.$/);
  const nada = veredictoDeSubida('image/png', null, null);
  assert.match(!nada.ok ? nada.error : '', /no es una imagen que MaKo pueda usar: súbela como JPG, PNG, WebP o GIF/);
  for (const r of [html, pdf, video, nada]) assert.ok(!r.ok && !/no es lo que dice/.test(r.error), 'ya no el mensaje que no dice nada');
});

test('3. una foto HEIC (iPhone) o AVIF no es un video MP4, y el mensaje dice cómo subirla', () => {
  assert.equal(sniffMedia(HEIC), null, 'antes: «video/mp4» por la caja ftyp');
  assert.equal(sniffMedia(AVIF), null);
  assert.equal(sniffMedia(MP4), 'video/mp4', 'un MP4 de verdad sigue siendo video');
  assert.equal(formatoVisto(HEIC), 'HEIC');
  assert.equal(formatoVisto(AVIF), 'AVIF');
  const heic = veredictoDeSubida('image/jpeg', sniffMedia(HEIC), formatoVisto(HEIC));
  assert.match(!heic.ok ? heic.error : '', /^Es una foto HEIC \(la del iPhone\) con nombre de JPG: expórtala como JPG y vuelve a subirla\.$/);
});

test('4. la ruta de subida usa el veredicto y guarda con la extensión de lo que el archivo es', () => {
  const src = readFileSync(join(process.cwd(), 'app/api/landing-generator/imagenes/route.ts'), 'utf8');
  assert.doesNotMatch(src, /mal\('El archivo no es lo que dice'\)/, 'el mensaje de antes no vuelve');
  assert.match(src, /const veredicto = veredictoDeSubida\(sub\.tipo, real, visto\);/);
  assert.match(src, /const final = tipo === sub\.tipo \? sub\.final : finalConTipo\(sub\.final, tipo\);/);
  assert.match(src, /await bucket\.move\(path, final\);/);
});
