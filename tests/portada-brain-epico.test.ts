// =============================================================================
// El Second Brain de la portada, «mucho más épico»: más nodos de verdad, más grande, y sin trabar el teléfono (16/11/2026)
// =============================================================================
// Martín: «el Second Brain me gustaría de que se vea mucho más épico, ya sea con mucho más nodos o algo así, pero me gustaría que
// se vea más épico». Y la regla de la casa para las animaciones del sitio: con datos REALES (el negocio de Alex Hormozi, como lo
// tiene Competitor Spy en el espacio de MaKo), nunca inventados.
//
// Lo que se fija:
//   1. el negocio de ejemplo (app/vsl/_sitio/cerebro-ejemplo.json): 200 nodos del MISMO negocio, cada uno con su fuente, y con la
//      FORMA del de verdad: las métricas de scripts/medir-grafo.mjs (densidad, hojas, hub, racimos, una sola isla);
//   2. que no pese: el JSON entra con el grafo (no con la página) y el grafo se desmonta al salir de la pantalla;
//   3. que no trabe: el flote quieto se espacia (`floteCada`) y sin la prop el grafo de la app sigue como siempre;
//   4. que sea más grande: la fila del Brain va a todo el ancho y más alta.
// Lo que se MIDIÓ en un navegador (y por eso no está acá): el costo en CPU, con la CPU frenada 4×, está en la cabecera de
// app/vsl/_sitio/BrainVivo.tsx (cuidado 5): 997 ms por segundo y 95 % de cuadros caídos con 200 nodos flotando a cada cuadro,
// 83 ms y 0 % como queda.
// PROBADO ROMPIÉNDOLO (16/11/2026; base 5 / 0): al pie.
// Correr: node --import tsx --test tests/portada-brain-epico.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CSS_PORTADA } from '../app/vsl/_sitio/estilos';
import type { Cerebro } from '../lib/cerebro-modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cerebro = JSON.parse(leer('app/vsl/_sitio/cerebro-ejemplo.json')) as Cerebro<string>;

test('1. más nodos, todos de verdad: el mismo negocio, cada uno con su fuente y su posición', () => {
  assert.equal(cerebro.negocio, 'Acquisition.com');
  assert.ok(cerebro.nodos.length >= 150, `son ${cerebro.nodos.length} nodos: Martín lo pidió con «mucho más nodos» (eran 53)`);
  const ids = new Set(cerebro.nodos.map((n) => n.id));
  assert.equal(ids.size, cerebro.nodos.length, 'un id repetido');
  for (const n of cerebro.nodos) {
    assert.ok(n.fuente && n.detalle, `${n.id}: sin fuente o sin detalle (un dato sin de dónde salió es un invento)`);
    assert.ok(cerebro.posiciones[n.id], `${n.id}: sin posición (el navegador tendría que correr d3-force)`);
  }
  for (const a of cerebro.aristas) assert.ok(ids.has(a.de) && ids.has(a.a), `una arista a un nodo que no existe: ${a.de} → ${a.a}`);
  // Los videos dicen sus vistas de verdad (las que leyó Competitor Spy), con número.
  const videos = cerebro.nodos.filter((n) => n.tipo === 'Short' || n.tipo === 'Video de YouTube');
  assert.ok(videos.length >= 40, `${videos.length} videos`);
  for (const v of videos) assert.match(v.datos?.find((d) => d.k === 'Vistas')?.v ?? '', /^\d{1,3}(\.\d{3})*$/, `${v.id}: sin sus vistas`);
});

test('2. con la forma del Second Brain de verdad: las métricas de scripts/medir-grafo.mjs', () => {
  const grado = new Map(cerebro.nodos.map((n) => [n.id, 0]));
  const vecinos = new Map(cerebro.nodos.map((n) => [n.id, new Set<string>()]));
  for (const a of cerebro.aristas) { grado.set(a.de, grado.get(a.de)! + 1); grado.set(a.a, grado.get(a.a)! + 1); vecinos.get(a.de)!.add(a.a); vecinos.get(a.a)!.add(a.de); }
  const g = [...grado.values()];
  const medio = g.reduce((s, x) => s + x, 0) / g.length;
  assert.ok(cerebro.aristas.length / cerebro.nodos.length >= 1.5, 'densidad < 1,5: se ve como un árbol, no como una nube');
  assert.ok(g.filter((x) => x === 1).length / g.length <= 0.3, 'más del 30 % de hojas');
  assert.ok(Math.max(...g) / medio <= 4.5, `hub de ${(Math.max(...g) / medio).toFixed(1)}×: un nodo se come el mapa`);
  let cc = 0;
  for (const vs of vecinos.values()) { const l = [...vs]; if (l.length < 2) continue; let t = 0; for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (vecinos.get(l[i])!.has(l[j])) t++; cc += t / ((l.length * (l.length - 1)) / 2); }
  assert.ok(cc / g.length >= 0.15, 'sin racimos (clustering < 0,15)');
  const visto = new Set<string>(); const pila = [cerebro.nodos[0].id];
  while (pila.length) { const x = pila.pop()!; if (visto.has(x)) continue; visto.add(x); pila.push(...vecinos.get(x)!); }
  assert.equal(visto.size, cerebro.nodos.length, 'el mapa quedó partido en islas');
});

