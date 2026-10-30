// =============================================================================
// «Súbeme este anuncio» desde el grupo (29/10/2026, la llamada con Thiago; lib/anuncio-desde-archivo.ts) — las piezas puras
// =============================================================================
// MaKo baja el archivo (el del mensaje o un link de Drive), lo guarda en el bucket de los creativos y PROPONE el anuncio EN PAUSA
// (`proponer_anuncio_desde_archivo`, pantalla /mako/revisar); al aprobarlo, el link firmado va a Zernio (`video.url` o `imageUrl`).
// Detrás de ZERNIO_ANUNCIOS_PROBADO. Lo que fija este archivo:
//   1. el link de descarga de Drive (y que un link http o roto no se baja);
//   2. qué archivo sirve como creativo y sus topes;
//   3. el cuerpo de Zernio: un video por LINK sale como `video.url` (por su id, si ya está en la cuenta);
//   4. la bandera: con ZERNIO_ANUNCIOS_PROBADO apagada, la operación lo dice ANTES de bajar o subir nada, y el despachante la propone.
// Por el turno real (el videoMessage, la herramienta y la regla), en tests/clase-del-grupo.test.ts (test 10).
//
// Probado rompiéndolo (29/10/2026, `roturas-despacho.mjs` del scratchpad, base verde): el cuerpo sin el video por link → 3 · sin la
// bandera al principio de `preparar` → 4 · la operación fuera de lo que viaja en la ACCIÓN → 4 (y el 10 de clase-del-grupo).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANUNCIO_DESDE_ARCHIVO_APAGADO, errorDelArchivo, linkDeDescarga, rutaEnElBucket, tipoDelArchivo } from '../lib/anuncio-desde-archivo';
import { ZERNIO_ANUNCIOS_PROBADO, cuerpoAnuncioEnConjunto } from '../lib/zernio-ads-cuerpo';
import { ACCIONES_CON_PANTALLA, viajaEnLaAccion } from '../lib/despacho-grupo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el link de descarga de Drive, y lo que no se baja', () => {
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  for (const l of [`https://drive.google.com/file/d/${id}/view?usp=sharing`, `https://drive.google.com/open?id=${id}`, `https://drive.google.com/uc?id=${id}&export=download`]) {
    assert.equal(linkDeDescarga(l), `https://drive.google.com/uc?export=download&id=${id}`, l);
  }
  assert.equal(linkDeDescarga('https://cdn.ejemplo.com/video.mp4'), 'https://cdn.ejemplo.com/video.mp4');
  assert.equal(linkDeDescarga('http://cdn.ejemplo.com/video.mp4'), null, 'sin https no se baja');
  assert.equal(linkDeDescarga('https://drive.google.com/drive/folders/'), null, 'una carpeta no es un archivo');
  assert.equal(linkDeDescarga('no es un link'), null);
});

test('2. qué archivo sirve como creativo, y sus topes', () => {
  assert.equal(tipoDelArchivo('video/mp4', null), 'video');
  assert.equal(tipoDelArchivo('image/jpeg; charset=binary', null), 'image');
  assert.equal(tipoDelArchivo('', 'anuncio.MP4'), 'video');
  assert.equal(tipoDelArchivo('application/pdf', 'x.pdf'), null);
  assert.match(errorDelArchivo(null, 10) ?? '', /no es una imagen/);
  assert.match(errorDelArchivo('image', 31 * 1024 * 1024) ?? '', /30 MB/);
  assert.match(errorDelArchivo('video', 101 * 1024 * 1024) ?? '', /100 MB/);
  assert.equal(errorDelArchivo('video', 5 * 1024 * 1024), null);
  assert.equal(rutaEnElBucket(10, 'abc', 'video', 'video/mp4'), 'grupo/10/abc.mp4');
  assert.equal(rutaEnElBucket(10, 'abc', 'image', 'image/png'), 'grupo/10/abc.png');
});

