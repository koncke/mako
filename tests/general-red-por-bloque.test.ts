// =============================================================================
// Una tarjeta de la hoja que se rompe dice «Este bloque no cargó» y el resto de la hoja sigue en pie
// =============================================================================
// 17/10/2026: Martín vio en el celular «Cannot read properties of undefined (reading 'length')» y se cayó la portada de
// General entera por UN bloque (el ejemplo de «Meta objetivo» sin `funnelIds`, arreglado en 6b922f7e3). Lo pidió el
// Cerebro: una red por bloque, en la computadora y en el teléfono. Lo que se puede romper sin que se vea: que `dibujar`
// vuelva a correr AFUERA de la red (un error al armar el elemento saltaría por encima), que el teléfono o las
// miniaturas dibujen un bloque sin pasar por ella, que un gráfico de la hoja quede afuera, y que una tarjeta rota no
// vuelva a intentar cuando le llegan datos nuevos.
//
// Sin DOM: el jsdom de node_modules no arranca (le falta @asamuzakjp/css-color, docs/hallazgos-infra.md), y un render en
// el server no corre error boundaries. Así que la red se prueba llamando a sus métodos, y el montaje leyendo el código.
//
// Correr: node --import tsx --test tests/general-red-por-bloque.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `dibujar` de vuelta en el cuerpo de `ElementoGeneral` (afuera de la red)
// → 3 / 1; la red que no se marca rota (`getDerivedStateFromError` devolviendo `roto: false`) → 3 / 1; la miniatura sin
// la red → 3 / 1; el gráfico sin la red → 3 / 1; la red que no vuelve a intentar (`componentDidUpdate` vacío) → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { RedDeBloque, TEXTO_BLOQUE_ROTO, cambio } from '../app/dashboard/RedDeBloque';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
const entre = (src: string, desde: string, hasta: string) => { const i = src.indexOf(desde); const j = src.indexOf(hasta, i + 1); assert.ok(i >= 0 && j > i, `no encontré ${desde}`); return src.slice(i, j); };

test('la red: un error la marca rota, rota dice «Este bloque no cargó», y vuelve a intentar si cambia lo que se le dio', () => {
  assert.deepEqual(RedDeBloque.getDerivedStateFromError(), { roto: true });
  const g = { id: 'g1' }, datos = { filas: [] };
  const red = new RedDeBloque({ nombre: 'Meta objetivo', reiniciarCon: [g, datos], children: 'el bloque' });
  assert.equal(red.render(), 'el bloque', 'sana, dibuja el bloque');
  red.state = { roto: true };
  const html = renderToStaticMarkup(red.render() as never);
  assert.match(html, new RegExp(`role="alert"[^>]*>${TEXTO_BLOQUE_ROTO}<`));
  assert.doesNotMatch(html, /el bloque/);
  // Fuera de React, `setState` no hace nada: se mira qué pide.
  const pedidos: unknown[] = [];
  red.setState = ((s: unknown) => { pedidos.push(s); }) as never;
  red.componentDidUpdate({ nombre: 'Meta objetivo', reiniciarCon: [g, datos], children: 'el bloque' });
  assert.deepEqual(pedidos, [], 'con lo mismo, no reintenta (se rompería de nuevo en cada render)');
  red.componentDidUpdate({ nombre: 'Meta objetivo', reiniciarCon: [g, undefined], children: 'el bloque' });
  assert.deepEqual(pedidos, [{ roto: false }], 'le llegaron datos: reintenta');
  // Se compara de a uno y por identidad, como las dependencias de un efecto.
  assert.equal(cambio([g, datos], [g, datos]), false);
  assert.equal(cambio([g, datos], [{ ...g }, datos]), true);
  assert.equal(cambio(undefined, undefined), false);
  assert.equal(cambio([g], [g, datos]), true);
});

test('cada bloque de General se dibuja ADENTRO de su red (computadora y teléfono pasan por ElementoGeneral)', () => {
  const src = leer('app/dashboard/ElementoGeneral.tsx');
  const el = entre(src, 'export function ElementoGeneral(', 'function DibujoDeBloque(');
  assert.match(el, /<RedDeBloque key=\{JSON\.stringify\(e\.general\)\} nombre=\{info\.nombre\}>\s*<DibujoDeBloque /);
  assert.doesNotMatch(el, /\.dibujar\(/, '`dibujar` corre afuera de la red: un error al armar el bloque tumba la hoja');
  assert.match(entre(src, 'function DibujoDeBloque(', 'export function PiezaGeneralDeMuestra('), /g\?\.dibujar\(e\)/);
  // El teléfono dibuja los bloques con la MISMA pieza.
  assert.match(leer('app/m/hoy/GeneralM.tsx'), /<ElementoGeneral e=\{e\} \/>/);
});

test('las miniaturas también: el ejemplo roto de un bloque no se lleva la galería', () => {
  const src = leer('app/dashboard/ElementoGeneral.tsx');
  const m = entre(src, 'export function PiezaGeneralDeMuestra(', 'function MuestraDeBloque(');
  assert.match(m, /<RedDeBloque key=\{JSON\.stringify\(e\.general\)\} nombre=\{piezaGeneral\(pieza\)\.nombre\}>\s*<MuestraDeBloque /);
  assert.doesNotMatch(m, /\.muestra\(/);
});

test('en la computadora, cada tarjeta de la hoja (un elemento, un gráfico) va adentro de su red', () => {
  const src = leer('app/dashboard/EditorInforme.tsx');
  assert.match(src, /<RedDeBloque nombre=\{c\.texto\.trim\(\) \|\| c\.tipo\} reiniciarCon=\{\[c\]\}>\s*<CuerpoElemento e=\{c\}/);
  // El gráfico: lo que se devuelve como cuerpo (con o sin las acciones en la fila) va adentro, y reintenta con sus datos.
  assert.match(src, /return <RedDeBloque nombre=\{tituloDe\(c\)\} reiniciarCon=\{\[c, datos\[c\.id\]\]\}>\{conAcciones\}<\/RedDeBloque>;/);
  assert.equal((src.match(/<CuerpoGrafico /g) ?? []).length, 2, 'apareció otro CuerpoGrafico: ¿va adentro de la red?');
});
