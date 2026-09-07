// =============================================================================
// Un reintento después de que el pedido salió le cobra dos veces al cliente
// =============================================================================
// Cada generación que sale a BOQ gasta UN CRÉDITO de la cuenta de Google del
// cliente. El crédito se gasta en el momento en que el pedido viaja: lo que pase
// después —que la respuesta no vuelva, que se corte la conexión leyendo el cuerpo—
// no lo devuelve.
//
// ⚠️ EL DEFAULT ERA `reintentable: !r.salio`, o sea que un `salio` AUSENTE se leía
// como «no salió» y se reintentaba. Y ausente es justo lo que mandaban los DOS
// caminos donde el pedido sí había salido:
//
//   · el timeout de 120 s (`content.js` contestaba `{ error: 'BOQ_TIMEOUT' }` pelado)
//   · el `catch` de afuera del espejo, que no veía `salio` POR SCOPE — estaba
//     declarado adentro del `try`. El caso concreto es `await res.text()` fallando
//     con la conexión cortada a mitad del cuerpo: Google ya aceptó y ya cobró.
//
// Cinco intentos = cinco créditos por un video, y el cliente con cinco clips
// iguales en su Flow. Este test fija la asimetría: **se reintenta sólo con una
// afirmación explícita de que el pedido nunca viajó.**
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const worker = vivo(leer('extension', 'background.js'));
const espejo = vivo(leer('extension', 'injected.js'));
const puente = vivo(leer('extension', 'content.js'));

test('sólo se reintenta con un `salio === false` explícito', () => {
  assert.ok(
    !/reintentable:\s*!r\.salio/.test(worker),
    'Volvió `reintentable: !r.salio`. Un `salio` ausente —el timeout, el catch de\n'
    + 'afuera del espejo— se lee como «no salió» y se reintenta: hasta 5 créditos\n'
    + 'del cliente por UN video.',
  );
  assert.ok(
    /reintentable:\s*r\.salio === false/.test(worker),
    'El reintento ya no exige la afirmación explícita de que el pedido no viajó.',
  );
  assert.ok(
    /motivo:\s*r\.salio === false \? 'transitorio' : 'permanente'/.test(worker),
    'El `motivo` volvió a decidirse con la truthiness de `salio`: tiene que usar\n'
    + 'la misma afirmación explícita que `reintentable`, o los dos se contradicen.',
  );
});

test('todo lo que devuelve `repetirEnBoq` ANTES de mandar declara `salio: false`', () => {
  // Son los únicos casos que SÍ se pueden reintentar gratis, y hay que decirlo:
  // con el default nuevo, callarse significa «no reintentes» y dejaría trabada una
  // falta de plantilla que se arregla sola en el latido siguiente.
  const i = worker.indexOf('async function repetirEnBoq(');
  assert.ok(i > 0, 'no encontré `repetirEnBoq`');
  const fin = worker.indexOf('chrome.tabs.sendMessage', i);
  assert.ok(fin > i, 'no encontré el envío dentro de `repetirEnBoq`');

  const sinSalio: string[] = [];
  for (const m of worker.slice(i, fin).matchAll(/return\s*\{[^}]*\}/g)) {
    if (!/salio:\s*false/.test(m[0])) sinSalio.push(m[0].replace(/\s+/g, ' '));
  }
  assert.deepEqual(
    sinSalio, [],
    'Estos returns previos al envío no declaran `salio: false`:\n  ' + sinSalio.join('\n  ')
    + '\n\nCon el default nuevo, no decirlo los vuelve no-reintentables — y son\n'
    + 'exactamente los que se arreglan solos.',
  );
});

test('el espejo declara `salio` afuera del try, o el catch de afuera no lo ve', () => {
  // ⚠️ ERA UN BUG DE SCOPE, NO DE OLVIDO: `let salio` vivía adentro del `try`, así
  // que el `catch` que atrapa todo lo demás no podía nombrarlo aunque quisiera.
  const handler = espejo.indexOf("window.addEventListener('MAKO_BOQ_PIDO'");
  assert.ok(handler > 0, 'no encontré el handler de BOQ en el espejo');
  const decl = espejo.indexOf('let salio = false;', handler);
  const primerTry = espejo.indexOf('try {', handler);
  assert.ok(decl > 0 && decl < primerTry,
    '`salio` volvió a declararse adentro del `try`: el `catch` de afuera no lo ve,\n'
    + 'y un fallo leyendo el cuerpo —con el crédito ya gastado— sale sin el dato.');
  assert.ok(
    /error: 'EXCEPCION', salio,/.test(espejo),
    'La respuesta de `EXCEPCION` no lleva `salio`: se lee como un pedido que nunca\n'
    + 'sucedió, y se reintenta cobrando de nuevo.',
  );
});

test('un timeout de generación declara que el pedido SÍ salió', () => {
  // El fetch ya viajó cuando el reloj se cumple. «No contestó» no es «no pasó nada».
  assert.ok(
    /\{ error: 'BOQ_TIMEOUT', salio: true \}/.test(puente),
    'El timeout de BOQ volvió a mandarse como un error pelado. El pedido ya salió:\n'
    + 'sin `salio: true` el worker lo reintenta y el cliente paga otra vez.',
  );
});
