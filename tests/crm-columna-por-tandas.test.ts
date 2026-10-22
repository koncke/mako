// =============================================================================
// La columna del Kanban por TANDAS (22/10/2026): el tablero abre rápido con 1.050 leads en una columna
// =============================================================================
// El sábado Mauricio abre «Sprint 3 días» con 1.050 en «Lead entrante» y mueve 50 por día. En el Chrome de Martín, el de
// 300 dejó la pestaña minutos sin responder. Medido con el arnés (tests/_crm-tablero-medir.mjs: el CrmBoard REAL en un
// Chrome sin ventana, con foto y «Datos pendientes» en todas, después de una corrida de calentamiento):
//   · antes (todas dibujadas): 300 → pinta en 934 ms, 1,1 s de tareas largas · 1.050 → 1,13 s, tildar 348 ms, 1,6 s
//     (en otra corrida, con la máquina más cargada: 2,2 s y 3,6 s);
//   · después (60 por columna, y 60 más al llegar al fondo): 300 → 98 ms, 264 ms · 1.050 → 161 ms, tildar 32 ms, 480 ms.
// Lo que NO puede cambiar: el conteo de la columna, la casilla que tilda a TODOS los de la columna (también los que no
// se dibujaron) y el orden al soltar miran la columna entera.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el tablero dibujando `cards` entera otra vez                                                  → 3 / 1
//   · la casilla de la columna tildando sólo las dibujadas                                         → 3 / 1
//   · el conteo de la columna con las dibujadas                                                    → 3 / 1
//   · el final de la columna sin pedir la tanda siguiente al asomar                                → 3 / 1
// Correr: node --import tsx --test tests/crm-columna-por-tandas.test.ts
// Medir: node tests/_crm-tablero-medir.mjs 50 300 1050   (con ARNES_QS="marcar=1&fotos=1")
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cuantasDibujar, rotuloVerMas, TANDA_COLUMNA } from '../app/crm/columna-por-tandas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));
const columna = () => { const i = BOARD.indexOf('const renderColumn = '); return BOARD.slice(i, BOARD.indexOf('const caminoTarjeta = ', i)); };

test('cuántas se dibujan: una tanda de 60, y las que se pidan; nunca más que las que hay', () => {
  assert.equal(TANDA_COLUMNA, 60);
  assert.equal(cuantasDibujar(1050, undefined), 60);
  assert.equal(cuantasDibujar(1050, 120), 120);
  assert.equal(cuantasDibujar(30, undefined), 30);
  assert.equal(cuantasDibujar(0, 180), 0);
  assert.equal(rotuloVerMas(990), 'Ver 60 más · quedan 990');
  assert.equal(rotuloVerMas(12), 'Ver 12 más · quedan 12');
});

test('el tablero dibuja la tanda, pero el conteo, la casilla y el orden miran la columna ENTERA', () => {
  const c = columna();
  assert.match(c, /const dibujadas = cards\.slice\(0, cuantasDibujar\(cards\.length, tandas\[c\.key\]\)\);/);
  assert.match(c, /\{dibujadas\.map\(\(l, iCard\) => \{/, 'el tablero volvió a dibujar la columna entera');
  assert.doesNotMatch(c, /\{cards\.map\(\(l, iCard\)/);
  assert.match(c, /const idsCol = cards\.map\(\(x\) => x\.id\);/, 'la casilla de la columna tilda sólo las dibujadas');
  assert.match(c, /fontVariantNumeric: 'tabular-nums' \}\}>\{cards\.length\}<\/span>/, 'el conteo de la columna no dice el total');
  assert.match(c, /antesDeQuien\(cards\.map\(\(x\) => x\.id\), insTarjeta\.idx, \[dragId\]\)/, 'soltar no ordena contra la columna entera');
  assert.match(c, /insTarjeta\.idx >= dibujadas\.length/, 'el hueco del final no aparece debajo de la última dibujada');
  assert.match(c, /\{cards\.length > dibujadas\.length && \(\s*<FinDeColumna quedan=\{cards\.length - dibujadas\.length\} onVerMas=\{\(\) => verMasDe\(c\.key\)\} \/>/);
  // Otro CRM empieza de nuevo.
  assert.match(BOARD, /useEffect\(\(\) => \{ setTandas\(\{\}\); \}, \[funnelActivo\]\);/);
});

test('el final de la columna pide la tanda siguiente al asomar (y con el toque)', () => {
  const f = sinComentarios(leer('app/crm/FinDeColumna.tsx'));
  assert.match(f, /new IntersectionObserver\(\(es\) => \{ if \(es\.some\(\(e\) => e\.isIntersecting\)\) pedir\.current\(\); \},\s*\{ root: el\.closest\('\[data-carril\]'\), rootMargin: '0px 0px 400px 0px' \}\)/);
  assert.match(f, /<button type="button" data-nodrag onClick=\{onVerMas\}/);
});

test('el mover de a varios no depende de lo dibujado: usa los tildados', () => {
  // `elegidos` sale de `leads` y la casilla, de `cards`: tildar la columna con 1.050 y arrastrar uno mueve a los 1.050.
  assert.match(BOARD, /const elegidos = useMemo\(\(\) => leads\.filter\(\(l\) => selLeads\.has\(l\.id\)\), \[leads, selLeads\]\);/);
  assert.match(BOARD, /if \(desdeArrastre && selLeads\.has\(id\) && elegidos\.length > 1 && manijaLote\.current\) \{\s*manijaLote\.current\.moverDeEtapa\(stageKey\);\s*return;\s*\}/);
});
