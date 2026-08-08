// =============================================================================
// fisica — la simulación VIVA del grafo, en el navegador y solo durante un gesto
// =============================================================================
// Se carga con `import()` dinámico la primera vez que alguien arrastra un nodo, así
// d3-force (~5 KB gzip) no entra en el bundle de nadie que solo mire el mapa.
//
// ⚠️ ESTA NO ES LA RECETA DEL SERVIDOR, Y NO PUEDE SERLO. `lib/cerebro-layout.ts`
// calcula el layout con link 250 + manyBody −1000 + centro 0,1 y lo congela. Reponer
// esas mismas fuerzas acá y despertarlas con el patrón canónico de d3
// (`alphaTarget(0.3).restart()`) **mueve el mapa 58 px de mediana a los 120 ticks sin
// que nadie toque nada**, 83 px a los 300, y al soltar no vuelve: quedan 72 px de
// deriva. La causa no es un bug: un layout parado en `alphaMin = 0.001` NO está en
// equilibrio de fuerzas, sigue cayendo 300 veces más lento. Reinyectarle alpha lo hace
// correr de nuevo. Bajar el alphaTarget mitiga y no cierra (0,05 todavía deja 20 px).
//
// O sea: el diagnóstico obvio —«usá el drag de los ejemplos de d3»— es el equivocado.
//
// Lo que SÍ funciona son dos fuerzas y nada más:
//   · COLISIÓN, para que los nodos se corran en vez de pisarse; y
//   · un RESORTE A SU CASA, o sea a la posición que mandó el servidor.
// Sin manyBody y sin centro, que son justamente las que rearman el mapa. Con esto la
// simulación nace en reposo exacto (0,00 px de deriva al despertarla sin tocar nada) y
// después de soltar cada nodo vuelve a su lugar en ~1 segundo.
//
// La guarda de `cerebro-layout.ts` («ningún módulo con 'use client' puede importarlo»)
// SIGUE VALIENDO: este archivo no lo importa. La receta del servidor no cruza.
// =============================================================================

import type { Punto } from '@/lib/cerebro-modelo';

/** Un nodo tal como lo ve la simulación. `casa` es su posición de reposo. */
export type NodoFisico = {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  casaX: number;
  casaY: number;
  /** El radio DIBUJADO del nodo. La colisión del cliente se calcula con esto. */
  r: number;
};

export type Simulacion = {
  nodos: NodoFisico[];
  /** Empieza a mover el nodo `id`. `x`/`y` son el punto del mundo donde se lo agarró:
   *  se guarda el desfase para que el nodo NO salte al cursor. */
  agarrar: (id: string, x: number, y: number) => void;
  /** Mueve el nodo agarrado a una posición del mundo. */
  mover: (x: number, y: number) => void;
  /** Suelta el nodo. Todo vuelve a su casa y la simulación se duerme sola. */
  soltar: () => void;
  /** Corta el rAF. Hay que llamarlo al desmontar. */
  destruir: () => void;
};

export const FISICA = {
  /** ⚠️ NO es el radio 60 de la colisión del SERVIDOR, y no puede serlo. El servidor
   *  usa `strength 0.5`, que es blanda: en el layout final la separación mínima real
   *  entre centros es de 37 unidades, MENOS que 60. Con radio 60 acá, la colisión
   *  considera que en su propia casa los nodos están mal puestos y los empuja para
   *  siempre — y como `forceCollide` NO está escalada por alpha y el resorte a casa
   *  SÍ, la colisión gana. Medido con Playwright: 128 px de desvío que nunca se
   *  corregían. Lo que hay que evitar acá es el solape VISUAL, así que el radio sale
   *  del nodo dibujado (8 a 11,6) más un poco de aire.
   *  El aire tiene TECHO: dos nodos chocan si la distancia baja de r1+r2+2·pad, y en
   *  reposo la separación mínima es 37. Con radios de 8 y pad 8 da 32 < 37, que entra
   *  justo. Subirlo a 12 da 40 y el problema vuelve. */
  colisionPad: 8,
  /** El radio del nodo que estás ARRASTRANDO. Mucho más grande a propósito: es lo que
   *  hace que el mapa se abra a su paso en vez de que empuje solo al que tiene pegado.
   *  Solo aplica mientras dura el gesto, así que no entra en conflicto con el techo del
   *  aire en reposo (ver `colisionPad`): al soltar vuelve a su radio normal y todos
   *  regresan a su casa. */
  colisionRadioArrastre: 150,
  colisionFuerza: 0.7,
  colisionIter: 1,
  /** El resorte a casa. Con 0,30 el mapa queda quieto en 62 ticks (~1,03 s) y el
   *  nodo arrastrado vuelve a 4 px de su lugar. Con 0,20 tarda 105 ticks y deja 17
   *  px; con 0,45 vuelve más rápido pero el arrastre empuja menos a los vecinos. */
  casaFuerza: 0.3,
  /** Se duerme cuando nadie se movió casi nada Y nadie quedó lejos de su casa. */
  quietoPorFrame: 0.15,
  quietoDeCasa: 1.5,
} as const;

