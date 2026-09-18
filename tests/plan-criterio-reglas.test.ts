// =============================================================================
// El juez del criterio: lo que el modelo NO decide
// =============================================================================
// El criterio de Mauricio (8/9) dice que sin cita literal un compromiso no existe. Acá eso
// deja de ser un pedido en el prompt y pasa a ser código: la cita se busca en la
// transcripción, y la que no está baja la tarea a «descartado» — nunca la borra, porque el
// miedo de Martín con este pedido era justamente que el criterio fuera una forma de tirar
// tareas.
//
// PROBADO ROMPIÉNDOLO (17/9), de a una rotura: sin la bajada a descartado por cita → 1 de
// 12 en rojo (el de la regla 5); sin sacar las marcas `[00:41:09] Nombre:` de la
// transcripción → 1 de 12 en rojo (el de la cita que cruza renglones). Restaurado → 12/12.
// Con la tolerancia de 1 palabra cada 10 (16 tests): con tolerancia 0 → 1 de 16 en rojo (el
// caso real del anexo); con tolerancia 5 → 1 de 16 en rojo (pasa una frase con 3 de 12
// palabras cambiadas). Restaurado → 16/16.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearVeredictos, transcriptParaCitas, citaVerificada, resumenVeredictos, CRITERIO_JUEZ_SYSTEM_TEMPLATE, CRITERIO_JUEZ_USER_TEMPLATE } from '../lib/plan-criterio-reglas';

// Con la fluidez rota del habla real, como las citas del anexo de su documento.
const TRANSCRIPT = [
  '[00:41:02] Mauricio Bustos: Voy a mandarles un video sobre el tema de estos, de estos se llama',
  '[00:41:09] Mauricio Bustos: el cuadrante de los 3X, para que lo vean antes de la próxima.',
  '[00:52:30] Director: Bueno, hay que, digo, yo se los mando, a mí me interesa que lo revisen',
  '[01:03:11] Director: eso lo ve el contador cuando vuelva',
  // Tal cual la transcribió Fathom en la sesión del anexo (3/9): «sabes qué ver haz», sin la «a».
  '[01:10:02] Director: Mándame tú, a lo mejor un correo donde, ¿sabes qué? ver haz todo este pinche trabajo, Director, y mándamelo',
  '[01:10:09] Director: y yo me voy a poner a chandear y te lo voy a mandar porque es lo que falta',
  '[01:10:20] Mauricio Bustos: me mandas eso Mauricio, nomás, yo me pongo y te mando toda la información que necesite',
].join('\n');
const NORM = transcriptParaCitas(TRANSCRIPT);

test('una cita que cruza de un renglón al siguiente se encuentra igual', () => {
  // Fathom parte el turno: con las marcas `[00:41:09] Nombre:` adentro, esto sería un descarte falso.
  assert.ok(citaVerificada('de estos se llama el cuadrante de los 3X', NORM));
});

test('la cita se compara sin acentos, mayúsculas ni puntuación', () => {
  assert.ok(citaVerificada('BUENO hay que digo yo se los mando', NORM));
});

test('EL CASO REAL: dos palabras de diferencia en 34 no tumban la cita', () => {
  // El modelo escribió «¿sabes qué? A ver, haz» donde Fathom transcribió «sabes que ver haz»,
  // y Fathom escribió «chandear» donde se dijo «chambear». Tal cual la cita de la corrida del 17/9.
  assert.ok(citaVerificada('Mándame tú, a lo mejor un correo donde, ¿sabes qué? A ver, haz todo este pinche trabajo, Director, y mándamelo. Y yo me voy a poner a chambear y te lo voy a mandar', NORM));
});

test('más de 1 palabra distinta cada 10 ya no es la misma frase', () => {
  // 12 palabras → tolera 1. Acá hay 3 cambiadas.
  assert.equal(citaVerificada('y yo me voy a poner a trabajar y se lo vamos a entregar', NORM), false);
});

test('dos pedazos separados por «...» valen si CADA uno aparece; uno inventado tumba la cita', () => {
  assert.ok(citaVerificada('Voy a mandarles un video sobre el tema de estos... me mandas eso Mauricio, nomás, yo me pongo', NORM));
  assert.equal(citaVerificada('Voy a mandarles un video sobre el tema de estos... y el lunes te mando el presupuesto firmado', NORM), false);
});

test('coser el principio de una frase con el final de OTRA no pasa, aunque las dos existan', () => {
  // «Bueno, hay que, digo, yo se los mando» (00:52) + «cuando vuelva» (01:03): cada mitad está, pegadas no.
  assert.equal(citaVerificada('Bueno, hay que, digo, yo se los mando eso lo ve el contador cuando vuelva', NORM), false);
});

test('menos de 12 caracteres no prueba nada', () => {
  assert.equal(citaVerificada('yo se los', NORM), false);
});

