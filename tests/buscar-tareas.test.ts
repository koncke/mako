// =============================================================================
// La barra de búsqueda: por defecto SOLO el título
// =============================================================================
// El pedido, textual: «es incómodo y contraintuitivo que intente buscar coincidencia en
// un título y me salgan muchas tareas porque está leyendo el detalle y otras cosas».
//
// Estos tests fijan las dos mitades de eso: que por defecto NO mire el detalle, y que
// cuando se lo pide explícitamente SÍ lo mire.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTarea, resumenCampos, coincide, CAMPOS, CAMPOS_TODOS, CAMPOS_POR_DEFECTO } from '../lib/buscar-tareas';

const T = {
  num: 412,
  title: 'Reescribir el copy de la landing',
  detalle: '**Por qué**\nEl semáforo de seguridad pinta verde por falta de datos.',
  notas: 'hablar con Mauricio antes',
  scoreRazon: 'Le gana a «BYOK de verdad» porque trae cash directo',
  deadlineRazon: 'Cae en la franja de prioridad Media',
  checklist: [{ text: 'Medir la retención del VSL' }, { text: 'Aprobar con el cliente' }],
};

test('EL PEDIDO: por defecto NO busca en el detalle', () => {
  assert.equal(matchTarea(T, 'landing'), true);          // está en el título
  assert.equal(matchTarea(T, 'semáforo'), false);        // está SOLO en el detalle
  assert.equal(matchTarea(T, 'Mauricio'), false);        // solo en las notas
  assert.equal(matchTarea(T, 'retención'), false);       // solo en la checklist
  assert.equal(matchTarea(T, 'BYOK'), false);            // solo en la razón del score
});

test('…y con la búsqueda avanzada sí, campo por campo', () => {
  assert.equal(matchTarea(T, 'semáforo', ['titulo', 'detalle']), true);
  assert.equal(matchTarea(T, 'Mauricio', ['titulo', 'notas']), true);
  assert.equal(matchTarea(T, 'retención', ['titulo', 'checklist']), true);
  assert.equal(matchTarea(T, 'BYOK', ['titulo', 'razones']), true);
  // Elegir un campo NO arrastra a los otros: pedir «detalle» no trae la checklist.
  assert.equal(matchTarea(T, 'retención', ['titulo', 'detalle']), false);
});

test('el #número se busca SIEMPRE, aunque el título no coincida', () => {
  assert.equal(matchTarea(T, '#412'), true);
  assert.equal(matchTarea(T, '412'), true);
  assert.equal(matchTarea(T, '#413'), false);
  // Y no depende de los campos: es un atajo a una tarea puntual, no una búsqueda.
  assert.equal(matchTarea(T, '#412', []), true);
});

test('busca por palabras en cualquier orden, sin acentos', () => {
  assert.equal(matchTarea(T, 'landing copy'), true);   // invertidas
  assert.equal(matchTarea(T, 'COPY'), true);           // mayúsculas
  assert.equal(matchTarea(T, 'reescribir landing'), true);
  assert.equal(coincide('Añadí el botón', 'anadi boton'), true);
});

test('sin campos activos no hay resultados, y una búsqueda vacía los trae todos', () => {
  assert.equal(matchTarea(T, 'landing', []), false);
  assert.equal(matchTarea(T, ''), true);
  assert.equal(matchTarea(T, '   '), true);
});

test('el chip dice dónde se está buscando', () => {
  assert.equal(resumenCampos(CAMPOS_POR_DEFECTO), 'Título');
  assert.equal(resumenCampos(CAMPOS_TODOS), 'Todos los campos');
  assert.equal(resumenCampos(['titulo', 'detalle']), 'Título y 1 más');
  assert.equal(resumenCampos([]), 'Ningún campo');
});

test('los campos sirven para los dos tableros (title y titulo)', () => {
  // El del dueño usa `title`; el de los clientes, `titulo`. Un solo buscador para los dos.
  assert.equal(matchTarea({ titulo: 'Conectar Meta Ads' }, 'meta'), true);
  assert.equal(matchTarea({ title: 'Conectar Meta Ads' }, 'meta'), true);
  // Y la checklist de los clientes guarda `texto`, no `text`.
  assert.equal(matchTarea({ titulo: 'x', checklist: [{ texto: 'pixel' }] }, 'pixel', ['checklist']), true);
});

test('cada campo declara su etiqueta y su ayuda (los pinta el panel)', () => {
  for (const c of CAMPOS) {
    assert.ok(c.label.length > 0, `${c.id} sin label`);
    assert.ok(c.ayuda.length > 0, `${c.id} sin ayuda`);
    assert.equal(typeof c.texto({}), 'string', `${c.id} no devuelve string con una tarea vacía`);
  }
});
