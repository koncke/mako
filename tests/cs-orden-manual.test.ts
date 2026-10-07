// =============================================================================
// El orden manual de las columnas del kanban de Customer Success (mig 0196)
// =============================================================================
// «Si a un cliente lo arrastro abajo de otro, no se ve esa animación» (Martín, 06/10/2026),
// y al preguntarle si esa posición se guarda: «Se guarda + "Manual"».
//
// Las funciones PURAS (app/customer-success/orden-manual.ts) se EJECUTAN: deciden dónde cae
// una tarjeta y cómo queda la columna guardada. El cableado (quién guarda, cuándo «Ordenar»
// pasa a «Manual») se mira sobre el código sin comentarios.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { indiceEnColumna, antesDeQuien, columnaConInsercion, ordenarManual, mismaLista } from '../app/customer-success/orden-manual';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── Dónde cae ─────────────────────────────────────────────────────────────────

test('el hueco sigue al cursor: antes de la primera tarjeta cuyo medio está más abajo', () => {
  const medios = [100, 200, 300];
  assert.equal(indiceEnColumna(medios, 50), 0);
  assert.equal(indiceEnColumna(medios, 150), 1, 'entre la 1ª y la 2ª');
  assert.equal(indiceEnColumna(medios, 299), 2);
  assert.equal(indiceEnColumna(medios, 999), 3, 'debajo de todas: al final');
  assert.equal(indiceEnColumna([], 10), 0, 'columna vacía');
});

test('el vecino: la primera tarjeta desde el hueco que NO viaja; null = al final', () => {
  // Lo que viaja sigue dibujado en su lugar durante el gesto, así que se saltea.
  assert.equal(antesDeQuien([1, 2, 3], 1, [5]), 2);
  assert.equal(antesDeQuien([1, 2, 3], 1, [2]), 3, 'el hueco justo debajo de sí misma: antes de la de abajo');
  assert.equal(antesDeQuien([1, 2, 3], 3, [5]), null);
  assert.equal(antesDeQuien([1, 2, 3], 2, [3]), null, 'la última soltada debajo de sí misma: al final');
});

// ── Cómo queda la columna ────────────────────────────────────────────────────

test('la columna ENTERA con lo que viaja insertado antes del vecino, en su orden', () => {
  assert.deepEqual(columnaConInsercion([1, 2, 3, 4], [4], 2), [1, 4, 2, 3]);
  assert.deepEqual(columnaConInsercion([1, 2, 3], [9, 8], 2), [1, 9, 8, 2, 3], 'un lote entra junto');
  assert.deepEqual(columnaConInsercion([1, 2, 3], [1], null), [2, 3, 1], 'al final');
  // ⚠️ El vecino puede ser alguien que el buscador muestra; los escondidos (7) no se mueven
  // al final: la lista es la columna entera, no lo que se ve.
  assert.deepEqual(columnaConInsercion([7, 1, 2], [2], 1), [7, 2, 1]);
  // Un vecino que no está en la columna (se movió) cae al final en vez de perderse.
  assert.deepEqual(columnaConInsercion([1, 2], [3], 99), [1, 2, 3]);
});

test('ordenar por la lista de SU columna; lo que no figura va después, en el orden que traía', () => {
  const cs = [{ id: 1, e: 'a' }, { id: 2, e: 'a' }, { id: 3, e: 'a' }, { id: 4, e: 'b' }, { id: 5, e: 'b' }];
  const listas: Record<string, number[]> = { a: [3, 1], b: [5] };
  const r = ordenarManual(cs, (c) => c.id, (c) => c.e, (e) => listas[e]);
  // Dentro de «a»: 3, 1 y después el 2 (no figura). Dentro de «b»: 5 y después el 4.
  const a = r.filter((c) => c.e === 'a').map((c) => c.id);
  const b = r.filter((c) => c.e === 'b').map((c) => c.id);
  assert.deepEqual(a, [3, 1, 2]);
  assert.deepEqual(b, [5, 4]);
  // ⚠️ La lista de «a» nombra a alguien que ya se movió a «b»: en «b» no cuenta esa posición.
  const r2 = ordenarManual(cs, (c) => c.id, (c) => c.e, (e) => ({ a: [4, 2], b: [] } as Record<string, number[]>)[e]);
  assert.deepEqual(r2.filter((c) => c.e === 'b').map((c) => c.id), [4, 5], 'el 4 está en «b» y la lista de «b» no lo nombra');
  assert.ok(mismaLista([1, 2], [1, 2]) && !mismaLista([1, 2], [2, 1]) && !mismaLista([1], [1, 2]));
});

// ── El cableado ───────────────────────────────────────────────────────────────

const APP = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
const fnSoltar = APP.slice(APP.indexOf('function soltarEnColumna('), APP.indexOf('function quitarDeProducto('));

