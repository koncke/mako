// =============================================================================
// El vigilante de líneas marca «avisado» sólo con lo que SALIÓ (17/11/2026, T1 del ws1)
// =============================================================================
// La línea mako_ws1 está caída desde el 30/10 y `wa.linea.caida.avisado` se ponía cada día. Esa marca no probaba nada: el
// vigilante (lib/lineas-vigilante.ts) marcaba con `r.wa || r.enApp || r.email`, y para un evento de la plataforma `wa` es
// «corrió una fila» (`emitirPorEvento`, lib/aviso-evento.ts) y `enApp` es «quedó en el hilo de la app». Con la marca puesta deja
// de insistir y habilita el «volvió». Ahora la tarjeta del evento dice si SALIÓ (WhatsApp o email), si sólo llegó a la app o si
// no llegó, `emitirPorEvento` devuelve `salieron`, y el vigilante marca con eso (`llegoElAvisoDeLinea`).
//
// Correr: node --import tsx --test tests/linea-aviso-salio.test.ts
// Probado rompiéndolo (17/11/2026, base 3/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { llegoElAvisoDeLinea } from '../lib/linea-vigilancia';
import { salioLaTarjeta, llegoLaTarjeta } from '../lib/mako-tarjeta';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('la marca va con lo que salió: un evento que corrió y no salió NO marca (el caso de T1)', () => {
  // `emitirPorEvento` con la fila corrida y la tarjeta sólo en la app: `wa: true`, `salieron: 0`.
  assert.equal(llegoElAvisoDeLinea({ wa: true, salieron: 0 }), false);
  assert.equal(llegoElAvisoDeLinea({ wa: true, salieron: 1 }), true);
  assert.equal(llegoElAvisoDeLinea({ wa: false, salieron: 2 }), true);
  // Un aviso que no es un evento no trae `salieron`: su `wa` es el WhatsApp de verdad (`env.ok`), y el email cuenta.
  assert.equal(llegoElAvisoDeLinea({ wa: true }), true);
  assert.equal(llegoElAvisoDeLinea({ wa: false, email: true }), true);
  assert.equal(llegoElAvisoDeLinea({ wa: false }), false);
});

test('la tarjeta: «salió» es WhatsApp o email; lo que quedó en la app llega pero no sale', () => {
  assert.equal(salioLaTarjeta({ ok: true, wa: true }), true);
  assert.equal(salioLaTarjeta({ ok: true, wa: false, email: true }), true);
  assert.equal(salioLaTarjeta({ ok: true, wa: false }), false);
  // `llegoLaTarjeta` no cambia: para quien reintenta, lo de la app llegó (no suma burbujas).
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, enApp: true }), true);
  assert.equal(salioLaTarjeta({ ok: true, wa: false }), false);
});

test('la cadena: la tarjeta lo distingue, `ejecutarPasos` lo cuenta, el evento lo devuelve y el vigilante marca con eso', () => {
  const flujos = leer('lib/flujos.ts');
  assert.match(flujos, /return salioLaTarjeta\(r\) \? true : llegoLaTarjeta\(r\) \? 'app' : false;/);
  assert.match(flujos, /if \(entregas && \(hecho === true \|\| hecho === 'app'\)\) entregas\.llegaron \+= 1;/);
  assert.match(flujos, /if \(entregas && hecho === true\) entregas\.salieron = \(entregas\.salieron \?\? 0\) \+ 1;/);
  const ev = leer('lib/aviso-evento.ts');
  assert.match(ev, /salieron \+= r\?\.salieron \?\? 0;/);
  assert.match(ev, /return \{ ok: true, feedId: null, wa: dePlataforma && n > 0, deduped: false, filas: n, llegaron, salieron \};/);
  assert.match(leer('lib/avisos.ts'), /const entregas = \{ llegaron: 0, salieron: 0 \};/);
  const vig = leer('lib/lineas-vigilante.ts');
  assert.equal((vig.match(/const llego = llegoElAvisoDeLinea\(r\);/g) ?? []).length, 2, 'la caída y el «volvió» marcan con lo que salió');
  assert.doesNotMatch(vig, /r\.wa \|\| r\.enApp === true \|\| r\.email === true/, 'volvió la marca con «corrió una fila»');
});

// ── Probado rompiéndolo (17/11/2026), de a una y restaurando. Base 3/0 ──
// R1 `llegoElAvisoDeLinea` vuelve a mirar sólo `wa`                         → 2/1
// R2 el vigilante vuelve a `r.wa || r.enApp === true || r.email === true`     → 2/1
// R3 `ejecutarPasos` cuenta como salido lo que quedó en la app               → 2/1
