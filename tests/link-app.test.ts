// =============================================================================
// /app: el link único para instalar MaKo (3/11/2026)
// =============================================================================
// Martín: «que instalen la app y que sea ese link o que les lleve a la apple store dependiendo su dispositivo... Tipo un QR o algo así». Los tres casos con cada tienda prendida y
// apagada, con los navegadores de verdad.
//
// Probado ROMPIÉNDOLO (3/11/2026), de a una, 15 roturas: la computadora o una tienda sin publicar yendo a una tienda, la publicada mostrando la guía, Android en la tienda de iPhone, una
// dirección equivocada, /app sin ser público, la página sin redirigir o leyendo la sesión, el QR del onboarding a otro lado, una dirección escrita en la tarjeta, la guía sin entrada, el iPad
// con el QR, cada teléfono con los pasos del otro y la computadora sin el QR. Fallan las 15; restaurado, 13 pasan y 0 fallan.
//
// Correr: node --import tsx --test tests/link-app.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GuiaApp } from '../app/app/GuiaApp';
import { RUTA_APP, TIENDAS, destinoDeLaApp, type Tienda } from '../lib/app-tiendas';
import { plataformaDeUA } from '../lib/push-payload';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';
import { linkApp } from '../lib/app-url';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r/g, '');

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const IOS = 'https://apps.apple.com/app/id6830383006';
const ANDROID = 'https://play.google.com/store/apps/details?id=com.holamako.app';

const tiendas = (ios: boolean, android: boolean): Record<'ios' | 'android', Tienda> => ({ ios: { url: IOS, publicada: ios }, android: { url: ANDROID, publicada: android } });
const para = (ua: string, t: Record<'ios' | 'android', Tienda>) => destinoDeLaApp(plataformaDeUA(ua), t);

test('las dos direcciones son las de las tiendas', () => {
  assert.equal(TIENDAS.ios.url, IOS);
  assert.equal(TIENDAS.android.url, ANDROID);
});

test('sin publicar, cada teléfono ve la guía de SU sistema, y nadie va a una tienda vacía', () => {
  const t = tiendas(false, false);
  assert.deepEqual(para(IPHONE, t), { tipo: 'guia', plataforma: 'ios' });
  assert.deepEqual(para(SAMSUNG, t), { tipo: 'guia', plataforma: 'android' });
  assert.deepEqual(para(CHROME_ANDROID, t), { tipo: 'guia', plataforma: 'android' });
});

test('una computadora ve el QR, con las tiendas prendidas o apagadas', () => {
  for (const t of [tiendas(false, false), tiendas(true, true)]) {
    assert.deepEqual(para(WINDOWS, t), { tipo: 'qr' });
    assert.deepEqual(para(MAC, t), { tipo: 'qr' });
    assert.deepEqual(destinoDeLaApp(plataformaDeUA(''), t), { tipo: 'qr' });
    assert.deepEqual(destinoDeLaApp(plataformaDeUA(null), t), { tipo: 'qr' });
  }
});

test('publicada en iPhone: el iPhone va a la App Store, y Android sigue con su guía', () => {
  const t = tiendas(true, false);
  assert.deepEqual(para(IPHONE, t), { tipo: 'tienda', url: IOS });
  assert.deepEqual(para(SAMSUNG, t), { tipo: 'guia', plataforma: 'android' });
});

test('publicada en Android: Android va a Play Store, y el iPhone sigue con su guía', () => {
  const t = tiendas(false, true);
  assert.deepEqual(para(SAMSUNG, t), { tipo: 'tienda', url: ANDROID });
  assert.deepEqual(para(IPHONE, t), { tipo: 'guia', plataforma: 'ios' });
});

test('prender una tienda es cambiar un solo valor: el dato vive una sola vez', () => {
  const s = leer('lib/app-tiendas.ts');
  assert.equal(s.match(/publicada: (?:true|false)/g)?.length, 2);
  for (const r of ['app/app/page.tsx', 'app/app/GuiaApp.tsx', 'app/onboarding/TarjetaAvisos.tsx', 'lib/onboarding-arranque-server.ts']) {
    assert.doesNotMatch(leer(r), /apps\.apple\.com|play\.google\.com/, `${r} tiene una dirección de tienda escrita`);
  }
});

