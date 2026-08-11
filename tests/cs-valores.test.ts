// =============================================================================
// Lo que llega por la red no entra crudo al jsonb
// =============================================================================
// `/api/compartido/tarea` es la única escritura autenticada por token de link, y
// lo que escribe es una columna `jsonb`. Sin saneo, un POST puede guardar
// cualquier cosa ahí: campos que no existen, opciones inventadas, tablas con más
// columnas que las suyas, celdas de un megabyte.
//
// Y la otra mitad: `respuesta` se DERIVA de `valores`. Si la derivación pierde
// las columnas de una tabla, la IA reescribe sobre un texto mutilado y el
// cliente aprueba algo que ya no dice lo que él escribió.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanear, aTexto, tieneValor, faltantes, tablaParaEditar } from '../lib/cs-valores';
import { camposDe } from '../lib/programa-campos';

// m2c2 tiene la tabla de cinco columnas con mínimo ocho renglones (D2).
const TABLA = camposDe('m2c2').find(c => c.tipo === 'tabla')!;
// m1c4 tiene los checks con opciones cerradas (B5).
const CHECKS = camposDe('m1c4').find(c => c.tipo === 'checks')!;
// m1c1 tiene la elección de arquetipo (A2).
const ELECCION = camposDe('m1c1').find(c => c.tipo === 'eleccion')!;

test('un campo que no existe en la clase no entra', () => {
  const v = sanear('m2c2', { 'no-existe': 'basura', [TABLA.id]: [['a', 'b', 'c', 'd', 'e']] });
  assert.equal(v['no-existe'], undefined);
  assert.ok(v[TABLA.id]);
});

test('una opción inventada en checks se descarta, la válida queda', () => {
  const validas = CHECKS.opciones!;
  const v = sanear('m1c4', { [CHECKS.id]: [validas[0], 'INVENTADA', validas[1]] });
  assert.deepEqual(v[CHECKS.id], [validas[0], validas[1]]);
});

test('una elección fuera de las opciones no se guarda', () => {
  assert.equal(sanear('m1c1', { [ELECCION.id]: 'cualquier cosa' })[ELECCION.id], undefined);
  assert.equal(sanear('m1c1', { [ELECCION.id]: ELECCION.opciones![0] })[ELECCION.id], ELECCION.opciones![0]);
});

test('una tabla no puede traer más columnas que las suyas', () => {
  const cols = TABLA.columnas!.length;
  const v = sanear('m2c2', { [TABLA.id]: [Array.from({ length: cols + 6 }, (_, i) => `c${i}`)] });
  assert.equal((v[TABLA.id] as string[][])[0].length, cols);
});

test('una fila corta se completa hasta el ancho de la tabla', () => {
  const cols = TABLA.columnas!.length;
  const v = sanear('m2c2', { [TABLA.id]: [['solo la primera']] });
  assert.equal((v[TABLA.id] as string[][])[0].length, cols);
});

test('una celda gigante se recorta', () => {
  const v = sanear('m2c2', { [TABLA.id]: [['x'.repeat(50_000), '', '', '', '']] }, 100);
  assert.equal((v[TABLA.id] as string[][])[0][0].length, 100);
});

test('lo que no es una tabla, no se guarda como tabla', () => {
  assert.equal(sanear('m2c2', { [TABLA.id]: 'esto es un string' })[TABLA.id], undefined);
  assert.equal(sanear('m1c4', { [CHECKS.id]: 'no es una lista' })[CHECKS.id], undefined);
});

test('sanear tolera basura sin romper', () => {
  assert.deepEqual(sanear('m2c2', null), {});
  assert.deepEqual(sanear('m2c2', 'un string'), {});
  assert.deepEqual(sanear('no-existe-esta-clase', { x: 1 }), {});
});

test('el texto derivado conserva las columnas de la tabla', () => {
  // Si esto se pierde, la IA reescribe sobre un texto mutilado y el cliente
  // aprueba algo que ya no dice lo que él escribió.
  const texto = aTexto('m2c2', { [TABLA.id]: [['Autorizar descuento', 'Yo', 'Cerrar sin regalar margen', 'Contra el margen', 'Escalarlo']] });
  for (const col of TABLA.columnas!) assert.ok(texto.includes(col), `falta la columna «${col}»`);
  assert.ok(texto.includes('Autorizar descuento'));
  assert.ok(texto.includes(TABLA.label), 'sin la pregunta encima, la respuesta no se entiende sola');
});

test('una celda vacía sale como raya, no desaparece la columna', () => {
  const texto = aTexto('m2c2', { [TABLA.id]: [['Contratar', 'Yo', 'Cubrir el turno', '', '']] });
  assert.ok(texto.includes('| — | — |'), 'las celdas vacías tienen que ocupar su lugar');
});

test('una tabla con todo vacío no cuenta como contestada', () => {
  // Si no, agregar un renglón vacío marcaría el bloque como contestado.
  assert.equal(tieneValor([['', '', '', '', '']]), false);
  assert.equal(tieneValor([['', 'algo', '', '', '']]), true);
  assert.equal(tieneValor('   '), false);
  assert.equal(tieneValor([]), false);
  assert.equal(tieneValor(undefined), false);
});

test('faltantes cuenta solo las obligatorias sin contestar', () => {
  const obligatorias = camposDe('m2c2').filter(c => c.obligatorio);
  assert.equal(faltantes('m2c2', {}).length, obligatorias.length);
  const llenas = Object.fromEntries(obligatorias.map(c => [c.id, c.tipo === 'tabla' ? [['x']] : 'x']));
  assert.equal(faltantes('m2c2', llenas).length, 0);
});

test('la tabla se abre con los renglones que el cuestionario pide', () => {
  // D2 dice «mínimo ocho renglones». Abrirla con uno y un botón «agregar»
  // esconde el pedido: el cliente contesta uno y cree que terminó.
  assert.equal(tablaParaEditar(TABLA, undefined).length, TABLA.filasMin);
});

test('una tabla de filas fijas conserva sus etiquetas y su orden', () => {
  // B4 son «las buenas / las medias / las que pierden». Si el cliente pudiera
  // cambiarlas, las respuestas dejan de ser comparables entre clientes.
  const conFijas = camposDe('m1c3').find(c => c.filasFijas?.length)!;
  const filas = tablaParaEditar(conFijas, [['OTRA COSA', 'x', 'y']]);
  assert.equal(filas[0][0], conFijas.filasFijas![0]);
  assert.equal(filas[0][1], 'x', 'lo que escribió el cliente en el resto de la fila se conserva');
  assert.equal(filas.length, conFijas.filasFijas!.length);
});
