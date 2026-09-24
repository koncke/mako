// =============================================================================
// «Hoy», «esta semana», «este Quarter» — la capa de tiempo del tablero
// =============================================================================
// Decide qué ve alguien cuando pregunta «¿qué me toca hoy?», así que un error acá
// no se ve como un bug: se ve como una tarea que desapareció.
//
// Los dos casos que importan y que ninguna prosa garantiza:
//   · un deadline VENCIDO cuenta como «hoy», no como pasado ni como «más adelante»
//   · `deadline` y `quarter` NO se colapsan: son dos hechos distintos
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuandoDe, contarPorCuando, quartersElegibles, CUANDO_OPS, CUANDO_LABEL } from '../app/plan/board/cuando';

// 2026-09-06 es un DOMINGO. Se elige a propósito: es el día en que la diferencia
// entre «hasta el domingo» y «los próximos 7 días» es máxima.
const HOY = '2026-09-06';

test('EL PEDIDO: un deadline vencido es HOY, no pasado', () => {
  // Algo que venció ayer y sigue abierto es exactamente lo que hay que hacer ahora.
  // Mandarlo a otra ventana lo esconde justo cuando más importa.
  assert.equal(cuandoDe({ deadline: '2026-09-05' }, HOY), 'hoy');
  assert.equal(cuandoDe({ deadline: '2026-01-01' }, HOY), 'hoy');
  assert.equal(cuandoDe({ deadline: HOY }, HOY), 'hoy');
});

test('la semana son los próximos 7 días, no «hasta el domingo»', () => {
  assert.equal(cuandoDe({ deadline: '2026-09-07' }, HOY), 'semana');
  assert.equal(cuandoDe({ deadline: '2026-09-12' }, HOY), 'semana', 'el día 6 todavía es esta semana');
  assert.equal(cuandoDe({ deadline: '2026-09-13' }, HOY), 'quarter', 'el día 7 ya no');
});

test('lo que vence dentro del Q es «este Quarter»; lo de después, «más adelante»', () => {
  assert.equal(cuandoDe({ deadline: '2026-09-30' }, HOY), 'quarter', 'último día del Q3');
  assert.equal(cuandoDe({ deadline: '2026-10-01' }, HOY), 'despues', 'primer día del Q4');
});

test('sin deadline manda el quarter planificado', () => {
  assert.equal(cuandoDe({ quarter: '2026-Q3' }, HOY), 'quarter');
  assert.equal(cuandoDe({ quarter: '2026-Q4' }, HOY), 'despues');
  assert.equal(cuandoDe({ quarter: '2027-Q1' }, HOY), 'despues');
});

test('un Quarter YA PASADO sin deadline es HOY: quedó sin hacer', () => {
  // Misma regla que el deadline vencido. Si se fuera a «más adelante» quedaría
  // escondida para siempre, que es la peor salida posible para algo atrasado.
  assert.equal(cuandoDe({ quarter: '2026-Q2' }, HOY), 'hoy');
  assert.equal(cuandoDe({ quarter: '2025-Q4' }, HOY), 'hoy');
});

test('EL PEDIDO: el deadline le gana al quarter, no se promedian', () => {
  // Son dos hechos distintos: el deadline dice cuándo VENCE y el quarter cuándo se
  // planificó HACERLO. Lo que decide la ventana es lo más urgente de los dos.
  assert.equal(cuandoDe({ deadline: HOY, quarter: '2026-Q4' }, HOY), 'hoy');
  assert.equal(cuandoDe({ deadline: '2026-12-20', quarter: '2026-Q3' }, HOY), 'despues');
});

test('sin ninguno de los dos, la tarea está SIN PLANIFICAR — no en una ventana', () => {
  assert.equal(cuandoDe({}, HOY), 'sin-fecha');
  assert.equal(cuandoDe({ deadline: '', quarter: null }, HOY), 'sin-fecha');
  assert.equal(cuandoDe({ deadline: '   ' }, HOY), 'sin-fecha', 'un deadline de espacios no es un deadline');
});

test('un quarter con formato inválido NO tira ni inventa ventana', () => {
  // Llega de la base, así que puede ser cualquier cosa que haya escrito un script
  // viejo. Cae en `sin-fecha`, que es lo honesto: no se sabe cuándo.
  for (const malo of ['Q3', '2026-Q9', 'proximo', '']) {
    assert.equal(cuandoDe({ quarter: malo }, HOY), 'sin-fecha', `quarter inválido: "${malo}"`);
  }
});

