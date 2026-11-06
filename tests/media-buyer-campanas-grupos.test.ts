// =============================================================================
// Media Buyer — Campañas: tres columnas por estado y un desplegable de producto (6/11/2026)
// =============================================================================
// Martín: «el gráfico de 3 no lo dividiría por CRM, sino que se pueda seleccionar un CRM tipo desplegable… tiene que tener sentido… el de
// Mauricio, todas las campañas en una columna, no tiene sentido». Fija lib/media-buyer/campanas-grupos.ts (puro). Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COLUMNAS, MIN_RESULTADOS, TOPE_POR_COLUMNA, grupoDe, opcionesDeProducto, referenciaDeCosto, repartirCampanas, verMas, visiblesPorProducto,
} from '../lib/media-buyer/campanas-grupos';
import type { CampanaDeLienzo, ProductoDeLienzo } from '../lib/media-buyer/productos';

let n = 0;
const camp = (o: Partial<CampanaDeLienzo> & { gasto: number; resultados: number }): CampanaDeLienzo => ({
  id: `c${++n}`, nombre: `Campaña ${n}`, prendida: true, presupuestoDia: 20, conjuntos: 2, costo: o.resultados ? o.gasto / o.resultados : null, tono: null, ...o,
});
const prod = (id: string, campanas: CampanaDeLienzo[]): ProductoDeLienzo => ({ id, nombre: `Producto ${id}`, gasto: 0, resultados: 0, costo: null, tono: null, campanas });

test('con objetivo: barata y con resultados suficientes funciona; cara, se revisa; en el medio, en prueba', () => {
  const OBJ = 10;
  const ref = referenciaDeCosto([], OBJ);
  assert.deepEqual(ref, { valor: 10, de: 'objetivo' });
  assert.equal(grupoDe(camp({ gasto: 80, resultados: 10 }), ref), 'funcionan', '8 por resultado, bajo 10');
  assert.equal(grupoDe(camp({ gasto: 100, resultados: 10 }), ref), 'funcionan', 'justo en el objetivo');
  assert.equal(grupoDe(camp({ gasto: 110, resultados: 10 }), ref), 'prueba', '11: dentro del 20% de margen');
  assert.equal(grupoDe(camp({ gasto: 130, resultados: 10 }), ref), 'revisar', '13: caro');
  assert.equal(grupoDe(camp({ gasto: 120, resultados: 10 }), ref), 'prueba', 'justo en el límite del margen no es caro');
});

test('poco dato no decide: menos de 3 resultados espera, aunque salga barato o caro', () => {
  const ref = { valor: 10, de: 'objetivo' as const };
  assert.equal(MIN_RESULTADOS, 3);
  assert.equal(grupoDe(camp({ gasto: 2, resultados: 2 }), ref), 'prueba', '1 por resultado con 2 resultados: no se cree');
  assert.equal(grupoDe(camp({ gasto: 200, resultados: 2 }), ref), 'prueba', '100 por resultado con 2: tampoco');
  assert.equal(grupoDe(camp({ gasto: 30, resultados: 3 }), ref), 'funcionan', 'con 3 ya cuenta');
});

test('sin resultados: se revisa sólo si ya gastó lo que cuesta un resultado', () => {
  const ref = { valor: 10, de: 'objetivo' as const };
  assert.equal(grupoDe(camp({ gasto: 9.99, resultados: 0 }), ref), 'prueba');
  assert.equal(grupoDe(camp({ gasto: 10, resultados: 0 }), ref), 'revisar');
  assert.equal(grupoDe(camp({ gasto: 500, resultados: 0 }), ref), 'revisar');
});

test('una campaña retenida por Meta siempre se revisa, y sin objetivo ni promedio todo está en prueba', () => {
  assert.equal(grupoDe(camp({ gasto: 0, resultados: 0, retenida: true }), { valor: 10, de: 'objetivo' }), 'revisar');
  assert.equal(grupoDe(camp({ gasto: 0, resultados: 0, retenida: true }), null), 'revisar');
  assert.equal(grupoDe(camp({ gasto: 900, resultados: 0 }), null), 'prueba', 'sin vara no se condena a nadie');
  const r = repartirCampanas([camp({ gasto: 50, resultados: 5 })], null);
  assert.equal(r.referencia, null, 'una sola campaña con resultados no se compara consigo misma');
  assert.equal(r.grupos.prueba.length, 1);
});

test('sin objetivo, la vara es el promedio de la cuenta (10% mejor, 50% peor)', () => {
  const cs = [camp({ gasto: 100, resultados: 10 }), camp({ gasto: 100, resultados: 5 }), camp({ gasto: 350, resultados: 10 })];
  const ref = referenciaDeCosto(cs, null)!;
  assert.equal(ref.de, 'promedio');
  assert.equal(ref.valor, 22, '550 de gasto / 25 resultados');
  const r = repartirCampanas(cs, null);
  assert.deepEqual(r.grupos.funcionan.map((c) => c.costo), [10], '10 <= 19.8');
  assert.deepEqual(r.grupos.prueba.map((c) => c.costo), [20], '20: ni bien ni mal');
  assert.deepEqual(r.grupos.revisar.map((c) => c.costo), [35], '35 > 33');
});

