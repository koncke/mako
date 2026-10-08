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
  // `accion` lo usan los DOS lienzos desde el 08/10/2026: el paso «⚡ Acción» de un aviso
  // y el de una secuencia del chatbot (`grafoDeSecuencia`). Es un nodo y no un `tipo` del
  // mensaje porque hace OTRA cosa que mandar un mensaje (AGENTS.md, las cinco puertas).
  | 'recordatorio' | 'accion' | 'mensaje-lead'
  // Los dos que el motor PASÓ A EJECUTAR el 04/10/2026 (mig 0186, `flujo_corridas`):
  // antes de eso `esperar` hacía `break` y no había condicional.
  | 'espera' | 'condicion';

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
  /**
   * Esta flecha NO ofrece el ＋ del medio. Es para las que SALTAN —la rama «si no» de un
   * condicional—: insertar «en el medio» agrega después del nodo de origen, que en un
   * salto es la OTRA rama. Un control que hace algo distinto de lo que dice la flecha de
   * la que cuelga es peor que no tenerlo.
   */
  sinMas?: boolean;
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
/**
 * A la DERECHA de la última tarjeta cuelga el ＋ de «agregar un paso», y el encuadre
 * tiene que meterlo adentro o queda cortado contra el `overflow: hidden` de la caja.
 *
 * Son 8 px de puente + 26 del botón + 6 de su sombra = 40, y el `MARGEN` de 28 no
 * alcanza. Va como constante propia y NO subiendo `MARGEN`: ése es el ORIGEN del
 * layout de los dos grafos (`col(i) = MARGEN + …`), así que tocarlo corre todas las
 * tarjetas calculadas mientras las guardadas se quedan donde están — un layout mixto,
 * y con las posiciones que ya hay en la base eso son 160 px de desalineación.
 */
export const HOLGURA_DERECHA = 42;

export function encerrar(nodos: NodoFlujo[]): { ancho: number; alto: number } {
  if (nodos.length === 0) return { ancho: ANCHO_NODO + MARGEN * 2, alto: ALTO_MIN + MARGEN * 2 };
  return {
    ancho: Math.max(...nodos.map((n) => n.x + n.ancho)) + HOLGURA_DERECHA,
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

/** Una vista del lienzo: cuánto zoom y cuánto corrida. */
export type VistaLienzo = { k: number; tx: number; ty: number };

/**
 * CÓMO QUEDA LA VISTA CUANDO SE ABRE EL PANEL DE UN NODO.
 *
 * El panel está anclado abajo a la izquierda, así que un nodo de la primera columna
 * queda detrás y se escribiría a ciegas. Lo que se corre es el LIENZO —no el panel, que
 * iría a tapar otra cosa— y sólo cuando hace falta: devuelve `null` si el nodo ya se ve.
 */
export function vistaConPanel(
  v: VistaLienzo,
  nodoX: number,
  panelAncho: number,
  margen: number,
): VistaLienzo | null {
  const libre = panelAncho + margen * 2;
  const izquierdaEnPantalla = v.tx + nodoX * v.k;
  if (izquierdaEnPantalla >= libre) return null;
  return { ...v, tx: v.tx + (libre - izquierdaEnPantalla) };
}

/**
 * Y AL CERRAR EL PANEL, EL LIENZO DEVUELVE LO QUE EL PANEL SE LLEVÓ.
 *
 * ⚠️ MEDIDO EN EL NAVEGADOR EL 04/10/2026, Y ES LO QUE AGRANDAR EL PANEL DESTAPÓ. Con
 * el panel en 460 px, abrir el nodo del disparador corría el grafo 443 px: la tarjeta
 * WHATSAPP quedaba en x=1485 de una ventana de 1600 —cortada por el borde— y al cerrar
 * el panel el lienzo NO volvía, porque reencuadrar solo está prohibido a propósito (sin
 * esa guarda, tocar un nodo deshace el paneo que la persona acaba de hacer). O sea que
 * quedaba una pantalla con media tarjeta y ninguna pista de que había más.
 *
 * ⚠️ Y LA SALIDA QUE PARECÍA LA BUENA ERA PEOR: achicar el grafo para que entren las dos
 * cosas. Medido, el lienzo de /mensajes tiene ~780 px (a la derecha de la lista de
 * mensajes), así que con 484 de panel quedan ~300 y el zoom caía al piso del lienzo,
 * 40%: tarjetas ilegibles, y encima ni así entraban. Correr y devolver no pelea por el
 * espacio — mientras se edita manda el panel, que es lo que se pidió.
 *
 * Devolver es simétrico y por eso no viola la regla del reencuadre: no se elige una
 * vista, se deshace la que eligió el código. Y SÓLO si la persona no tocó nada en el
 * medio: si paneó o hizo zoom, la vista es suya y se queda.
 */
export function vistaAlCerrarPanel(
  actual: VistaLienzo,
  aplicada: VistaLienzo,
  antes: VistaLienzo,
): VistaLienzo | null {
  const igual = (a: VistaLienzo, b: VistaLienzo): boolean =>
    Math.abs(a.k - b.k) < 0.001 && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5;
  if (!igual(actual, aplicada)) return null;
  if (igual(actual, antes)) return null;
  return antes;
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
