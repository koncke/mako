// =============================================================================
// La imagen que Flow SÍ generó por BOQ se encuentra en un array posicional
// =============================================================================
// ⚠️ MEDIDO el 07/09/2026, trabajo #670: la primera imagen real generada por el
// replay del Flow nuevo. Google la generó (estaba en la grilla de Flow) y MaKo dijo
// «Flow aceptó el pedido y no devolvió ninguna imagen», porque el extractor buscaba
// campos con NOMBRE (`fifeUrl`, `mediaId`…) y BOQ contesta posiciones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imagenesDeRespuesta } from '../lib/flow-imagen';

const MEDIA = '99e46e24-c2dd-4e72-9d0c-35221660cfdb';
const URL_FIRMADA = `https://flow-content.google/image/${MEDIA}?Expires=1788774307&KeyName=labs-flow-prod-cdn-key&Signature=jlVXKosUx9vEVRpa6TasPwP770c`;

/** La forma REAL del payload de `ogiZ0b`, recortada en los textos largos. */
const BOQ = [[[
  MEDIA, null, '401b005f-f469-415e-9119-81a268539ccd', null, null, null,
  [[null, 463482732, null, null, null, null, 1,
    'Keep the person completely unchanged: same face…', 25, null, null,
    '401b005f-f469-415e-9119-81a268539ccd', null,
    URL_FIRMADA, 2,
    [null, null, [['Mantén a la persona totalmente inalterada…']]],
  ]],
]]];

test('EL CASO REAL: la url firmada y su mediaId salen del array posicional', () => {
  const out = imagenesDeRespuesta(BOQ);
  assert.equal(out.length, 1, 'no encontró la imagen que Flow generó');
  assert.equal(out[0].url, URL_FIRMADA);
  assert.equal(out[0].mediaId, MEDIA, 'el mediaId es el uuid del path: sin él no se puede animar desde esta imagen');
});

test('el camino viejo (objetos con nombre de campo) sigue igual', () => {
  const rest = { media: [{ fifeUrl: 'https://lh3.googleusercontent.com/x', mediaId: 'abc' }] };
  assert.deepEqual(imagenesDeRespuesta(rest), [{ url: 'https://lh3.googleusercontent.com/x', mediaId: 'abc' }]);
});

test('un string cualquiera no es una imagen: ni el prompt, ni el proyecto, ni otra url', () => {
  const nada = [['9973383e-74eb-4503-80f3-d30fb856781a', 'https://flow.google.com/project/9973383e-74eb-4503-80f3-d30fb856781a', 'texto con https://algo.com/image/no-es-uuid']];
  assert.deepEqual(imagenesDeRespuesta(nada), []);
});

test('la misma url dos veces cuenta una', () => {
  assert.equal(imagenesDeRespuesta([URL_FIRMADA, [URL_FIRMADA]]).length, 1);
});
