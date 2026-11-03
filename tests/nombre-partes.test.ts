// =============================================================================
// Con qué nombre se saluda: nunca «Hola MX» ni «Hola 5491155550002» (31/10/2026)
// =============================================================================
// Llamada con Leila (30/10): «MX Nadia Calderón», «Kun Fabiola Pedraza». Martín: «yo voy a poner una opción». Si no se puede saber, no se inventa.
//
// Correr: node --import tsx --test tests/nombre-partes.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (ver docs/hallazgos-crm.md, «El nombre con que se saluda»).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partesDelNombre as p, noSonDeSetting, normalizarNoSon, resumenDeNombres, sinNombresVacios } from '../lib/nombre-partes';
import { aplicarVariables, valoresVariablesLead } from '../lib/template-vars';

const nombre = (s: string | null, ...no: string[]) => p(s, new Set(normalizarNoSon(no))).nombre;

test('1. lo que seguro no es un nombre se salta: códigos, títulos, corchetes, dígitos, emojis', () => {
  assert.equal(nombre('MX Nadia Calderón'), 'Nadia');
  assert.equal(nombre('PERÚ Rosa Díaz'), 'Rosa');
  assert.equal(nombre('[COL] Marta Ruiz'), 'Marta');
  assert.equal(nombre('(Bogotá) Marta Ruiz'), 'Marta', 'entre paréntesis es una aclaración');
  assert.equal(nombre('MX|Nadia'), 'Nadia');
  assert.equal(nombre('Dra. Paula Gómez'), 'Paula');
  assert.equal(nombre('🌸 Nadia'), 'Nadia');
  assert.equal(nombre('2 Laura Pérez'), 'Laura');
  assert.equal(nombre('Laura 2'), 'Laura');
  assert.equal(nombre('Ana Pérez'), 'Ana');
});

test('2. lo que no se puede saber no se inventa', () => {
  assert.equal(nombre('5491155550002'), null, 'un teléfono no saluda');
  assert.equal(nombre('+52 1 55 1234 5678'), null);
  assert.equal(nombre('MX'), null, 'sólo el código');
  assert.equal(nombre(''), null);
  assert.equal(nombre(null), null);
  assert.equal(nombre('😀'), null);
  assert.equal(nombre('.'), null);
  assert.equal(nombre('A'), null, 'una letra no es un nombre');
});

test('3. un nombre real no se rompe: mayúsculas, compuestos y nombres cortos', () => {
  assert.equal(nombre('ANA LOPEZ'), 'Ana', 'en mayúsculas toda la fila: no hay sigla');
  assert.equal(nombre('IVY STONE'), 'Ivy', 'en mayúsculas toda la fila, tampoco con uno que no está en la lista');
  assert.equal(nombre('ANA Lopez'), 'Ana', 'nombre corto conocido');
  assert.equal(nombre('LUIS Pérez'), 'Luis');
  assert.equal(nombre('nadia calderón'), 'Nadia');
  assert.equal(nombre('Ana-María Ruiz'), 'Ana-María');
  assert.equal(nombre('McKenzie Ruiz'), 'McKenzie');
  assert.equal(nombre('Dra'), 'Dra', 'sola, un título puede ser lo único que hay');
  assert.equal(nombre('Clínica 24 h'), 'Clínica');
  const c = p('MX NADIA Calderón');
  assert.equal(c.nombre, 'Nadia', 'código conocido, aunque toda la fila esté en mayúsculas');
  assert.equal(c.completo, 'Nadia Calderón');
  assert.equal(c.apellido, 'Calderón');
});

test('4. lo que sólo el negocio sabe: «Kun»', () => {
  assert.equal(nombre('Kun Fabiola Pedraza'), 'Kun', 'sola no se puede saber');
  assert.equal(nombre('Kun Fabiola Pedraza', 'Kun'), 'Fabiola');
  assert.equal(nombre('KUN Fabiola Pedraza', 'kun'), 'Fabiola');
  assert.equal(nombre('Kun', 'Kun'), null, 'marcada y sola: sin nombre');
  assert.deepEqual([...noSonDeSetting('["Kun","  kun ","Ñandú"]')], ['kun', 'nandu']);
  assert.deepEqual([...noSonDeSetting('roto')], []);
  assert.deepEqual([...noSonDeSetting(null)], []);
});