test('contarPorCuando reparte cada tarea en exactamente una ventana', () => {
  const tareas = [
    { deadline: '2026-09-01' },              // vencida → hoy
    { deadline: HOY },                       // hoy
    { deadline: '2026-09-09' },              // semana
    { deadline: '2026-09-25' },              // quarter
    { deadline: '2026-11-01' },              // despues
    { quarter: '2026-Q3' },                  // quarter
    {},                                      // sin-fecha
  ];
  const c = contarPorCuando(tareas, HOY);
  assert.deepEqual(c, { hoy: 2, semana: 1, quarter: 2, despues: 1, 'sin-fecha': 1 });
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), tareas.length, 'ninguna se cuenta dos veces ni se pierde');
});

test('el filtro no ofrece «más adelante»: es justo lo que no hay que mirar hoy', () => {
  assert.ok(!CUANDO_OPS.includes('despues'));
  assert.deepEqual(CUANDO_OPS, ['hoy', 'semana', 'quarter', 'sin-fecha']);
  for (const op of CUANDO_OPS) assert.ok(CUANDO_LABEL[op], `${op} sin rótulo`);
});

test('EL PEDIDO: el selector no ofrece Quarters PASADOS', () => {
  // Planificar algo para un trimestre que ya terminó no es una intención posible.
  // Si apareciera en la lista, alguien lo elegiría por error y la tarea quedaría
  // en una ventana que no existe.
  const ops = quartersElegibles(HOY);
  assert.equal(ops[0].key, '2026-Q3', 'el primero es el Q en curso');
  assert.ok(ops[0].label.includes('(Actual)'), `el rótulo del Q en curso: ${ops[0].label}`);
  assert.ok(!ops.some((o) => o.key < '2026-Q3'), `hay Quarters pasados: ${ops.map((o) => o.key).join(', ')}`);
  // Dos años de ventana: un proyecto se planifica más lejos que una tarea, y el rótulo
  // sale del cálculo, así que cruza de año solo.
  assert.equal(ops.length, 8);
  assert.equal(ops[ops.length - 1].key, '2028-Q2');
  assert.ok(!ops.slice(1).some((o) => o.label.includes('(Actual)')), 'SÓLO el primero es el actual');
});

test('EL QUE YA ESTÁ ELEGIDO ENTRA AUNQUE SEA PASADO (si no, el select lo borra)', () => {
  // Un `<select>` cuyo `value` no matchea ninguna `<option>` no muestra nada: la pantalla
  // dice «Sin asignar» sobre una fila que tiene `2026-Q2` guardado, y el primer click lo
  // pisa. Que no se pueda ELEGIR un trimestre pasado no es lo mismo que esconder el que
  // ya está.
  //
  // ⚠️ Probado ROMPIÉNDOLO: anulando el `unshift` de `quartersElegibles` este archivo da
  // `pass 12 / fail 1` (revienta en la primera aserción, `ops[0].key`); con el arreglo
  // puesto, `pass 13 / fail 0`.
  const ops = quartersElegibles(HOY, 8, '2026-Q2');
  assert.equal(ops[0].key, '2026-Q2', 'el elegido va primero');
  assert.equal(ops[0].label, 'Q2 2026 (pasado)');
  assert.equal(ops[1].key, '2026-Q3', 'y el actual queda detrás');
  assert.equal(ops.length, 9);
  // El que YA está en la ventana no se duplica.
  assert.equal(quartersElegibles(HOY, 8, '2026-Q4').filter((o) => o.key === '2026-Q4').length, 1);
  // Basura no entra: un string libre acá dejaría la fila en una ventana que ninguna vista
  // sabe leer, y el síntoma no es un error — es que desaparece de todos los filtros.
  assert.equal(quartersElegibles(HOY, 8, 'el que viene').length, 8);
  assert.equal(quartersElegibles(HOY, 8, '').length, 8);
});

test('el selector cruza bien el fin de año', () => {
  const ops = quartersElegibles('2026-11-15', 3).map((o) => o.key);
  assert.deepEqual(ops, ['2026-Q4', '2027-Q1', '2027-Q2']);
});
