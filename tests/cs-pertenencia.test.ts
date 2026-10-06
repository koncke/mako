// =============================================================================
// De qué productos es cada cliente de Customer Success
// =============================================================================
// «Un cliente puede estar en varios productos, lo mismo que el CRM… Pero en el producto de
// PRUEBA debería estar vacío, elimina a los clientes de allí» (Martín, 06/10/2026).
//
// Hasta ese día cada kanban dibujaba a la cartera ENTERA: «un cliente sin fila está en la
// primera etapa» no preguntaba de qué producto era. La regla nueva (app/customer-success/
// pertenencia.ts) se EJECUTA acá, y el cableado se mira sobre el código sin comentarios: si
// uno de los universos que cuelgan del producto no pasa por el filtro, el editor de etapas
// cuenta clientes que el tablero no muestra.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { casaDeCliente, esDelProducto } from '../app/customer-success/pertenencia';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// Negocio que Escala, medido el 06/10/2026: embudo principal 1 → producto 1; «Prueba» (13)
// tiene su embudo 9 y ningún cliente.
const FUNNELS = new Map([[1, 1], [9, 13]]);
const OFRECIDOS = [1, 13];
const casa = (funnelId: number | null, tieneFilas = false, funnelDefault: number | null = 1) =>
  casaDeCliente({ funnelId, funnelDefault, productoDeFunnel: FUNNELS, ofrecidos: OFRECIDOS, tieneFilas });

test('sin embudo puesto es del producto del embudo PRINCIPAL, como en el CRM', () => {
  // `funnel_id = null` es el embudo del negocio, no «sin producto»: los 1.530 leads lo tienen así.
  assert.equal(casa(null), 1);
  assert.equal(casa(9), 13, 'con su embudo, su producto');
});

test('«Prueba» queda VACÍO: un cliente sin fila ahí no es de ahí', () => {
  const c = { 5: casa(null) };
  assert.equal(esDelProducto(5, 1, c, {}), true);
  assert.equal(esDelProducto(5, 13, c, {}), false, 'volvió a dibujarse la cartera entera en cada producto');
});

test('una FILA lo hace de otro producto más: puede estar en varios', () => {
  const c = { 5: casa(null) };
  // La clave presente es una fila, aunque esté en la primera etapa.
  assert.equal(esDelProducto(5, 13, c, { 5: { etapa: 'bienvenida' } }), true);
  assert.equal(esDelProducto(5, 1, c, { 5: { etapa: 'bienvenida' } }), true, 'tener fila en otro no lo saca de su casa');
});

test('sin casa que se ofrezca: si tiene filas vive donde lo pusieron, si no cae al primero', () => {
  // Código Inmobiliario: su embudo principal no está atado a ningún producto.
  const sinAtar = (tieneFilas: boolean) => casaDeCliente({ funnelId: null, funnelDefault: 6, productoDeFunnel: new Map(), ofrecidos: [4, 6], tieneFilas });
  assert.equal(sinAtar(true), null, 'se le inventó una casa a quien ya tiene un producto');
  assert.equal(sinAtar(false), 4, 'un cliente sin casa ni filas desaparecería de todos los tableros');
  // Un embudo cuyo producto ya no se ofrece (lo eliminó el CRM) tampoco es una casa.
  assert.equal(casaDeCliente({ funnelId: 7, funnelDefault: 1, productoDeFunnel: new Map([[7, 99]]), ofrecidos: [1], tieneFilas: true }), null);
  // Y sin ningún producto ofrecido no hay casa posible.
  assert.equal(casaDeCliente({ funnelId: null, funnelDefault: null, productoDeFunnel: new Map(), ofrecidos: [], tieneFilas: false }), null);
});

test('una clave HEREDADA del prototipo no es una fila', () => {
  // `in` contestaría que sí para «toString»; la pertenencia mira claves propias.
  assert.equal(esDelProducto(Number('NaN'), 13, {}, {}), false);
  assert.equal(esDelProducto(0, 13, {}, Object.create({ 0: 'heredada' })), false);
});

// ── El cableado: los CUATRO universos del producto pasan por el filtro ────────

const APP = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));

test('el kanban, la tabla, «N de M» y el conteo del editor salen de los clientes DEL producto', () => {
  assert.match(APP, /const visiblesServ = delServicio\(visibles\);/);
  assert.match(APP, /const listaServ = delServicio\(lista\);/);
  assert.match(APP, /cs\.filter\(\(c\) => esDelProducto\(c\.leadId, servicio\.productoId, casa, asigServicio\)\)/);
  assert.match(APP, /<KanbanEntrega[\s\S]*?clientes=\{visiblesServ\}/, 'el kanban dibuja a la cartera entera');
  assert.match(APP, /<TablaClientes filas=\{visiblesServ\}/, 'la tabla dibuja a la cartera entera');
  assert.match(APP, /nTotal=\{listaServ\.length\}/, '«N de M» cuenta clientes de otros productos');
  assert.match(APP, /conteo=\{conteoDeEtapas\(servicio\.etapas,\s*listaServ\.map/, 'el editor avisa por clientes que el tablero no muestra');
  // Y lo que está en pantalla con una fase elegida parte de los del producto, no de `visibles`.
  const enPantalla = APP.slice(APP.indexOf('const enPantalla ='), APP.indexOf('const elegidosVisibles'));
  assert.ok(!/\bvisibles\b(?!Serv)/.test(enPantalla), 'el lote y el exportar vuelven a ver clientes de otro producto');
});

test('la casa la calcula el server con la MISMA función, y viaja con la entrega', () => {
  const ENT = sinComentarios(leer('app/customer-success/entrega.ts'));
  assert.match(ENT, /out\[l\.id\] = casaDeCliente\(\{/);
  assert.match(ENT, /return \{ ok: true, servicios, porServicio, secuenciasPorServicio: Object\.fromEntries\(secs\), casaPorLead \};/);
});

test('la ficha agrega a un producto por el MISMO camino que el kanban', () => {
  // `onMover` es `moverEntrega` de ClientesApp: deshacer, reloj e historial incluidos.
  assert.match(APP, /onMover: \(etapa, prodId\) => moverEntrega\(abierto\.leadId, etapa, prodId\)/);
  const FE = sinComentarios(leer('app/customer-success/FichaEntrega.tsx'));
  assert.match(FE, /onClick=\{\(\) => e\.onMover\(s\.etapas\[0\]\.key, s\.productoId\)\}/);
  assert.match(FE, /const esSuyo = esDelProducto\(leadId, s\.productoId, e\.casa, asig\);/);
});

// PROBADO ROMPIÉNDOLO (06/10/2026), corrido junto con cs-ficha-resumen: baseline 20 pass / 0
// fail. Cada rotura, de a una y restaurada de memoria:
//   1. `esDelProducto` → `return true` (la cartera entera en todos) → 18/2: «Prueba queda
//      VACÍO» y «una clave HEREDADA…».
//   2. `casaDeCliente` sin `if (opts.tieneFilas) return null;` → 19/1: «sin casa que se ofrezca…».
//   3. `<TablaClientes filas={visibles}` → 19/1: «el kanban, la tabla, N de M…».
//   4. `nTotal={lista.length}` → 19/1: el mismo.
