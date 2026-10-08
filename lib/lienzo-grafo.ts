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
//
// ── LOS PUERTOS (08/10/2026) ──────────────────────────────────────────────────
// Pedido de Martín, punto 9: «A raíz de cada condicional, debería poder crear tarjetas
// arriba y abajo, no solo a la derecha». El molde es ManyChat, medido en su ayuda: TODAS
// las salidas de un nodo son puntos en su borde DERECHO, una fila por salida, y los
// destinos se abren a la derecha, apilados arriba y abajo. No hay conectores en el borde
// de arriba ni en el de abajo: «arriba y abajo» es dónde caen las tarjetas, no de dónde
// sale la flecha.
//
// Todo es OPCIONAL: un nodo sin `puertos` y una arista sin `puerto` se dibujan como
// siempre (una sola salida, a la altura de la cabecera). Así el lienzo de /mensajes
// (`lib/flujo-aviso.ts`) no cambia ni un píxel.

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

/**
 * UNA SALIDA DE UN NODO. Una fila por salida, con su punto en el borde derecho.
 *
 * Sin `rotulo` es la salida ÚNICA de un nodo simple (un mensaje, una espera): no se
 * dibuja una fila, sólo el punto a la altura de la cabecera. Con `rotulo` es una de
 * varias (una rama de una condición, un caso de «Si responde», el «Si no»), y cada una
 * es una fila al pie de la tarjeta.
 */
export type PuertoNodo = {
  id: string;
  rotulo?: string;
  /** El color del punto: verde para «se cumple», rojo para «si no». */
  tono?: TonoArista;
  /** No sale nada de acá todavía: el lienzo dibuja su ＋. */
  vacio: boolean;
  /** Una marca chica al final de la fila («2 sin caso»): algo que salió por aquí y espera. */
  marca?: string;
};

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
  /**
   * Las salidas, de arriba hacia abajo. Con esto la tarjeta tiene ALTO FIJO (`alto`): la
   * posición de cada punto se calcula desde el pie de la tarjeta, y una tarjeta que crece
   * con su contenido correría las filas lejos de sus flechas. Un `[]` es un nodo que
   * termina (un «Ir a»): sin puntos y sin el ＋ de pasar el cursor.
   */
  puertos?: PuertoNodo[];
  x: number; y: number; ancho: number; alto: number;
};

