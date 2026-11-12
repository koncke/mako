// =============================================================================
// Spy: cortar un texto sin dejar medio emoji (12/11/2026)
// =============================================================================
// Dave Ramsey tenía foto y web pero ningún video: el guardado contestaba «invalid input syntax for type json», sin
// decir cuál. Era UN video entre 200 (t2h2lK2hN4M, descripción de 4280 caracteres) con un emoji justo en el 4000:
// `.slice(0, 4000)` lo partió, JSON.stringify escribió la mitad suelta como escape, y PostgREST rechazó el lote ENTERO.
//   1. un corte en el medio de un emoji lo saca entero, y el JSON queda bien formado;
//   2. una mitad suelta que ya viene de la fuente se cambia por «�»;
//   3. un emoji entero y un texto corto quedan como estaban;
//   4. las piezas (comun de guardarVistas), los videos de YouTube y la captura cortan con cortarTexto, no con .slice.
//
// Probado rompiéndolo (romper.mjs + roturas-corte-emoji.mjs):
//   · no sacar la mitad del final del corte                                      → 1 / 1
//   · no cambiar las mitades sueltas por «�»                                     → 2 / 1
//   · volver a .slice(0, TOPES.texto) en guardarVistas                           → 4 / 1
//   · volver a .slice(0, TOPES.texto) en la descripción de YouTube               → 4 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cortarTexto, TOPES } from '../lib/spy-reglas';

const EMOJI = String.fromCodePoint(0x1f600);
const MITAD_ALTA = String.fromCharCode(0xd83d);
const MITAD_BAJA = String.fromCharCode(0xde00);
const REEMPLAZO = String.fromCharCode(0xfffd);
/** Lo que PostgreSQL no acepta: un escape de una mitad suelta dentro del JSON. */
const sinMitadSuelta = (s: string) => !/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/i.test(JSON.stringify(s)) && !/(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/i.test(JSON.stringify(s));

test('1. un corte en el medio de un emoji lo saca entero, y el JSON queda bien formado', () => {
  const descripcion = 'a'.repeat(TOPES.texto - 1) + EMOJI + ' y sigue';
  assert.equal(sinMitadSuelta(descripcion.slice(0, TOPES.texto)), false, 'el caso de Dave Ramsey: .slice deja la mitad');
  const c = cortarTexto(descripcion, TOPES.texto);
  assert.equal(c, 'a'.repeat(TOPES.texto - 1));
  assert.ok(sinMitadSuelta(c));
});

test('2. una mitad suelta que ya viene de la fuente se cambia por «�»', () => {
  assert.equal(cortarTexto(`hola ${MITAD_ALTA} chau`, 100), `hola ${REEMPLAZO} chau`);
  assert.equal(cortarTexto(`hola ${MITAD_BAJA} chau`, 100), `hola ${REEMPLAZO} chau`);
  // Ya cortado con .slice por otro (largo justo n): la mitad del final no se puede sacar como «corte», se reemplaza.
  const yaCortado = 'b'.repeat(9) + MITAD_ALTA;
  assert.equal(cortarTexto(yaCortado, 10), 'b'.repeat(9) + REEMPLAZO);
  assert.ok(sinMitadSuelta(cortarTexto(yaCortado, 10)));
});

test('3. un emoji entero y un texto corto quedan como estaban', () => {
  assert.equal(cortarTexto(`Mirá esto ${EMOJI}${EMOJI}`, 300), `Mirá esto ${EMOJI}${EMOJI}`);
  assert.equal(cortarTexto(`${EMOJI}abc`, 3), `${EMOJI}a`);
  assert.equal(cortarTexto('', 10), '');
});

test('4. las piezas, YouTube y la captura cortan con cortarTexto, no con .slice', () => {
  const leer = (r: string) => readFileSync(new URL(`../lib/${r}`, import.meta.url), 'utf8');
  const spy = leer('spy.ts');
  assert.match(spy, /titulo: v\.titulo != null \? cortarTexto\(v\.titulo, TOPES\.titulo\)/);
  assert.match(spy, /texto: v\.texto != null \? cortarTexto\(v\.texto, TOPES\.texto\)/);
  const yt = leer('spy-youtube.ts');
  assert.match(yt, /cortarTexto\(str\(snippet\.title\), TOPES\.titulo\)/);
  assert.match(yt, /cortarTexto\(str\(snippet\.description\), TOPES\.texto\)/);
  for (const r of ['spy.ts', 'spy-youtube.ts', 'spy-captura.ts', 'spy-que-es.ts', 'spy-todo-reglas.ts']) {
    assert.doesNotMatch(leer(r), /\.slice\(0, (TOPES\.(titulo|texto|nombre)|4000|300)\)/, `${r} vuelve a cortar con .slice`);
  }
});
