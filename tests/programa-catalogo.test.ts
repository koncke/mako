// =============================================================================
// El id de una clase es la clave de una respuesta guardada
// =============================================================================
// `lib/programa-catalogo.ts` es la fuente única del temario, y lo leen tres
// cosas: el cargador de Whop, el formulario que contesta el cliente y el prompt
// que reescribe la respuesta después de la junta. La respuesta del cliente se
// guarda contra el `id` de la clase.
//
// Por eso el id NO es decoración: si dos clases comparten id, la respuesta de
// una pisa la de la otra y el cliente pierde trabajo escrito a mano. Y si un id
// se renumera porque se insertó una clase en el medio, todas las respuestas
// guardadas apuntan a la clase equivocada — en silencio, porque nada valida que
// un id viejo siga existiendo.
//
// Estos tests son la segunda capa de esa regla. La primera es el comentario del
// catálogo; sin esto, es una expresión de deseo (AGENTS.md → «Una regla en un
// prompt no es una regla»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRAMA, CLASES, TOTAL_CLASES, TOTAL_MODULOS,
  CLASES_QUE_DESTRABAN, MODULOS_POR_AREA, claseDe, rotuloDe,
} from '../lib/programa-catalogo';

test('ningún id de clase se repite: una colisión pisa la respuesta del cliente', () => {
  const ids = CLASES.map(c => c.clase.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `ids repetidos: ${dupes.join(', ')}`);
});

test('ningún id de módulo se repite', () => {
  const ids = PROGRAMA.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('los números de módulo son correlativos desde 0', () => {
  PROGRAMA.forEach((m, i) => assert.equal(m.numero, i, `módulo ${m.id}`));
});

test('toda clase tiene título y pregunta no vacíos', () => {
  for (const { modulo, clase } of CLASES) {
    assert.ok(clase.titulo.trim().length > 3, `${modulo.id}/${clase.id}: título`);
    assert.ok(clase.pregunta.trim().length > 10, `${modulo.id}/${clase.id}: pregunta`);
  }
});

test('ningún módulo queda sin clases: un bloque vacío es una clase que nadie contesta', () => {
  for (const m of PROGRAMA) assert.ok(m.clases.length > 0, `${m.id} sin clases`);
});

test('las cinco clases que destraban existen de verdad', () => {
  // Si se renombra o se saca una, esto falla acá y no cuando alguien intente
  // grabar el video que ya no está en el temario.
  for (const id of CLASES_QUE_DESTRABAN) {
    assert.ok(claseDe(id), `${id} no existe en el programa`);
    assert.ok(claseDe(id)!.clase.atoro, `${id} está en la lista pero no declara su atoro`);
  }
});

test('los umbrales los contesta el líder del área, no el dueño', () => {
  // No es un detalle de forma: si el umbral lo pone el dueño, el líder no se
  // compromete con el número. Está en su metodología y se rompe solo al editar.
  const umbrales = PROGRAMA.find(m => m.id === 'm8');
  assert.ok(umbrales);
  assert.equal(umbrales!.quien, 'líder de área');
});

test('los módulos que se repiten por área son los de palancas', () => {
  assert.deepEqual(MODULOS_POR_AREA, ['m6', 'm7', 'm8', 'm9']);
});

test('el rótulo numera la clase dentro de su módulo', () => {
  assert.equal(rotuloDe('m4c2'), '4.2 · La MCI 2, el criterio');
  assert.equal(rotuloDe('m0c1'), '0.1 · Qué vas a tener al final');
});

test('rotuloDe devuelve el id cuando no existe, en vez de romper', () => {
  assert.equal(rotuloDe('no-existe'), 'no-existe');
});

test('el conteo que se comunica es el real', () => {
  // docs/programa-mauricio.md dice 12 módulos y 44 clases, y de ahí sale cuántos
  // videos hay que grabar. Un número mal contado es un presupuesto mal hecho.
  assert.equal(TOTAL_MODULOS, 12);
  assert.equal(TOTAL_CLASES, 44);
});
