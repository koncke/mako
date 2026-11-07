// =============================================================================
// La galería del teléfono: UNA columna, y la que se CUENTA es la que se DIBUJA (6/11/2026)
// =============================================================================
// `GrillaPiezas` (app/competitor-spy/GrillaPiezas.tsx) escribe `grid-template-columns` en el ESTILO EN LÍNEA con las
// columnas que midió, y cuenta la paginación con ESE número (`porPagina = columnas * FILAS_POR_PAGINA`). La pantalla de
// /m necesita una sola columna (docs/diseno-competitors-spy.md §8) y la forzaba con `!important` desde su hoja, porque un
// estilo en línea le gana a cualquier clase: se VEÍA una columna y se CONTABAN las dos que el componente creía dibujar a
// 390 px, así que cada página del teléfono traía seis tarjetas en vez de tres — el doble de miniaturas que bajar con
// datos (docs/hallazgos-mobile.md, «Montar una pieza de escritorio en /m»). Ahora la columna se PIDE con la prop
// `columnas`, y el cálculo de siempre quedó como default: el escritorio no cambia.
//
// PROBADO ROMPIÉNDOLO (6/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · SpyM.tsx sin `columnas={1}`                                      → 1
//   · la hoja de /m vuelve a `grid-template-columns … !important`      → 2
//   · `GrillaPiezas` ignora la prop y mide siempre                     → 3
//   · el estilo en línea dibuja `medidas` y `porPagina` cuenta otra cosa → 3
// Correr: node --import tsx --test tests/spy-telefono-una-columna.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FILAS_POR_PAGINA, columnasQueEntran } from '../lib/spy-vista';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la pantalla del teléfono PIDE una columna, y por eso una página son tres tarjetas y no seis', () => {
  const m = sinComentarios(leer('app/m/competitor-spy/SpyM.tsx'));
  assert.equal(m.split('<GrillaPiezas').length - 1, 1, 'una sola grilla en la pantalla: si hay dos, este test mira la otra');
  const etiqueta = m.slice(m.indexOf('<GrillaPiezas'), m.indexOf('<GrillaPiezas') + 2000);
  assert.match(etiqueta, /\bcolumnas=\{1\}/, 'sin la prop, la grilla mide la caja y cuenta DOS columnas a 390 px');

  // La cuenta que cambia: a 390 px de pantalla la caja mide ~358 y entran dos columnas de 150 con hueco de 12.
  assert.equal(FILAS_POR_PAGINA, 3);
  assert.equal(columnasQueEntran(358, 150, 12) * FILAS_POR_PAGINA, 6, 'lo que traía una página del teléfono: el doble');
  assert.equal(1 * FILAS_POR_PAGINA, 3, 'lo que trae pedida: una tarjeta por fila, tres filas');
});

test('2. la hoja de /m no le pelea el estilo en línea: la columna única no se declara en dos lugares', () => {
  const css = leer('app/m/competitor-spy/competitor-spy.css');
  const i = css.indexOf('.m-competitor-spy .spy-pgrid {');
  assert.ok(i > 0, 'la hoja de /m viste la grilla, que no trae su CSS (docs/hallazgos-mobile.md)');
  const regla = css.slice(i, css.indexOf('}', i));
  assert.match(regla, /display: grid/, 'la grilla sigue siendo grilla');
  assert.doesNotMatch(regla, /grid-template-columns/, 'las columnas las pide la pantalla con `columnas`, no esta hoja');
  assert.doesNotMatch(regla, /!important/, 'un `!important` cambia lo que se VE y deja la cuenta como estaba');
});

test('3. GrillaPiezas dibuja y cuenta el MISMO número, y el escritorio sigue midiendo', () => {
  const g = leer('app/competitor-spy/GrillaPiezas.tsx');
  assert.match(g, /columnas\?: number;/, 'la prop es OPCIONAL: sin ella, el cálculo de siempre');
  assert.match(g, /const columnas = Math\.max\(1, Math\.floor\(pedidas \?\? medidas\)\);/, 'gana la pedida; si no hay, la medida (y nunca menos de 1: con 0 las páginas son infinitas)');
  assert.match(g, /if \(pedidas != null\) return;/, 'con la prop no se mide ni se observa el ancho de la caja');
  assert.match(g, /gridTemplateColumns: `repeat\(\$\{columnas\}, minmax\(0, 1fr\)\)`/, 'se DIBUJA con `columnas`');
  assert.match(g, /const porPagina = columnas \* FILAS_POR_PAGINA;/, 'y se CUENTA con el mismo `columnas`');
  assert.doesNotMatch(g, /porPagina = medidas/, 'contar con lo medido mientras se dibuja lo pedido es el bug que esto cierra');
});
