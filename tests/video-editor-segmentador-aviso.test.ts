// =============================================================================
// El segmentador de «Eliminación automática»: una falla SIN aviso deja el aviso pendiente (revisión del 10/11/2026)
// =============================================================================
// Clips mágicos carga el segmentador con `avisar: false` (si no carga, el clip queda al centro y no corresponde el aviso
// de quitar el fondo). Pero esa falla dejaba la pestaña en «fallo» SIN aviso, y después «Eliminación automática» salía
// sin recortar y sin decir nada. Acá se EJECUTA fondo/segmentador.ts con MediaPipe y `sonner` de mentira (cambiados en
// `Module._load`, por eso este archivo va en su proceso) y la red cortada: la falla silenciosa no avisa, y la próxima
// carga (o el próximo cuadro) que sí avisa, avisa UNA vez.
//
// Correr: node --import tsx --test tests/video-editor-segmentador-aviso.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';

const avisos: string[] = [];
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) => {
  if (pedido === 'sonner') return { toast: { error: (t: string) => avisos.push(t) } };
  // El wasm del CDN que no llega (un bloqueador, la red): la carga falla.
  if (pedido === '@mediapipe/tasks-vision') return { FilesetResolver: { forVisionTasks: async () => { throw new Error('sin wasm'); } }, ImageSegmenter: {} };
  return Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain]);
}) as Cargador;
// Sin red: el modelo tampoco baja (y la prueba no sale a internet).
globalThis.fetch = (async () => { throw new Error('sin red'); }) as typeof fetch;
console.warn = () => {};
console.error = () => {};

test('una falla sin aviso deja el aviso para el próximo que sí avisa, y se avisa una sola vez', async () => {
  const s = await import('../app/video-editor/_opencut/fondo/segmentador');
  // Clips mágicos: falla, en silencio.
  assert.equal(await s.cargarSegmentador({ avisar: false }), false);
  assert.equal(s.estadoSegmentador(), 'fallo');
  assert.deepEqual(avisos, [], 'Clips mágicos no pidió el aviso de quitar el fondo');
  // Otra carga silenciosa tampoco avisa.
  assert.equal(await s.cargarSegmentador({ avisar: false }), false);
  assert.deepEqual(avisos, []);
  // «Eliminación automática» (sin volver a cargar: la falla queda hasta que se reintente): ahora sí, el aviso.
  assert.equal(await s.cargarSegmentador(), false);
  assert.deepEqual(avisos, [s.TEXTO_FALLO]);
  // Y un cuadro que pide recortar con aviso no lo repite.
  const lienzo = {} as unknown as HTMLCanvasElement;
  assert.equal(s.segmentarPersona(lienzo, () => {}), false);
  assert.equal(await s.cargarSegmentador(), false);
  assert.deepEqual(avisos, [s.TEXTO_FALLO], 'se avisa una vez');
  // Reintentar (la persona vuelve a prender el interruptor) vuelve a cargar, y la falla con aviso avisa de nuevo.
  s.reintentarSegmentador();
  assert.equal(s.estadoSegmentador(), 'inactivo');
  assert.equal(await s.cargarSegmentador(), false);
  assert.deepEqual(avisos, [s.TEXTO_FALLO, s.TEXTO_FALLO]);
});

test('el primer cuadro que pide recortar después de una falla silenciosa también avisa', async () => {
  const s = await import('../app/video-editor/_opencut/fondo/segmentador');
  avisos.length = 0;
  s.reintentarSegmentador();
  assert.equal(await s.cargarSegmentador({ avisar: false }), false);
  assert.deepEqual(avisos, []);
  // Un cuadro sin aviso (el de Clips mágicos) no; uno con aviso (el render de «Eliminación automática») sí.
  const lienzo = {} as unknown as HTMLCanvasElement;
  assert.equal(s.segmentarPersona(lienzo, () => {}, { avisar: false }), false);
  assert.deepEqual(avisos, []);
  assert.equal(s.segmentarPersona(lienzo, () => {}), false);
  assert.deepEqual(avisos, [s.TEXTO_FALLO]);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 2/0; una rotura por vez, restaurada de memoria):
//   · `cargarSegmentador` con «fallo» sale sin avisar (lo de antes)                -> 1/1 (el 1)
//   · `segmentarPersona` con «fallo» no avisa                                       -> 1/1 (el 2)
//   · la carga silenciosa avisa igual (`if (avisar)` sacado en el catch)            -> 0/2
//   · `avisarFallo` sin `errorAvisado` (avisa en cada cuadro)                       -> 1/1 (el 1)
//   · un cambio sin efecto (renombrar `errorAvisado`)                               -> 2/0
// Lo que NO ve: MediaPipe de verdad en el navegador (eso se mira en el editor).
