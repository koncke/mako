// =============================================================================
// El aviso de los leads de Meta por Zernio no dice «no recibe» cuando sí llegan (lib/zernio-leads-estado.ts, 5/11/2026)
// =============================================================================
// Código Inmobiliario lo vio salir conectado. Medido el 5/11 leyendo el código: sin webhook los leads llegan igual por el barrido
// de cada 30 minutos; un webhook viejo o pausado no es «falta el complemento»; y sin el secreto maestro no hay webhook que mirar.
// Probado rompiéndolo (5/11/2026, base 3/0):
//   · `avisoDeLeads` como antes (sólo el webhook: «no está» → no recibe)      → 2/1 (el 2);
//   · un webhook pausado tomado como que escucha                              → 2/1 (el 1);
//   · sin el secreto maestro, «tarde» con un consejo que no arregla nada      → 2/1 (el 3).
// Lo mismo, EJECUTADO contra el webhook y la API de Zernio: tests/zernio-webhook-suscripcion.test.ts (`avisoDeLeadsZernio`).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeLeads, escuchaComoBooleano, escuchaDelWebhook } from '../lib/zernio-leads-estado';

const URL_MAKO = 'https://hola-mako.com/api/webhooks/zernio?w=13';
const EV = 'lead.received';

test('1 · el webhook de MaKo: escucha, no escucha, pausado o no está (sólo la URL exacta es la nuestra)', () => {
  assert.equal(escuchaDelWebhook([{ url: URL_MAKO, events: ['message.received', EV] }], URL_MAKO, EV), 'escucha');
  assert.equal(escuchaDelWebhook([{ url: ` ${URL_MAKO} `, events: [EV], isActive: true }], URL_MAKO, EV), 'escucha');
  assert.equal(escuchaDelWebhook([{ url: URL_MAKO, events: ['message.received'] }], URL_MAKO, EV), 'no-escucha');
  assert.equal(escuchaDelWebhook([{ url: URL_MAKO, events: [EV], isActive: false }], URL_MAKO, EV), 'inactivo');
  assert.equal(escuchaDelWebhook([{ url: 'https://otra.app/hook', events: [EV] }], URL_MAKO, EV), 'no-esta');
  assert.equal(escuchaDelWebhook([], URL_MAKO, EV), 'no-esta');
  // Para el cron diario: sólo «escucha» es true; uno que no está es null, como siempre.
  assert.deepEqual(['escucha', 'no-escucha', 'inactivo', 'no-esta'].map((e) => escuchaComoBooleano(e as 'escucha')), [true, false, false, null]);
});

test('2 · sin webhook (o sin escuchar) pero la API los entrega: llegan cada media hora, NO «no recibe»', () => {
  for (const webhook of ['no-esta', 'no-escucha', 'inactivo'] as const) {
    assert.equal(avisoDeLeads({ hayMaestro: true, webhook, lectura: 'anda' }), 'tarde', webhook);
  }
  assert.equal(avisoDeLeads({ hayMaestro: true, webhook: 'escucha', lectura: null }), 'si');
});

test('3 · lo que no se midió no se afirma; la falta del complemento sí (la API contesta 403)', () => {
  assert.equal(avisoDeLeads({ hayMaestro: true, webhook: 'no-esta', lectura: 'no-se' }), null);
  assert.equal(avisoDeLeads({ hayMaestro: true, webhook: 'no-escucha', lectura: 'sin-complemento' }), 'sin-permiso');
  assert.equal(avisoDeLeads({ hayMaestro: false, webhook: null, lectura: 'sin-complemento' }), 'sin-permiso');
  // Sin el secreto maestro, «Volver a conectar» no registra ningún webhook: no se manda a tocarlo.
  assert.equal(avisoDeLeads({ hayMaestro: false, webhook: 'no-esta', lectura: 'anda' }), null);
  assert.equal(avisoDeLeads({ hayMaestro: false, webhook: null, lectura: null }), null);
});
