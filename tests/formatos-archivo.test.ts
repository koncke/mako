// =============================================================================
// Qué archivos entiende MaKo — la lista que estaba escrita tres veces
// =============================================================================
// Martín mandó un .txt por WhatsApp para cargarlo al plan y le rebotó con «ese tipo de
// archivo todavía no». El lector sabía abrirlo desde el día uno; la copia de la lista
// que tenía WhatsApp (imágenes y PDF, y nada más) no se había enterado.
//
// Estos tests fijan la regresión: si alguien vuelve a partir la lista en dos, o saca un
// formato de la familia equivocada, esto se rompe antes del push.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  familiaDeArchivo, puedeLeerse, EXTENSIONES_SOPORTADAS, ACCEPT_IMPORTAR,
  formatosLegibles, comoSeLee, iconoDeArchivo,
} from '../lib/formatos-archivo';

test('EL BUG: un .txt de WhatsApp se puede leer', () => {
  assert.equal(puedeLeerse('notas.txt', 'text/plain'), true);
  assert.equal(familiaDeArchivo('notas.txt', 'text/plain'), 'texto');
  // WhatsApp a veces manda el documento SIN mime: la extensión tiene que alcanzar.
  assert.equal(puedeLeerse('notas.txt', ''), true);
  // …y a veces manda el mime sin extensión en el nombre.
  assert.equal(puedeLeerse('documento', 'text/plain'), true);
});

test('cada formato cae en la familia que decide cómo se lee', () => {
  assert.equal(familiaDeArchivo('reunion.md'), 'texto');
  assert.equal(familiaDeArchivo('transcript.vtt'), 'texto');
  assert.equal(familiaDeArchivo('brief.docx'), 'docx');
  assert.equal(familiaDeArchivo('contrato.pdf'), 'pdf');
  assert.equal(familiaDeArchivo('captura.PNG'), 'imagen');   // mayúsculas incluidas
  assert.equal(familiaDeArchivo('nota.ogg'), 'audio');
  assert.equal(familiaDeArchivo('demo.mp4'), 'video');
});

test('lo que de verdad no se sabe leer, se dice', () => {
  assert.equal(puedeLeerse('planilla.xlsx'), false);
  assert.equal(familiaDeArchivo('binario.exe'), 'desconocido');
  assert.equal(comoSeLee('planilla.xlsx'), 'no sé leerlo');
});

test('el accept del input sale de la misma lista', () => {
  assert.equal(ACCEPT_IMPORTAR, EXTENSIONES_SOPORTADAS.join(','));
  for (const e of EXTENSIONES_SOPORTADAS) {
    assert.ok(e.startsWith('.'), `«${e}» tiene que empezar con punto`);
    assert.equal(puedeLeerse(`x${e}`), true, `«${e}» está en la lista pero no se puede leer`);
  }
});

test('el mensaje que le llega al dueño nombra formatos de verdad', () => {
  const prosa = formatosLegibles();
  for (const e of ['txt', 'md', 'pdf', 'docx']) {
    assert.ok(prosa.includes(e), `el aviso no menciona ${e}`);
  }
  assert.ok(!prosa.includes('.'), 'la prosa va sin puntos');
});

test('el ícono distingue las familias (la bandeja de importación)', () => {
  assert.equal(iconoDeArchivo('nota.mp3'), '🎧');
  assert.equal(iconoDeArchivo('demo.mov'), '🎬');
  assert.equal(iconoDeArchivo('captura.jpg'), '🖼');
  assert.equal(iconoDeArchivo('contrato.pdf'), '📕');
  assert.equal(iconoDeArchivo('notas.txt'), '📝');
});