export type AristaFlujo = {
  desde: string;
  hasta: string;
  /** De qué salida de `desde` parte. Ausente = la única, a la altura de la cabecera. */
  puerto?: string;
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
/** El alto de cada fila de salida (una rama, un caso, el «Si no»). */
export const ALTO_PUERTO = 26;
/** Lo que queda debajo de la última fila, adentro de la tarjeta (su padding de abajo). */
export const PIE_PUERTOS = 8;
/** El borde de la tarjeta (`TarjetaNodo`): las filas se cuentan desde adentro de él. */
export const BORDE_NODO = 1.5;

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

/**
 * La caja que encierra a todos los nodos, con su margen.
 *
 * ⚠️ ASUME COORDENADAS ≥ 0: el lienzo pone el dibujo con su esquina en (0, 0) y encuadra
 * contra `ancho × alto`. Un layout que abre ramas hacia ARRIBA de su padre produce `y`
 * negativas, y sin normalizar esa rama nace fuera de cuadro —arriba del borde, donde
 * `overflow: hidden` la corta—. Por eso el árbol pasa por `aOrigen` antes de llegar acá.
 */
export function encerrar(nodos: NodoFlujo[]): { ancho: number; alto: number } {
  if (nodos.length === 0) return { ancho: ANCHO_NODO + MARGEN * 2, alto: ALTO_MIN + MARGEN * 2 };
  return {
    ancho: Math.max(...nodos.map((n) => n.x + n.ancho)) + HOLGURA_DERECHA,
    alto: Math.max(...nodos.map((n) => n.y + n.alto)) + MARGEN,
  };
}

/**
 * Corre todo el dibujo para que su esquina de arriba a la izquierda quede en (margen,
 * margen). Devuelve copias: el layout de quien llama no se toca.
 *
 * Es la otra mitad de `encerrar`: el árbol de una condición apila sus ramas arriba y
 * abajo del puerto, así que la primera rama de la primera condición puede quedar con
 * `y < 0`. Se calcula libre y se normaliza al final, en vez de reservar «por las dudas»
 * un alto arriba que nadie sabe cuánto es.
 */
export function aOrigen(nodos: readonly NodoFlujo[], margen: number = MARGEN): NodoFlujo[] {
  if (!nodos.length) return [];
  const dx = margen - Math.min(...nodos.map((n) => n.x));
  const dy = margen - Math.min(...nodos.map((n) => n.y));
  return nodos.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
}

/** ¿El nodo dibuja FILAS de salida (varias, con rótulo), o una sola salida simple? */
export function tieneFilas(n: Pick<NodoFlujo, 'puertos'>): boolean {
  return (n.puertos ?? []).some((p) => p.rotulo != null);
}

/**
 * La altura (en coordenadas del grafo) de donde sale la flecha de un puerto.
 *
 * · Sin puerto, o un nodo de salida simple: a la altura de la CABECERA, con el tope de
 *   44 px — en un nodo alto la flecha que sale del medio cruza por encima del texto.
 * · Una fila: el centro de su fila, contado desde el PIE de la tarjeta. Desde el pie y
 *   no desde la cabecera porque lo de arriba (el contenido) es lo que varía; las filas
 *   tienen alto fijo y van pegadas abajo (`TarjetaNodo`).
 */
export function yDePuerto(n: NodoFlujo, puerto?: string): number {
  const cabecera = n.y + Math.min(n.alto / 2, 44);
  if (!puerto || !tieneFilas(n)) return cabecera;
  const filas = n.puertos ?? [];
  const i = filas.findIndex((p) => p.id === puerto);
  if (i < 0) return cabecera;
  return n.y + n.alto - BORDE_NODO - PIE_PUERTOS - (filas.length - i - 0.5) * ALTO_PUERTO;
}

/**
 * El centro de las filas de salida, relativo al TOPE del nodo. Es contra lo que el árbol
 * apila las ramas («arriba y abajo del puerto»): centradas en las filas y no en la
 * tarjeta, las flechas salen casi derechas.
 */
export function centroDeFilas(alto: number, filas: number): number {
  if (filas <= 0) return Math.min(alto / 2, 44);
  return alto - BORDE_NODO - PIE_PUERTOS - (filas * ALTO_PUERTO) / 2;
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
 *
 * `puerto` es opcional: sin él, sale de la cabecera como siempre (el lienzo de avisos).
 */
export function curvaEntre(a: NodoFlujo, b: NodoFlujo, puerto?: string): string {
  const { x1, y1, x2, y2 } = puntas(a, b, puerto);
  const dx = Math.max(38, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** El punto medio de esa misma curva, donde va la etiqueta (y el ＋ del medio). */
export function medioDeCurva(a: NodoFlujo, b: NodoFlujo, puerto?: string): { x: number; y: number } {
  const { x1, y1, x2, y2 } = puntas(a, b, puerto);
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
 *
 * `margenIzq` es dónde EMPIEZA el panel (su margen más lo que la pantalla apoya a la
 * izquierda, `insetIzq`) y `separacion`, el aire entre el panel y el nodo. El borde libre es
 * `margenIzq + panelAncho + separacion`.
 *
 * ⚠️ HASTA EL 08/10 ERA `panelAncho + margen × 2` CON `margen = 12 + insetIzq` (revisión,
 * lienzo-4): el inset izquierdo entraba DOS veces. En /chatbot (lista de 304 px, panel de 392)
 * el nodo se corría a x = 1024 en vez de 720, y con «Probar» abierto (el teléfono en
 * [924, 1284] de un lienzo de 1300) quedaba DEBAJO del teléfono: se editaba a ciegas justo
 * donde la pantalla promete «se prueba lo que se edita». Sin inset izquierdo (/mensajes) las
 * dos cuentas dan lo mismo.
 *
 * Y con `tope` (lo que la pantalla deja ver a la derecha: el ancho menos `insetDer`) el nodo
 * no se corre más allá de donde termina: si no entra entero al lado del panel, se corre hasta
 * el tope, y si ni eso lo mejora, no se corre.
 */
/** El zoom con el que una tarjeta se lee: el encuadre inicial no arranca por debajo. */
export const ZOOM_LEGIBLE = 0.85;
/** Lo que queda libre a la izquierda de la entrada cuando el flujo no entra entero. */
export const MARGEN_ENCUADRE = 24;

/**
 * La vista con la que abre un lienzo.
 *
 * ⚠️ NUNCA ARRANCA ILEGIBLE (08/10/2026). Hasta acá era «que entre todo»: con las ramas, un
 * flujo de antes convertido a tarjetas (esperas, condiciones, «Si responde») mide diez
 * columnas y quedaba al 30 %. Martín abrió /chatbot y vio un dibujo de tarjetas de tres
 * píxeles. Ahora el zoom tiene un piso legible y, si así no entra, se ancla en la ENTRADA (el
 * CRON): se arranca por el principio, como en ManyChat, y lo demás se recorre arrastrando.
 *
 * El ancho que se usa es el ÚTIL: lo que tapan la lista (insetIzq) y el panel de «Probar»
 * (insetDer) no cuenta, o la primera tarjeta nace debajo de la lista y no se puede tocar.
 */
export function encuadreInicial(
  grafo: Pick<GrafoFlujo, 'nodos' | 'ancho' | 'alto'>,
  caja: { w: number; h: number; insetIzq?: number; insetDer?: number },
): VistaLienzo {
  const izq = caja.insetIzq ?? 0;
  const wUtil = Math.max(1, caja.w - izq - (caja.insetDer ?? 0));
  const ajuste = Math.min(1, Math.min(wUtil / Math.max(1, grafo.ancho), caja.h / Math.max(1, grafo.alto)));
  const k = Math.max(ajuste, ZOOM_LEGIBLE);
  const ancla = grafo.nodos.find((n) => n.tipo === 'entrada') ?? grafo.nodos[0];
  const tx = grafo.ancho * k <= wUtil || !ancla
    ? izq + (wUtil - grafo.ancho * k) / 2
    : izq + MARGEN_ENCUADRE - ancla.x * k;
  const ty = grafo.alto * k <= caja.h || !ancla
    ? (caja.h - grafo.alto * k) / 2
    : caja.h / 2 - (ancla.y + ancla.alto / 2) * k;
  return { k, tx, ty };
}

export function vistaConPanel(
  v: VistaLienzo,
  nodoX: number,
  panelAncho: number,
  margenIzq: number,
  op: { separacion?: number; nodoAncho?: number; tope?: number } = {},
): VistaLienzo | null {
  const libre = margenIzq + panelAncho + (op.separacion ?? 12);
  const izquierdaEnPantalla = v.tx + nodoX * v.k;
  if (izquierdaEnPantalla >= libre) return null;
  const hasta = op.tope != null && op.nodoAncho != null
    ? Math.min(libre, op.tope - op.nodoAncho * v.k)
    : libre;
  if (hasta <= izquierdaEnPantalla) return null;
  return { ...v, tx: v.tx + (hasta - izquierdaEnPantalla) };
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

/** De dónde sale y a dónde llega la flecha. La salida es la de su puerto (`yDePuerto`);
 *  la llegada, a la altura de la cabecera del destino, con el mismo tope de 44 px. */
function puntas(a: NodoFlujo, b: NodoFlujo, puerto?: string) {
  return {
    x1: a.x + a.ancho,
    y1: yDePuerto(a, puerto),
    x2: b.x,
    y2: b.y + Math.min(b.alto / 2, 44),
  };
}