test('3. el cuerpo de Zernio: un video por link sale como video.url; por su id si ya está en la cuenta', () => {
  // Rota: sin el `video_url` en `cuerpoAnuncioEnConjunto` → el video por link cae a la rama de la imagen y tira «sin dirección pública».
  const base = { conexion: { accountId: 'acc', adAccountId: 'act_1' }, adSetId: '120', nombre: 'Video fiesta' };
  const conLink = cuerpoAnuncioEnConjunto({ ...base, creative: { source: 'upload', media_type: 'video', video_url: 'https://supa.test/firmado.mp4', primary_text: 'Ven' } });
  assert.deepEqual(conLink.video, { url: 'https://supa.test/firmado.mp4' });
  assert.equal(conLink.status, 'PAUSED');
  const conId = cuerpoAnuncioEnConjunto({ ...base, creative: { source: 'upload', media_type: 'video', video_id: '999', video_url: 'https://supa.test/x.mp4', primary_text: 'Ven' } });
  assert.deepEqual(conId.video, { id: '999' }, 'con el id en la cuenta, se reusa');
  const imagen = cuerpoAnuncioEnConjunto({ ...base, creative: { source: 'upload', media_type: 'image', thumbnail_url: 'https://supa.test/firmada.jpg', primary_text: 'Ven' } });
  assert.equal(imagen.imageUrl, 'https://supa.test/firmada.jpg');
  // Un video sin id ni link de verdad no se arma: tira, y quien llama no publica a medias.
  assert.throws(() => cuerpoAnuncioEnConjunto({ ...base, creative: { source: 'upload', media_type: 'video', video_url: 'no es un link', primary_text: 'Ven' } }));
});

test('4. detrás de la bandera: apagada, la operación lo dice antes de bajar o subir nada; el despachante la propone', () => {
  // Rota: sacar el `if (!ZERNIO_ANUNCIOS_PROBADO)` del principio de `preparar` → con la bandera apagada baja el archivo y lo sube.
  assert.equal(ZERNIO_ANUNCIOS_PROBADO, false, 'la bandera la prende la prueba de Martín (scripts/prueba-zernio-anuncio.mts), no este cambio');
  const run = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  const desde = run.indexOf('  proponer_anuncio_desde_archivo: {');
  assert.ok(desde > 0, 'falta el runner');
  const cuerpo = run.slice(desde, run.indexOf('\n  },\n', desde));
  assert.match(cuerpo, /preparar: async \(input, ctx\) => \{\n\s*const \{ ZERNIO_ANUNCIOS_PROBADO \} = await import\('@\/lib\/zernio-ads-cuerpo'\);\n\s*if \(!ZERNIO_ANUNCIOS_PROBADO\) return \{ error: ANUNCIO_DESDE_ARCHIVO_APAGADO \};/);
  assert.match(cuerpo, /ejecutar: async \(p\) => \{\n\s*const \{ ZERNIO_ANUNCIOS_PROBADO \} = await import\('@\/lib\/zernio-ads-cuerpo'\);\n\s*if \(!ZERNIO_ANUNCIOS_PROBADO\) return \{ ok: false, resumen: ANUNCIO_DESDE_ARCHIVO_APAGADO \};/);
  assert.match(ANUNCIO_DESDE_ARCHIVO_APAGADO, /falta la prueba de anuncios por Zernio/);
  // La definición: una propuesta EN PAUSA que se aprueba en /mako/revisar, y el despachante la lleva (no la delega).
  assert.match(leer('lib/api-mako/areas/ads.def.ts'), /id: 'proponer_anuncio_desde_archivo', area: 'ads', tipo: 'accion', confirmacion: 'pantalla', pantalla: '\/mako\/revisar'/);
  assert.ok(ACCIONES_CON_PANTALLA.has('proponer_anuncio_desde_archivo') && viajaEnLaAccion('proponer_anuncio_desde_archivo'));
  // El turno del grupo le da el archivo del mensaje (un video que no es un GIF, o una imagen).
  assert.match(sinComentarios(leer('lib/mako-doer-in.ts')), /archivoDelMensaje: async \(\) => \{\n\s*const m = \(data\.message \?\? \{\}\) as Record<string, unknown>;\n\s*const vid = m\.videoMessage/);
});
