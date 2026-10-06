// =============================================================================
// El orden manual de las columnas del kanban del CRM (mig 0200)
// =============================================================================
// Pedido de Martín (06/10/2026), por el chat de Customer Success: el hueco del arrastre
// seguía al cursor también en la MISMA columna, y soltar ahí no movía nada.
//   «cuando se hace esto, es como poner un "ORDENAMIENTO" dentro de filtros... normalmente
//   se ordena por orden de llegada. Para quitar eso y volver a antes, simplemente es volver
//   a ordenar por fecha y listo. Y luego si quiero volver a la posición que había dejado las
//   tarjetas es simplemente quitar filtros.»
//
// La pieza pura (app/crm/orden-kanban.ts) se EJECUTA. El cableado —quién guarda, cuándo
// «Ordenar» pasa a «Manual», qué limpia «Limpiar»— se mira sobre el código sin comentarios.
//
// Verificado además en el navegador (06/10/2026, ws4 de diseño, columna «No responde»):
// soltar arriba de otra reordena y sobrevive al F5; «Fecha de llegada» vuelve al orden de
// siempre con chip y contador; «Limpiar» vuelve a lo arrastrado. Y el «drop perdido» que
// Customer Success midió en su editor (soltar con el cursor quieto sobre el hueco) NO se
// reprodujo acá: 4 de 4 drops llegaron, así que no se agregó ese arreglo.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ordenarKanbanManual, ORDEN_KANBAN } from '../app/crm/orden-kanban';
import { antesDeQuien, columnaConInsercion } from '../app/customer-success/orden-manual';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

type L = { id: number; etapa: string };
const L = (id: number, etapa = 'a'): L => ({ id, etapa });
const ordenar = (ls: L[], listas: Record<string, number[]>) =>
  ordenarKanbanManual(ls, (l) => l.id, (l) => l.etapa, (e) => listas[e]).map((l) => l.id);

// ── La pieza pura ─────────────────────────────────────────────────────────────

test('cada columna va en el orden de SU lista', () => {
  assert.deepEqual(ordenar([L(4), L(3), L(2), L(1)], { a: [2, 4, 1, 3] }), [2, 4, 1, 3]);
});

test('⚠️ los que la lista no nombra (llegaron después del último arrastre) van ARRIBA, en orden de llegada', () => {
  // 9 y 8 entraron a la columna después de que alguien la ordenó: al CRM llegan leads todos
  // los días, y al final quedarían debajo de todo, donde nadie los ve.
  assert.deepEqual(ordenar([L(9), L(8), L(4), L(3), L(2)], { a: [2, 4, 3] }), [9, 8, 2, 4, 3]);
});

test('la lista que nombra a quien ya no está en esa columna se ignora, y las columnas sin lista no se tocan', () => {
  const ls = [L(5, 'b'), L(4), L(3, 'b'), L(2)];
  // 7 ya no existe y 3 se fue a la columna «b»: la lista de «a» sólo ordena a los suyos.
  const porColumna = (ids: number[], etapa: string) => ids.filter((id) => ls.find((l) => l.id === id)!.etapa === etapa);
  const r = ordenar(ls, { a: [7, 3, 2, 4] });
  assert.deepEqual(porColumna(r, 'a'), [2, 4]);
  assert.deepEqual(porColumna(r, 'b'), [5, 3], 'la columna sin lista queda en orden de llegada');
});

test('soltar arriba de otra: el vecino y la columna ENTERA (la pieza de Customer Success)', () => {
  const dibujadas = [4, 3, 2, 1];
  const antes = antesDeQuien(dibujadas, 1, [1]);
  assert.equal(antes, 3, 'el hueco sobre la 2ª tarjeta: antes de esa');
  assert.deepEqual(columnaConInsercion(dibujadas, [1], antes), [4, 1, 3, 2]);
});

test('«Ordenar» ofrece Manual y la fecha de llegada', () => {
  assert.deepEqual(Object.keys(ORDEN_KANBAN).sort(), ['llegada', 'manual']);
});

// ── El cableado del tablero ───────────────────────────────────────────────────

const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));

