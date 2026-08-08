// =============================================================================
// cerebro-layout — dónde va cada nodo del grafo del negocio
// =============================================================================
// Corre d3-force EN EL SERVIDOR y devuelve números. El cliente recibe 42 pares de
// coordenadas (~1,2 KB de JSON) y **d3-force nunca entra al bundle del browser**.
//
// ⚠️ NINGÚN módulo con 'use client' puede importar este archivo. Si alguien lo hace,
// se lleva d3-force al bundle del cliente y el typecheck NO lo ve — es la misma clase
// de bug que ya está documentada en la cabecera de `cerebro-modelo.ts`. Este módulo es
// PURO a propósito (sin 'server-only', sin React, sin DOM) para poder testearlo, no
// para que lo importe el navegador.
//
// POR QUÉ FÍSICA Y NO EL LAYOUT RADIAL QUE HABÍA ANTES. La primera versión evitaba la
// simulación por tres razones, y dos resultaron falsas al leer el código de verdad:
//
//  · «tiembla para siempre» — FALSO. d3 baja alpha con `alphaDecay = 1−0.001^(1/300)`
//    y el loop se corta en `alphaMin = 0.001`. Acá ni siquiera se enciende el timer:
//    `.stop()` y después `.tick()` a mano. El resultado es estático por construcción.
//    (Obsidian hace exactamente lo mismo: su worker se auto-agenda solo mientras
//    alpha > 0.001, y su renderer se apaga a los 60 frames sin cambios.)
//  · «es aleatorio» — FALSO en d3-force v3: el único azar es `jiggle`, que usa un LCG
//    de semilla FIJA creado por simulación (src/lcg.js). No usa Math.random.
//  · «d3 muta los objetos que le pasás» — VERDADERO, y es la regla que gobierna este
//    módulo: se le pasan COPIAS PLANAS DESECHABLES de nodos y aristas, y se devuelven
//    solo números. `forceLink` además reemplaza los strings `source`/`target` por
//    referencias al objeto nodo; si eso pasara sobre el array real, la segunda corrida
//    recibiría datos distintos a los de la primera.
//
// Y la razón de fondo, que es la que más costó ver: el problema nunca fue el motor de
// dibujo. Los datos eran un ÁRBOL —una arista entrante por nodo, todo colgando de la
// raíz— y sobre un árbol ninguna simulación da la nube de Obsidian. Las aristas
// laterales de `cerebro-grafo.ts` son lo que hace que esto funcione.
// =============================================================================

import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { AREAS, type AreaId, type NodoCerebro, type AristaCerebro } from './cerebro-modelo';

export type Punto = { x: number; y: number };
export type Encuadre = { x: number; y: number; lado: number };
export type Layout = { posiciones: Record<string, Punto>; encuadre: Encuadre; huella: string };

/**
 * Los números SON el dibujo. Cambiar cualquiera cambia el mapa de todos los clientes,
 * así que van juntos, versionados y con el porqué al lado. Medido sobre un cliente
 * real de 42 nodos: mover `alphaDecay` un 0,016% corre nodos 10 px; ponerlo en 0,04
 * los corre 253 px — no es «menos convergido», es OTRO layout.
 */
export const RECETA = {
  v: 1,
  /** d3 converge «naturalmente» en 300; 320 clava el residuo sin costar nada. */
  ticks: 320,
  /** Repulsión. El default de d3 (−30) está calibrado para aristas de 30 px y acá da
   *  una pelota ilegible; −260 abre la nube sin que se escape del encuadre. */
  carga: -260,
  /** Sin tope, el ancho del mapa crece sin control a medida que entran nodos. */
  cargaDistMax: 420,
  linkDist: 70,
  /** El hub necesita más aire que una hoja, o la raíz queda ahogada. */
  linkDistRaiz: 130,
  colisionPad: 14,
  colisionFuerza: 0.9,
  colisionIter: 2,
  /** Lo que mantiene juntas a las diez áreas sin volver al radial. Medido, «pureza de
   *  sector» (% de nodos cuyo vecino más cercano es de su área): 0 → 55%, 0,02 → 79%,
   *  0,08 → 100%, 0,12 → 100% pero ya se vuelve a ver el abanico. */
  anclaArea: 0.08,
  anclaRadio: 230,
  /** Margen del encuadre, en unidades de mundo: es el lugar de las etiquetas. */
  margen: 70,
  ladoMin: 600,
} as const;

