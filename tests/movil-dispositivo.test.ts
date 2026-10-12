// =============================================================================
// ¿El que entra a /inicio es un TELÉFONO? (lib/movil-dispositivo.ts)
// =============================================================================
// Es la decisión que manda a la persona a MaKo Mobile o al escritorio. Se fija
// con un corpus de UAs reales y, para no ser «una segunda opinión», se compara
// contra el ua-parser que trae Next (`userAgentFromString` de next/server) en los
// casos donde los dos tienen que coincidir.
//
// Verificado ROMPIÉNDOLO (11/10/2026):
//   · quitando la línea del iPad viejo (`/\biPad\b/ → 'tablet'`): 2 fallos, 6
//     pases («las tabletas no van a /m» y la paridad con Next).
//   · cambiando el BOT por un `/bot/i` suelto: 1 fallo, 7 pases («CUBOT…»).
//   · poniendo el `sec-ch-ua-mobile: ?1` ANTES del UA: 1 fallo, 7 pases.
//   · con `vaAMovil` ignorando la cookie: 1 fallo, 7 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { userAgentFromString } from 'next/server';
import {
  tipoDeDispositivo, vaAMovil, cookieVistaEscritorio, cookieVistaMovil,
  VISTA_COOKIE, VISTA_ESCRITORIO, VISTA_ESCRITORIO_SEG,
} from '../lib/movil-dispositivo';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_REDUCIDO = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPAD_VIEJO = 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
// iPadOS 13+ se anuncia como Mac: para el server es escritorio, a propósito.
const IPAD_NUEVO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';
const CUBOT = 'Mozilla/5.0 (Linux; Android 11; CUBOT_X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const GOOGLEBOT_MOVIL = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('los teléfonos son teléfono', () => {
  for (const ua of [IPHONE, IPHONE_CHROME, ANDROID, ANDROID_REDUCIDO, FIREFOX_ANDROID]) {
    assert.equal(tipoDeDispositivo(ua), 'telefono', ua);
  }
});

test('CUBOT es un teléfono (una marca, no un bot)', () => {
  assert.equal(tipoDeDispositivo(CUBOT), 'telefono');
});

test('las tabletas no van a /m', () => {
  assert.equal(tipoDeDispositivo(ANDROID_TABLET), 'tablet');
  assert.equal(tipoDeDispositivo(IPAD_VIEJO), 'tablet', 'iPad con iOS 12 es tablet');
  assert.equal(tipoDeDispositivo(IPAD_NUEVO), 'escritorio', 'iPadOS manda UA de Mac = escritorio');
});

test('escritorio y bots son escritorio', () => {
  for (const ua of [MAC_CHROME, WINDOWS, GOOGLEBOT_MOVIL]) assert.equal(tipoDeDispositivo(ua), 'escritorio', ua);
});

test('sec-ch-ua-mobile CONFIRMA, nunca da vuelta al UA', () => {
  assert.equal(tipoDeDispositivo(WINDOWS, '?1'), 'escritorio');
  assert.equal(tipoDeDispositivo(ANDROID_TABLET, '?1'), 'tablet');
  // Sólo decide cuando el UA no dice nada.
  assert.equal(tipoDeDispositivo('', '?1'), 'telefono');
  assert.equal(tipoDeDispositivo(null, '?0'), 'escritorio');
  assert.equal(tipoDeDispositivo(undefined), 'escritorio');
});

test('coincide con el ua-parser de Next en teléfonos y tabletas', () => {
  const casos: Array<[string, 'mobile' | 'tablet' | undefined]> = [
    [IPHONE, 'mobile'], [ANDROID, 'mobile'], [ANDROID_TABLET, 'tablet'], [IPAD_VIEJO, 'tablet'],
    [IPAD_NUEVO, undefined], [MAC_CHROME, undefined], [WINDOWS, undefined],
  ];
  for (const [ua, esperadoNext] of casos) {
    const next = userAgentFromString(ua).device.type;
    assert.equal(next, esperadoNext, `Next cambió de opinión sobre: ${ua}`);
    const nuestro = tipoDeDispositivo(ua);
    const comoNext = next === 'mobile' ? 'telefono' : next === 'tablet' ? 'tablet' : 'escritorio';
    assert.equal(nuestro, comoNext, ua);
  }
});

test('la cookie de «Versión completa» gana sobre el teléfono', () => {
  assert.equal(vaAMovil('telefono', undefined), true);
  assert.equal(vaAMovil('telefono', VISTA_ESCRITORIO), false);
  assert.equal(vaAMovil('telefono', 'otra-cosa'), true);
  assert.equal(vaAMovil('tablet', undefined), false);
  assert.equal(vaAMovil('escritorio', undefined), false);
});

test('las cookies de vista: 12 h para la completa, y borrarla vuelve al teléfono', () => {
  assert.equal(VISTA_ESCRITORIO_SEG, 43200);
  const pone = cookieVistaEscritorio();
  assert.ok(pone.startsWith(`${VISTA_COOKIE}=${VISTA_ESCRITORIO};`));
  assert.match(pone, /Path=\//);
  assert.match(pone, /Max-Age=43200/);
  assert.match(cookieVistaMovil(), /Max-Age=0/);
});
