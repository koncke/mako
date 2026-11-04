// El aviso de sus otras redes: una pastilla de un renglón por canal, en la fila de la miga (4/11/2026).
//
// Martín, con Víctor Heras en producción: «encontró su YouTube, pero mira como se bugea todo el diseño». Medido en la vista de
// prueba: cada canal medía 249 px de alto. La regla del enlace, `flex:1 1 220px`, se escribió cuando el enlace era hijo directo
// de la fila (una fila horizontal); al pasar el enlace adentro de una COLUMNA, esos 220 px son ALTO. El aviso empujaba
// Contenido debajo de la pantalla. Ahora es una pastilla de 40 px por canal, dentro de la miga, que no empuja nada mientras entra.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · la regla vieja del enlace (flex 1 1 220px) de vuelta                    → 1
//   · el texto de la pastilla en columna                                      → 1
//   · el aviso otra vez debajo de la miga, fuera de la fila                  → 2
//
// Correr: node --import tsx --test tests/spy-redes-pastillas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const app = () => readFileSync(`${RAIZ}app/competitor-spy/SpyApp.tsx`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. una pastilla de un renglón: 40 px, el texto en fila, y ninguna regla de las suyas con una base de 220 px', () => {
  const css = sinComentarios(app());
  const reglas = [...css.matchAll(/^\.spy-redes[^{]*\{[^}]*\}/gm)].map((m) => m[0]);
  assert.ok(reglas.length >= 5, `reglas de .spy-redes: ${reglas.length}`);
  for (const r of reglas) assert.doesNotMatch(r, /flex:\s*1 1 220px/, `una base de 220 px en una regla del aviso: ${r}`);
  const fila = reglas.find((r) => r.startsWith('.spy-redes-fila{'));
  assert.ok(fila, 'la regla de la pastilla');
  assert.match(fila!, /height:40px/);
  assert.match(fila!, /display:inline-flex/);
  const texto = reglas.find((r) => r.startsWith('.spy-redes-texto{'));
  assert.ok(texto);
  assert.doesNotMatch(texto!, /flex-direction:\s*column/, 'en columna, el alto vuelve a depender de sus hijos');
  assert.match(texto!, /white-space:nowrap/);
});

test('2. vive en la fila de la miga, antes del «?», y no debajo', () => {
  const src = sinComentarios(app());
  const nav = src.indexOf('<nav className="spy-volver"');
  const fin = src.indexOf('</nav>', nav);
  assert.ok(nav > 0 && fin > nav);
  const adentro = src.slice(nav, fin);
  const redes = adentro.indexOf('<OtrasRedes');
  const ayuda = adentro.indexOf('spy-volver__ayuda');
  assert.ok(redes > 0, 'el aviso no está en la fila de la miga');
  assert.ok(ayuda > 0 && redes < ayuda, 'el «?» queda al final de la fila');
  assert.equal(src.split('<OtrasRedes').length - 1, 1, 'una sola vez');
});