/** El ancla de cada área. Es el MISMO ángulo que usaba el layout radial, pero cambió
 *  de rol: antes era la posición final, ahora es apenas un objetivo de fuerza que la
 *  simulación negocia con el resto. */
export function anclaDe(area: AreaId, nNodos: number): Punto {
  const i = Math.max(0, AREAS.findIndex((a) => a.id === area));
  const ang = ((-90 + (i * 360) / AREAS.length) * Math.PI) / 180;
  const r = RECETA.anclaRadio * Math.sqrt(Math.max(nNodos, 39) / 39);
  return { x: r * Math.cos(ang), y: r * Math.sin(ang) };
}

/** Grado de cada nodo (cuántas aristas lo tocan). Alimenta el radio y el ranking de
 *  etiquetas: en un grafo, «importante» es «muy conectado». */
export function gradosDe(nodos: NodoCerebro[], aristas: AristaCerebro[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const n of nodos) g[n.id] = 0;
  for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
  return g;
}

/** El radio en unidades de MUNDO. El bonus por grado es lo que hace que el mapa tenga
 *  jerarquía visible; sin las aristas laterales sería 0 en casi todos los nodos. */
export function radioNodo(n: NodoCerebro, grado: number): number {
  const base = n.id === 'raiz' ? 9 : n.destacado || n.alerta ? 6.5 : n.autoria === 'pendiente' ? 3.5 : 4.5;
  return base + Math.min(3, 0.9 * Math.sqrt(Math.max(0, grado - 1)));
}

/**
 * Semilla determinista por IDENTIDAD, no por índice.
 *
 * d3 solo inventa posiciones si vienen NaN, y cuando las inventa usa una espiral de
 * filotaxis indexada por la POSICIÓN EN EL ARRAY. O sea: insertar un documento en el
 * medio corre la semilla de todos los nodos siguientes y el mapa entero cambia, sin
 * que nada falle ni avise. Sembrando por hash del id, el mismo nodo arranca siempre
 * en el mismo lugar — y arranca en el barrio de su área, así que un nodo nuevo nace
 * donde le corresponde en vez de cruzar el mapa mientras se acomoda.
 */
function semilla(id: string, ancla: Punto): Punto {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = ((h >>> 0) / 4294967296) * Math.PI * 2;
  const r = 30 + (((h >>> 8) & 0xff) / 255) * 90;
  return { x: ancla.x + r * Math.cos(a), y: ancla.y + r * Math.sin(a) };
}

/** Identifica un grafo + su receta. Sirve para saber si un layout guardado sigue
 *  valiendo sin volver a simular. */
