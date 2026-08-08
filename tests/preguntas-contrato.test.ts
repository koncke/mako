// El contrato de las preguntas del Perro: que el TIPO y el CAMPO se correspondan.
//
// Cada caso de acá salió de una pantalla real que el dueño reportó. Las reglas
// vivían en la prosa de cinco prompts y no había una sola línea que las validara;
// por eso el mismo bug volvió después de estar documentado. Estos tests son la
// diferencia entre una regla escrita y una regla que se cumple.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearPregunta, apuntarSobre, ayudaDePregunta, explicaLaEscala, pideFecha } from '../lib/preguntas-contrato';
import { corregirMarca } from '../lib/mako-gramatica';

// ── El caso de las capturas ───────────────────────────────────────────────────

test('una pregunta de deadline NO puede quedar como escala 1-5', () => {
  const q = sanearPregunta({ pregunta: '¿Cuál es el deadline para tener los ángulos listos y empezar a producir los primeros vídeos?', tipo: 'escala' });
  assert.ok(q);
  assert.equal(q.tipo, 'fecha', 'tiene que ir al calendario, no a una intensidad');
});

test('escala CON opciones: ganan las opciones, no el token del tipo', () => {
  const q = sanearPregunta({ pregunta: '¿Para cuándo se necesita el video de bienvenida?', tipo: 'escala', opciones: ['15 de agosto', 'Fin de mes', 'Sin fecha'] });
  assert.ok(q);
  assert.equal(q.tipo, 'opcion');
  // Lo que se perdía antes: las tres respuestas concretas se tiraban a la basura
  // y en pantalla quedaban cinco números pelados.
  assert.deepEqual(q.opciones, ['15 de agosto', 'Fin de mes', 'Sin fecha']);
});

test('una escala que SÍ explica sus extremos se respeta, y sin opciones', () => {
  const q = sanearPregunta({ pregunta: '¿Qué tan firme es esa fecha? (1 = es una idea, 5 = ya está comprometida)', tipo: 'escala', opciones: ['poco', 'mucho'] });
  assert.ok(q);
  // Con 2+ opciones gana la lista: es lo correcto, porque «poco/mucho» ES contestable.
  assert.equal(q.tipo, 'opcion');
  const limpia = sanearPregunta({ pregunta: '¿Qué tan firme es esa fecha? (1 = es una idea, 5 = ya está comprometida)', tipo: 'escala' });
  assert.ok(limpia);
  assert.equal(limpia.tipo, 'escala');
  assert.deepEqual(limpia.opciones, []);
});

test('una escala sin explicar los extremos no es una escala', () => {
  const q = sanearPregunta({ pregunta: '¿Qué tan seguido te piden integrar su propio agente?', tipo: 'escala' });
  assert.ok(q);
  assert.notEqual(q.tipo, 'escala', 'un 3 sin unidad no significa nada');
  assert.equal(q.tipo, 'texto');
});

// ── Coherencia tipo ↔ opciones, en las dos direcciones ────────────────────────

test('opcion sin opciones se degrada a algo contestable', () => {
  assert.equal(sanearPregunta({ pregunta: '¿Qué herramienta vas a usar?', tipo: 'opcion' })?.tipo, 'texto');
  // …y si lo que pide es una fecha, al calendario, no a un textarea.
  assert.equal(sanearPregunta({ pregunta: '¿Para cuándo lo necesitás?', tipo: 'opcion' })?.tipo, 'fecha');
});

test('comparacion exige exactamente dos', () => {
  assert.equal(sanearPregunta({ pregunta: '¿Cuál pesa más?', tipo: 'comparacion', opciones: ['A', 'B'] })?.tipo, 'comparacion');
  assert.equal(sanearPregunta({ pregunta: '¿Cuál pesa más?', tipo: 'comparacion', opciones: ['A', 'B', 'C'] })?.tipo, 'opcion');
  assert.equal(sanearPregunta({ pregunta: '¿Cuál pesa más?', tipo: 'comparacion', opciones: ['A'] })?.tipo, 'opcion');
});

