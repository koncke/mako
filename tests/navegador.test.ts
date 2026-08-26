// =============================================================================
// El detector de navegador: cada rama, con objetos literales
// =============================================================================
// Todo esto se prueba SIN abrir un navegador, que es el punto de que la
// condición viva en `lib/navegador.ts` y no adentro del componente.
//
// El caso que hay que probar sí o sí es Brave/Arc: son los que un allowlist de
// NOMBRES de marca dejaría afuera, y son los que más caro salen de excluir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeInstalarExtension, type NavegadorMin } from '../lib/navegador';

/** La entrada GREASE que Chromium inyecta a propósito para romper al que asuma
 *  una lista fija. El nombre cambia entre versiones; el orden, también. */
const BASURA = { brand: 'Not;A=Brand', version: '99' };

const chromium = (extra: { brand: string; version: string }[], mobile = false): NavegadorMin => ({
  userAgentData: { brands: [BASURA, { brand: 'Chromium', version: '140' }, ...extra], mobile },
});

test('Chrome de escritorio: sí', () => {
  assert.equal(puedeInstalarExtension(chromium([{ brand: 'Google Chrome', version: '140' }])), 'si');
});

test('Edge: sí — la marca es distinta, el motor es el mismo', () => {
  assert.equal(puedeInstalarExtension(chromium([{ brand: 'Microsoft Edge', version: '140' }])), 'si');
});

test('Brave y Arc: sí, aunque digan «Google Chrome» y no su nombre', () => {
  // Es EL caso que rompe un allowlist de marcas: los dos se identifican como
  // Chrome a propósito, y los dos instalan de la Chrome Web Store sin problema.
  const comoChrome = chromium([{ brand: 'Google Chrome', version: '140' }]);
  assert.equal(puedeInstalarExtension(comoChrome), 'si');
});

test('Opera: sí', () => {
  assert.equal(puedeInstalarExtension(chromium([{ brand: 'Opera', version: '120' }])), 'si');
});

test('el orden de `brands` no importa: la basura puede venir primera o última', () => {
  const alReves: NavegadorMin = {
    userAgentData: {
      brands: [{ brand: 'Google Chrome', version: '140' }, { brand: 'Chromium', version: '140' }, BASURA],
      mobile: false,
    },
  };
  assert.equal(puedeInstalarExtension(alReves), 'si');
});

test('Chrome en Android: NO — Chromium, pero sin extensiones', () => {
  assert.equal(puedeInstalarExtension(chromium([{ brand: 'Google Chrome', version: '140' }], true)), 'no');
});

test('Safari: no', () => {
  const safari: NavegadorMin = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  };
  assert.equal(puedeInstalarExtension(safari), 'no');
});

test('Firefox: no', () => {
  const firefox: NavegadorMin = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  };
  assert.equal(puedeInstalarExtension(firefox), 'no');
});

test('Chrome para iOS (CriOS): no — dice Chrome y es WebKit', () => {
  const crios: NavegadorMin = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1',
  };
  assert.equal(puedeInstalarExtension(crios), 'no');
});

test('Edge y Firefox en iOS: no, por la misma razón que CriOS', () => {
  // Apple obliga a WebKit en el iPhone: todos los navegadores de ahí son Safari
  // con otro ícono. Ninguno instala de la Chrome Web Store.
  const edgiOS: NavegadorMin = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/125.0 Mobile/15E148 Safari/605.1.15',
  };
  const fxiOS: NavegadorMin = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15',
  };
  assert.equal(puedeInstalarExtension(edgiOS), 'no');
  assert.equal(puedeInstalarExtension(fxiOS), 'no');
});

test('la UA de Chrome NO se confunde con Safari aunque diga «Safari/537.36»', () => {
  // El bug de sniffing más viejo que existe: buscar «Safari» a secas en la UA
  // matchea Chrome, Edge, Brave y Opera. Acá no hay userAgentData (http:// por
  // IP de LAN), así que se cae al último recurso — y tiene que decir «no sé»,
  // nunca «no».
  const chromeSinUAData: NavegadorMin = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  };
  assert.equal(puedeInstalarExtension(chromeSinUAData), 'no-se-sabe');
});

test('sin ninguna señal: no se sabe, y no se afirma nada', () => {
  assert.equal(puedeInstalarExtension({}), 'no-se-sabe');
});

test('Chromium sin marca conocida: no se sabe, nunca «no»', () => {
  // Un build raro que emite brands pero sin `Chromium` no autoriza ni condena:
  // el aviso solo se pinta con certeza.
  const raro: NavegadorMin = { userAgentData: { brands: [BASURA], mobile: false } };
  assert.equal(puedeInstalarExtension(raro), 'no-se-sabe');
});

test('CONTRATO: solo «no» pinta el aviso — ninguna otra rama lo hace', () => {
  // El aviso es la única consecuencia de esta función, y el falso positivo (decirle
  // a un Chrome que no puede) es más caro que el falso negativo (no avisarle a un
  // Safari, que es lo que ya pasa hoy). Este test fija la asimetría: todo lo que
  // no sea una certeza tiene que caer en «no-se-sabe».
  const dudosos: NavegadorMin[] = [
    {},
    { userAgent: '' },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36' },
    { userAgentData: { brands: [BASURA] } },
  ];
  for (const d of dudosos) {
    assert.notEqual(puedeInstalarExtension(d), 'no', `no puede afirmar «no» con ${JSON.stringify(d)}`);
  }
});
