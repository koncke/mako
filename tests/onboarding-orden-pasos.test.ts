// No se puede saltear un paso del onboarding de una tab.
//
// EL CASO REAL, con una clienta delante: el onboarding del Chatbot quedó `done`
// marcando `ensayo` y `aprobar` con diez segundos de diferencia (20:37:38 →
// 20:37:48), sin haber grabado un solo audio. `marcarPasoTab` aceptaba cualquier
// clave del def, así que marcar el último paso cerraba el recorrido entero — y
// con la tab en `done`, la pantalla muestra el dashboard vacío en vez del
// onboarding.
//
// El guard va en el SERVER: la UI ya deshabilitaba «Siguiente» y aun así se
// llegó. Esconder el botón no protege nada; el que decide es el server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasoBloqueadoPor } from '../lib/onboarding-orden';

const PASOS = [
  { key: 'wa_no_oficial' },
  { key: 'wa_no_oficial_prueba' },
  { key: 'contexto' },
  { key: 'voz' },
  { key: 'ensayo' },
  { key: 'aprobar' },
  { key: 'wa_oficial', opcional: true },
];
const hechos = (...ks: string[]) => Object.fromEntries(ks.map((k) => [k, { done: true }]));

test('el caso de Leila: no se puede marcar `aprobar` sin haber grabado la voz', () => {
  const steps = hechos('wa_no_oficial', 'wa_no_oficial_prueba', 'contexto');
  assert.equal(pasoBloqueadoPor(PASOS, steps, 'aprobar'), 'voz');
  assert.equal(pasoBloqueadoPor(PASOS, steps, 'ensayo'), 'voz');
});

test('el primer paso nunca está bloqueado', () => {
  assert.equal(pasoBloqueadoPor(PASOS, {}, 'wa_no_oficial'), null);
});

test('el paso siguiente al último hecho SÍ se puede marcar', () => {
  const steps = hechos('wa_no_oficial', 'wa_no_oficial_prueba', 'contexto');
  assert.equal(pasoBloqueadoPor(PASOS, steps, 'voz'), null);
});

test('devuelve el PRIMER paso que falta, no el más cercano', () => {
  // Con `contexto` sin hacer pero `voz` hecho, lo que hay que completar primero
  // es `contexto`: si devolviera el más cercano, el mensaje mandaría al usuario
  // al paso equivocado.
  const steps = hechos('wa_no_oficial', 'wa_no_oficial_prueba', 'voz');
  assert.equal(pasoBloqueadoPor(PASOS, steps, 'aprobar'), 'contexto');
});

test('un paso OPCIONAL no bloquea a los que vienen después', () => {
  const conOpcionalEnMedio = [
    { key: 'a' },
    { key: 'b', opcional: true },
    { key: 'c' },
  ];
  assert.equal(pasoBloqueadoPor(conOpcionalEnMedio, hechos('a'), 'c'), null);
});

test('un paso desconocido no bloquea nada (lo rechaza el caller, no esto)', () => {
  assert.equal(pasoBloqueadoPor(PASOS, {}, 'inventado'), null);
});

test('todos los pasos hechos: el último no está bloqueado', () => {
  const steps = hechos('wa_no_oficial', 'wa_no_oficial_prueba', 'contexto', 'voz', 'ensayo');
  assert.equal(pasoBloqueadoPor(PASOS, steps, 'aprobar'), null);
});