test('3. que no pese: el negocio entra CON el grafo, cuando la fila se ve, y el grafo sale cuando la fila deja de verse', () => {
  const brain = sinComentarios(leer('app/vsl/_sitio/BrainVivo.tsx'));
  assert.doesNotMatch(brain, /^import [^;]*cerebro-ejemplo\.json/m, 'el JSON de 105 KB volvió a viajar con la página');
  assert.match(brain, /Promise\.all\(\[import\('@\/app\/second-brain\/Grafo'\), import\('\.\/cerebro-ejemplo\.json'\)\]\)/);
  assert.match(brain, /else if \(!e\.isIntersecting\) setVisto\(false\)/, 'el grafo ya no se desmonta al salir de la pantalla: su bucle sigue corriendo');
  // El póster (lo que se ve antes de que entre, y en el teléfono hasta tocarlo) es el del mapa nuevo, y liviano.
  const poster = statSync(join(RAIZ, 'public/vsl-assets/sitio/cerebro.jpg'));
  assert.ok(poster.size < 100_000, `el póster pesa ${Math.round(poster.size / 1024)} KB`);
});

test('4. que no trabe: el flote quieto se espacia en la portada, y el grafo de la app (sin la prop) sigue a cada cuadro', () => {
  const brain = sinComentarios(leer('app/vsl/_sitio/BrainVivo.tsx'));
  assert.match(brain, /floteCada=\{angosto \? FLOTE_TELEFONO_MS : FLOTE_COMPUTADORA_MS\}/);
  assert.match(brain, /export const FLOTE_TELEFONO_MS = Number\.POSITIVE_INFINITY;/, 'el teléfono volvió a flotar: con 200 nodos se cae a 24 cuadros por segundo');
  const pc = Number(/export const FLOTE_COMPUTADORA_MS = (\d+);/.exec(brain)?.[1]);
  assert.ok(pc >= 33 && pc <= 100, `la computadora repinta el flote cada ${pc} ms`);
  const grafo = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(grafo, /const cada = floteCadaRef\.current \?\? 0;/, 'sin la prop, el flote tiene que seguir a cada cuadro (el grafo de la app)');
  assert.match(grafo, /const quieto = cada > 0 && t > 1800 && arrastrando\.current == null && !deslizarRef\.current && !viajesRef\.current\.some\(\(v\) => !v\.llego\);/, 'el espaciado alcanza a la entrada, a un arrastre o a un viajero');
  assert.match(grafo, /if \(!quieto \|\| t - ultimo >= cada\) \{ pintarRef\.current\(t\); ultimo = t; \}/);
});

test('5. más grande: la fila del Brain a todo el ancho, con el texto arriba, y más alta (también en el teléfono)', () => {
  assert.match(leer('app/vsl/_sitio/Portada.tsx'), /className=\{`s-zz-fila\$\{visual === 'brain' \? ' s-zz-brain' : inv \? ' s-zz-inv' : ''\}`\}/);
  assert.match(CSS_PORTADA, /\.s-zz-fila\.s-zz-brain\{grid-template-columns:minmax\(0,1fr\);/);
  assert.match(CSS_PORTADA, /\.s-zz-brain \.s-zz-vis\{aspect-ratio:auto;height:clamp\(520px,72vh,680px\)\}/);
  assert.match(CSS_PORTADA, /\.s-zz-brain \.s-zz-vis\{height:auto;aspect-ratio:4\/5\}/, 'en el teléfono la fila vuelve a ser una tira de 210 px');
});

// ── Probado rompiéndolo (16/11/2026) ───────────────────────────────────────────────────────────────────────────────────
// Base: 5 pasan / 0 fallan. Cada rotura, restaurada después (pasan / fallan):
//   · el JSON vuelve a importarse arriba (viaja con la página)          -> 4 / 1 (el 3)
//   · el grafo no se desmonta al salir de la pantalla                   -> 4 / 1 (el 3)
//   · el teléfono vuelve a flotar (cada 50 ms)                          -> 4 / 1 (el 4)
//   · sin la prop, el grafo de la app espacia igual                     -> 4 / 1 (el 4)
//   · el espaciado alcanza a un arrastre                                -> 4 / 1 (el 4)
//   · la fila del Brain vuelve a ser una más (sin `s-zz-brain`)         -> 4 / 1 (el 5)
