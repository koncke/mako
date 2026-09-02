import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOGO_ESCENARIOS, escenarioPorId, escenariosParaCamara,
  repartirFondos, fondoSiguiente,
} from '../lib/escenarios-data';
import { armarEscenas } from '../lib/escenas-core';

// =============================================================================
// El catálogo de escenarios — DÓNDE se graba, que no es el formato
// =============================================================================
// Lo que se prueba acá es lo único que puede fallar en silencio: un fondo que se
// repite entre dos escenarios del mismo anuncio, o un «otro fondo» que da vueltas
// entre los mismos dos. Ninguna de las dos cosas tira error — salen cuatro
// imágenes del mismo rincón y se leen como un problema del modelo.

test('el catálogo no tiene ids repetidos', () => {
  const ids = CATALOGO_ESCENARIOS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'dos escenarios con el mismo id: `escenarioPorId` devolvería siempre el primero');
});

test('todo escenario tiene al menos dos fondos', () => {
  // Con uno solo, «Otro fondo» devuelve el mismo y el botón miente. La pantalla
  // lo esconde cuando la lista está vacía, pero no cuando tiene exactamente uno.
  for (const e of CATALOGO_ESCENARIOS) {
    assert.ok(e.fondos.length >= 2, `${e.id} tiene ${e.fondos.length} fondo(s)`);
  }
});

test('los fondos de un escenario no se repiten entre sí', () => {
  for (const e of CATALOGO_ESCENARIOS) {
    assert.equal(new Set(e.fondos).size, e.fondos.length, `${e.id} repite un fondo`);
  }
});

test('ningún prompt del catálogo describe a la persona', () => {
  // La misma regla que la red de `escenas-core`, del lado del catálogo: si el
  // fondo describe una cara, sale otra persona y ya se pagó el clip.
  const prohibidas = /\b(face|eyes|hair|beard|smile|skin|young|old man|old woman)\b/i;
  for (const e of CATALOGO_ESCENARIOS) {
    assert.doesNotMatch(e.mundo, prohibidas, `${e.id}: el mundo describe a la persona`);
    for (const f of e.fondos) {
      assert.doesNotMatch(f, prohibidas, `${e.id}: un fondo describe a la persona`);
    }
  }
});

test('«Car Talks» no puede ofrecer una oficina', () => {
  // Es una contradicción, no una preferencia: ese formato ES un selfie adentro
  // de un auto. Ofrecer la oficina sería ofrecer romper el formato.
  const ids = escenariosParaCamara('selfie').map((e) => e.id);
  assert.ok(ids.includes('auto'), 'el auto tiene que estar');
  assert.ok(!ids.includes('oficina'), 'la oficina no filma en selfie de auto');
});

test('filtrar por cámara nunca deja la pantalla sin nada que elegir', () => {
  // Un formato con una cámara que ningún escenario declara dejaría la grilla
  // vacía y sin forma de avanzar. Se prefiere ofrecer todos.
  for (const c of ['seguimiento', 'selfie', 'estatica', 'mano'] as const) {
    assert.ok(escenariosParaCamara(c).length > 0, `${c} se quedó sin escenarios`);
  }
});

test('los fondos se reparten sin repetir mientras alcancen', () => {
  const oficina = escenarioPorId('oficina')!;
  const cuatro = repartirFondos(oficina, 4);
  assert.equal(cuatro.length, 4);
  assert.equal(new Set(cuatro).size, 4, 'cuatro tomas en la misma oficina salieron en el mismo rincón');
});

test('cuando los escenarios superan a los fondos se vuelve a empezar, no se deja vacío', () => {
  const auto = escenarioPorId('auto')!;
  const muchos = repartirFondos(auto, auto.fondos.length + 2);
  assert.equal(muchos.length, auto.fondos.length + 2);
  assert.ok(muchos.every((f) => !!f), 'un escenario quedó sin fondo');
  assert.equal(muchos[auto.fondos.length], auto.fondos[0], 'no volvió a empezar por el primero');
});

test('«otro fondo» recorre TODOS los rincones y recién ahí vuelve al primero', () => {
  // ⚠️ Es el punto del botón. Si avanzara al azar, o si diera la vuelta antes de
  // tiempo, la persona tocaría cinco veces para ver tres fondos y creería que el
  // lugar no tiene más.
  const oficina = escenarioPorId('oficina')!;
  const vistos: string[] = [];
  let actual = oficina.fondos[0];
  for (let i = 0; i < oficina.fondos.length; i++) {
    actual = fondoSiguiente(oficina, actual);
    vistos.push(actual);
  }
  assert.equal(new Set(vistos).size, oficina.fondos.length, 'repitió un fondo antes de recorrerlos todos');
  assert.equal(actual, oficina.fondos[0], 'después de la vuelta completa no volvió al primero');
});

test('«otro fondo» sobre un fondo que no está en la lista arranca por el primero', () => {
  // Pasa con un anuncio anterior al catálogo, o con un prompt editado a mano.
  // «Dame otro» cuando no se sabe cuál es el de ahora se contesta con el primero,
  // no con un vacío.
  const casa = escenarioPorId('casa')!;
  assert.equal(fondoSiguiente(casa, 'un fondo que nadie escribió'), casa.fondos[0]);
  assert.equal(fondoSiguiente(casa, undefined), casa.fondos[0]);
});

test('un id que ya no existe no rompe: contesta null', () => {
  // Un plan guardado puede nombrar un escenario que se sacó del catálogo. La
  // pantalla tiene que poder seguir andando sin él.
  assert.equal(escenarioPorId('el-que-ya-no-esta'), null);
  assert.equal(escenarioPorId(undefined), null);
});

test('armarEscenas le pone a cada escenario SU fondo', () => {
  const v = { cortes: [1, 3], lugares: ['Uno', 'Dos'], prompts: ['a'.repeat(40), 'b'.repeat(40)] };
  const escenas = armarEscenas(4, 2, v, ['fondo uno', 'fondo dos']);
  assert.equal(escenas[0].fondo, 'fondo uno');
  assert.equal(escenas[1].fondo, 'fondo dos');
});

test('sin fondos, la escena no inventa el campo', () => {
  // ⚠️ Tiene que quedar AUSENTE y no vacío: `fondoSiguiente` distingue «no sé cuál
  // es el de ahora» de «el de ahora es la cadena vacía», y un `fondo: ''` haría
  // que un anuncio sin catálogo se comportara como uno que eligió la nada.
  const v = { cortes: [1], lugares: ['Uno'], prompts: ['a'.repeat(40)] };
  const escenas = armarEscenas(3, 1, v);
  assert.ok(!('fondo' in escenas[0]), 'la escena se inventó un fondo');
});
