// =============================================================================
// lead_respuestas — la idempotencia es por CONTENIDO, no por fecha
// =============================================================================
// `saveLeadRespuestas` (lib/leads.ts) guarda el set del formulario de una reserva, de Calendly y de
// Cal.com. Hasta el 09/10/2026 no guardaba nada si ya había una fila del mismo (lead, reunión, DÍA):
// `evento_inicio` es un `date`, así que un reagendado el mismo día (10:00 → 15:00) o cancelar y
// volver a reservar dejaban la ficha con el set viejo mientras el aviso mostraba el nuevo.
//
// La decisión vive en `yaGuardado` (lib/lead-respuestas.ts, sin `server-only` para que este test la
// pueda importar). Probado ROMPIENDO cada pieza (09/10/2026), el resultado en cada test.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yaGuardado } from '../lib/lead-respuestas';

const sinCR = (s: string) => s.replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '') // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después

const SET = [
  { q: 'Tu Instagram', a: '@lucia.prueba' },
  { q: '¿Hace cuánto que formas parte del rubro inmobiliario?', a: '3 a 6 años' },
];

/**
 * El set como lo DEVUELVE la base: un `jsonb` no conserva el orden de las claves y saca `a` antes
 * que `q` (medido contra prod sobre un literal, 09/10/2026: `[{"a": "Respuesta", "q": "Pregunta"}]`).
 */
const comoVuelve = (s: Array<{ q: string; a: string }>) => s.map(({ q, a }) => ({ a, q }));

test('el reintento del webhook (mismo set) no duplica, aunque la base devuelva las claves en otro orden', () => {
  // Rotura (09/10/2026): con `yaGuardado` comparando `JSON.stringify` de los dos lados —el arreglo
  // que parecía obvio— fallan 2 de 4 (este y el del reagendado, que también pregunta por un set
  // igual): todo reintento del webhook insertaría otra fila.
  assert.equal(yaGuardado([{ respuestas: comoVuelve(SET) }], SET), true);
  assert.notEqual(JSON.stringify(comoVuelve(SET)), JSON.stringify(SET), 'la premisa: como texto, los dos sets NO son iguales');
});

test('un reagendado el mismo día con respuestas distintas SÍ se guarda', () => {
  // Rotura (09/10/2026): con `yaGuardado` devolviendo `filas.length > 0` (la idempotencia por fecha
  // de antes) → fallan 2 de 4 (este y el de las filas raras): el «Motivo del cambio» no llegaba
  // nunca a la ficha.
  const conMotivo = [...SET, { q: 'Motivo del cambio', a: 'Me surgió un viaje' }];
  assert.equal(yaGuardado([{ respuestas: comoVuelve(SET) }], conMotivo), false, 'una respuesta más es un set nuevo');
  const cambiado = [SET[0], { q: SET[1].q, a: '+10 años' }];
  assert.equal(yaGuardado([{ respuestas: comoVuelve(SET) }], cambiado), false, 'una respuesta distinta es un set nuevo');
  // Entre varias filas del mismo día alcanza con que UNA sea igual (el reintento del reagendado).
  assert.equal(yaGuardado([{ respuestas: comoVuelve(SET) }, { respuestas: comoVuelve(conMotivo) }], conMotivo), true);
});

test('sin filas, o con filas que no son un set, no hay nada guardado', () => {
  assert.equal(yaGuardado([], SET), false);
  assert.equal(yaGuardado([{ respuestas: null }, { respuestas: 'no soy una lista' }, { respuestas: [null, 3] }], SET), false);
});

test('CABLEADO: saveLeadRespuestas decide con yaGuardado sobre el CONTENIDO, no con «hay una fila»', () => {
  // Rotura (09/10/2026): devolviendo el `select('id')` + `if (ya && ya.length) return;` de antes →
  // falla este test (1 de 4); los otros 3 siguen verdes.
  const src = sinComentarios(sinCR(readFileSync(new URL('../lib/leads.ts', import.meta.url), 'utf8')));
  const ini = src.indexOf('export async function saveLeadRespuestas(');
  const fin = src.indexOf('export async function getLeadRespuestas(', ini);
  assert.ok(ini > 0 && fin > ini, 'las dos funciones siguen en lib/leads.ts');
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /\.select\('respuestas'\)/, 'para comparar el contenido hay que traerlo');
  assert.match(cuerpo, /if \(yaGuardado\(/);
  assert.doesNotMatch(cuerpo, /ya\.length\)\s*return/, 'volvió la idempotencia por fecha');
});
