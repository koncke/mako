// Entrar a un competidor ES el loader (4/11/2026).
//
// Martín (por el Cerebro), mirando `competidor=17`: «al entrar en un competidor se ve así… Eso es lo que no quiero en diseño… Me
// imagino que la tarjeta que hice click, la de la caricatura se pone grande en el medio y de esa caricatura salen todas las
// tarjetitas de los reels y youtube… Eso funciona como un loader». Antes: la columna de la derecha y el resto vacío.
//   1. la caricatura en el centro: grande, pero entra en un teléfono;
//   2. la ficha se arma escondida mientras espera; sale cuando el gráfico está listo, sin gráfico apenas están sus piezas, con la
//      película de una primera lectura, y nunca después de 9 s; con «reducir movimiento» no hay entrada; un link directo nace en el
//      centro;
//   3. el gráfico retiene su entrada y, al soltarla, sus tarjetitas salen del centro de la caricatura;
//   4. la caricatura sólo anima `transform` y `opacity`, en un portal, y vuela a la foto de la ficha.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · la ficha sin esconderse mientras espera                              → 2
//   · sin el tope de 9 s                                                    → 2
//   · el gráfico que anima aunque lo retengan                               → 3
//   · las tarjetitas desde la grilla en vez de la caricatura               → 3
//   · la caricatura que anima `left`/`width`                                → 4
//
// Correr: node --import tsx --test tests/spy-entrada.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cajaDelCentro, centroDe, ladoEnElCentro } from '../app/competitor-spy/EntradaFicha';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. la caricatura en el centro: grande, pero entra en un teléfono', () => {
  assert.equal(ladoEnElCentro(1440, 900), 220);
  assert.ok(ladoEnElCentro(390, 844) <= 390 * 0.46);
  const c = cajaDelCentro(1280, 860);
  assert.equal(c.width, c.height);
  assert.equal(Math.round(centroDe(c).x), 640);
  assert.ok(centroDe(c).y < 860 / 2, 'un poco arriba del medio: abajo va el gráfico');
});

test('2. la ficha se arma escondida y sale con el gráfico listo, sin gráfico, con la película o a los 9 s', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /\.spy-cuerpo\[data-entrando='esperando'\] > :not\(\.spye\)\{opacity:0;pointer-events:none\}/, 'escondida, pero se puede medir');
  assert.match(app, /<div className="spy-cuerpo" data-entrando=\{entrando \? entrada\?\.fase : undefined\}>/);
  assert.match(app, /return id != null \? \{ id, origen: null, fase: 'esperando' \} : null;/, 'un link directo nace en el centro');
  assert.match(app, /setEntrada\(id != null && !quieto\(\) \? \{ id, origen: origen \?\? null, fase: 'esperando' \} : null\);/);
  assert.match(app, /if \(quieto\(\)\) \{ setEntrada\(null\); return; \}/, 'con «reducir movimiento», no hay entrada');
  assert.match(app, /if \(ordenando\?\.id === c\.id \|\| \(fichaLista === c\.id && !trayendo && !conGrafico\)\) \{ salir\(\); return; \}/);
  assert.match(app, /window\.setTimeout\(salir, 9000\)/, 'una espera que no termina no es un loader');
  assert.match(app, /onAbrir\(c\.id, r \? \{ left: r\.left, top: r\.top, width: r\.width, height: r\.height \} : undefined\)/, 'sale de la tarjeta tocada');
  assert.match(app, /retener=\{entrando && entrada\?\.fase === 'esperando'\}/);
  assert.match(app, /onListo=\{\(\) => setEntrada\(/);
});

test('3. el gráfico retiene su entrada y, al soltarla, sus tarjetitas salen de la caricatura', () => {
  const g = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  assert.match(g, /if \(!listo \|\| retener \|\| !plot\.current \|\| animado\.current === clave\) return;/);
  const desde = g.slice(g.indexOf('if (desde) {'), g.indexOf('return () => anims.forEach', g.indexOf('if (desde) {')));
  assert.ok(desde.length > 200, `recorte de ${desde.length}`);
  assert.match(desde, /const dx = desde\.x - \(r\.left \+ r\.width \/ 2\);/);
  assert.match(desde, /\{ transform: `translate\(\$\{dx\}px,\$\{dy\}px\) scale\(\.25\)`, opacity: 0 \}/);
  assert.match(g, /\}, \[listo, clave, telefono, retener\]\);/, 'soltarla vuelve a correr el efecto');
});

test('4. la caricatura: sólo transform y opacity, en un portal, y vuela a la foto de la ficha', () => {
  const e = sinComentarios(leer('app/competitor-spy/EntradaFicha.tsx'));
  const keyframes = [...e.matchAll(/\.animate\(\[([\s\S]*?)\]\s*,\s*\{/g)].map((m) => m[1]);
  assert.ok(keyframes.length >= 4, `animaciones: ${keyframes.length}`);
  for (const k of keyframes) assert.doesNotMatch(k, /\b(left|top|width|height|borderRadius|boxShadow)\s*:/, `anima algo que no es transform u opacity: ${k}`);
  assert.match(e, /createPortal\(/);
  assert.match(e, /document\.body/);
  assert.match(sinComentarios(leer('app/competitor-spy/SpyApp.tsx')), /const destinoDeEntrada = \(\) => document\.querySelector\('\.spy-ficha__foto'\);/);
  assert.match(leer('app/competitor-spy/EntradaFicha.tsx'), /@media \(prefers-reduced-motion:reduce\)\{\.spye-flota\{animation:none\}\}/);
});
