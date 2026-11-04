// El desafío de un antibots no es la página (4/11/2026).
//
// Martín, con la página de enlaces de un competidor en Spy: «Y revisa esto, que no se bloquee». Medido por el Cerebro: beacons.ai
// contesta el «Just a moment...» de Cloudflare (403), que pide ejecutar JavaScript. El mismo desafío puede venir con 503 o con 200,
// y leído como la página sería un análisis de «Just a moment» (Landing Analyst, Offer, Spy: todo lo que usa lib/landing-fetch.ts).
// Ahora sale como «nos bloquea» (403) y quien lo lee lo pregunta con `bloqueaLaLectura`, igual que un 403.
//
// Lo que NO es un desafío también se prueba: Cloudflare inyecta su script en páginas normales y Turnstile es un formulario.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `esDesafioDeBot` sin la marca del título «Just a moment»               → 1
//   · con `/cdn-cgi/challenge-platform/` a secas como marca                   → 2
//   · landing-fetch sin la pregunta antes de mirar el código                  → 3
//
// Correr: node --import tsx --test tests/landing-desafio-bot.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esDesafioDeBot } from '../lib/landing-extraer';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');

// Con la forma de la página de Cloudflare (inventada, sin datos de nadie).
const CLOUDFLARE = `<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="refresh" content="390">
<script>(function(){window._cf_chl_opt={cvId: '3',cZone: 'ejemplo.com',cType: 'managed'};var a=document.createElement('script');
a.src='/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1?ray=abc';document.getElementsByTagName('head')[0].appendChild(a);}());</script>
</head><body><div class="main-wrapper"><h1>ejemplo.com</h1><p>Verifying you are human. This may take a few seconds.</p></div></body></html>`;

test('1. el desafío de Cloudflare, el de DataDome y el de Incapsula se reconocen', () => {
  assert.equal(esDesafioDeBot(CLOUDFLARE), true);
  assert.equal(esDesafioDeBot('<html><head><title>Attention Required! | Cloudflare</title></head><body>Sorry, you have been blocked</body></html>'), true);
  assert.equal(esDesafioDeBot('<html><head><title> Just a moment... </title></head></html>'), true, 'con espacios');
  assert.equal(esDesafioDeBot('<html><body><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>'), true, 'DataDome');
  assert.equal(esDesafioDeBot('<html><body><iframe src="/_Incapsula_Resource?CWUDNSAI=1"></iframe></body></html>'), true, 'Incapsula');
  assert.equal(esDesafioDeBot('<div class="cf-browser-verification">x</div>'), true);
});

test('2. una página normal con Cloudflare adelante, Turnstile o un título parecido NO es un desafío', () => {
  const normal = `<!doctype html><html><head><title>Marca Personal 360 | Entradas</title></head><body><h1>Evento presencial</h1>
<form><div class="cf-turnstile" data-sitekey="0x4AAA"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></form>
<script defer src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body></html>`;
  assert.equal(esDesafioDeBot(normal), false, 'el script que Cloudflare inyecta en páginas normales y un Turnstile');
  assert.equal(esDesafioDeBot('<html><head><title>Just a moment of calm: meditación guiada</title></head></html>'), false, 'un título que empieza parecido');
  assert.equal(esDesafioDeBot(''), false);
});

test('3. landing-fetch lo pregunta ANTES de mirar el código, y lo tira como «nos bloquea» (403)', () => {
  const f = leer('lib/landing-fetch.ts');
  const desafio = f.indexOf('if (esDesafioDeBot(');
  const codigo = f.indexOf('if (res.status < 200 || res.status >= 300) {');
  const redireccion = f.indexOf('if (res.status >= 300 && res.status < 400) {');
  assert.ok(desafio > 0 && codigo > 0 && redireccion > 0);
  assert.ok(redireccion < desafio && desafio < codigo, 'después de seguir la redirección y antes del código: con 200 también');
  assert.match(f.slice(desafio, codigo), /throw new ErrorDeLectura\('[^']+', 403\)/);
});