/**
 * Crea la simulación a partir de las posiciones que mandó el servidor. Nace DORMIDA:
 * no hay rAF corriendo hasta el primer `agarrar()`.
 *
 * `alRedibujar` recibe los nodos ya movidos; el componente escribe los transforms con
 * setAttribute. No se pasa por React: un setState por frame durante un arrastre son
 * 60 renders por segundo de 50 nodos.
 */
export async function crearSimulacion(
  posiciones: Record<string, Punto>,
  radios: Record<string, number>,
  alRedibujar: (nodos: NodoFisico[]) => void,
): Promise<Simulacion> {
  const { forceSimulation, forceCollide, forceX, forceY } = await import('d3-force');

  const nodos: NodoFisico[] = Object.entries(posiciones).map(([id, p]) => ({
    id, x: p.x, y: p.y, casaX: p.x, casaY: p.y, r: radios[id] ?? 8,
  }));
  const porId = new Map(nodos.map((n) => [n.id, n]));

  let agarrado: NodoFisico | null = null;

  const sim = forceSimulation<NodoFisico>(nodos)
    .force('colision', forceCollide<NodoFisico>((d) => (d === agarrado ? FISICA.colisionRadioArrastre : d.r + FISICA.colisionPad)).strength(FISICA.colisionFuerza).iterations(FISICA.colisionIter))
    .force('casaX', forceX<NodoFisico>((d) => d.casaX).strength(FISICA.casaFuerza))
    .force('casaY', forceY<NodoFisico>((d) => d.casaY).strength(FISICA.casaFuerza))
    .stop();

  let raf: number | null = null;
  // Cuánto había entre el centro del nodo y el punto donde lo agarraste. Sin esto el
  // nodo se teletransporta bajo el cursor en el primer movimiento, que es el defecto
  // clásico de un drag mal hecho: se siente que lo arrancaste, no que lo agarraste.
  let desfase = { x: 0, y: 0 };

  const quieto = (): boolean => {
    if (agarrado) return false;
    for (const n of nodos) {
      if (Math.abs(n.vx ?? 0) > FISICA.quietoPorFrame || Math.abs(n.vy ?? 0) > FISICA.quietoPorFrame) return false;
      if (Math.hypot(n.x - n.casaX, n.y - n.casaY) > FISICA.quietoDeCasa) return false;
    }
    return true;
  };

  const latir = () => {
    // ⚠️ PISO DE ALPHA. d3 escala TODA fuerza por alpha (`vx += (x - node.x) * strength
    // * alpha`), así que cuando alpha decae el resorte a casa se apaga y el nodo queda
    // a mitad de camino: medido con Playwright, 123 px de desvío que no se corregían
    // ni esperando 4 segundos. No era tiempo de asentado, era que la fuerza valía
    // cero. Mientras la simulación esté despierta, alpha no baja de acá.
    if (sim.alpha() < 0.06) sim.alpha(0.06);
    sim.tick();
    alRedibujar(nodos);
    // Se duerme sola. Sin esto el rAF corre para siempre y la pestaña nunca entra en
    // idle — que es exactamente lo que Obsidian evita apagándose a los 60 frames.
    if (quieto()) {
      // Se clava en casa para que no queden decimales a la deriva.
      for (const n of nodos) { n.x = n.casaX; n.y = n.casaY; n.vx = 0; n.vy = 0; }
      alRedibujar(nodos);
      raf = null;
      return;
    }
    raf = requestAnimationFrame(latir);
  };

  const despertar = () => { if (raf == null) raf = requestAnimationFrame(latir); };

  return {
    nodos,
    agarrar(id, x, y) {
      const n = porId.get(id);
      if (!n) return;
      agarrado = n;
      desfase = { x: n.x - x, y: n.y - y };
      n.fx = n.x; n.fy = n.y;
      sim.alpha(0.35);
      despertar();
    },
    mover(x, y) {
      if (!agarrado) return;
      agarrado.fx = x + desfase.x; agarrado.fy = y + desfase.y;
      sim.alpha(0.35);
      despertar();
    },
    soltar() {
      if (!agarrado) return;
      // fx/fy a null: el nodo NO queda clavado donde lo soltaste, vuelve a su casa.
      // Es lo que hace Obsidian, y es lo correcto acá: la posición SIGNIFICA algo (la
      // calculó el servidor con la topología), así que dejarla movida sería mentir.
      agarrado.fx = null; agarrado.fy = null;
      agarrado = null;
      sim.alpha(0.3);
      despertar();
    },
    destruir() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      sim.stop();
    },
  };
}