test('/app es público y sólo se lee: quien escanea puede no tener sesión en ese teléfono', () => {
  assert.equal(RUTA_APP, '/app');
  assert.equal(esPublica('/app'), true);
  assert.equal(esPublicaSoloLeer('/app'), true);
  // El prefijo no abre nada más.
  for (const r of ['/apple', '/application', '/apps', '/api/app']) assert.equal(esPublica(r), false, r);
});

test('/app no choca con otra ruta: es la única página ahí, sin rutas por debajo', () => {
  assert.equal(existsSync(join(RAIZ, 'app/app/page.tsx')), true);
  assert.equal(existsSync(join(RAIZ, 'app/app/route.ts')), false);
  assert.equal(existsSync(join(RAIZ, 'app/m/app')), false, 'el teléfono vería otra cosa');
});

test('la página manda a la tienda y no lee cookies ni la base: es pública', () => {
  const s = leer('app/app/page.tsx');
  assert.match(s, /if \(destino\.tipo === 'tienda'\) redirect\(destino\.url\);/);
  assert.match(s, /destinoDeLaApp\(plataformaDeUA\(\(await headers\(\)\)\.get\('user-agent'\)\)\)/);
  assert.doesNotMatch(s, /cookies\(\)|getSupabase|getUsuarioActual|getSesion/);
});

test('el QR de /app y el del onboarding apuntan al mismo link, sin negocio', () => {
  assert.equal(linkApp(RUTA_APP, null).endsWith('/app'), true);
  assert.match(leer('app/app/page.tsx'), /QRCode\.toDataURL\(linkApp\(RUTA_APP, null\)/);
  assert.match(leer('lib/onboarding-arranque-server.ts'), /QRCode\.toDataURL\(linkApp\(RUTA_APP, null\)/);
});

test('la guía lleva a entrar, y un iPad que se presenta como Mac no se queda con el QR', () => {
  const g = leer('app/app/GuiaApp.tsx');
  assert.match(g, /href="\/inicio"/);
  assert.match(g, /\/Macintosh\/i\.test\(navigator\.userAgent\)/);
  assert.match(g, /destinoDeLaApp\('ios'\)/);
  assert.match(g, /pasosInstalar\(destino\.plataforma === 'ios'\)/);
});

test('lo que se ve: el QR en la computadora, y en cada teléfono los pasos de SU sistema', () => {
  const ver = (inicial: Parameters<typeof GuiaApp>[0]['inicial'], qr: string | null = null) => renderToStaticMarkup(createElement(GuiaApp, { inicial, qr }));

  const compu = ver({ tipo: 'qr' }, 'data:image/png;base64,QR');
  assert.match(compu, /src="data:image\/png;base64,QR"/);
  assert.doesNotMatch(compu, /gapp__paso"/, 'la computadora no ve pasos de un teléfono');
  assert.doesNotMatch(compu, /href="\/inicio"/);

  const iphone = ver({ tipo: 'guia', plataforma: 'ios' });
  const android = ver({ tipo: 'guia', plataforma: 'android' });
  for (const h of [iphone, android]) {
    assert.match(h, /gapp__paso"/);
    assert.match(h, /href="\/inicio"/);
    assert.doesNotMatch(h, /<img/, 'en el teléfono no hay QR que escanear');
  }
  assert.match(iphone, /Compartir/, 'en iPhone se agrega desde Compartir');
  assert.doesNotMatch(android, /Compartir/);
});

test('en iPhone, el onboarding lleva a /app cuando su tienda ya está publicada', () => {
  const t = leer('app/onboarding/TarjetaAvisos.tsx');
  assert.match(t, /TIENDAS\.ios\.publicada/);
  assert.match(t, /href=\{RUTA_APP\}/);
});
