// =============================================================================
// El JSON del modelo se repara por los modos de falla que existen, y sólo si falla
// =============================================================================
// ⚠️ EL CASO REAL, visto por el dueño en una reunión con su cliente (06/09/2026):
//
//     No se pudo armar el plan: Expected ',' or ']' after array element in JSON
//     at position 631 (line 9 column 6)
//
// Diez tomas bien escritas y UNA coma menos entre dos elementos del array. El
// `JSON.parse` directo lo tiraba todo. Este test fija cada modo de falla conocido,
// y —tan importante— que un JSON válido NO se toca.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonObject, repararJson, extraerObjeto } from '../lib/json-del-modelo';

const VALIDO = {
  titulo: 'Car Talks',
  clips: [
    { n: 1, voz: 'Necesitas una empresa capaz de ejecutar mejor.', seg: 8 },
    { n: 2, voz: 'Ahí te explico cómo funciona y qué necesitas para empezar.', seg: 8 },
  ],
};

test('un JSON válido vuelve idéntico: la reparación no se aplica', () => {
  const texto = JSON.stringify(VALIDO, null, 2);
  assert.deepEqual(parseJsonObject(texto), VALIDO);
  // Y `repararJson` sobre texto válido tampoco lo cambia — es la garantía de que
  // la heurística no inventa nada donde no hace falta.
  assert.equal(repararJson(texto), texto);
});

test('EL CASO REAL: falta la coma entre dos elementos del array', () => {
  const roto = `{
  "titulo": "Car Talks",
  "clips": [
    {
      "n": 1,
      "voz": "Necesitas una empresa capaz de ejecutar mejor.",
      "seg": 8
    }
    {
      "n": 2,
      "voz": "Ahí te explico cómo funciona y qué necesitas para empezar.",
      "seg": 8
    }
  ]
}`;
  assert.throws(() => JSON.parse(roto), /after array element/);
  assert.deepEqual(parseJsonObject(roto), VALIDO);
});

test('coma que sobra antes de cerrar', () => {
  const roto = '{"a": [1, 2, 3,], "b": {"c": 1,},}';
  assert.deepEqual(parseJsonObject(roto), { a: [1, 2, 3], b: { c: 1 } });
});

test('comillas de diálogo sin escapar adentro de un valor', () => {
  // Es lo que escribe un guion: alguien dice algo entre comillas.
  const roto = '{"voz": "Le dije "esto se vende solo" y se rió.", "seg": 8}';
  assert.deepEqual(parseJsonObject(roto), { voz: 'Le dije "esto se vende solo" y se rió.', seg: 8 });
});

test('«"hola", dijo» es diálogo, no el cierre del string', () => {
  // La coma después de la comilla es la trampa: sólo cierra si lo que viene
  // después de la coma es OTRO valor, no una palabra.
  const roto = '{"voz": "Me miró y "hola", dijo, sin más.", "seg": 4}';
  assert.deepEqual(parseJsonObject(roto), { voz: 'Me miró y "hola", dijo, sin más.', seg: 4 });
  // Y el array de strings de verdad se sigue leyendo como array.
  assert.deepEqual(parseJsonObject('{"a": ["x", "y"]}'), { a: ['x', 'y'] });
});

test('salto de línea crudo adentro de un string', () => {
  const roto = '{"voz": "Primera línea\nsegunda línea", "seg": 8}';
  assert.deepEqual(parseJsonObject(roto), { voz: 'Primera línea\nsegunda línea', seg: 8 });
});

test('cercas de markdown y prosa alrededor', () => {
  const texto = 'Acá va el plan:\n```json\n' + JSON.stringify(VALIDO) + '\n```\nEspero que sirva.';
  assert.deepEqual(parseJsonObject(texto), VALIDO);
  assert.equal(extraerObjeto(texto), JSON.stringify(VALIDO));
});

test('falta la coma entre dos strings o entre string y objeto', () => {
  assert.deepEqual(parseJsonObject('{"a": ["x" "y"]}'), { a: ['x', 'y'] });
  assert.deepEqual(parseJsonObject('{"a": "x" "b": "y"}'), { a: 'x', b: 'y' });
  assert.deepEqual(parseJsonObject('{"a": [{"n": 1} {"n": 2}]}'), { a: [{ n: 1 }, { n: 2 }] });
});

test('lo que no tiene arreglo tira, y dice de quién es la culpa', () => {
  assert.throws(() => parseJsonObject('no hay nada acá'), /respuesta sin JSON/);
  assert.throws(() => parseJsonObject('{"a": [1, 2'), /el modelo devolvió un JSON inválido/);
});
