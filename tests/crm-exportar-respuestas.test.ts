// =============================================================================
// El export de leads del CRM lleva lo que contestó cada lead: una columna por pregunta (ticket 106, 17/11/2026)
// =============================================================================
// Codigo Inmobiliario (ws 13): «cuando quiero descargar del CRM los leads, no me descarga las respuestas del formulario».
// Medido en producción ese día: 60 de sus 111 leads tienen respuestas en `lead_respuestas` (Cal.com), y el grupo
// «Respuestas del formulario» del export leía seis columnas fijas de Calendly que en el ws 13 están en NULL. El archivo salía
// con seis columnas vacías y sin un error. Lo que fija este archivo:
//
//   1. Un lead del ws 13 (su formulario de verdad) sale con UNA COLUMNA POR PREGUNTA, la pregunta entera de rótulo.
//   2. Un lead del ws 1 con las columnas de Calendly: la regla del resumen (rótulos curados, sin repetir la agenda cruda),
//      más lo que contestó en el formulario de Meta, que tampoco salía.
//   3. Formularios distintos en un mismo archivo: las columnas son la unión, en el orden en que aparecen, y una pregunta
//      que un lead no contestó queda vacía en su fila.
//   4. La misma pregunta en dos lugares no sale dos veces; la de la R2 lleva «R2 · ».
//   5. De `lead_respuestas`, el último set de cada reunión.
//   6. Los rótulos de las columnas de Calendly son los curados: ninguno de los dos que invertían el sentido.
//   7. El export arma las columnas de los datos: ninguna lista fija de preguntas en el catálogo.
//
// PROBADO ROMPIÉNDOLO (17/11/2026), cada rotura sola y vuelta atrás:
//   a. `respuestasDeFila` sin la agenda (sólo el legado)                        → fallan 1, 3 y 4.
//   b. sin `respuestasPropias` (el formulario de Meta)                           → falla 2.
//   c. `claveDe` sin pasar a minúsculas                                          → falla 4.
//   d. `agendaPorLead` quedándose con el set MÁS VIEJO                            → falla 5.
//   e. `PREGUNTAS_CALENDLY` con «¿Es el decisor?» de vuelta                       → fallan 2 y 6.
//   f. `respuestas: PREGUNTAS_FORM…` de vuelta en COLUMNAS_POR_CAMPO              → falla 7.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agendaPorLead, columnasDeRespuestas, respuestasDeFila } from '../app/crm/leads-exportar-respuestas';
import { COLUMNAS_POR_CAMPO, tablaDeLeads } from '../app/crm/leads-exportar';
import { PREGUNTAS_CALENDLY } from '../lib/lead-respuestas';

// Las preguntas del formulario de Cal.com del ws 13, tal como están guardadas (medido el 17/11/2026).
const WS13 = {
  instagram: 'Tu Instagram',
  agente: 'Actualmente soy agente o tengo una inmobiliaria en funcionamiento',
  rubro: '¿Hace cuánto que formas parte del rubro inmobiliario?',
};
const leadWs13 = { id: 501, nombre: 'Ana', respuesta_objetivo: null, respuesta_decisor: null, meta_field_data: null, optin_respuestas: null };
const agendaWs13 = { R1: [{ q: WS13.instagram, a: '@ana.props' }, { q: WS13.agente, a: 'Sí' }, { q: WS13.rubro, a: 'Más de 5 años' }], R2: [] };

test('1. un lead del ws 13 sale con una columna por pregunta de SU formulario', () => {
  const rs = respuestasDeFila(leadWs13, agendaWs13);
  const { columnas, valores } = columnasDeRespuestas([rs]);
  assert.deepEqual(columnas.map(([, r]) => r), [WS13.instagram, WS13.agente, WS13.rubro]);
  const fila = { id: 501, nombre: 'Ana', ...valores[0] };
  const tabla = tablaDeLeads([['id', 'ID'], ['nombre', 'Nombre'], ...columnas], [fila]);
  assert.deepEqual(tabla, [['ID', 'Nombre', WS13.instagram, WS13.agente, WS13.rubro], [501, 'Ana', '@ana.props', 'Sí', 'Más de 5 años']]);
});