test('un tipo desconocido no rompe ni inventa un campo que no se puede contestar', () => {
  assert.equal(sanearPregunta({ pregunta: '¿Y esto?', tipo: 'ranking', opciones: ['a', 'b'] })?.tipo, 'opcion');
  assert.equal(sanearPregunta({ pregunta: '¿Y esto?', tipo: 'ranking' })?.tipo, 'texto');
});

test('una pregunta con buenas opciones de fecha se queda como opcion', () => {
  // No hay que mandar TODO lo que huela a fecha al calendario: si el modelo ya dio
  // respuestas concretas, ésas son mejores que un date picker en blanco.
  const q = sanearPregunta({ pregunta: '¿Para cuándo tiene que estar la estrategia?', tipo: 'opcion', opciones: ['Esta semana', 'Próximos 15 días', 'Sin fecha fija'] });
  assert.equal(q?.tipo, 'opcion');
});

test('la pregunta vacía no pasa', () => {
  assert.equal(sanearPregunta({ pregunta: '   ', tipo: 'opcion', opciones: ['a'] }), null);
  assert.equal(sanearPregunta(null), null);
});

test('detectores', () => {
  assert.ok(pideFecha('¿Para cuándo lo tenés?'));
  assert.ok(pideFecha('¿Cuál es el deadline?'));
  assert.ok(!pideFecha('¿Qué herramienta usás?'));
  assert.ok(explicaLaEscala('(1 = es una idea, 5 = ya está comprometido)'));
  assert.ok(!explicaLaEscala('¿Qué tan firme es?'));
});

// ── El chip «Por: …» ──────────────────────────────────────────────────────────

test('re-apunta el chip cuando el modelo señaló la tarea equivocada', () => {
  // Caso real, borrador propmskgpno0rxldp: la pregunta hablaba de la capacitación
  // del equipo y el chip mostraba la tarea de rediseñar funnels.
  const titulos = [
    'Rediseñar estructura de funnels en MaKo para soportar múltiples productos y funnels por producto',
    'Configurar plantillas de funnels por tipo (TOFU) en MaKo',
    'Capacitar al equipo en la nueva estructura de funnels y productos',
  ];
  const sobre = apuntarSobre('¿Cuál es el presupuesto asignado para la capacitación del equipo?', [titulos[0]], titulos);
  assert.deepEqual(sobre, [titulos[2]]);
});

test('si el chip ya apunta bien, no se toca', () => {
  const titulos = ['Configurar el pixel de Meta en el dominio nuevo', 'Grabar el video de bienvenida'];
  assert.deepEqual(apuntarSobre('¿El pixel de Meta bloquea el lanzamiento?', [titulos[0]], titulos), [titulos[0]]);
});

test('sin ninguna tarea que coincida, mejor sin chip que con uno que miente', () => {
  const titulos = ['Configurar el pixel de Meta', 'Grabar el video de bienvenida'];
  assert.equal(apuntarSobre('¿Cuánto factura el negocio por mes?', [titulos[0]], titulos), undefined);
});

// ── La ayuda de abajo del enunciado ───────────────────────────────────────────

test('la ayuda cambia con el tipo (no dice «elegí una opción» sobre una escala)', () => {
  assert.notEqual(ayudaDePregunta('escala'), ayudaDePregunta('opcion'));
  assert.match(ayudaDePregunta('escala'), /1 al 5/);
  assert.match(ayudaDePregunta('fecha'), /fecha/i);
  assert.match(ayudaDePregunta('multi'), /varias/i);
});

// ── Cómo se escribe la marca ──────────────────────────────────────────────────

test('«Maco» de una transcripción se corrige a MaKo', () => {
  assert.equal(corregirMarca('Configurar plantillas de funnels por tipo (TOFU) en Maco'), 'Configurar plantillas de funnels por tipo (TOFU) en MaKo');
  assert.equal(corregirMarca('subilo a mako y a MACO'), 'subilo a MaKo y a MaKo');
});

test('no toca nombres de persona ni palabras que empiezan igual', () => {
  assert.equal(corregirMarca('Hablar con Marco el martes'), 'Hablar con Marco el martes');
  assert.equal(corregirMarca('el estilo makoto'), 'el estilo makoto');
});
