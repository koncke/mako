// =============================================================================
// graficos-conectores — la flecha que UNE dos tarjetas del Dashboard (punto 11 de la tanda v5)
// =============================================================================
// Martín (12/10/2026, punto 11): las líneas y flechas de antes eran dibujos que ocupaban una celda y no sabían
// de ningún bloque: si se movía una tarjeta, la flecha quedaba donde estaba. Un CONECTOR (`Hoja.conectores`,
// lib/graficos-catalogo.ts) une dos componentes por sus ids, y la pantalla lo dibuja en una capa SVG encima de
// la grilla que los SIGUE al moverse (app/dashboard/Conectores.tsx).
//
// Acá vive lo PURO, con test (tests/graficos-conectores.test.ts): de dos rectángulos en píxeles a la curva.
//   · LOS LADOS ENFRENTADOS: la flecha sale del lado de A que mira a B y entra por el de B que mira a A. Si
//     están separados en los dos ejes, manda el eje con MÁS aire (una tarjeta abajo y apenas corrida a la
//     derecha se une por abajo, no por el costado). Si se pisan (no debería pasar en la grilla), manda la
//     distancia entre centros.
//   · TRES TRAZOS: curva (Bézier con los tiradores en la normal de cada lado, como las del lienzo de
//     Automations), recta y codo (dos quiebres en ángulo recto, a mitad de camino).
//   · LA PUNTA no la tapa la línea: el trazo termina en la BASE de la punta, no en el borde de la tarjeta.
//   · Borrar una tarjeta borra sus conectores en el MISMO cambio (`sinConectoresDe`): un Deshacer los devuelve
//     juntos. El saneo (`sanearHoja`) igual descarta los que apuntan a un id que no está.
//
// Sin `server-only` y sin React: la pantalla y el test.

import type { Conector } from './graficos-catalogo';

export type Caja = { left: number; top: number; width: number; height: number };
export type Lado = 'izq' | 'der' | 'arr' | 'aba';
export type Punto = { x: number; y: number };
export type Trazo = Conector['trazo'];
export type Punta = Conector['punta'];

export type GeometriaConector = {
  /** El `d` del trazo (ya acortado donde va una punta). */
  d: string;
  desde: Punto & { lado: Lado };
  hasta: Punto & { lado: Lado };
  /** El punto del medio del trazo: ahí va el botón de borrar del conector elegido. */
  medio: Punto;
  /** Los triángulos de las puntas (`points` de un <polygon>), los que correspondan. */
  puntas: string[];
};

/** El tamaño de la punta de la flecha, en píxeles (el largo; el ancho es parecido). */
export const PUNTA = 9;

const NORMAL: Record<Lado, Punto> = { izq: { x: -1, y: 0 }, der: { x: 1, y: 0 }, arr: { x: 0, y: -1 }, aba: { x: 0, y: 1 } };
const r1 = (n: number) => Math.round(n * 10) / 10;

/** El medio de un lado. */
export function puntoDeLado(c: Caja, lado: Lado): Punto {
  switch (lado) {
    case 'izq': return { x: c.left, y: c.top + c.height / 2 };
    case 'der': return { x: c.left + c.width, y: c.top + c.height / 2 };
    case 'arr': return { x: c.left + c.width / 2, y: c.top };
    case 'aba': return { x: c.left + c.width / 2, y: c.top + c.height };
  }
}

/** Por qué lado sale (de `a`) y por cuál entra (en `b`): los que se miran. */
export function ladosEnfrentados(a: Caja, b: Caja): [Lado, Lado] {
  const aireX = Math.max(b.left - (a.left + a.width), a.left - (b.left + b.width));
  const aireY = Math.max(b.top - (a.top + a.height), a.top - (b.top + b.height));
  const ca = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  const cb = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  let horizontal: boolean;
  if (aireX >= 0 || aireY >= 0) horizontal = aireX >= aireY;
  else horizontal = Math.abs(cb.x - ca.x) >= Math.abs(cb.y - ca.y);
  if (horizontal) return cb.x >= ca.x ? ['der', 'izq'] : ['izq', 'der'];
  return cb.y >= ca.y ? ['aba', 'arr'] : ['arr', 'aba'];
}

const mover = (p: Punto, n: Punto, d: number): Punto => ({ x: p.x + n.x * d, y: p.y + n.y * d });

