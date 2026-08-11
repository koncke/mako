// =============================================================================
// El formulario del programa: los ids son claves, y las tablas son tablas
// =============================================================================
// `lib/programa-campos.ts` son las preguntas de verdad, sacadas de los dos
// Cuestionarios Maestros. Tres cosas se rompen en silencio al editarlo:
//
//  1. Un `id` repetido dentro de una clase pisa la respuesta del cliente.
//  2. Un `id` renombrado pierde lo que ya había escrito, sin error.
//  3. Una tabla sin columnas es un textarea disfrazado: se pierde justo la
//     estructura que hace que la respuesta sirva para armar la matriz.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS, camposDe, TOTAL_CAMPOS, type Campo } from '../lib/programa-campos';
import { CLASES, claseDe } from '../lib/programa-catalogo';

const todos: [string, Campo][] = Object.entries(CAMPOS).flatMap(([c, fs]) => fs.map(f => [c, f] as [string, Campo]));

test('todo campo cuelga de una clase que existe', () => {
  for (const claseId of Object.keys(CAMPOS)) {
    assert.ok(claseDe(claseId), `«${claseId}» tiene campos pero no está en el programa`);
  }
});

test('ningún id se repite DENTRO de una clase: una colisión pisa la respuesta', () => {
  for (const [claseId, campos] of Object.entries(CAMPOS)) {
    const ids = campos.map(f => f.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dup, [], `${claseId}: ids repetidos → ${dup.join(', ')}`);
  }
});

test('toda clase del programa tiene al menos una pregunta', () => {
  // Un bloque sin formulario es un video que el cliente mira y después no tiene
  // qué contestar: el bucle se queda sin su segundo paso.
  for (const { clase } of CLASES) {
    assert.ok(camposDe(clase.id).length > 0, `${clase.id} se quedó sin campos`);
  }
});

test('todo campo dice de qué pregunta del cuestionario sale', () => {
  // Sin `origen` no se puede auditar qué se perdió al pasar de sus dos
  // cuestionarios a este formulario.
  for (const [claseId, f] of todos) {
    assert.ok(f.origen.trim().length > 0, `${claseId}/${f.id}: sin origen`);
    assert.ok(f.label.trim().length > 8, `${claseId}/${f.id}: label vacío o de una palabra`);
  }
});

test('ninguna pregunta del cuestionario se pregunta DOS veces', () => {
  // El cliente contestando lo mismo en dos bloques es la forma más rápida de
  // que abandone el formulario.
  const vistos = new Map<string, string>();
  const repetidos: string[] = [];
  for (const [claseId, f] of todos) {
    const previo = vistos.get(f.origen);
    if (previo && previo !== claseId) repetidos.push(`${f.origen}: ${previo} y ${claseId}`);
    else vistos.set(f.origen, claseId);
  }
  assert.deepEqual(repetidos, [], `preguntas duplicadas → ${repetidos.join(' · ')}`);
});

test('una tabla tiene columnas con nombre, o no es una tabla', () => {
  for (const [claseId, f] of todos) {
    if (f.tipo !== 'tabla') continue;
    assert.ok((f.columnas?.length ?? 0) >= 2, `${claseId}/${f.id}: tabla con menos de 2 columnas`);
    for (const c of f.columnas!) assert.ok(c.trim().length > 0, `${claseId}/${f.id}: columna sin nombre`);
  }
});

test('elección y checks traen sus opciones; el resto NO las trae', () => {
  for (const [claseId, f] of todos) {
    if (f.tipo === 'eleccion' || f.tipo === 'checks') {
      assert.ok((f.opciones?.length ?? 0) >= 2, `${claseId}/${f.id}: ${f.tipo} con menos de 2 opciones`);
    } else {
      assert.ok(!f.opciones, `${claseId}/${f.id}: ${f.tipo} no debería traer opciones`);
    }
  }
});

test('las filas fijas y el mínimo de filas solo tienen sentido en una tabla', () => {
  for (const [claseId, f] of todos) {
    if (f.tipo === 'tabla') continue;
    assert.ok(!f.filasFijas, `${claseId}/${f.id}: filasFijas fuera de una tabla`);
    assert.ok(f.filasMin === undefined, `${claseId}/${f.id}: filasMin fuera de una tabla`);
  }
});

test('las tablas que el cuestionario define con filas fijas las conservan', () => {
  // E4 son las CINCO carteras de la agenda del dueño, y B4 son los TRES bloques
  // de unidades. Si alguien las convierte en tabla libre, el cliente inventa sus
  // propias categorías y las respuestas dejan de ser comparables entre clientes.
  const conFilas = todos.filter(([, f]) => f.filasFijas?.length);
  assert.ok(conFilas.length >= 2, 'se perdieron las tablas de filas fijas del cuestionario');
});

test('el conteo que se comunica es el real', () => {
  assert.equal(TOTAL_CAMPOS, todos.length);
  assert.ok(TOTAL_CAMPOS >= 100, `el formulario se achicó a ${TOTAL_CAMPOS} preguntas`);
});
