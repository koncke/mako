// =============================================================================
// lead_respuestas — la idempotencia es por CONTENIDO, y el resumen del lead las LEE
// =============================================================================
// (El resumen: más abajo, en «El resumen del lead».)
//
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
import { yaGuardado, respuestasDelResumen } from '../lib/lead-respuestas';

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
  // que parecía obvio— fallan 2 de 8 (este y el del reagendado, que también pregunta por un set
  // igual): todo reintento del webhook insertaría otra fila.
  assert.equal(yaGuardado([{ respuestas: comoVuelve(SET) }], SET), true);
  assert.notEqual(JSON.stringify(comoVuelve(SET)), JSON.stringify(SET), 'la premisa: como texto, los dos sets NO son iguales');
});

test('un reagendado el mismo día con respuestas distintas SÍ se guarda', () => {
  // Rotura (09/10/2026): con `yaGuardado` devolviendo `filas.length > 0` (la idempotencia por fecha
  // de antes) → fallan 2 de 8 (este y el de las filas raras): el «Motivo del cambio» no llegaba
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
  // falla este test (1 de 8); los otros 7 siguen verdes.
  const src = sinComentarios(sinCR(readFileSync(new URL('../lib/leads.ts', import.meta.url), 'utf8')));
  const ini = src.indexOf('export async function saveLeadRespuestas(');
  const fin = src.indexOf('export async function getLeadRespuestas(', ini);
  assert.ok(ini > 0 && fin > ini, 'las dos funciones siguen en lib/leads.ts');
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /\.select\('respuestas'\)/, 'para comparar el contenido hay que traerlo');
  assert.match(cuerpo, /if \(yaGuardado\(/);
  assert.doesNotMatch(cuerpo, /ya\.length\)\s*return/, 'volvió la idempotencia por fecha');
});

// ── El resumen del lead ─────────────────────────────────────────────────────
// El aviso «Nuevo agendado» de Cal.com dice «+N en el resumen» y lleva a /crm/<id>/resumen, igual que
// el recordatorio previo a la llamada. Esa pantalla armaba «Lo que contestó al agendar» SÓLO con las
// seis columnas respuesta_* de Calendly, y Cal.com guarda sus respuestas únicamente en
// `lead_respuestas`: para un lead de Cal.com la sección no salía nunca (09/10/2026).

const CURADAS = [{ pregunta: '¿Qué quiere lograr?', respuesta: 'Escalar a 3 sucursales' }];

test('el resumen de un lead de Cal.com muestra lo que contestó: sale de lead_respuestas', () => {
  // Rotura (09/10/2026): con `respuestasDelResumen` sin la rama de `porReunion` (devolviendo `[]`
  // cuando no hay columnas, que es lo que hacía la pantalla) → fallan 2 de 8 (este y el de la R2).
  assert.deepEqual(respuestasDelResumen([], { R1: SET, R2: [] }), [
    { pregunta: 'Tu Instagram', respuesta: '@lucia.prueba' },
    { pregunta: '¿Hace cuánto que formas parte del rubro inmobiliario?', respuesta: '3 a 6 años' },
  ]);
  assert.deepEqual(respuestasDelResumen([], null), [], 'si la lectura falló, la sección no sale (como antes)');
  assert.deepEqual(respuestasDelResumen([], { R1: [{ q: 'Notas', a: '  ' }], R2: [] }), [], 'una respuesta en blanco no deja «Notas:» suelto');
});

test('con las columnas de Calendly el resumen no cambia: rótulos curados y nada más (ws1)', () => {
  assert.deepEqual(respuestasDelResumen(CURADAS, { R1: SET, R2: SET }), CURADAS);
});

test('la R2 sale con su rótulo, y la misma pregunta en las dos reuniones no se pisa', () => {
  const r = respuestasDelResumen([], { R1: [SET[0]], R2: [SET[0]] });
  assert.deepEqual(r.map((x) => x.pregunta), ['Tu Instagram', 'R2 · Tu Instagram']);
});

test('CABLEADO: getResumenLead lee lead_respuestas cuando no hay columnas, y la pantalla no repite keys', () => {
  // Rotura (09/10/2026): con `const respuestas = legado;` en getResumenLead → falla este test (1 de
  // 8); con el `key={r.pregunta}` de antes en la pantalla → falla este test (1 de 8). Cada rotura,
  // por separado; los otros 7 siguen verdes en las dos.
  const src = sinComentarios(sinCR(readFileSync(new URL('../lib/lead-resumen.ts', import.meta.url), 'utf8')));
  const ini = src.indexOf('export async function getResumenLead(');
  const fin = src.indexOf('export async function textoAvisoPostLlamada(', ini);
  assert.ok(ini > 0 && fin > ini, 'getResumenLead sigue en lib/lead-resumen.ts');
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /legado\.length \? Promise\.resolve\(null\) : getLeadRespuestas\(lead\)/, 'sin columnas, se leen las de lead_respuestas');
  assert.match(cuerpo, /const respuestas = respuestasDelResumen\(legado, porReunion\);/);
  assert.match(cuerpo, /^\s*respuestas,$/m, 'lo que se devuelve es lo que armó respuestasDelResumen');

  const pagina = sinCR(readFileSync(new URL('../app/crm/[id]/resumen/page.tsx', import.meta.url), 'utf8'));
  const seccion = pagina.slice(pagina.indexOf('titulo="Lo que contestó al agendar"'), pagina.indexOf('titulo="De dónde vino"'));
  assert.ok(seccion.length > 0 && seccion.length < 600, `la sección se recortó mal (${seccion.length} caracteres)`);
  assert.match(seccion, /respuestas\.map\(\(r, i\) => <Dato key=\{`\$\{i\}:\$\{r\.pregunta\}`\}/, 'la R1 y la R2 pueden repetir la pregunta: el key lleva el índice');
});
