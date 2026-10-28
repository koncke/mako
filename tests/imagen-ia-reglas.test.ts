// =============================================================================
// Crear y editar imágenes con la IA del NEGOCIO (lib/image-editor/imagen-ia-reglas.ts, 26/10/2026): las reglas puras
// =============================================================================
// Lo que se cobra en la cuenta del negocio (crear_imagen / editar_imagen del chat «MaKo IA» y, desde el 27/10/2026,
// crear_imagen_ia / editar_imagen_ia de la API) pasa por estas reglas antes y después del `fetch` (lib/image-editor/imagen-ia.ts):
//   · R1 con qué clave: SU OpenAI y, si no, SU Gemini; una copia de la plataforma no es suya; sin ninguna, pide OpenAI;
//   · R2 el fallo dice de quién fue y qué hacer (su clave, su saldo, un bache del proveedor, el contenido), sin la clave;
//   · R3 un 200 sin imagen NO es un éxito (AGENTS.md, «res.ok no es salió bien»), y uno con imagen trae sus medidas;
//   · R4 Gemini: el bloqueo por contenido viene adentro del 200.
// Las respuestas son las del proveedor, simuladas (el `fetch` que no se hace).
//
// Correr: node --import tsx --test tests/imagen-ia-reglas.test.ts
//
// PROBADO ROMPIÉNDOLO (27/10/2026, base 4/0, cada rotura restaurada de memoria):
//   · una copia de la plataforma vale como propia (`=== 'propia'` → `!== 'copia'`, condición invertida)  -> 3/1 (R1)
//   · un 200 sin imagen pasa como éxito                                                                   -> 3/1 (R3)
//   · el mensaje del proveedor sale con la clave adentro                                                  -> 3/1 (R2)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirProveedor, falloDeRespuesta, leerRespuestaGemini, leerRespuestaOpenAI } from '../lib/image-editor/imagen-ia-reglas';

/** Un PNG de 1×1 de verdad (firma y IHDR). */
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('R1 la clave: su OpenAI primero, su Gemini después; una copia no es suya, y sin ninguna se pide OpenAI', () => {
  assert.deepEqual(elegirProveedor([{ clave: 'GEMINI_API_KEY', es: 'propia' }, { clave: 'OPENAI_API_KEY', es: 'propia' }]), { ok: true, proveedor: 'openai', clave: 'OPENAI_API_KEY' });
  assert.deepEqual(elegirProveedor([{ clave: 'OPENAI_API_KEY', es: 'copia' }, { clave: 'GEMINI_API_KEY', es: 'propia' }]), { ok: true, proveedor: 'gemini', clave: 'GEMINI_API_KEY' });
  const copia = elegirProveedor([{ clave: 'OPENAI_API_KEY', es: 'copia' }]);
  assert.ok(!copia.ok && copia.fallo.deQuien === 'cuenta' && copia.fallo.link?.href === '/integraciones?abrir=openai' && !copia.fallo.salio, 'una copia de la plataforma no se usa');
  const ilegible = elegirProveedor([{ clave: 'OPENAI_API_KEY', es: 'ilegible' }]);
  assert.ok(!ilegible.ok && /no se puede leer/.test(ilegible.fallo.texto));
  const soloClaude = elegirProveedor([{ clave: 'ANTHROPIC_API_KEY', es: 'propia' }]);
  assert.ok(!soloClaude.ok && /Tu Claude no crea imágenes/.test(soloClaude.fallo.texto));
});

test('R2 el fallo dice de quién fue y qué hacer, y nunca muestra la clave', () => {
  assert.equal(falloDeRespuesta('openai', 'm', 401, 'Incorrect API key provided: sk-proj-abcdefghijk').deQuien, 'cuenta');
  assert.equal(falloDeRespuesta('openai', 'm', 429, 'You exceeded your current quota').deQuien, 'cuenta');
  assert.equal(falloDeRespuesta('openai', 'm', 503, 'overloaded').deQuien, 'proveedor');
  assert.equal(falloDeRespuesta('openai', 'm', 400, 'Your request was rejected by the safety system').deQuien, 'contenido');
  assert.equal(falloDeRespuesta('openai', 'm', 404, 'model_not_found').deQuien, 'mako');
  const raro = falloDeRespuesta('openai', 'm', 400, 'algo raro con la clave sk-proj-abcdefghijk');
  assert.doesNotMatch(raro.texto, /sk-proj-abcdefghijk/, 'la clave no se muestra');
  assert.match(raro.texto, /\[clave\]/);
});

test('R3 OpenAI: un 200 sin imagen no es un éxito; con imagen, trae sus medidas; el error ADENTRO del 200 es un error', () => {
  const vacia = leerRespuestaOpenAI(200, { data: [] }, 'm');
  assert.ok(!vacia.ok && vacia.fallo.salio && /sin ninguna imagen/.test(vacia.fallo.texto));
  const ok = leerRespuestaOpenAI(200, { data: [{ b64_json: PNG_1X1 }], usage: { total_tokens: 10 } }, 'm');
  assert.ok(ok.ok, 'una imagen de verdad');
  assert.deepEqual(ok.ok && { mime: ok.imagen.mime, ancho: ok.imagen.ancho, alto: ok.imagen.alto }, { mime: 'image/png', ancho: 1, alto: 1 });
  const adentro = leerRespuestaOpenAI(200, { error: { code: 'insufficient_quota', message: 'billing' } }, 'm');
  assert.ok(!adentro.ok && adentro.fallo.deQuien === 'cuenta');
});

test('R4 Gemini: el bloqueo por contenido viene adentro del 200', () => {
  const bloqueo = leerRespuestaGemini(200, { promptFeedback: { blockReason: 'SAFETY' } }, 'm');
  assert.ok(!bloqueo.ok && bloqueo.fallo.deQuien === 'contenido');
  const ok = leerRespuestaGemini(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_1X1 } }] } }] }, 'm');
  assert.ok(ok.ok, 'la imagen de un inlineData');
});