test('las pausadas van aparte y no mueven la vara; una retenida no cuenta como pausada', () => {
  const viva = camp({ gasto: 100, resultados: 10 });
  const pausada = camp({ gasto: 9999, resultados: 1, prendida: false });
  const retenida = camp({ gasto: 0, resultados: 0, prendida: false, retenida: true });
  const r = repartirCampanas([viva, pausada, retenida], 20);
  assert.deepEqual(r.pausadas.map((c) => c.id), [pausada.id]);
  assert.deepEqual(r.grupos.revisar.map((c) => c.id), [retenida.id]);
  assert.deepEqual(r.grupos.funcionan.map((c) => c.id), [viva.id]);
  assert.equal(referenciaDeCosto([viva, pausada], null), null, 'el promedio se arma con las prendidas');
});

test('cada campaña cae en UNA columna: nada se pierde ni se repite, con cualquier mezcla', () => {
  const cs: CampanaDeLienzo[] = [];
  for (let i = 0; i < 60; i++) cs.push(camp({ gasto: (i * 37) % 400, resultados: i % 9, prendida: i % 7 !== 0, retenida: i % 13 === 0 || undefined }));
  for (const obj of [null, 5, 25]) {
    const r = repartirCampanas(cs, obj);
    const ids = [...r.grupos.funcionan, ...r.grupos.prueba, ...r.grupos.revisar, ...r.pausadas].map((c) => c.id);
    assert.equal(ids.length, cs.length, `objetivo ${obj}`);
    assert.equal(new Set(ids).size, cs.length, `objetivo ${obj}: repetidas`);
  }
});

test('el caso de Mauricio: un solo producto con muchas campañas ya no cae todo en una columna ni muestra un desplegable de uno', () => {
  const cs: CampanaDeLienzo[] = [];
  for (let i = 0; i < 40; i++) cs.push(camp({ gasto: 50 + i * 10, resultados: i < 12 ? 8 : i < 28 ? 1 : 0 }));
  const productos = [prod('1', cs)];
  assert.deepEqual(opcionesDeProducto(productos, []), [], 'un solo producto: sin desplegable');
  const r = repartirCampanas(visiblesPorProducto(productos, [], 'todos'), 12);
  const largos = COLUMNAS.map((c) => r.grupos[c.id].length);
  assert.ok(largos.every((x) => x > 0), `las tres columnas tienen campañas: ${largos}`);
  assert.ok(Math.max(...largos) < cs.length, 'ninguna columna se come todas');
  // Con tantas, cada columna muestra el tope y ofrece el resto.
  assert.equal(TOPE_POR_COLUMNA, 6);
  assert.equal(verMas(largos[0], TOPE_POR_COLUMNA), largos[0] > 6 ? `Ver ${largos[0] - 6} más` : null);
  assert.equal(verMas(5, 6), null);
  assert.equal(verMas(7, 6), 'Ver 1 más');
});

test('el desplegable: todos, uno por producto con campañas, y «Sin producto» sólo si hay; filtra de verdad', () => {
  const a = camp({ gasto: 10, resultados: 1 }), b = camp({ gasto: 20, resultados: 2 }), c = camp({ gasto: 30, resultados: 3 });
  const productos = [prod('7', [a]), prod('8', [b]), prod('9', [])];
  const huerfana = [c];
  const ops = opcionesDeProducto(productos, huerfana);
  assert.deepEqual(ops.map((o) => [o.id, o.n]), [['todos', 3], ['7', 1], ['8', 1], ['sin', 1]], 'el producto 9 no tiene campañas y no aparece');
  assert.deepEqual(visiblesPorProducto(productos, huerfana, 'todos').map((x) => x.id), [a.id, b.id, c.id]);
  assert.deepEqual(visiblesPorProducto(productos, huerfana, '8').map((x) => x.id), [b.id]);
  assert.deepEqual(visiblesPorProducto(productos, huerfana, 'sin').map((x) => x.id), [c.id]);
  assert.deepEqual(visiblesPorProducto(productos, huerfana, 'no-existe'), []);
  assert.deepEqual(opcionesDeProducto([prod('7', [a])], [c]).map((o) => o.id), ['todos', '7', 'sin'], 'un producto y huérfanas: sí hay qué elegir');
});

test('cada columna dice qué es y sirve para algo: título, ayuda y estado vacío', () => {
  assert.deepEqual(COLUMNAS.map((c) => c.id), ['funcionan', 'prueba', 'revisar']);
  for (const c of COLUMNAS) assert.ok(c.titulo && c.ayuda && c.vacia, c.id);
});

test('está conectado: Campañas dibuja las tres columnas por estado y no una por producto', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'app/ads-manager/Lienzo.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /repartirCampanas\(/);
  assert.match(src, /opcionesDeProducto\(/);
  assert.doesNotMatch(src, /\.\.\.l\.productos\.map\(\(p\) => \(\{\s*clave: p\.id/, 'ya no hay una columna por producto');
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. MIN_RESULTADOS de 3 a 1                                  → rojo «poco dato no decide».
//   2. `c.gasto >= ref.valor` a `> 0` en el caso sin resultados  → rojo «sin resultados».
//   3. repartir sin separar las pausadas                         → rojo «las pausadas van aparte».
//   4. opcionesDeProducto sin el `length > 1`                    → rojo «el caso de Mauricio».
