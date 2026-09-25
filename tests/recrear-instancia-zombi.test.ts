import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hayQueRecrear } from '../lib/evolution-sonda';

// =============================================================================
// Recuperar una línea desvinculada sin borrar una que anda
// =============================================================================
// Una sesión que WhatsApp desvinculó (403) queda ZOMBI: existe, dice `connecting` para
// siempre y `/instance/connect` devuelve `base64: null`. El modal mostraba «Sin QR» y no
// había forma de recuperarla desde la app. Medido el 25/09/2026: la línea de Mauricio
// llevaba 22 días así, con su chatbot venciendo el domingo.
//
// La decisión es peligrosa en la otra dirección: rotar una sesión ABIERTA le borra el
// WhatsApp a un cliente que estaba trabajando. Por eso `abierta` corta antes que todo.
//
// Probado rompiéndolo:
//   · sacando el `if (p.abierta) return false` → cae «una sesión que anda no se toca»
//     (4 pasan / 1 falla) — y ese es el test que evita romperle la línea a un cliente.
//   · devolviendo siempre false → caen los dos de recuperación (2 pasan / 3 fallan).
// Como está: 5/5. (El guard del cableado falló primero sobre código CORRECTO, porque el
// comentario de al lado del borrado nombra `revertirEstadoNoOficial`: por eso se comparan
// los cuerpos sin comentarios.)

test('una sesión que anda no se toca, aunque no devuelva QR', () => {
  // Evolution no da QR sobre una sesión ya conectada: eso NO es una zombi.
  assert.equal(hayQueRecrear({ abierta: true, qrBase64: null, conectarOk: true }), false);
  assert.equal(hayQueRecrear({ abierta: true, qrBase64: null, conectarOk: false }), false);
  assert.equal(hayQueRecrear({ abierta: true, qrBase64: 'data:image/png;base64,AAA', conectarOk: true }), false);
});

test('la zombi (existe, no abierta, sin QR) se recrea', () => {
  assert.equal(hayQueRecrear({ abierta: false, qrBase64: null, conectarOk: true }), true);
  assert.equal(hayQueRecrear({ abierta: false, qrBase64: undefined, conectarOk: true }), true);
  assert.equal(hayQueRecrear({ abierta: false, qrBase64: '', conectarOk: true }), true);
});

test('si Evolution rechaza el connect de una sesión muerta, también se recrea', () => {
  assert.equal(hayQueRecrear({ abierta: false, qrBase64: null, conectarOk: false }), true);
});

test('con QR de verdad NO se recrea: alcanza con escanear', () => {
  // Es el camino normal de re-vincular. Recrear acá sería tirar la instancia y sus
  // ajustes (webhook, settings) por nada.
  assert.equal(hayQueRecrear({ abierta: false, qrBase64: 'data:image/png;base64,AAA', conectarOk: true }), false);
});

test('conectar() usa la decisión y no borra sin preguntarle', () => {
  // Guard del cableado: el borrado vive en `conectar`, que no se puede importar (arrastra
  // el runtime de Next). Sin esto, alguien puede dejar el logout+delete colgando de otra
  // condición y los tests de arriba seguirían en verde.
  const src = readFileSync(new URL('../lib/evolution.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const i = src.indexOf('export async function conectar(');
  const cuerpoConComentarios = src.slice(i, src.indexOf('\n}\n', i));
  // Sin comentarios: el de al lado del borrado dice «SIN revertirEstadoNoOficial», o sea que
  // la última comprobación se encontraba a sí misma explicada y fallaba sobre código correcto.
  // Es la trampa que este repo ya tiene escrita, y cayó igual.
  const cuerpo = cuerpoConComentarios.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(cuerpo, /hayQueRecrear\(\{ abierta, qrBase64: c\.ok \? c\.data\.base64 : null, conectarOk: c\.ok \}\)/);
  // El delete tiene que estar DENTRO de ese if, no suelto en la función.
  const desde = cuerpo.indexOf('hayQueRecrear(');
  assert.match(cuerpo.slice(desde, desde + 700), /\/instance\/delete\//);
  // Y no puede arrastrar el reseteo del onboarding: esto es re-vincular, no desvincular.
  assert.doesNotMatch(cuerpo, /revertirEstadoNoOficial/);
});
