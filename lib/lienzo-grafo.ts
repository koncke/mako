// =============================================================================
// lienzo-grafo — la forma de un grafo dibujable, y su geometría
// =============================================================================
// Módulo SIN `server-only` y PURO. Lo comparten los dos lienzos del producto:
//
//   · el FLUJO DE CONVERSACIÓN de una secuencia (`lib/flujo-conversacion.ts`)
//   · el FLUJO DE UN AVISO de MaKo (`lib/flujo-aviso.ts`)
//
// Vive aparte desde el 30/09/2026, cuando el segundo apareció. Antes los tipos y
// las curvas estaban adentro del primero, y copiarlos habría dejado dos lienzos
// que se separan en la primera edición — que es exactamente la razón escrita por
// la que se borró el editor de diagramas del funnel.
//
// Lo que NO vive acá es CÓMO se arma cada grafo: eso es propio de cada flujo, y
// mezclarlo haría un constructor con banderas que no sabe de qué está hablando.

export type TipoNodo =
  | 'entrada' | 'mensaje' | 'respuesta' | 'cualifica' | 'desenlace' | 'ir-a' | 'suelto'
  | 'recordatorio' | 'salida';

export type TonoArista = 'normal' | 'buena' | 'mala' | 'condicional';

export type NodoFlujo = {
  id: string;
  tipo: TipoNodo;
  /** El rótulo corto de la cabecera del nodo. Techo: tres palabras. */
  titulo: string;
  /** El emoji de la cabecera. Es el mismo vocabulario que ya usa el producto. */
  icono: string;
  /** El paso que este nodo representa, para que la pantalla sepa qué editar. */
  orden?: number;
  /** Para un «Go To»: la clave del destino, y si existe de verdad. */
  claveDestino?: string;
  destinoExiste?: boolean;
  /** Lo que el nodo dice adentro cuando no es un mensaje. */
  detalle?: string;
  /** Algo que este nodo declara y el motor no hace. Se dibuja con su marca. */
  advertencia?: string;
  x: number; y: number; ancho: number; alto: number;
};

export type AristaFlujo = {
  desde: string;
  hasta: string;
  /** Lo que se lee sobre la flecha: «Al instante», «2 h después», «si contesta». */
  etiqueta?: string;
  tono: TonoArista;
  /** Si la etiqueta se puede tocar para editar, y qué paso edita. */
  editaOrden?: number;
};

export type GrafoFlujo = {
  nodos: NodoFlujo[];
  aristas: AristaFlujo[];
  /** La caja que ocupa todo el dibujo, para encuadrarlo sin medir el DOM. */
  ancho: number;
  alto: number;
};

// ── La geometría. Números, no clases: el lienzo los usa tal cual ────────────
export const ANCHO_NODO = 252;
export const ALTO_MIN = 76;
/** Separación entre columnas. Tiene que dar lugar a la etiqueta de la arista. */
export const GAP_X = 118;
export const GAP_Y = 34;
export const MARGEN = 28;

/** La caja que encierra a todos los nodos, con su margen. */
export function encerrar(nodos: NodoFlujo[]): { ancho: number; alto: number } {
  if (nodos.length === 0) return { ancho: ANCHO_NODO + MARGEN * 2, alto: ALTO_MIN + MARGEN * 2 };
  return {
    ancho: Math.max(...nodos.map((n) => n.x + n.ancho)) + MARGEN,
    alto: Math.max(...nodos.map((n) => n.y + n.alto)) + MARGEN,
  };
}

/**
 * La curva de una arista, de la derecha de un nodo a la izquierda del otro.
 *
 * Es una Bézier cúbica con los tiradores horizontales — la misma forma que usa
 * ManyChat (`curveBumpX` de d3-shape). Se escribe a mano en vez de importar
 * d3-shape a propósito: d3-shape está en `node_modules` pero NO está declarado en
 * `package.json` — entra como dependencia TRANSITIVA de recharts, así que
 * importarlo funciona hoy y se rompe el día que recharts cambie de versión, con
 * un error que no nombra a este archivo.
 */
export function curvaEntre(a: NodoFlujo, b: NodoFlujo): string {
  const { x1, y1, x2, y2 } = puntas(a, b);
  const dx = Math.max(38, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** El punto medio de esa misma curva, donde va la etiqueta. */
export function medioDeCurva(a: NodoFlujo, b: NodoFlujo): { x: number; y: number } {
  const { x1, y1, x2, y2 } = puntas(a, b);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

/** De dónde sale y a dónde llega la flecha. El tope de 44 px hace que en un nodo
 *  alto la flecha salga a la altura de su CABECERA y no de su centro: apuntada al
 *  medio de una tarjeta de 300 px, la curva cruza por encima del texto. */
function puntas(a: NodoFlujo, b: NodoFlujo) {
  return {
    x1: a.x + a.ancho,
    y1: a.y + Math.min(a.alto / 2, 44),
    x2: b.x,
    y2: b.y + Math.min(b.alto / 2, 44),
  };
}
