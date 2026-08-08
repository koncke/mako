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
// `radioNodo` vive en el modelo y no acá porque lo consumen las DOS puntas: la
// colisión de esta simulación y el dibujo del cliente. Cuando estaba escrito en los
// dos archivos, cada uno llevaba un comentario avisando que si divergían los nodos se
// pisaban — que es la señal de que estaba en el lugar equivocado.
import { radioNodo, type AreaId, type NodoCerebro, type AristaCerebro } from './cerebro-modelo';

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
  /** Entra en `huellaDe()`: sin bumpearla, un layout guardado con la receta vieja
   *  seguiría valiendo y el mapa no cambiaría. */
  v: 2,
  /** El mundo es 3,6× más grande que en la v1 y la nube arranca de un disco chico:
   *  la expansión tarda más. d3 llega a `alphaMin` en ~300; 400 clava el residuo. */
  ticks: 400,
  /** Los cinco valores de Obsidian, sin adaptar. La v1 usaba −260/70, que tiene el
   *  MISMO balance (−3,7 contra −4,0) pero a un cuarto de la escala: los nodos se
   *  escapaban del resorte y se iban al perímetro. */
  carga: -1000,
  /** Sin esto, dos nodos que se rozan generan una fuerza casi infinita. */
  cargaDistMin: 30,
  linkDist: 250,
  colisionRadio: 60,
  colisionFuerza: 0.5,
  colisionIter: 1,
  /** La ÚNICA fuerza posicional, y va al ORIGEN. La v1 tenía diez anclas por área con
   *  strength 0,08 y radio 230, y eso sentaba todo sobre un anillo: la mediana medida
   *  de distancia al centro daba 237. Bajarlas no alcanzaba (la relación pico/valle de
   *  densidad por corona daba 4,5× con 0,08 y seguía en 4,2× con 0,04, contra 2,3× sin
   *  anclas). Se fueron. Los racimos ahora los hacen los NODOS DE ÁREA, por topología. */
  centro: 0.1,
  /** Radio de la nube inicial: 10·√n, el mismo disco que usa la filotaxis de d3. */
  semillaRadio: 10,
  /** Margen del encuadre, en unidades de mundo: es el lugar de las etiquetas. */
  margen: 140,
  ladoMin: 1400,
} as const;
// `velocityDecay` (0,4) y `alphaDecay` (0,0227628) se dejan en el DEFAULT de d3 a
// propósito: son exactamente los de Obsidian. No los ajustes.

/** Grado de cada nodo (cuántas aristas lo tocan). Alimenta el radio y el ranking de
 *  etiquetas: en un grafo, «importante» es «muy conectado». */
export function gradosDe(nodos: NodoCerebro[], aristas: AristaCerebro[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const n of nodos) g[n.id] = 0;
  for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
  return g;
}

/**
 * Semilla determinista por IDENTIDAD, no por índice.
 *
 * d3 solo inventa posiciones si vienen NaN, y cuando las inventa usa una espiral de
 * filotaxis indexada por la POSICIÓN EN EL ARRAY. O sea: insertar un documento en el
 * medio corre la semilla de todos los nodos siguientes y el mapa entero cambia, sin
 * que nada falle ni avise. Sembrando por hash del id, el mismo nodo arranca siempre
 * en el mismo lugar.
 *
 * El `√u` no es decorativo: sin él, un radio uniforme siembra sobre un ANILLO en vez
 * de sobre un disco. Es el mismo bug de arranque que el código de d3 evita.
 */
function semilla(id: string, n: number): Punto {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const ang = ((h >>> 0) / 4294967296) * Math.PI * 2;
  const u = ((h >>> 8) & 0xffff) / 65536;
  const r = RECETA.semillaRadio * Math.sqrt(n) * Math.sqrt(u);
  return { x: r * Math.cos(ang), y: r * Math.sin(ang) };
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
      const p = previo?.[nd.id] ?? semilla(nd.id, n);
      return { id: nd.id, area: nd.area, r: radioNodo(grados[nd.id] ?? 0), x: p.x, y: p.y };
    });
  // La raíz NO se pinea. Un hub de grado 14 clavado en el origen, con todo lo demás
  // empujado hacia afuera, dibuja un asterisco — que era literalmente la queja. El
  // forceX/forceY al origen ya la mantiene cerca del centro, y el encuadre recentra
  // por bbox. Ningún clon de Obsidian pinea nada salvo mientras dura un arrastre.
  const porId = new Set(sim.map((s) => s.id));
  const links: LinkSim[] = aristas
    .filter((a) => porId.has(a.de) && porId.has(a.a))
    .map((a) => ({ source: a.de, target: a.a }))
    .sort((x, y) => (`${String(x.source)}>${String(x.target)}` < `${String(y.source)}>${String(y.target)}` ? -1 : 1));

  const s = forceSimulation<NodoSim>(sim)
    .stop()                                       // NUNCA se enciende el timer: esto es estático
    // UNA sola distancia para todas las aristas. Especializar la del hub («que
    // respire») es lo que dibuja el asterisco: el aire del hub ya lo da el `strength`
    // por defecto de forceLink, que es 1/min(gradoA, gradoB) y NO se pisa.
    .force('link', forceLink<NodoSim, LinkSim>(links).id((d) => d.id).distance(RECETA.linkDist))
    // Sin `distanceMax`: con un tope, media cancha deja de ejercer fuerza sobre la
    // otra y se apaga justo la repulsión de largo alcance, que es la que redondea la
    // nube y separa los racimos. Obsidian usa Infinity.
    .force('carga', forceManyBody<NodoSim>().strength(RECETA.carga).distanceMin(RECETA.cargaDistMin))
    // Radio FIJO, no `r + pad`: una burbuja personal pareja es lo que produce la
    // separación de espuma. Con `r + 14` la burbuja medía 1,7 diámetros; ésta, 3,75.
    .force('colision', forceCollide<NodoSim>(RECETA.colisionRadio).strength(RECETA.colisionFuerza).iterations(RECETA.colisionIter))
    // forceX/forceY al ORIGEN y NO forceCenter: `center.js` mueve node.x DIRECTO en
    // vez de la velocidad. Es la única fuerza posicional que existe acá.
    .force('ax', forceX<NodoSim>(0).strength(RECETA.centro))
    .force('ay', forceY<NodoSim>(0).strength(RECETA.centro));

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
