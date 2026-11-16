// =============================================================================
// El sitio arranca SIEMPRE en modo claro (Martín, 16/11/2026)
// =============================================================================
// Martín, mirando la portada en el artefacto: «arranca en oscuro, literalmente es lo contrario que te pedí. O sea, siempre en
// modo claro y que el usuario active el modo oscuro si quiere». Antes, sin un modo elegido, cada página arrancaba en el modo en
// que NACIÓ (`aplicar(… ? p : base)`), y la portada nació oscura (app/vsl/_sitio/Barra.tsx le pasa `base="oscuro"`).
// Se fija el script del sol y la luna (app/vsl/_competencia/TemaSitio.tsx): es un script en línea, sin React, que corre antes
// de que la página se vea; medido en un navegador (Chromium, la portada dibujada sin servidor) con el sistema en claro y en
// oscuro: arrancaba «oscuro» en los dos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync('app/vsl/_competencia/TemaSitio.tsx', 'utf8');

test('sin un modo elegido arranca en claro, aunque la página haya nacido oscura', () => {
  assert.match(fuente, /var INICIAL=ELEGIDO==='oscuro'\?'oscuro':'claro';/, 'el modo de arranque tiene que ser el claro salvo que la persona eligió el oscuro');
  assert.match(fuente, /aplicar\(p==='oscuro'\?'oscuro':'claro'\);quitarEspera\(\);/, 'al iniciar se aplica el claro salvo el oscuro elegido');
  assert.doesNotMatch(fuente, /\?p:base\)/, 'volvió a arrancar en el modo en que nació la página');
});

test('el oscuro sólo lo guarda el clic en el sol y la luna, no el arranque', () => {
  // `aplicar` no escribe en localStorage: si lo hiciera, el primer arranque dejaría «elegido» un modo que nadie eligió.
  const aplicar = fuente.match(/function aplicar\(m\)\{[^\n]*\}/)?.[0] ?? '';
  assert.ok(aplicar.length > 0, 'no encontré function aplicar(m)');
  assert.doesNotMatch(aplicar, /localStorage\.setItem/);
  const clic = fuente.match(/addEventListener\('click'[^\n]*/)?.[0] ?? '';
  assert.match(clic, /localStorage\.setItem\(LS,n\)/, 'el clic en el sol y la luna es el que guarda la elección');
});

test('una página que nació oscura no se ve un segundo en negro antes de pasar a claro', () => {
  // La espera (el body escondido con el fondo del modo de arranque) también corre cuando el modo de arranque no es el de nacimiento.
  assert.match(fuente, /if\(ELEGIDO==='claro'\|\|ELEGIDO==='oscuro'\|\|BASE_FIJA!==INICIAL\)/);
  assert.match(fuente, /\(INICIAL==='oscuro'\?'#0e1219':'#ffffff'\)/, 'el fondo de la espera es el del modo con que arranca');
});
