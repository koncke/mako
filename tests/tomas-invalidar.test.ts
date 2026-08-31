// =============================================================================
// Un escenario nuevo invalida las tomas que fallaron saliendo de él
// =============================================================================
// El defecto que motivó este archivo fue un BUCLE SIN SALIDA, en producción y en
// el paso más caro del recorrido:
//
//   Google rechazó la toma 1 → la pantalla ofreció arreglar el escenario → se
//   arregló → Continuar → `pasoDe` volvió a la toma 1, que seguía con el error
//   del intento viejo → la pantalla ofreció arreglar el escenario → …
//
// Ninguna de las dos pantallas estaba rota por su cuenta. Lo que faltaba era que
// rehacer la ENTRADA invalidara el resultado que esa entrada había producido —
// «rechazar deja una deuda», con nadie encargado de saldarla.
//
// Lo que se fija acá son las dos mitades, porque la de abajo cuesta plata: se
// olvida lo que falló, y NO se olvida ni lo filmado ni lo que está en vuelo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { olvidarTomasFallidas } from '../app/video-generator/tomas-invalidar';
import type { PlanGuardado } from '../app/video-generator/video-datos';

/**
 * Un plan con lo único que esta función lee: las escenas y las tomas.
 *
 * El resto de `PlanGuardado` —el guion, el plan, la fecha— no participa de la
 * decisión, y escribirlo entero haría que el test se rompiera cada vez que el
 * historial gana un campo, que es exactamente cuando NO tiene que romperse.
 */
function plan(video: PlanGuardado['video']): PlanGuardado {
  return {
    escenas: [
      { n: 1, desde: 1, hasta: 3, lugar: 'El auto', prompt: 'car' },
      { n: 2, desde: 4, hasta: 7, lugar: 'La oficina', prompt: 'office' },
    ],
    video,
  } as unknown as PlanGuardado;
}

test('el fallo de una toma NO sobrevive a la imagen que lo causó', () => {
  const antes = plan({ '1': { error: 'Google no quiso animar esta cara', errorCausa: 'persona_publica' } });
  const despues = olvidarTomasFallidas(antes, 1);
  assert.equal(
    despues.video?.['1'], undefined,
    'con el fallo puesto, volver a la toma 1 la muestra fallada otra vez: ése es el bucle',
  );
});

test('una toma FILMADA no se toca nunca: son créditos pagados', () => {
  // El caso peligroso es el que trae las dos cosas — un error viejo Y la url del
  // clip que sí llegó después. Se mira la url, no el error.
  const antes = plan({ '1': { url: 'https://flow/clip1.mp4', error: 'un fallo viejo' } });
  const despues = olvidarTomasFallidas(antes, 1);
  assert.equal(despues.video?.['1']?.url, 'https://flow/clip1.mp4');
});

test('una toma EN VUELO no se toca: borrarla deja el trabajo huérfano', () => {
  // Sin error y con operación = Google la está haciendo. Si se borra la marca, su
  // resultado llega y no tiene dónde caer, y la pantalla vuelve a ofrecer filmar
  // algo que ya se está filmando.
  const antes = plan({ '2': { operacion: 'op-abc', trabajoId: 99 } });
  const despues = olvidarTomasFallidas(antes, 1);
  assert.deepEqual(despues.video?.['2'], { operacion: 'op-abc', trabajoId: 99 });
});

test('sólo se olvidan las tomas de ESA escena', () => {
  // Siete tomas en dos escenarios: rehacer el auto no puede tocar la oficina.
  const antes = plan({
    '2': { error: 'falló' },
    '5': { error: 'falló' },
  });
  const despues = olvidarTomasFallidas(antes, 1);
  assert.equal(despues.video?.['2'], undefined, 'la toma 2 sale del escenario 1');
  assert.ok(despues.video?.['5'], 'la toma 5 sale del escenario 2 y no se toca');
});

test('sin la escena no se borra a ciegas: se devuelve el plan intacto', () => {
  // No saber qué tomas dependían de una escena es una razón para abstenerse, no
  // para vaciar el mapa.
  const antes = plan({ '1': { error: 'falló' } });
  assert.equal(olvidarTomasFallidas(antes, 9), antes);
});

test('sin nada que olvidar se devuelve el MISMO objeto', () => {
  // No es prolijidad: cada llamada a esta función precede a una escritura del
  // historial, y devolver una copia nueva por una imagen que sólo se confirmó
  // haría que un paso sin cambios pisara el historial igual.
  const antes = plan({ '1': { url: 'https://flow/clip1.mp4' } });
  assert.equal(olvidarTomasFallidas(antes, 1), antes);
});
