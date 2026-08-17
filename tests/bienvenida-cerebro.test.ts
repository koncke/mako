// =============================================================================
// El mapa de la portada tiene que ser una NUBE, no un árbol
// =============================================================================
// Pedido del dueño: «que como están armados los nodos, sea como hoy se arman… tipo
// cerebro, no como un árbol». Antes esta pantalla dibujaba anillos concéntricos
// calculados con trigonometría — un árbol radial, y se notaba.
//
// ⚠️ CAMBIAR EL MOTOR NO ALCANZA, Y ESTE TEST EXISTE POR ESO. `lib/cerebro-layout.ts` lo
// dice: «sobre un árbol ninguna simulación da la nube de Obsidian». Se puede pasar la
// ficción por d3-force y seguir obteniendo un diente de león, porque el layout no puede
// inventar una forma que los datos no tienen. Lo que hace la nube son las ARISTAS
// LATERALES, y eso es una propiedad de los DATOS: se mide acá, no se mira a ojo.
//
// Los cuatro umbrales son los que `lib/cerebro-grafo.ts:875-876` midió sobre cuatro
// workspaces reales, con el árbol puro al lado para comparar:
//
//              | árbol puro (medido) | umbral  |
//   densidad   | 0,79 - 0,83         | ≥ 1,5   |
//   hojas      | 63% - 67%           | ≤ 30%   |
//   hub        | 7,0× - 7,8×         | ≤ 4,5×  |
//   clustering | 0,00                | ≥ 0,15  |
//
// Si este test se pone en rojo, lo que se rompió NO es un número: es que el mapa volvió a
// ser un árbol y la portada volvió a mentir sobre cómo se ve el producto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grafoBienvenida } from '../lib/bienvenida-cerebro';

const { nodos, aristas } = grafoBienvenida();

/** Vecinos de cada nodo, sin dirección: la forma no depende de hacia dónde apunta. */
function vecinos(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const n of nodos) m.set(n.id, new Set());
  for (const a of aristas) {
    m.get(a.de)?.add(a.a);
    m.get(a.a)?.add(a.de);
  }
  return m;
}

test('las aristas apuntan a nodos que EXISTEN', () => {
  // Una arista colgada no rompe nada visible —el grafo la descarta— pero se lleva puesta
  // la lateral que la hacía falta, y el mapa vuelve a ser un árbol sin que nada avise.
  const ids = new Set(nodos.map((n) => n.id));
  for (const a of aristas) {
    assert.ok(ids.has(a.de), `arista desde un nodo que no existe: ${a.de}`);
    assert.ok(ids.has(a.a), `arista hacia un nodo que no existe: ${a.a}`);
    assert.ok(a.motivo.trim(), `arista sin motivo (${a.de} → ${a.a}): el hover queda mudo`);
  }
});

test('no hay ids repetidos', () => {
  // Ya pasó en esta misma pantalla: dos nodos con el mismo id y React omite uno.
  const ids = nodos.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids duplicados en el mapa de la portada');
});

test('DENSIDAD: más de 1,5 aristas por nodo (un árbol da menos de 1)', () => {
  // Un árbol tiene exactamente N-1 aristas: densidad < 1 siempre. Pasar de 1,5 solo se
  // logra con aristas que NO son de padre a hijo.
  const d = aristas.length / nodos.length;
  assert.ok(d >= 1.5, `densidad ${d.toFixed(2)} — por debajo de 1,5 esto es un árbol (${aristas.length} aristas / ${nodos.length} nodos)`);
});

test('HOJAS: menos del 30% de los nodos tienen un solo vecino', () => {
  // El árbol puro medido daba 63-67%. Una hoja es un nodo que no conecta nada: muchas
  // hojas es la firma del diente de león.
  const v = vecinos();
  const hojas = [...v.values()].filter((s) => s.size <= 1).length;
  const pct = (hojas / nodos.length) * 100;
  assert.ok(pct <= 30, `${pct.toFixed(0)}% de hojas — el árbol puro daba 63-67%, el techo es 30%`);
});

test('HUB: ningún nodo concentra más de 4,5× el grado promedio', () => {
  // Si el centro concentra todo, el layout dibuja un abanico con un punto gordo al medio.
  const v = vecinos();
  const grados = [...v.values()].map((s) => s.size);
  const prom = grados.reduce((a, b) => a + b, 0) / grados.length;
  const max = Math.max(...grados);
  const razon = max / prom;
  assert.ok(razon <= 4.5, `el nodo más conectado tiene ${razon.toFixed(1)}× el promedio (techo 4,5×)`);
});

test('CLUSTERING: hay triángulos de verdad (≥ 0,15)', () => {
  // ⚠️ ES EL QUE MÁS IMPORTA Y EL ÚNICO QUE UN ÁRBOL NO PUEDE FALSEAR: un árbol tiene
  // clustering CERO por definición — no hay un solo triángulo. Que este número suba
  // significa que los vecinos de un nodo también se conocen entre sí, que es exactamente
  // lo que un force layout convierte en nube.
  const v = vecinos();
  let suma = 0;
  let cuenta = 0;
  for (const [, vec] of v) {
    const lista = [...vec];
    if (lista.length < 2) continue;
    let enlaces = 0;
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (v.get(lista[i])?.has(lista[j])) enlaces++;
      }
    }
    suma += (2 * enlaces) / (lista.length * (lista.length - 1));
    cuenta++;
  }
  const c = cuenta ? suma / cuenta : 0;
  assert.ok(c >= 0.15, `clustering ${c.toFixed(3)} — un árbol da 0,000; el piso es 0,15`);
});

test('el grafo es UNA sola pieza, no islas', () => {
  // El árbol puro medido partía el mapa en 12-14 islas. Una isla en una portada se lee
  // como un pedazo suelto que quedó ahí por error.
  const v = vecinos();
  const visto = new Set<string>();
  const cola = [nodos[0].id];
  while (cola.length) {
    const id = cola.pop()!;
    if (visto.has(id)) continue;
    visto.add(id);
    for (const w of v.get(id) ?? []) if (!visto.has(w)) cola.push(w);
  }
  assert.equal(visto.size, nodos.length, `el mapa quedó partido: ${nodos.length - visto.size} nodos sueltos`);
});
