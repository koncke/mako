// =============================================================================
// Regenerar una imagen SUMA una variante; nunca pisa la anterior
// =============================================================================
// El defecto que motivó este archivo, reportado por el dueño el 31/08/2026:
//
//   «Ya lo había regenerado y había salido bien la imagen… Ahora me obligaste a
//   regenerar y esta segunda no me gustó. Vuelve a poner la primera.»
//
// No se podía: cada generación escribía `opciones: []` al encolar, así que la
// imagen anterior desaparecía del plan. Hubo que rescatarla a mano de
// `flow_trabajos`. Su regla estaba escrita desde antes: «un render nuevo NUNCA
// sobrescribe al anterior; van los dos con nombre que los distinga».
//
// Y el motivo de que la destrucción existiera no era descuido: `opciones` hacía
// DE SEÑAL además de guardar el dato (`if (m.opciones?.length) return listo`),
// así que conservarla habría hecho que el sondeo diera por llegada una imagen que
// todavía no existía. Lo que se fija acá es la mitad pura del arreglo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sumarVariantes, type Variante } from '../app/video-generator/variantes-imagen';

const A: Variante = { url: 'https://flow/a.png?Expires=1', mediaId: 'id-a' };
const B: Variante = { url: 'https://flow/b.png?Expires=2', mediaId: 'id-b' };

test('la variante nueva se SUMA: la anterior sigue estando', () => {
  const { todas } = sumarVariantes([A], [B]);
  assert.deepEqual(todas.map((v) => v.mediaId), ['id-a', 'id-b']);
});

test('queda mirándose la RECIÉN LLEGADA, no la primera de la lista', () => {
  // Es la que la persona acaba de pedir: dejarle a la vista una vieja haría que
  // el botón pareciera no haber hecho nada.
  const { elegida } = sumarVariantes([A], [B]);
  assert.equal(elegida?.mediaId, 'id-b');
});

test('el orden es CRONOLÓGICO, y es lo que hace reconocible la tira', () => {
  const { todas } = sumarVariantes([A], [B]);
  assert.equal(todas[0].mediaId, 'id-a', 'la primera generada va primera');
});

test('un sondeo repetido NO duplica la variante', () => {
  // Dos pestañas abiertas, un reintento, un visibilitychange: el mismo trabajo
  // se absorbe dos veces. Una tira con la misma imagen repetida convierte la
  // comparación en una trampa — se elige entre dos cosas creyendo que son
  // distintas.
  const { todas } = sumarVariantes([A, B], [B]);
  assert.equal(todas.length, 2);
});

test('y si nada es nuevo, NO se mueve la selección', () => {
  // Devolver la repetida como «elegida» movería lo que la persona está mirando
  // por debajo, sin que haya pasado nada.
  const { elegida } = sumarVariantes([A, B], [B]);
  assert.equal(elegida, undefined);
});

test('el dedup es por mediaId, no por url: la url viene FIRMADA y cambia sola', () => {
  // La misma imagen pedida de nuevo trae otra firma y otro `Expires`. Comparar
  // por url la dejaría entrar como si fuera otra imagen.
  const mismoMedioOtraFirma: Variante = { url: 'https://flow/a.png?Expires=9999', mediaId: 'id-a' };
  const { todas } = sumarVariantes([A], [mismoMedioOtraFirma]);
  assert.equal(todas.length, 1, 'es la misma imagen con otra dirección');
});

test('sin mediaId se cae a la url, que es peor clave pero es la que queda', () => {
  const sinId: Variante = { url: 'https://flow/z.png' };
  assert.equal(sumarVariantes([sinId], [{ url: 'https://flow/z.png' }]).todas.length, 1);
  assert.equal(sumarVariantes([sinId], [{ url: 'https://flow/otra.png' }]).todas.length, 2);
});

test('desde cero: la primera generación entra y queda elegida', () => {
  const { todas, elegida } = sumarVariantes([], [A]);
  assert.deepEqual(todas, [A]);
  assert.equal(elegida?.mediaId, 'id-a');
});

test('dos variantes en una misma respuesta entran las dos, y manda la primera', () => {
  // Flow puede devolver más de una imagen por pedido: son variantes hermanas.
  const { todas, elegida } = sumarVariantes([], [A, B]);
  assert.equal(todas.length, 2);
  assert.equal(elegida?.mediaId, 'id-a');
});

test('no muta las listas que recibe', () => {
  // Los llamadores guardan el plan entero: mutar la lista previa escribiría el
  // cambio antes de que nadie decida escribirlo.
  const previas = [A];
  sumarVariantes(previas, [B]);
  assert.deepEqual(previas, [A]);
});