test('2. un lead del ws 1: las columnas de Calendly con su rótulo curado, y lo que contestó en el formulario de Meta', () => {
  const lead = {
    id: 9, respuesta_objetivo: 'Ordenar el equipo', respuesta_decisor: 'No',
    meta_field_data: [
      { name: 'full_name', values: ['Juan'] }, { name: 'email', values: ['j@x.com'] },
      { name: '¿cuál_describe_mejor_tu_rol?', values: ['dueño'] },
    ],
    optin_respuestas: null,
  };
  // La agenda cruda del mismo lead NO se repite: con las columnas de Calendly puestas, manda el legado (como el resumen).
  const rs = respuestasDeFila(lead, { R1: [{ q: '¿Que quieres lograr en caso de decidir implementar este sistema?', a: 'Ordenar el equipo' }], R2: [] });
  assert.deepEqual(rs.map((r) => r.pregunta), ['¿Qué quiere lograr?', '¿Alguien más participa en la decisión?', '¿Cuál describe mejor tu rol?']);
  assert.equal(rs.find((r) => /rol/.test(r.pregunta))?.respuesta, 'Dueño');
  assert.ok(!rs.some((r) => /full_name|email|nombre/i.test(r.pregunta)), 'el nombre y el email ya tienen su columna');
});

test('3. dos formularios en el mismo archivo: la unión de las preguntas, y vacío donde no contestó', () => {
  const a = respuestasDeFila(leadWs13, agendaWs13);
  const b = respuestasDeFila({ id: 7, optin_respuestas: [{ pregunta: '¿Qué zona buscás?', respuesta: 'Palermo' }, { pregunta: WS13.instagram, respuesta: '@beto' }] }, null);
  const { columnas, valores } = columnasDeRespuestas([a, b]);
  assert.deepEqual(columnas.map(([, r]) => r), [WS13.instagram, WS13.agente, WS13.rubro, '¿Qué zona buscás?']);
  const tabla = tablaDeLeads(columnas, valores);
  assert.deepEqual(tabla[2], ['@beto', '', '', 'Palermo']);
});

test('4. la misma pregunta en dos lugares sale una vez; la de la R2 lleva «R2 · »', () => {
  const rs = respuestasDeFila(
    { id: 3, optin_respuestas: [{ pregunta: '  tu   INSTAGRAM ', respuesta: '@otra' }] },
    { R1: [{ q: WS13.instagram, a: '@ana' }], R2: [{ q: WS13.instagram, a: '@ana.r2' }] },
  );
  assert.deepEqual(rs, [{ pregunta: WS13.instagram, respuesta: '@ana' }, { pregunta: `R2 · ${WS13.instagram}`, respuesta: '@ana.r2' }]);
});

test('5. de lead_respuestas queda el último set de cada reunión (vienen de la más nueva a la más vieja)', () => {
  const m = agendaPorLead([
    { lead_id: 1, reunion: 'R1', respuestas: [{ q: 'P', a: 'nueva' }] },
    { lead_id: 1, reunion: 'R2', respuestas: [{ q: 'P', a: 'r2' }] },
    { lead_id: 1, reunion: 'R1', respuestas: [{ q: 'P', a: 'vieja' }] },
    { lead_id: '2', reunion: 'R1', respuestas: [{ q: 'X', a: 'y' }, { basura: true }] },
    { lead_id: 3, reunion: 'R9', respuestas: [{ q: 'X', a: 'y' }] },
  ]);
  assert.deepEqual(m.get(1), { R1: [{ q: 'P', a: 'nueva' }], R2: [{ q: 'P', a: 'r2' }] });
  assert.deepEqual(m.get(2), { R1: [{ q: 'X', a: 'y' }], R2: [] });
  assert.equal(m.has(3), false);
});

test('6. los rótulos de Calendly son los curados (lib/lead-resumen.ts): ninguno de los que invertían el sentido', () => {
  const rotulos = PREGUNTAS_CALENDLY.map((p) => p.pregunta);
  assert.equal(PREGUNTAS_CALENDLY.find((p) => p.campo === 'respuesta_decisor')?.pregunta, '¿Alguien más participa en la decisión?');
  for (const malo of ['¿Es el decisor?', 'Facturación mensual actual', '¿A qué se dedica?']) assert.ok(!rotulos.includes(malo), malo);
  assert.equal(rotulos.length, 6);
});

test('7. el catálogo no trae una lista fija de preguntas: las columnas salen de los datos', () => {
  assert.deepEqual(COLUMNAS_POR_CAMPO.respuestas, []);
  const accion = readFileSync(new URL('../app/crm/actions.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(accion, /PREGUNTAS_FORM/);
  assert.match(accion, /if \(dondeVanRespuestas >= 0\) await ponerRespuestas\(filas, columnas, dondeVanRespuestas\);/);
});
