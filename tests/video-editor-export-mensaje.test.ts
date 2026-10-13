// =============================================================================
// Debajo de «No se pudo exportar» va una frase para la persona, nunca el motor
// =============================================================================
// Estaba en la lista «sin hacer» del editor: el diálogo mostraba `error.message`
// crudo, en inglés y con nombres de piezas internas. Este test fija que cada mensaje
// que el motor tira HOY tenga su frase, y que lo desconocido caiga a una genérica
// que igual dice qué probar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeDeExport, MENSAJE_EXPORT_GENERICO } from '../app/video-editor/_opencut/export/mensaje-error';

const DEL_MOTOR = [
  'OffscreenCanvas is not supported in this environment',
  'OffscreenCanvas is required for compositor',
  'Compositor is not initialized',
  'Failed to get target canvas context',
  'Failed to create 2D rendering context',
  'Failed to get 2d context for texture t3',
  'Canvas 2D no disponible',
  '[pases-ce] el shader ce-glow no compila: ERROR: 0:12',
  'AAC vacío',
  'QuotaExceededError: out of memory',
  'NotSupportedError: Unsupported codec hvc1',
  'The operation was aborted',
];

test('todo lo que el motor tira hoy tiene una frase en español', () => {
  for (const crudo of DEL_MOTOR) {
    const m = mensajeDeExport(new Error(crudo));
    assert.notEqual(m, MENSAJE_EXPORT_GENERICO, `«${crudo}» cae a la genérica: le falta su caso`);
    assert.ok(!/[A-Za-z]+ (is|are|not|failed|to) [a-z]/.test(m) || /Chrome o Edge|MP4/.test(m), `salió inglés: «${m}»`);
    assert.ok(!m.includes(crudo.split(' ')[0]), `el mensaje repite el crudo: «${m}»`);
  }
});

test('lo desconocido cae a una frase que dice qué probar, nunca al crudo', () => {
  for (const raro of [new Error('Frobnicator exploded at 0x1f'), 'string suelto', null, undefined, 42]) {
    const m = mensajeDeExport(raro);
    assert.equal(m, MENSAJE_EXPORT_GENERICO);
  }
});

test('las frases son cortas y accionables', () => {
  // Regla de la casa: el texto que se dibuja es corto, y dice qué hacer.
  const todas = new Set([MENSAJE_EXPORT_GENERICO, ...DEL_MOTOR.map((c) => mensajeDeExport(new Error(c)))]);
  for (const m of todas) {
    assert.ok(m.length <= 110, `muy larga (${m.length}): «${m}»`);
    assert.match(m, /\.$/, `sin punto final: «${m}»`);
  }
});
