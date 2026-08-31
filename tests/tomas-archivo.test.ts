// =============================================================================
// Descartar un clip para rehacerlo no puede perderlo
// =============================================================================
// El defecto: «Rehacer la toma N» es `descartarTomaAction` + `generarTomaAction`
// en UN click, y el primero hacía `delete` de la marca entera. El clip pagado
// —~15 créditos— desaparecía antes de saber si el segundo podía filmar… y el
// segundo tiene CINCO puertas que devuelven sin filmar nada: escenario sin
// confirmar, puente sin conectar, sesión marcada por Google, sesión de Flow
// vencida, sin `mediaId`.
//
// Y el .mp4 tampoco sobrevivía: `guardarClip` subía a una ruta fija con
// `upsert: true`, así que el clip nuevo pisaba el archivo del anterior. Se perdía
// en los dos lugares a la vez.
//
// Lo que se fija acá es la mitad pura: archivar y recuperar sin que ningún camino
// tire un clip que se pagó.

import test from 'node:test';
import assert from 'node:assert/strict';
import { archivarToma, recuperarToma } from '../app/video-generator/tomas-archivo';
import type { MarcaVideo } from '../app/video-generator/video-datos';

const CLIP_A: MarcaVideo = { url: 'https://mako/toma-1-a.mp4', mediaId: 'op-a', saldoAntes: 900 };
const CLIP_B: MarcaVideo = { url: 'https://mako/toma-1-b.mp4', mediaId: 'op-b', saldoAntes: 885 };

test('descartar GUARDA el clip: no desaparece', () => {
  const despues = archivarToma(CLIP_A);
  assert.deepEqual(despues.descartadas?.map((d) => d.mediaId), ['op-a']);
});

test('y la toma queda por filmar: sin url, sin trabajo, sin operación', () => {
  // Es lo que se pidió al apretar «Rehacer». Si quedara `operacion`, el sondeo
  // saldría a preguntar por un clip que ya nadie espera.
  const despues = archivarToma({ ...CLIP_A, trabajoId: 77, operacion: 'op-a' });
  assert.equal(despues.url, undefined);
  assert.equal(despues.trabajoId, undefined);
  assert.equal(despues.operacion, undefined);
});

test('un intento SIN clip no ensucia el archivo', () => {
  // Un fallo o algo a medias no es un clip. Guardarlo haría aparecer el pliegue
  // «volver al anterior» prometiendo algo que no se puede recuperar.
  assert.deepEqual(archivarToma({ error: 'Google lo rechazó', errorCausa: 'contenido' }), {});
  assert.deepEqual(archivarToma({ trabajoId: 5, operacion: 'op-x' }), {});
  assert.deepEqual(archivarToma(undefined), {});
});

test('descartar dos veces guarda los DOS clips, en orden', () => {
  const uno = archivarToma(CLIP_A);
  const dos = archivarToma({ ...CLIP_B, descartadas: uno.descartadas });
  assert.deepEqual(dos.descartadas?.map((d) => d.mediaId), ['op-a', 'op-b']);
});

test('recuperar devuelve el ÚLTIMO descartado', () => {
  const archivo = archivarToma({ ...CLIP_B, descartadas: archivarToma(CLIP_A).descartadas });
  const vuelto = recuperarToma(archivo);
  assert.equal(vuelto?.mediaId, 'op-b');
  assert.equal(vuelto?.url, CLIP_B.url);
});

test('y el que estaba filmado AHORA pasa al archivo: recuperar tampoco pierde', () => {
  // Sin esta línea, apretar «volver al anterior» dos veces dejaría uno en la nada.
  const conArchivo: MarcaVideo = { ...CLIP_B, descartadas: [CLIP_A] };
  const vuelto = recuperarToma(conArchivo);
  assert.equal(vuelto?.mediaId, 'op-a', 'vuelve el viejo');
  assert.deepEqual(vuelto?.descartadas?.map((d) => d.mediaId), ['op-b'], 'y el nuevo queda guardado');
});

test('ida y vuelta: los dos clips siguen existiendo siempre', () => {
  // La invariante que importa. Cuántos clips con url hay antes y después de
  // cualquier movimiento tiene que ser el mismo número.
  const cuenta = (m: MarcaVideo | null): number =>
    (m?.url ? 1 : 0) + (m?.descartadas ?? []).filter((d) => d.url).length;

  const filmado: MarcaVideo = { ...CLIP_B, descartadas: [CLIP_A] };
  assert.equal(cuenta(filmado), 2);
  const tras1 = recuperarToma(filmado);
  assert.equal(cuenta(tras1), 2);
  const tras2 = recuperarToma(tras1 ?? undefined);
  assert.equal(cuenta(tras2), 2);
  assert.equal(cuenta(archivarToma(tras2 ?? undefined)), 2);
});

test('sin nada guardado, recuperar dice que NO en vez de escribir vacío', () => {
  // Devolver una marca vacía pisaría el clip bueno con nada.
  assert.equal(recuperarToma(undefined), null);
  assert.equal(recuperarToma({}), null);
  assert.equal(recuperarToma(CLIP_A), null, 'un clip filmado sin archivo no tiene a dónde volver');
  assert.equal(recuperarToma({ descartadas: [{ error: 'falló' }] }), null, 'lo guardado sin url no es recuperable');
});

test('el archivo no se anida dentro de sí mismo', () => {
  // Guardar la marca con su propio archivo adentro duplicaría cada clip en cada
  // vuelta, y el plan entero vive en UNA fila de texto de app_settings.
  const dos = archivarToma({ ...CLIP_B, descartadas: [CLIP_A] });
  assert.equal(dos.descartadas?.every((d) => d.descartadas === undefined), true);
});
