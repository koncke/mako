// =============================================================================
// El motor por interfaz, del lado de MaKo: a quién se le manda y qué se firma
// =============================================================================
// Probado rompiéndolo (17/10/2026):
//   · `usaInterfaz` con `!esMasVieja(v, …)` cambiado por `v === MOTOR_INTERFAZ_DESDE`
//     → falla «una 0.70 también»: la 0.70.0 recibiría pedidos de BOQ.
//   · `RUTA_SUBIDA` sin el `^` → falla «la firma de subida»: se firmaría
//     `../otro-bucket/video-generator/…`.
//   · sacar `await seguirTomados(ws, body.enCurso);` del route → falla «el route
//     renueva»: el rescate de diez minutos volvería a repartir trabajos pagados.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  usaInterfaz, MOTOR_INTERFAZ_DESDE, segundosDeFlow, clipDeInterfaz, RUTA_SUBIDA, rutaDeSubida,
  pedidoClipInterfaz, TOPE_CREDITOS,
} from '../lib/flow-interfaz';

test('el motor por interfaz es para la 0.69 en adelante, y una versión rara es vieja', () => {
  assert.equal(MOTOR_INTERFAZ_DESDE, '0.69.0');
  assert.equal(usaInterfaz('0.69.0'), true);
  assert.equal(usaInterfaz('0.70.0'), true, 'una 0.70 también');
  assert.equal(usaInterfaz('0.68.9'), false);
  // ⚠️ La comparación de texto diría que '0.100.0' es menor que '0.69.0'.
  assert.equal(usaInterfaz('0.100.0'), true);
  for (const raro of ['', null, undefined, 'dev', '0.69.0-beta']) assert.equal(usaInterfaz(raro), false, String(raro));
});

test('la duración se redondea a una que Flow ofrece, nunca para abajo', () => {
  assert.deepEqual([3, 4, 5, 7, 8, 9, 10, 12].map(segundosDeFlow), [4, 4, 6, 8, 8, 10, 10, 10]);
});

test('el pedido del clip lleva la cara y el tope de créditos', () => {
  const p = pedidoClipInterfaz({ prompt: 'x', mediaId: 'm', segundos: 7, ruta: 'r' });
  assert.equal(p.motor, 'interfaz');
  assert.deepEqual(p.referencias, ['m'], 'sin la cara sale otra persona, y se descubre pagando el clip');
  assert.equal(p.segundos, 8);
  assert.equal(p.maxCreditos, TOPE_CREDITOS.video);
});

test('sólo se lee como de interfaz lo que dice serlo', () => {
  assert.equal(clipDeInterfaz({ media: [{ name: 'op' }] }), null, 'un resultado de BOQ no es de interfaz');
  assert.equal(clipDeInterfaz(null), null);
  assert.deepEqual(
    clipDeInterfaz({ motor: 'interfaz', mediaId: ' m ', url: 'u', propio: true }),
    { mediaId: 'm', url: 'u', propio: true },
  );
  // `propio` sólo con un true explícito: una url de Flow no es nuestra por omisión.
  assert.equal(clipDeInterfaz({ motor: 'interfaz', url: 'u', propio: 'si' })!.propio, false);
});

test('la firma de subida sólo se da para rutas con la forma conocida', () => {
  const uuid = '0f8b3c2a-1111-2222-3333-444455556666';
  const buena = rutaDeSubida('plan_1', 'toma', 3, uuid);
  assert.equal(buena, `video-generator/plan_1/toma-3-${uuid}.mp4`);
  assert.ok(RUTA_SUBIDA.test(buena));
  assert.ok(RUTA_SUBIDA.test(rutaDeSubida('p', 'escena', 1, uuid)));
  // El id del plan se limpia: no puede subir de carpeta.
  assert.ok(RUTA_SUBIDA.test(rutaDeSubida('../../x', 'toma', 1, uuid)));
  for (const mala of [
    `../otro-bucket/video-generator/p/toma-1-${uuid}.mp4`,
    `video-generator/p/toma-1-${uuid}.mp4.html`,
    `video-generator/p/../q/toma-1-${uuid}.mp4`,
    `video-generator/p/toma-1-${uuid}.exe`,
  ]) assert.equal(RUTA_SUBIDA.test(mala), false, mala);
});

test('el route renueva los trabajos en curso ANTES de tomar (y de rescatar) otros', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/flow/puente/route.ts'), 'utf8');
  const i = route.indexOf('await seguirTomados(ws, body.enCurso);');
  const j = route.indexOf('await tomarTrabajos(ws, cuantos)');
  assert.ok(i > 0, 'el route ya no renueva el `tomado_at` de lo que el navegador sigue trabajando');
  assert.ok(j > i, 'la renovación tiene que ir antes de tomar: el RPC rescata los colgados al tomar');
});