test('5. la opción que pidió Martín: la palabra en esa posición, tal como está', () => {
  const k = p('Kun Fabiola Pedraza');
  assert.equal(k.segunda, 'Fabiola');
  assert.equal(k.tercera, 'Pedraza');
  const m = p('MX Nadia Calderón');
  assert.equal(m.segunda, 'Nadia', 'cuenta el código: es la posición tal como se ve');
  assert.equal(p('Nadia').segunda, null);
  assert.equal(p('Ana 2 Ruiz').segunda, 'Ruiz', 'un número no cuenta como palabra');
  assert.equal(p('🌸 MX Nadia').segunda, 'Nadia', 'un emoji no es una palabra');
});

test('6. por el motor: las variables nuevas, y un teléfono no saluda', () => {
  const v = valoresVariablesLead({ nombre: 'MX Nadia Calderón' });
  assert.equal(v.nombre, 'Nadia');
  assert.equal(v.nombre_completo, 'Nadia Calderón');
  assert.equal(v.apellido, 'Calderón');
  assert.equal(v.segundo_nombre, 'Nadia');
  assert.equal(v.tercer_nombre, 'Calderón');
  const t = valoresVariablesLead({ nombre: '5491155550002' });
  assert.equal(t.nombre, '');
  assert.equal(t.nombre_completo, '');
  assert.equal(aplicarVariables('Hola {{nombre}}, ¿cómo estás?', t), 'Hola, ¿cómo estás?');
  const k = valoresVariablesLead({ nombre: 'Kun Fabiola Pedraza' }, { noSon: new Set(['kun']) });
  assert.equal(aplicarVariables('Hola {{nombre}}', k), 'Hola Fabiola');
  // Al EQUIPO se le muestra como está: un teléfono o el código le sirven para saber quién es.
  const e = valoresVariablesLead({ nombre: '5491155550002' }, { paraEquipo: true });
  assert.equal(e.nombre_completo, '5491155550002');
  assert.equal(valoresVariablesLead({ nombre: 'MX Nadia' }, { paraEquipo: true }).nombre_completo, 'MX Nadia');
});

test('7. un nombre vacío no deja el mensaje cojo', () => {
  const v = { nombre: '' };
  const ok = (a: string, b: string) => assert.equal(aplicarVariables(a, v), b);
  ok('Hola {{nombre}}, ¿cómo estás?', 'Hola, ¿cómo estás?');
  ok('¡Hola {{nombre}}!', '¡Hola!');
  ok('Hola {{nombre}}', 'Hola');
  ok('Hola, {{nombre}}.', 'Hola.');
  ok('{{nombre}}, te escribo por la Academia', 'Te escribo por la Academia');
  ok('Hola {{nombre}} cómo estás', 'Hola cómo estás');
  ok('Hola {nombre}, ¿cómo estás?', 'Hola, ¿cómo estás?');
  ok('Hola {{ nombre }}, ¿cómo estás?', 'Hola, ¿cómo estás?');
  ok('Hola {{nombre}}\n\nTe escribo', 'Hola\n\nTe escribo');
  ok('¡{{nombre}}!\nTe escribo', '\nTe escribo');
  // Con valor, o sin la clave, no se toca.
  assert.equal(sinNombresVacios('Hola {{nombre}}, sí', { nombre: 'Ana' }), 'Hola {{nombre}}, sí');
  assert.equal(sinNombresVacios('Hola {{nombre}}, sí', {}), 'Hola {{nombre}}, sí');
  assert.equal(aplicarVariables('Hola {{nombre}}', { nombre: 'Ana' }), 'Hola Ana');
});

test('8. el resumen: cuántos sin nombre, y qué palabras se repiten adelante', () => {
  const nombres = ['Kun Fabiola Pedraza', 'Kun Ana Ruiz', 'Kun Rosa Díaz', 'MX Nadia', 'MX Paula', 'MX Marta', '5491155550002', 'Laura Pérez', null];
  const r = resumenDeNombres(nombres, new Set());
  assert.equal(r.total, 9);
  assert.equal(r.sinNombre, 2);
  const kun = r.repetidas.find((x) => x.palabra === 'Kun')!;
  assert.equal(kun.n, 3);
  assert.equal(kun.noEs, false);
  assert.equal(kun.automatica, false);
  assert.equal(kun.ejemploA, 'Kun');
  const mx = r.repetidas.find((x) => x.palabra === 'MX')!;
  assert.equal(mx.automatica, true, 'el código ya se salta solo');
  assert.equal(mx.ejemploA, 'Nadia');
  assert.equal(r.repetidas.find((x) => x.palabra === 'Laura'), undefined, 'una sola vez no dice nada');
  const con = resumenDeNombres(nombres, new Set(['kun']));
  assert.equal(con.repetidas.find((x) => x.palabra === 'Kun')!.noEs, true);
  assert.equal(con.repetidas.find((x) => x.palabra === 'Kun')!.ejemploA, 'Fabiola');
});
