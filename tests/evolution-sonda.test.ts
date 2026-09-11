// =============================================================================
// El veredicto de la sonda, con las respuestas MEDIDAS de Evolution
// =============================================================================
// 11/09/2026. La sonda nueva (`fetchBusinessProfile`) se corrió contra las cinco
// instancias del servidor ANTES de desplegarla, y devolvió `sin_respuesta` sobre las
// TRES muertas. Evolution había contestado «Connection Closed», pero anidado en
// `response.message`, y el lector de `evFetch` buscaba solo `body.message`: el error
// llegaba como «Evolution 500» y `esSesionCaida` no tenía nada que reconocer.
//
// Desplegado así, la próxima línea zombi no se rotaba y el vigilante no avisaba. Los
// tests por regex pasaban: miraban qué endpoint se llama, no qué se hace con la
// respuesta. Estos usan los bodies TAL CUAL llegaron ese día.
//
// PROBADO ROMPIÉNDOLO: con el lector viejo de `evFetch` (solo `body.message`) y la primera
// regla de la sonda nueva («todo 404 es muerto») fallan 3 de 6, justo los tres que importan:
// el mensaje anidado, las muertas dando «muerto», y el 404 de ruta que no suelta una viva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeEvolution, veredictoSondeo, esSesionCaida } from '../lib/evolution-sonda';

// ── Bodies medidos el 11/09/2026, copiados de la respuesta cruda ────────────────
// Zombi en `open`, cerrada por WhatsApp (403) y nunca vinculada: las tres, este mismo.
const SIN_SOCKET_500 = { status: 500, error: 'Internal Server Error', response: { message: ['Error updating profile name', 'Error: Connection Closed'] } };
const SIN_INSTANCIA_404 = { status: 404, error: 'Not Found', response: { message: ['The "no_existe_xyz" instance does not exist'] } };
const RUTA_INEXISTENTE_404 = { status: 404, error: 'Not Found', response: { message: ['Cannot POST /chat/rutaQueNoExiste/mako_ws11'] } };

const fallo = (status: number, body: unknown) => ({ ok: false, status, error: mensajeEvolution(body, status) });

test('el mensaje anidado de Evolution llega entero', () => {
  assert.match(mensajeEvolution(SIN_SOCKET_500, 500), /Connection Closed/,
    'volvió a leer solo body.message: todo error de Evolution llega como «Evolution 500»');
  // Las formas de antes siguen saliendo igual.
  assert.equal(mensajeEvolution({ message: ['x'] }, 500), '["x"]');
  assert.equal(mensajeEvolution('texto crudo', 502), 'texto crudo');
  assert.equal(mensajeEvolution({}, 503), 'Evolution 503');
});

test('las instancias sin socket dan «muerto»', () => {
  assert.equal(veredictoSondeo(fallo(500, SIN_SOCKET_500)), 'muerto');
});

test('una instancia que no existe da «muerto»', () => {
  assert.equal(veredictoSondeo(fallo(404, SIN_INSTANCIA_404)), 'muerto');
});

test('la viva da «vivo», y no llegar a Evolution no es un dato', () => {
  assert.equal(veredictoSondeo({ ok: true }), 'vivo');
  assert.equal(veredictoSondeo({ ok: false, status: 0, error: 'The operation was aborted due to timeout' }), 'sin_respuesta');
});

test('⛔ un error que no es «sesión caída» no convierte una línea en «muerta»', () => {
  // De «muerto» cuelga un logout. Una ruta que otra versión de Evolution renombre contesta
  // 404 sobre una línea VIVA (medido: así se ve). Con «todo 404 es muerto», un upgrade de
  // Evolution soltaba la voz de MaKo al primer clic en «Conectar por QR».
  assert.equal(veredictoSondeo(fallo(404, RUTA_INEXISTENTE_404)), 'sin_respuesta');
  assert.equal(veredictoSondeo({ ok: false, status: 500, error: 'Evolution 500' }), 'sin_respuesta');
});

test('esSesionCaida reconoce las dos formas de la sesión caída, y no un grupo que no existe', () => {
  assert.ok(esSesionCaida('["Error fetching group","Error: Connection Closed"]'));
  assert.ok(esSesionCaida('Evolution 428: Precondition Required'));
  // Esto lo contesta un socket VIVO al pedirle un grupo inexistente (medido el 11/09).
  assert.ok(!esSesionCaida('["Error fetching group","Error: item-not-found"]'));
});