/** El triángulo de una punta: la punta en `tip`, la base hacia afuera de la tarjeta (`n` = la normal del lado). */
function triangulo(tip: Punto, n: Punto): string {
  const base = mover(tip, n, PUNTA);
  const t = { x: -n.y, y: n.x }; // la perpendicular
  const a = mover(base, t, PUNTA * 0.6);
  const b = mover(base, t, -PUNTA * 0.6);
  return [tip, a, b].map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ');
}

/** Un punto de una Bézier cúbica en `t`. */
function bezier(p0: Punto, p1: Punto, p2: Punto, p3: Punto, t: number): Punto {
  const u = 1 - t;
  const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
  return { x: k0 * p0.x + k1 * p1.x + k2 * p2.x + k3 * p3.x, y: k0 * p0.y + k1 * p1.y + k2 * p2.y + k3 * p3.y };
}

/**
 * La geometría de un conector entre dos cajas (en píxeles, del mismo origen). Las puntas van donde dice
 * `punta`: 'fin' (en `b`), 'ambas' o 'ninguna'.
 */
export function geometriaConector(a: Caja, b: Caja, trazo: Trazo = 'curva', punta: Punta = 'fin'): GeometriaConector {
  const [la, lb] = ladosEnfrentados(a, b);
  const pa = puntoDeLado(a, la), pb = puntoDeLado(b, lb);
  const na = NORMAL[la], nb = NORMAL[lb];
  const conFin = punta === 'fin' || punta === 'ambas';
  const conInicio = punta === 'ambas';
  // El trazo arranca y termina en la BASE de la punta: si llegara al borde, la línea asomaría por la punta.
  const s = conInicio ? mover(pa, na, PUNTA) : pa;
  const e = conFin ? mover(pb, nb, PUNTA) : pb;
  const horizontal = la === 'izq' || la === 'der';
  let d: string;
  let medio: Punto;
  if (trazo === 'recta') {
    d = `M ${r1(s.x)} ${r1(s.y)} L ${r1(e.x)} ${r1(e.y)}`;
    medio = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
  } else if (trazo === 'codo') {
    if (horizontal) {
      const xm = (s.x + e.x) / 2;
      d = `M ${r1(s.x)} ${r1(s.y)} H ${r1(xm)} V ${r1(e.y)} H ${r1(e.x)}`;
      medio = { x: xm, y: (s.y + e.y) / 2 };
    } else {
      const ym = (s.y + e.y) / 2;
      d = `M ${r1(s.x)} ${r1(s.y)} V ${r1(ym)} H ${r1(e.x)} V ${r1(e.y)}`;
      medio = { x: (s.x + e.x) / 2, y: ym };
    }
  } else {
    // Los tiradores salen por la normal de cada lado: la curva sale «derecho» de la tarjeta y entra derecho.
    const largo = horizontal ? Math.abs(e.x - s.x) : Math.abs(e.y - s.y);
    const k = Math.max(30, largo * 0.5);
    const c1 = mover(s, na, k), c2 = mover(e, nb, k);
    d = `M ${r1(s.x)} ${r1(s.y)} C ${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(e.x)} ${r1(e.y)}`;
    medio = bezier(s, c1, c2, e, 0.5);
  }
  const puntas: string[] = [];
  if (conFin) puntas.push(triangulo(pb, nb));
  if (conInicio) puntas.push(triangulo(pa, na));
  return { d, desde: { ...pa, lado: la }, hasta: { ...pb, lado: lb }, medio: { x: r1(medio.x), y: r1(medio.y) }, puntas };
}

/** Los conectores que siguen valiendo después de sacar `ids` de la hoja (los que tocan uno, se van con él). */
export function sinConectoresDe(conectores: readonly Conector[] | undefined, ids: ReadonlySet<string>): Conector[] {
  return (conectores ?? []).filter((k) => !ids.has(k.desde) && !ids.has(k.hasta));
}

/**
 * ¿Se puede unir `desde` con `hasta`? No a sí misma, no dos veces el mismo par (en cualquier sentido: dos
 * flechas entre las mismas tarjetas se dibujan una encima de la otra) y no pasando el tope.
 */
export function puedeConectar(conectores: readonly Conector[] | undefined, desde: string, hasta: string, tope: number): boolean {
  if (!desde || !hasta || desde === hasta) return false;
  const lista = conectores ?? [];
  if (lista.length >= tope) return false;
  return !lista.some((k) => (k.desde === desde && k.hasta === hasta) || (k.desde === hasta && k.hasta === desde));
}

/** Un conector nuevo con lo de siempre: curva, punta al final, en la tinta. */
export const conectorNuevo = (id: string, desde: string, hasta: string): Conector => ({ id, desde, hasta, punta: 'fin', trazo: 'curva', color: null });
