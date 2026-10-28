// =============================================================================
// Importar un video: qué se hace con él y, si no se puede, POR QUÉ (ticket #15, Leila, 27/10/2026)
// =============================================================================
// «No se pudo importar. ESP_Fabi sentada_limpio.mp4», sin error técnico en el reporte. Lo que se puede romper sin que se
// vea: que una lectura fallida vuelva a sumar un clip roto, que la miniatura vuelva a tumbar la importación, que el aviso
// vuelva a decir sólo el nombre, o que el reporte a Soporte salga otra vez sin la causa técnica.
//
// Correr: node --import tsx --test tests/video-editor-importar-motivo.test.ts
//
// PROBADO ROMPIÉNDOLO (27/10/2026, base 4/0, restaurando de memoria y comparando el hash): el rechazo que sigue hasta el
// push → 3/1; la condición de importar invertida (`||` en vez de `&&`) → 3/1; sin «como audio» → 3/1; el archivo de la
// nube sin su motivo (por el nombre del error) → 3/1; el reporte sin la causa técnica → 3/1; la miniatura que vuelve a
// tirar → 3/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidirImportacionVideo, detalleTecnico, motivoDeLectura } from '../app/video-editor/_opencut/media/importar-motivo';

const MP4 = { name: 'ESP_Fabi sentada_limpio.mp4', size: 734_003_200, type: 'video/mp4' };
const conNombre = (name: string, message: string) => Object.assign(new Error(message), { name });
const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');

test('1. lo que se pudo leer decide: importar, avisar, como audio o no importar', () => {
  assert.deepEqual(decidirImportacionVideo({ ok: true, canDecode: true, codec: 'avc', errorDecodificar: null }, MP4), { accion: 'importar' });
  // Un códec sin decodificador se importa avisando (el HEVC de un iPhone en Chrome de Windows).
  const hevc = decidirImportacionVideo({ ok: true, canDecode: false, codec: 'hevc', errorDecodificar: null }, MP4);
  assert.equal(hevc.accion, 'importar-con-aviso');
  assert.match(hevc.accion === 'importar-con-aviso' ? hevc.aviso : '', /HEVC.*Safari/);
  // La miniatura que no se pudo decodificar YA NO tumba la importación: se avisa, con el error para Soporte.
  const miniatura = decidirImportacionVideo({ ok: true, canDecode: true, codec: 'avc', errorDecodificar: 'EncodingError: Decoding error.' }, MP4);
  assert.equal(miniatura.accion, 'importar-con-aviso');
  assert.match(miniatura.accion === 'importar-con-aviso' ? miniatura.tecnico : '', /EncodingError: Decoding error\. · video\/mp4 · 700 MB/);
  // Sin imagen pero con sonido: entra como audio.
  assert.equal(decidirImportacionVideo({ ok: false, error: new Error('No video track found in the file'), sinImagenConAudio: true }, MP4).accion, 'como-audio');
  // Lo que no se pudo leer NO se importa: se rechaza con el porqué y el detalle técnico.
  const mal = decidirImportacionVideo({ ok: false, error: new Error('Input has an unsupported or unrecognizable format.'), sinImagenConAudio: false }, MP4);
  assert.equal(mal.accion, 'rechazar');
  if (mal.accion === 'rechazar') {
    assert.match(mal.motivo, /formato.*no se reconoce.*MP4 \(H\.264\)/);
    assert.match(mal.tecnico, /^Error: Input has an unsupported or unrecognizable format\. · video\/mp4 · 700 MB$/);
  }
});

test('2. el porqué dice qué pasó y qué hacer, según el error', () => {
  assert.match(motivoDeLectura(new Error('x'), { ...MP4, size: 0 }), /vacío.*descárgalo/);
  assert.match(motivoDeLectura(conNombre('NotReadableError', 'The requested file could not be read'), MP4), /no dejó leer.*OneDrive.*Mantener siempre/);
  // Por el NOMBRE solo (el texto de Chrome cambia entre versiones y en otro idioma).
  assert.match(motivoDeLectura(conNombre('NotReadableError', ''), MP4), /no dejó leer/);
  assert.match(motivoDeLectura(conNombre('QuotaExceededError', 'quota exceeded'), MP4), /espacio en el navegador/);
  assert.match(motivoDeLectura(new Error('No video track found in the file'), MP4), /no tiene imagen.*Audio › Importar/);
  assert.match(motivoDeLectura(new Error('Unexpected end of file while reading box moov'), MP4), /incompleto o dañado/);
  assert.match(motivoDeLectura(new Error('algo raro'), MP4), /No se pudo leer el archivo.*repórtalo/);
  // Ninguno es sólo el nombre del archivo (lo que vio Leila).
  for (const e of [new Error('a'), conNombre('NotReadableError', 'b')]) assert.ok(motivoDeLectura(e, MP4).length > 40);
});

test('3. el detalle técnico lleva el error, el tipo y el peso, y tiene tope', () => {
  assert.equal(detalleTecnico(conNombre('NotReadableError', 'could not be read'), MP4), 'NotReadableError: could not be read · video/mp4 · 700 MB');
  assert.equal(detalleTecnico('texto', { name: 'a', size: 2048, type: '' }), 'texto · sin tipo · 0.0 MB');
  assert.ok(detalleTecnico(new Error('x'.repeat(2000)), MP4).length <= 400);
});

test('4. la importación: un rechazo NO suma el clip, y el reporte a Soporte lleva el detalle técnico', () => {
  const p = leer('app/video-editor/_opencut/media/processing.ts');
  const rechazo = p.slice(p.indexOf('decision.accion === "rechazar"'), p.indexOf('decision.accion === "como-audio"'));
  assert.match(rechazo, /continue;/, 'un video que no se pudo leer no sigue hasta el push');
  assert.match(p, /reportarASoporte\(\{ error: `\$\{titulo\}\. \$\{descripcion\} · Técnico: \$\{tecnico\}` \}\)/, 'el reporte lleva la causa');
  assert.doesNotMatch(p, /toast\.error\("No se pudo importar", \{ description: file\.name \}\)/, 'nunca más sólo el nombre');
  // Y el lector: la miniatura en su propio try, que anota el error en vez de tirar.
  const m = leer('app/video-editor/_opencut/media/mediabunny.ts');
  assert.match(m, /catch \(error\) \{\n\t+errorDecodificar = /);
  assert.match(m, /throw new SinPistaDeVideo\(audioTrack !== null\)/);
});