test('soltar en la MISMA columna reordena (hasta el 06/10 no hacía nada)', () => {
  assert.match(BOARD, /if \(effStage\(lead\) === stageKey\) \{\s*if \(antesDe !== undefined\) reordenarColumna\(id, stageKey, antesDe, false\);\s*return;/);
});

test('el lugar sale del HUECO dibujado, y sin hueco el orden no se toca', () => {
  assert.match(BOARD, /const antes = dragId != null && insTarjeta\?\.col === c\.key\s*\? antesDeQuien\(cards\.map\(\(x\) => x\.id\), insTarjeta\.idx, \[dragId\]\)\s*: undefined;\s*handleDrop\(c\.key, antes\);/);
});

test('en otra columna, el lugar se guarda recién cuando el movimiento SE HACE — en los dos caminos', () => {
  assert.match(BOARD, /persistStage\(id, stageKey, from, tr, senalesRef\.current\);\s*guardarLugar\(\);\s*return;/, 'el camino directo');
  assert.match(BOARD, /onOk: \(\) => \{ persistStage\(id, stageKey, from, tr, senalesRef\.current\); guardarLugar\(\); \}/, 'el que confirma');
});

test('cada columna se dibuja con el criterio elegido', () => {
  assert.match(BOARD, /const cards = enOrden\(filtered\.filter\(\(l\) => effStage\(l\) === c\.key\)\);/);
});

test('soltar donde ya estaba no guarda ni cambia «Ordenar»', () => {
  assert.match(BOARD, /if \(!mueve && mismaLista\(nueva, columna\)\) return;/);
});

test('⚠️ «Ordenar» se CALCULA: con algo arrastrado la base es «Manual», y vale por embudo', () => {
  assert.match(BOARD, /const ordenBase: OrdenKanban = hayOrdenManual \? 'manual' : 'llegada';/);
  assert.match(BOARD, /ordenElegido && ordenElegido\.funnel === funnelActivo \? ordenElegido\.valor : ordenBase/);
  assert.doesNotMatch(BOARD, /useState<OrdenKanban>/, 'un useState fijo perdería lo arrastrado en cada F5');
});

test('el orden local lleva el embudo en la clave (las etapas se repiten entre embudos)', () => {
  assert.match(BOARD, /const claveCol = \(etapa: string\) => `\$\{funnelActivo \?\? 0\}:\$\{etapa\}`;/);
});

// ── La barra: «Ordenar», su chip, y «Limpiar» vuelve a la base ────────────────

const TOOLBAR = sinComentarios(leer('app/crm/CrmToolbar.tsx'));

test('«Ordenar» cuenta como filtro sólo si se apartó de la base, y «Limpiar» vuelve a ella', () => {
  assert.match(TOOLBAR, /const ordenOn = !!orden && orden\.valor !== orden\.base;/);
  assert.match(TOOLBAR, /\+ \(ordenOn \? 1 : 0\);/);
  // El «Limpiar filtros» del menú y el «Limpiar» de la fila de chips, los dos.
  assert.equal((TOOLBAR.match(/orden\?\.elegir\(orden\.base\)/g) ?? []).length, 2);
  assert.match(TOOLBAR, /if \(orden && orden\.valor !== orden\.base\) \{/, 'el chip');
});

test('el tablero le pasa «Ordenar» al menú y a los chips, sólo en el kanban', () => {
  assert.match(BOARD, /const ordenFiltro = vista === 'kanban'/);
  assert.equal((BOARD.match(/orden=\{ordenFiltro\}/g) ?? []).length, 2);
});

// ── La base y la acción ───────────────────────────────────────────────────────

test('⚠️ la tabla: una fila por (embudo, etapa) con NULLS NOT DISTINCT, RLS y sin permisos públicos', () => {
  const mig = sinComentarios(leer('supabase/migrations/0200_lead_orden.sql').replace(/^--.*$/gm, ''));
  // El embudo del negocio es funnel_id NULL: sin NULLS NOT DISTINCT cada arrastre ahí insertaría
  // una fila nueva en vez de pisar la suya.
  assert.match(mig, /create unique index if not exists lead_orden_uk on lead_orden \(workspace_id, funnel_id, etapa\) nulls not distinct;/);
  assert.match(mig, /alter table lead_orden enable row level security;/);
  assert.match(mig, /revoke all on lead_orden from anon, authenticated;/);
});

test('lead_orden está en las dos listas de tablas por inquilino', () => {
  assert.match(leer('lib/workspace.ts'), /'lead_orden',/, 'sin esto getTenantDb() es passthrough');
  assert.match(leer('lib/tablas-de-inquilino.ts'), /'lead_orden'/, 'sin esto el reset no la vacía');
});

test('la acción guarda sólo leads de esta cuenta y de este embudo, contra el índice único', () => {
  const acc = sinComentarios(leer('app/crm/orden-actions.ts'));
  assert.match(acc, /funnel == null \? q\.is\('funnel_id', null\) : q\.eq\('funnel_id', funnel\)/);
  assert.match(acc, /onConflict: 'workspace_id,funnel_id,etapa'/);
  assert.match(acc, /if \(!etapas\.some\(\(s\) => s\.key === etapa\)\) return/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), una rotura a la vez — cada una dio 16 pass / 1 fail, y
// restaurado volvió a 17 / 0:
//   - `?? -1` → `?? Number.MAX_SAFE_INTEGER` en ordenarKanbanManual (los nuevos al final):
//     cae «los que la lista no nombra van ARRIBA».
//   - sacar `reordenarColumna(...)` del caso de la misma columna en handleDrop: cae «soltar en
//     la MISMA columna reordena».
//   - sacar el `guardarLugar();` del camino directo: cae «en otra columna… en los dos caminos».
//   - sacar `nulls not distinct` de la migración: cae «la tabla: una fila por (embudo, etapa)».