export function huellaDe(nodos: NodoCerebro[], aristas: AristaCerebro[]): string {
  const ns = nodos.map((n) => n.id).sort().join(',');
  const as = aristas.map((a) => `${a.de}>${a.a}`).sort().join(',');
  let h = 2166136261;
  const s = `v${RECETA.v}|${ns}|${as}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

type NodoSim = SimulationNodeDatum & { id: string; area: AreaId; r: number; x: number; y: number };
type LinkSim = SimulationLinkDatum<NodoSim>;

/**
 * Calcula las posiciones. `previo` (opcional) son las posiciones de la corrida
 * anterior: si se pasan, los nodos que ya existían arrancan de ahí y se re-acomodan
 * poco, en vez de que el mapa entero se rearme porque entró un dato.
 */
export function layoutCerebro(nodos: NodoCerebro[], aristas: AristaCerebro[], previo?: Record<string, Punto>): Layout {
  const grados = gradosDe(nodos, aristas);
  const n = nodos.length;

  // COPIAS DESECHABLES Y ORDENADAS. Dos cosas distintas, las dos necesarias:
  //  · COPIAS, porque d3 va a escribirles x/y/vx/vy/index y a reemplazar los strings
  //    de las aristas por referencias al objeto nodo. Nada de eso puede tocar los
  //    arrays reales, o la segunda corrida recibe una entrada distinta.
  //  · ORDENADAS por id, porque el orden del array cambia el orden en que se acumulan
  //    las fuerzas en el quadtree, y la suma de floats no es asociativa. No es azar
  //    —el desvío medido era de 0,5 px— pero es una diferencia real entre dos corridas
  //    del MISMO grafo, y con eso alcanza para que el test de determinismo falle y
  //    para que algún día el mapa se vea distinto sin motivo. Ordenar lo cierra.
  const sim: NodoSim[] = [...nodos]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((nd) => {
      const ancla = anclaDe(nd.area, n);
      const p = previo?.[nd.id] ?? semilla(nd.id, ancla);
      return { id: nd.id, area: nd.area, r: radioNodo(nd, grados[nd.id] ?? 0), x: p.x, y: p.y };
    });
  const raiz = sim.find((s) => s.id === 'raiz');
  if (raiz) { raiz.fx = 0; raiz.fy = 0; }        // el negocio es el centro del mundo
  const porId = new Set(sim.map((s) => s.id));
  const links: LinkSim[] = aristas
    .filter((a) => porId.has(a.de) && porId.has(a.a))
    .map((a) => ({ source: a.de, target: a.a }))
    .sort((x, y) => (`${String(x.source)}>${String(x.target)}` < `${String(y.source)}>${String(y.target)}` ? -1 : 1));

  const s = forceSimulation<NodoSim>(sim)
    .stop()                                       // NUNCA se enciende el timer: esto es estático
    .force('link', forceLink<NodoSim, LinkSim>(links)
      .id((d) => d.id)
      // `distance` corre DESPUÉS de que forceLink resolvió los ids a objetos, así que
      // `l.source` ya es el nodo y no el string con el que se armó el array.
      .distance((l) => ((l.source as NodoSim).id === 'raiz' ? RECETA.linkDistRaiz : RECETA.linkDist)))
    // `strength` de forceLink queda en el DEFAULT (1/min(gradoA, gradoB)) a propósito:
    // en una topología con un hub, eso solo ya evita que las 20 aristas de la raíz
    // aplasten el centro. Pisarlo es el error clásico.
    .force('carga', forceManyBody<NodoSim>().strength(RECETA.carga).distanceMax(RECETA.cargaDistMax))
    // La colisión es lo que impide que los puntos se pisen. NO lo hace la repulsión.
    .force('colision', forceCollide<NodoSim>((d) => d.r + RECETA.colisionPad).strength(RECETA.colisionFuerza).iterations(RECETA.colisionIter))
    // forceX/forceY y NO forceCenter: `center.js` mueve node.x DIRECTO en vez de la
    // velocidad, y pelea con los nodos pineados (la raíz).
    .force('ax', forceX<NodoSim>((d) => anclaDe(d.area, n).x).strength(RECETA.anclaArea))
    .force('ay', forceY<NodoSim>((d) => anclaDe(d.area, n).y).strength(RECETA.anclaArea));

  s.tick(RECETA.ticks);
  s.stop();

  const posiciones: Record<string, Punto> = {};
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const nd of sim) {
    const x = Math.round(nd.x * 1000) / 1000;
    const y = Math.round(nd.y * 1000) / 1000;
    posiciones[nd.id] = { x, y };
    x0 = Math.min(x0, x - nd.r); y0 = Math.min(y0, y - nd.r);
    x1 = Math.max(x1, x + nd.r); y1 = Math.max(y1, y + nd.r);
  }
  if (!Number.isFinite(x0)) { x0 = y0 = -300; x1 = y1 = 300; }

  const lado = Math.max(x1 - x0, y1 - y0) + 2 * RECETA.margen;
  const ladoFinal = Math.max(lado, RECETA.ladoMin);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return {
    posiciones,
    encuadre: {
      x: Math.round((cx - ladoFinal / 2) * 100) / 100,
      y: Math.round((cy - ladoFinal / 2) * 100) / 100,
      lado: Math.round(ladoFinal * 100) / 100,
    },
    huella: huellaDe(nodos, aristas),
  };
}
