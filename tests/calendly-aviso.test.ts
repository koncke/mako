// =============================================================================
// El aviso de Calendly (23/10/2026): ¿le llegan a MaKo las reservas NUEVAS de esta cuenta?
// =============================================================================
// Medido ese día: la agenda de MaKo (ws 9) no tenía ni ruteo ni aviso, y todo el lanzamiento del 25/10 vende por ella
// (docs/hallazgos-integraciones.md). «Conectada» en /integraciones era tener el token y el tipo de evento de R1, y ninguna
// reserva llegaba nunca. Lo que se fija acá es la regla pura (lib/calendly-aviso-reglas.ts): cuándo hay un aviso a MaKo,
// cuándo anda, y qué dice la pantalla. Los scripts que usan `esWebhookDeMako`: tests/calendly-scripts.test.ts.
//
// Probado rompiéndolo (23/10/2026). Una rotura por vez, restaurando (pasan / fallan): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMINO_WEBHOOK_CALENDLY, esWebhookDeMako, estadoDelAviso, motivoDelAviso } from '../lib/calendly-aviso-reglas';

const MAKO = `https://hola-mako.com${CAMINO_WEBHOOK_CALENDLY}`;
const sana = { callback_url: MAKO, state: 'active', retry_started_at: null, events: ['invitee.created', 'invitee.canceled'] };

test('el aviso: activo si alguno a MaKo anda, apagado si sólo hay deshabilitados, sin-aviso si no hay', () => {
  assert.equal(estadoDelAviso([sana]), 'activo');
  assert.equal(estadoDelAviso([{ ...sana, state: 'disabled' }, sana]), 'activo');
  assert.equal(estadoDelAviso([{ ...sana, state: 'disabled' }]), 'apagado');
  assert.equal(estadoDelAviso([]), 'sin-aviso');
  assert.equal(estadoDelAviso([{ ...sana, callback_url: 'https://hooks.zapier.com/x' }]), 'sin-aviso', 'el aviso de otra app no cuenta');
});

test('«activo» no es sólo state=active: con reintentos en curso falla, y sin invitee.created no trae reservas nuevas', () => {
  assert.equal(estadoDelAviso([{ ...sana, retry_started_at: '2026-10-20T10:00:00Z' }]), 'fallando');
  assert.equal(estadoDelAviso([{ ...sana, events: ['invitee.canceled'] }]), 'incompleto');
  assert.equal(estadoDelAviso([{ ...sana, events: null }]), 'incompleto', 'si no dice sus eventos no se da por bueno');
  // Uno sano alcanza, aunque haya otro roto.
  assert.equal(estadoDelAviso([{ ...sana, retry_started_at: '2026-10-20T10:00:00Z' }, sana]), 'activo');
});

test('es de MaKo por CAMINO y por DOMINIO (los de MaKo, incluido el de antes), sólo https y sin puerto', () => {
  assert.equal(esWebhookDeMako(MAKO), true);
  assert.equal(esWebhookDeMako(`https://www.hola-mako.com${CAMINO_WEBHOOK_CALENDLY}/`), true);
  assert.equal(esWebhookDeMako(`https://hola-mako.com${CAMINO_WEBHOOK_CALENDLY}?x=1#y`), true);
  assert.equal(esWebhookDeMako(`https://makodigital.app${CAMINO_WEBHOOK_CALENDLY}`), true, 'el dominio de antes puede seguir entregando');
  assert.equal(esWebhookDeMako(`http://hola-mako.com${CAMINO_WEBHOOK_CALENDLY}`), false);
  assert.equal(esWebhookDeMako('https://hola-mako.com/api/webhooks/calcom'), false);
  assert.equal(esWebhookDeMako('no es una url'), false);
  assert.equal(esWebhookDeMako(null), false);
});

test('el camino solo NO alcanza: el webhook de otro sitio (otro CRM, un túnel, localhost) no es el de MaKo', () => {
  // Medido por la revisión adversarial: todos estos daban «activo» y la pantalla pintaba verde sin que entrara una reserva.
  for (const ajeno of [
    `https://app.otrocrm.com${CAMINO_WEBHOOK_CALENDLY}`,
    `https://abcd.ngrok-free.app${CAMINO_WEBHOOK_CALENDLY}`,
    `https://localhost${CAMINO_WEBHOOK_CALENDLY}`,
    `https://hola-mako.com:8443${CAMINO_WEBHOOK_CALENDLY}`,
    `https://hola-mako.com.evil.com${CAMINO_WEBHOOK_CALENDLY}`,
    `https://evilhola-mako.com${CAMINO_WEBHOOK_CALENDLY}`,
    `https://hola-mako.site${CAMINO_WEBHOOK_CALENDLY}`,
  ]) {
    assert.equal(esWebhookDeMako(ajeno), false, ajeno);
    assert.equal(estadoDelAviso([{ ...sana, callback_url: ajeno }]), 'sin-aviso', ajeno);
  }
});

test('la pantalla: dice qué falta cuando no entra nada, y calla cuando anda o no se pudo leer', () => {
  assert.match(motivoDelAviso('sin-aviso')!.motivo, /reservas nuevas no entran/);
  assert.equal(motivoDelAviso('sin-aviso')!.chip, 'Falta el aviso');
  assert.equal(motivoDelAviso('apagado')!.chip, 'Aviso apagado');
  assert.equal(motivoDelAviso('fallando')!.chip, 'Aviso con fallas');
  assert.equal(motivoDelAviso('incompleto')!.chip, 'Aviso incompleto');
  assert.equal(motivoDelAviso('activo'), null);
  assert.equal(motivoDelAviso(null), null, '«no pude leer» no es «no está»');
});

// Roturas (23/10/2026; cada una restaurada, pasan / fallan):
//   · `estadoDelAviso`: cualquier aviso a MaKo es «activo», aunque esté deshabilitado          -> falla «el aviso»
//   · `estadoDelAviso`: ignora retry_started_at                                                 -> falla «no es sólo state=active»
//   · `estadoDelAviso`: ignora que falte invitee.created                                        -> falla «no es sólo state=active»
//   · `esWebhookDeMako` acepta http                                                             -> falla «es de MaKo»
//   · `esWebhookDeMako` mira sólo el camino (cualquier dominio)                                 -> falla «el camino solo NO alcanza»
//   · `esWebhookDeMako` acepta puerto                                                           -> falla «el camino solo NO alcanza»
//   · `esWebhookDeMako` exige el dominio hola-mako.com (alarma falsa con el de antes)           -> falla «es de MaKo»
//   · `motivoDelAviso(null)` dice «Aviso apagado» («no pude leer» pinta ámbar)                  -> falla «la pantalla»
