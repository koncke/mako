/**
 * Qué evento de Google Calendar es la reunión de un lead (lib/calendario-reunion.ts).
 *
 * El caso que lo motivó, medido el 09/10/2026: reagendar desde el CRM a un lead de prueba
 * movió la instancia del jueves 8 a las 15:00 de «Sprint 4» (una serie del dueño, sin
 * invitados) al domingo 12. El lead tenía el email del dueño y su reunión vieja estaba a
 * esa misma hora. Los fixtures de abajo son esa agenda.
 *
 * Probado rompiéndolo (10/10/2026), cada rotura por separado sobre una base de 9 pases:
 *   · devolver la regla de la hora (aceptar cualquier evento a ±10 min): 4 fallos, 5 pases;
 *   · sacar el `!a.self` de los invitados: 2 fallos, 7 pases;
 *   · sacar el veto de `esConOtraPersona` al título: 1 fallo, 8 pases.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { elegirEventoDeReunion, esConOtraPersona, leadInvitado, titulosParecidos } from '../lib/calendario-reunion';

const DUENO = 'martinkoncke@gmail.com';
const t0 = Date.parse('2026-10-08T15:00:00-03:00');

const sprint = {
  id: 'sprint4_20261008',
  summary: 'Sprint 4',
  start: { dateTime: '2026-10-08T15:00:00-03:00' },
};
const sprintConDueno = { ...sprint, attendees: [{ email: DUENO, self: true }] };
const conOtro = {
  id: 'otro',
  summary: 'Llamada con Demo Lead',
  start: { dateTime: '2026-10-08T15:05:00-03:00' },
  attendees: [{ email: DUENO, self: true }, { email: 'alguien@otra.com' }],
};
const deLaReunion = {
  id: 'reunion',
  summary: 'Reunión 1 · Demo Lead',
  start: { dateTime: '2026-10-08T16:30:00-03:00' },
  attendees: [{ email: DUENO, self: true }, { email: 'lead@cliente.com' }],
};

test('la hora sola NO alcanza: «Sprint 4» a la misma hora no es la reunión del lead', () => {
  assert.equal(elegirEventoDeReunion([sprint], { email: 'lead@cliente.com', titulo: 'Demo Lead', t0 }), null);
  assert.equal(elegirEventoDeReunion([sprint], { email: null, titulo: null, t0 }), null);
});

test('un lead con el email del DUEÑO no está «invitado» a lo que el dueño tiene', () => {
  assert.equal(leadInvitado(sprintConDueno, DUENO), false);
  assert.equal(elegirEventoDeReunion([sprintConDueno], { email: DUENO, titulo: 'Demo Lead', t0 }), null);
});

test('el lead invitado de verdad es prueba, aunque el evento esté lejos de la hora vieja', () => {
  assert.equal(leadInvitado(deLaReunion, 'LEAD@cliente.com '), true);
  const r = elegirEventoDeReunion([sprint, conOtro, deLaReunion], { email: 'lead@cliente.com', titulo: 'Demo Lead', t0 });
  assert.equal(r?.id, 'reunion');
});

test('un título parecido sobre una reunión con OTRA persona no prueba nada', () => {
  assert.equal(esConOtraPersona(conOtro, 'lead@cliente.com'), true);
  assert.equal(elegirEventoDeReunion([conOtro], { email: 'lead@cliente.com', titulo: 'Demo Lead', t0 }), null);
  // Y con el email del dueño como «lead», tampoco: el otro invitado sigue siendo otra persona.
  assert.equal(elegirEventoDeReunion([conOtro], { email: DUENO, titulo: 'Demo Lead', t0 }), null);
});

test('el título sí prueba si el evento no tiene invitados ajenos (o no sabemos el email)', () => {
  const sinInvitados = { id: 'solo', summary: 'Llamada con Demo Lead', start: { dateTime: '2026-10-08T15:00:00-03:00' } };
  assert.equal(elegirEventoDeReunion([sprint, sinInvitados], { email: 'lead@cliente.com', titulo: 'Demo Lead', t0 })?.id, 'solo');
  assert.equal(elegirEventoDeReunion([conOtro], { email: null, titulo: 'Demo Lead', t0 })?.id, 'otro');
});

test('el invitado gana sobre el título, y la hora sólo desempata', () => {
  const tituloCerca = { id: 'titulo', summary: 'Demo Lead', start: { dateTime: '2026-10-08T15:00:00-03:00' } };
  assert.equal(elegirEventoDeReunion([tituloCerca, deLaReunion], { email: 'lead@cliente.com', titulo: 'Demo Lead', t0 })?.id, 'reunion');
  const lejos = { ...tituloCerca, id: 'lejos', start: { dateTime: '2026-10-08T17:00:00-03:00' } };
  assert.equal(elegirEventoDeReunion([lejos, tituloCerca], { email: null, titulo: 'Demo Lead', t0 })?.id, 'titulo');
});

test('una sala (resource) no cuenta como otra persona', () => {
  const conSala = { id: 'sala', summary: 'Demo Lead', start: sprint.start, attendees: [{ email: 'sala@resource.calendar.google.com', resource: true }] };
  assert.equal(esConOtraPersona(conSala, 'lead@cliente.com'), false);
});

test('titulosParecidos sigue pidiendo 4 caracteres y mira las dos direcciones', () => {
  assert.equal(titulosParecidos('Llamada con Juan Pérez', 'juan perez'), true);
  assert.equal(titulosParecidos('Ana', 'Ana'), false);
});

test('lib/google-calendar.ts usa la regla pura y no volvió a aceptar por hora', () => {
  const src = readFileSync(resolve(__dirname, '..', 'lib/google-calendar.ts'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf('async function buscarEventoDeReunion');
  const fin = src.indexOf('\n}\n', ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré buscarEventoDeReunion');
  const cuerpo = src.slice(ini, fin);
  assert.match(cuerpo, /elegirEventoDeReunion\(/);
  assert.doesNotMatch(cuerpo, /casiExacto|10 \* 60 \* 1000/);
  // Los otros dos lectores que deciden «con el lead» también excluyen al dueño.
  const exacto = src.slice(src.indexOf('async function eventoExacto'), src.indexOf('export async function cancelarEventoDeReunion'));
  assert.match(exacto, /leadInvitado\(e, email\)/);
  const proximas = src.slice(src.indexOf('export async function proximasReunionesCon'), src.indexOf('/** Un evento de un día de la agenda'));
  assert.match(proximas, /leadInvitado\(e, quien\)/);
});