test('un compromiso con cita que NO está en la transcripción baja a descartado por la regla 5 — no se borra', () => {
  const [v] = sanearVeredictos({ veredictos: [{ i: 0, cubeta: 'compromiso', cita: 'Te mando el reporte el lunes sin falta', razon: 'x' }] }, 1, NORM);
  assert.ok(v);
  assert.equal(v.cubeta, 'descartado');
  assert.equal(v.regla, '5');
  assert.equal(v.degradado, 'cita');
  assert.equal(v.cita, null);
  assert.match(v.razon, /no aparece en la transcripción/); // la cita rechazada queda para revisarla
});

test('un compromiso con cita verificada queda compromiso, con la cita', () => {
  const [v] = sanearVeredictos({ veredictos: [{ i: 0, cubeta: 'compromiso', cita: 'Voy a mandarles un video sobre el tema de estos', razon: 'lo prometió', tema: 'jugadores' }] }, 1, NORM);
  assert.equal(v?.cubeta, 'compromiso');
  assert.equal(v?.estado, 'acordado');
  assert.ok(v?.cita);
});

test('un descartado SIN regla no se completa adivinando: queda sin juzgar', () => {
  const [v] = sanearVeredictos({ veredictos: [{ i: 0, cubeta: 'descartado', cita: 'eso lo ve el contador cuando vuelva', razon: 'x' }] }, 1, NORM);
  assert.equal(v, null);
});

test('«regla 2» y «2» son la misma regla; «contexto» es un motivo válido', () => {
  const vs = sanearVeredictos({ veredictos: [
    { i: 0, cubeta: 'descartado', regla: 'Regla 2', cita: 'eso lo ve el contador cuando vuelva', razon: 'no estuvo' },
    { i: 1, cubeta: 'descartado', regla: 'contexto', cita: null, razon: 'no se sabe quién' },
  ] }, 2, NORM);
  assert.equal(vs[0]?.regla, '2');
  assert.equal(vs[1]?.regla, 'contexto');
  assert.equal(vs[1]?.cita, null); // descartado sin cita verificable sigue descartado
});

test('lo que falta queda SIN JUZGAR (null), no descartado: entra por el camino de siempre', () => {
  const vs = sanearVeredictos({ veredictos: [{ i: 1, cubeta: 'fuera', razon: 'idea' }] }, 3, NORM);
  assert.equal(vs[0], null);
  assert.equal(vs[1]?.cubeta, 'fuera');
  assert.equal(vs[2], null);
  assert.deepEqual(resumenVeredictos(vs), { compromiso: 0, acuerdo_interno: 0, descartado: 0, fuera: 1, sin_juzgar: 2, degradadas: 0 });
});

test('índices fuera de rango, repetidos o cubetas inventadas no pasan', () => {
  const vs = sanearVeredictos({ veredictos: [
    { i: 0, cubeta: 'fuera', razon: 'primero' },
    { i: 0, cubeta: 'compromiso', cita: 'Voy a mandarles un video sobre el tema de estos', razon: 'segundo' },
    { i: 7, cubeta: 'fuera' },
    { i: 1, cubeta: 'tarea' },
  ] }, 2, NORM);
  assert.equal(vs[0]?.razon, 'primero');
  assert.equal(vs[1], null);
});

test('parte_de solo vale con la regla 1 y apuntando a OTRA tarea de la lista', () => {
  const vs = sanearVeredictos({ veredictos: [
    { i: 0, cubeta: 'descartado', regla: '1', parte_de: 1, cita: 'eso lo ve el contador cuando vuelva', razon: 'paso' },
    { i: 1, cubeta: 'descartado', regla: '1', parte_de: 1, cita: 'eso lo ve el contador cuando vuelva', razon: 'a sí misma' },
    { i: 2, cubeta: 'descartado', regla: '2', parte_de: 0, cita: 'eso lo ve el contador cuando vuelva', razon: 'otra regla' },
  ] }, 3, NORM);
  assert.equal(vs[0]?.parteDe, 1);
  assert.equal(vs[1]?.parteDe, null);
  assert.equal(vs[2]?.parteDe, null);
});

test('una respuesta que no es la forma esperada no juzga nada', () => {
  assert.deepEqual(sanearVeredictos(null, 2, NORM), [null, null]);
  assert.deepEqual(sanearVeredictos({ veredictos: 'x' }, 1, NORM), [null]);
});

test('las plantillas conservan sus slots', () => {
  for (const s of ['{{criterio}}', '{{dueno}}', '{{jsonShape}}']) assert.ok(CRITERIO_JUEZ_SYSTEM_TEMPLATE.includes(s), s);
  for (const s of ['{{dueno}}', '{{participantes}}', '{{tareas}}', '{{reunion}}']) assert.ok(CRITERIO_JUEZ_USER_TEMPLATE.includes(s), s);
});