test('soltar guarda la columna ENTERA, y soltar donde ya estaba no hace nada', () => {
  assert.ok(fnSoltar.length > 300 && fnSoltar.length < 3_000, `soltarEnColumna mide ${fnSoltar.length}`);
  // La columna sale de los clientes del producto SIN el buscador (`listaServ`), ordenados como
  // se dibujan: con `visiblesServ`, reordenar con una búsqueda puesta mandaba al final a los escondidos.
  assert.match(fnSoltar, /const columna = conManual\(porCriterio\(listaServ\)\)/);
  assert.match(fnSoltar, /if \(!mueven\.length && mismaLista\(nueva, columna\)\) return;/);
  // Por `atajar` (06/10/2026): sin red la promesa rechaza y, en una transición, tumba la pantalla.
  assert.match(fnSoltar, /await atajar\(ordenarEtapaAction\(prodId, etapa, nueva\)/);
  // Y pasa a «Manual» recordando el criterio de antes, que ordena a los que nadie arrastró.
  assert.match(fnSoltar, /if \(orden !== 'manual'\) \{ setOrdenPrevio\(orden\); setOrden\('manual'\); \}/);
  // Un lote es UN deshacer aunque al final cambie uno solo.
  assert.match(fnSoltar, /if \(ids\.length > 1\) moverLote\(mueven, etapa, prodId\);/);
});

test('«Manual» ordena lo que se dibuja, sólo con un servicio y sin sentido «al revés»', () => {
  assert.match(APP, /const visiblesServ = conManual\(delServicio\(visibles\)\);/);
  assert.match(APP, /orden === 'manual' && servicio\s*\? ordenarManual\(/);
  assert.match(APP, /ordenes=\{servicio \? ORDEN_CS : ORDEN_LABEL\}/);
  assert.match(APP, /onDir=\{orden === 'manual' \? undefined : setDir\}/);
  // «Si quiero volver a la posición que había dejado las tarjetas es simplemente quitar filtros»
  // (Martín, 06/10/2026): con algo guardado, «Manual» es la base y «Limpiar filtros» vuelve ahí.
  assert.match(APP, /ordenBase=\{hayOrdenManual \? 'manual' : 'nombre'\}/);
  // Arranca en «Manual» si alguien ya ordenó: si no, cada F5 lo escondería.
  assert.match(APP, /useState<OrdenCS>\(\(\) =>\s*entrega\?\.ok && Object\.values\(entrega\.ordenPorServicio\)\.some/);
  // /admin monta la misma barra y no tiene nada que arrastrar: «Manual» no entra a ORDEN_LABEL.
  assert.doesNotMatch(sinComentarios(leer('app/customer-success/BarraClientes.tsx')), /manual:/);
});

test('el server guarda sólo clientes del workspace y en una etapa que existe', () => {
  const ACC = sinComentarios(leer('app/customer-success/actions.ts'));
  const ini = ACC.indexOf('export async function ordenarEtapaAction');
  const fn = ACC.slice(ini, ACC.indexOf('export async function', ini + 10));
  assert.match(fn, /if \(!entrega\.etapas\.some\(\(e\) => e\.key === etapa\)\) return \{ ok: false/);
  assert.match(fn, /\.in\('id', pedidos\)\.eq\('estado_lead', 'ganado'\)/);
  assert.match(fn, /onConflict: 'workspace_id,producto_id,etapa'/);
  // Y la tabla es de inquilino: sin eso `getTenantDb` no le pone el `.eq` del workspace.
  assert.match(leer('lib/tablas-de-inquilino.ts'), /'cliente_entrega_orden'/);
  assert.match(leer('lib/workspace.ts'), /'cliente_entrega_fuera', 'cliente_entrega_orden',/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), corrido junto con cs-pertenencia: baseline 17 pass / 0
// fail. Cada rotura, de a una y restaurada de memoria, cayó en el test que le toca — 16/1:
//   1. `indiceEnColumna` comparando contra otra altura → «el hueco sigue al cursor…».
//   2. `antesDeQuien` sin saltear a los que viajan → «el vecino…».
//   3. `columnaConInsercion` sin sacar primero a los que viajan → «la columna ENTERA…».
//   4. `ordenarManual` sin usar la lista (sólo el orden de llegada) → «ordenar por la lista…».
//   5. `soltarEnColumna` armando la columna con `visiblesServ` (lo que se ve) → «soltar guarda…».
//   6. `soltarEnColumna` sin cortar cuando no cambió nada → el mismo.
//   (Las tres de «Quitar» —la casa sin mirar `fuera`, la cruz con un solo producto y el server
//   sin contar— cayeron en tests/cs-pertenencia.test.ts, 16/1 cada una.)
