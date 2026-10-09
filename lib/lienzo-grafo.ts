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
  | 'espera' | 'condicion'
  // La tarjeta de ETIQUETA del chatbot (segunda tanda, decisión 8): una PRESENTACIÓN sobre la
  // ⚡ Acción `poner_etiqueta_lead` / `sacar_etiqueta_lead`. El dato sigue siendo una acción y
  // el motor no cambia; lo que cambia es cómo se dibuja.
  | 'etiqueta'
  // La tarjeta MAKO del chatbot (tercera tanda, decisión 11): la ⚡ Acción `avisar_al_equipo`, que
  // le escribe al GRUPO de WhatsApp del negocio (nunca al lead). Misma idea que la etiqueta.
  | 'mako';

/**
 * LA IDENTIDAD DE UNA TARJETA DE MENSAJE (tercera tanda, decisión 5): la de WhatsApp lleva el verde
 * y el fondo de chat; la de Email, el blanco de Gmail y el sobre rojo. Ausente = la tarjeta de
 * siempre (/mensajes no la pasa).
 */
export type CanalTarjeta = 'whatsapp' | 'email' | 'instagram' | 'messenger';

/**
 * Los dos íconos de tarjeta que no son ni un emoji ni una marca del catálogo (`ServicioVisual`): el
 * logo de MaKo y el sobre de Gmail. Los dibuja `IconoNodo` (app/_components/Lienzo.tsx); viven acá
 * porque los ponen los constructores de grafos, que son puros.
 */
export const ICONO_MAKO = 'mako';
export const ICONO_GMAIL = 'gmail';

/**
 * LAS DOS FAMILIAS DE TARJETAS (segunda tanda, decisión 9; pedido literal, punto 5: «Las
 * tarjetas de condición, esperar y etiqueta, deberían tener un diseño diferente a las de mensaje
 * y CRON»).
 *
 *   · `contenido`: lo que MANDA o DISPARA algo (el CRON, un mensaje, un email, una acción). La
 *     tarjeta blanca de siempre.
 *   · `control`: lo que DECIDE o ESPERA (condición, esperar, etiqueta, ir a). Compacta y
 *     teñida: se lee como una bisagra del camino, no como un mensaje.
 *
 * Ausente = la tarjeta de siempre (el lienzo de /mensajes no la pasa y no cambia ni un píxel).
 */
export type FamiliaNodo = 'contenido' | 'control';

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
  /**
   * FLECHAS EN PARALELO (segunda tanda, decisión 2). Esta salida admite MÁS de una flecha: con
   * el punto ocupado, el lienzo igual ofrece un ＋ que agrega una flecha «en paralelo» (en
   * vez de la de siempre, que continúa el hilo). Las flechas en paralelo que salen del nodo
   * (`par:<id>`) parten de ESTA fila.
   *
   * Ausente = una sola flecha por salida, como siempre: /mensajes no lo pasa y no cambia.
   */
  paralelo?: boolean;
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
  /** Contenido o control (ver `FamiliaNodo`). Ausente = la tarjeta de siempre. */
  familia?: FamiliaNodo;
  /**
   * El color de lo que la tarjeta representa, en `#rrggbb` (hoy: el de la etiqueta). La tarjeta
   * se tiñe con él como `ChipEtiqueta` (fondo color+24, borde color+66). Otro formato se ignora:
   * pegarle «24» a un `var(--x)` o a un `rgb()` da un color inválido, que no falla — no pinta.
   */
  color?: string | null;
  /** WhatsApp, Email, Instagram o Messenger: la tarjeta lleva la identidad de esa app (ver `CanalTarjeta`). */
  canal?: CanalTarjeta;
  /**
   * LA SALIDA AL PIE (sexta tanda, punto 4: «cada paso tiene un círculo al final que dice "Entonces"
   * y la flecha sale de ahí... si no tiene siguiente paso, el texto al lado del círculo con el "+"
   * dice "Siguiente paso"»). La salida ÚNICA de la tarjeta se dibuja como una FILA al pie, con el
   * texto a la derecha y el círculo sobre el borde: cuenta como fila para `yDePuerto` y el alto de la
   * tarjeta la incluye. Ausente = la salida de siempre, a la altura de la cabecera (/mensajes, la
   * píldora de una espera).
   */
  salidaAlPie?: boolean;
  /** No cuelga de nada (sexta tanda, punto 7): se creó suelta o se le borró la flecha. Borde punteado. */
  suelta?: boolean;
  /**
   * UNA ESPERA DIBUJADA EN LA FLECHA (sexta tanda, DELAY 1: «Que Delay no sea una tarjeta, que la
   * flecha no se corte»). El nodo existe —se selecciona, se edita, sale en el menú— pero no se dibuja
   * como tarjeta: es la pastilla de una arista (`AristaFlujo.esperas`). Su `x`/`y` son los de la
   * pastilla al armar el grafo; la posición viva la calcula `posicionDePildora`.
   */
  enFlecha?: boolean;
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
  /**
   * LAS ESPERAS QUE VAN SOBRE ESTA FLECHA (sexta tanda, DELAY 1), en orden: la flecha va de `desde` a
   * `hasta` sin cortarse y cada espera es una pastilla en el camino. En el DATO la flecha de `desde`
   * llega a la PRIMERA espera (`esperas[0].id`) y la última sigue en `hasta`: quien borra o inserta
   * sobre esta flecha tiene que mirar esto, no `hasta`.
   */
  esperas?: Array<{ id: string; texto: string }>;
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

/**
 * ¿El nodo dibuja FILAS de salida (varias, con rótulo, o la salida al pie), o una sola salida
 * simple a la altura de la cabecera?
 */
export function tieneFilas(n: Pick<NodoFlujo, 'puertos'> & { salidaAlPie?: boolean }): boolean {
  const pts = n.puertos ?? [];
  return pts.some((p) => p.rotulo != null) || (n.salidaAlPie === true && pts.length > 0);
}

/**
 * LO QUE DICE UNA FILA DE SALIDA. La de una rama o un caso, su rótulo; la salida al pie (sexta
 * tanda, punto 4), «Entonces» si ya sigue en algo y «Siguiente paso» si no: es el molde de ManyChat.
 */
export const ROTULO_ENTONCES = 'Entonces';
export const ROTULO_SIGUIENTE = 'Siguiente paso';
export function rotuloDeFila(n: { salidaAlPie?: boolean }, p: Pick<PuertoNodo, 'rotulo' | 'vacio'>): string | undefined {
  if (p.rotulo != null) return p.rotulo;
  return n.salidaAlPie ? (p.vacio ? ROTULO_SIGUIENTE : ROTULO_ENTONCES) : undefined;
}

/**
 * LA FILA DE LA QUE SALE UNA FLECHA: el puerto de la arista (`sig`, una rama, `par:<id>`,
 * `par:<id>@<resultado>`) leído como la FILA de la tarjeta donde se dibuja su círculo. Lo usan
 * `yDePuerto` (de dónde sale la curva) y el lienzo (qué flechas borra la papelera de un círculo).
 * null = la tarjeta no tiene filas (sale de la cabecera).
 *
 * · Una flecha en paralelo de un RESULTADO (`par:<destino>@<resultado>`) sale de la fila de ESE
 *   resultado (cuarta tanda, punto 8).
 * · Una en paralelo de una tarjeta (`par:<destino>`) sale de la fila que la admite (`paralelo`: en el
 *   CRON es «Al entrar»), y si ya no ofrece más (el tope), de la de siempre ('sig').
 */
export function filaDePuerto(n: NodoFlujo, puerto?: string): string | null {
  if (!puerto || !tieneFilas(n)) return null;
  const filas = n.puertos ?? [];
  let i = filas.findIndex((p) => p.id === puerto);
  const arroba = puerto.startsWith('par:') ? puerto.lastIndexOf('@') : -1;
  if (i < 0 && arroba > 0) i = filas.findIndex((p) => p.id === puerto.slice(arroba + 1));
  if (i < 0 && puerto.startsWith('par:')) i = filas.findIndex((p) => p.paralelo);
  if (i < 0 && puerto.startsWith('par:')) i = filas.findIndex((p) => p.id === 'sig');
  return i < 0 ? null : filas[i].id;
}

/**
 * La altura (en coordenadas del grafo) de donde sale la flecha de un puerto.
 *
 * · Sin puerto, o un nodo de salida simple: a la altura de la CABECERA, con el tope de
 *   44 px — en un nodo alto la flecha que sale del medio cruza por encima del texto.
 * · Una fila: el centro de su fila, contado desde el PIE de la tarjeta. Desde el pie y
 *   no desde la cabecera porque lo de arriba (el contenido) es lo que varía; las filas
 *   tienen alto fijo y van pegadas abajo (`TarjetaNodo`).
 * · Una flecha EN PARALELO (`par:<id>`) sale de la fila que la admite (`paralelo: true`): en el
 *   CRON es «Al entrar». Sin esto caía a la cabecera, y la flecha salía de arriba de la tarjeta,
 *   por encima de las filas, como si viniera de otro lado.
 */
export function yDePuerto(n: NodoFlujo, puerto?: string): number {
  const cabecera = n.y + Math.min(n.alto / 2, 44);
  // ⚠️ LA SALIDA AL PIE (sexta tanda) es una fila aunque nadie pida un puerto: sin puerto, sale de ella.
  const fila = filaDePuerto(n, puerto ?? (n.salidaAlPie ? 'sig' : undefined));
  if (fila == null) return cabecera;
  const filas = n.puertos ?? [];
  // CUARTA TANDA, PUNTO 8: una flecha en paralelo de un RESULTADO sale de la fila de ESE resultado; y
  // si la fila ya no ofrece más (el tope), las que YA salen en paralelo siguen saliendo de la de
  // siempre ('sig'). Las dos reglas viven en `filaDePuerto`.
  const i = filas.findIndex((p) => p.id === fila);
  return n.y + n.alto - BORDE_NODO - PIE_PUERTOS - (filas.length - i - 0.5) * ALTO_PUERTO;
}

/**
 * DÓNDE ENTRA UNA FLECHA A UNA TARJETA (sexta tanda, punto 5: «Yo puedo soltar en cualquier lugar de
 * la tarjeta la flecha, pero siempre se coloca en el mismo lugar»). Siempre el mismo punto: el borde
 * izquierdo, a la altura del TÍTULO, como en ManyChat. Una tarjeta con salidas (/chatbot) entra en
 * su cabecera (`Y_ENTRADA`); las de /mensajes (sin `puertos`) siguen con los 44 px de siempre.
 */
export const Y_ENTRADA = 22;
export function puntoDeEntrada(b: NodoFlujo): { x: number; y: number } {
  return { x: b.x, y: b.y + Math.min(b.alto / 2, b.puertos !== undefined ? Y_ENTRADA : 44) };
}

/** Dónde sale la flecha de un puerto: el borde derecho, a la altura de su fila (`yDePuerto`). */
export function puntoDePuerto(n: NodoFlujo, puerto?: string): { x: number; y: number } {
  return { x: n.x + n.ancho, y: yDePuerto(n, puerto) };
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
  return curvaPuntos(x1, y1, x2, y2);
}

/**
 * La MISMA curva entre dos puntos sueltos: la flecha que sigue al cursor mientras se arrastra desde un
 * círculo (sexta tanda, punto 5) y la que asoma al tocarlo, con el menú en su punta. Con la misma
 * forma que las de verdad, la que se suelta no «salta» al conectarse.
 */
export function curvaPuntos(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(38, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/**
 * Un punto de la curva de una arista en `t` (0 = la salida, 1 = la llegada): la Bézier cúbica de
 * `curvaEntre`, evaluada. Es dónde van las pastillas de las esperas sobre una flecha (sexta tanda,
 * DELAY 1): con una, en el medio; con varias, repartidas. `medioDeCurva` es el punto medio de las
 * PUNTAS (no de la curva) y se queda así: lo fijan los tests de la etiqueta y del ＋ del medio.
 */
export function puntoDeCurva(a: NodoFlujo, b: NodoFlujo, puerto: string | undefined, t: number): { x: number; y: number } {
  const { x1, y1, x2, y2 } = puntas(a, b, puerto);
  const dx = Math.max(38, Math.abs(x2 - x1) * 0.5);
  const u = 1 - t;
  const bez = (p0: number, p1: number, p2: number, p3: number) => u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  return { x: bez(x1, x1 + dx, x2 - dx, x2), y: bez(y1, y1, y2, y2) };
}

/** Dónde va la pastilla `k` de `n` sobre una flecha: repartidas a lo largo, sin tocar las puntas. */
export const tDePildora = (k: number, n: number): number => (k + 1) / (n + 1);

/** El tamaño de la pastilla de una espera sobre una flecha (la dibuja el lienzo; el texto lo ajusta). */
export const ALTO_PILDORA_FLECHA = 22;
export const anchoPildoraFlecha = (texto: string): number => Math.min(150, Math.max(54, Math.ceil(30 + texto.length * 6.4)));

/**
 * DÓNDE ESTÁ AHORA LA PASTILLA de una espera dibujada en una flecha (`NodoFlujo.enFlecha`), como el
 * rectángulo de una tarjeta, o null si ninguna flecha la lleva. Se calcula de la flecha que la lleva:
 * mover una de sus puntas la mueve. Lo usa el lienzo para correr la vista cuando se abre su panel.
 */
export function posicionDePildora(g: Pick<GrafoFlujo, 'nodos' | 'aristas'>, id: string): { x: number; y: number; ancho: number; alto: number } | null {
  for (const a of g.aristas) {
    const k = (a.esperas ?? []).findIndex((e) => e.id === id);
    if (k < 0) continue;
    const d = g.nodos.find((n) => n.id === a.desde);
    const h = g.nodos.find((n) => n.id === a.hasta);
    if (!d || !h) return null;
    const p = puntoDeCurva(d, h, a.puerto, tDePildora(k, a.esperas!.length));
    const ancho = anchoPildoraFlecha(a.esperas![k].texto);
    return { x: p.x - ancho / 2, y: p.y - ALTO_PILDORA_FLECHA / 2, ancho, alto: ALTO_PILDORA_FLECHA };
  }
  return null;
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

// ── El panel APAISADO y los muelles (segunda tanda, decisiones 10 y 11) ───────────────

/** El margen con el que el panel del nodo (y lo que flota) se despega del borde del lienzo. */
export const PANEL_MARGEN = 12;
/**
 * El alto de la fila del zoom, abajo a la izquierda. El panel del nodo abre POR ENCIMA de ella:
 * medido el 04/10/2026, un panel de 328x355 en `bottom: 12` la tapaba entera.
 */
export const ZOOM_ALTO = 40;
/** Lo que ocupa arriba el chrome flotante (su relleno de 14 + la tarjeta del título, ~36). */
export const CHROME_ALTO = 64;

/**
 * LAS CAPAS DE LO QUE FLOTA SOBRE EL LIENZO (revisión de la segunda tanda, 09/10/2026).
 *
 * El panel APAISADO llega al rincón de abajo a la derecha de la ventana —el lienzo de /chatbot va
 * de borde a borde— y ahí pinta, `fixed` y en z 55, la esquina de avisos (EsquinaAvisos), subida a
 * 64 px por el `data-esquina-ocupada` de «Publicar». Sin capa propia (ningún ancestro del lienzo
 * tiene z-index) la pastilla quedaba encima de la última fila del editor de WhatsApp en `fila`, la
 * de «Revisar antes de enviar», y esa casilla no recibía el clic. Y las cajas de «Crear con IA»
 * (z 4, SecuenciaPerfil) tapaban el pie del editor y el desplegable del disparador.
 *
 * - El panel apaisado va ENCIMA de la esquina (55) y de esas cajas, y DEBAJO de los modales (la
 *   pila arranca en 130; AGENTS.md: «un aviso flotante va debajo de los modales»). Lo abrió la
 *   persona: mientras está abierto tapa el aviso, y el aviso vuelve al cerrarlo. Los menús de
 *   `Dropdown` van portaleados a `body` en z 1000 y el Toast en 600, así que siguen arriba.
 * - «Publicar» y su error, ENCIMA del panel: el error que frena Publicar abre la tarjeta culpable,
 *   o sea que el panel está abierto mientras se lee, y antes le tapaba el primer renglón.
 *
 * ⚠️ No se subió la esquina con `:root:has([data-panel-forma="apaisado"])`: con «Probar» apilado,
 * su borde de abajo queda a 12 px del techo del panel y la esquina subida caería sobre ese chat.
 */
export const Z_EDITOR_APAISADO = 56;
export const Z_ACCION_LIENZO = 57;

/**
 * CÓMO QUEDA LA VISTA CUANDO SE ABRE EL PANEL APAISADO (la franja de abajo).
 *
 * Es la otra mitad de `vistaConPanel`: aquél corre el lienzo en HORIZONTAL porque el panel de
 * columna tapa la izquierda; éste lo corre en VERTICAL, porque el panel apaisado tapa la franja
 * de abajo, de la lista al borde derecho. Y también en horizontal si la tarjeta quedó debajo de
 * lo que la pantalla apoya a los costados (la lista, «Probar» arriba a la derecha).
 *
 * `libre` es la franja que queda a la vista, en coordenadas de PANTALLA del lienzo: de `izq` a
 * `der` y de `arriba` (debajo del chrome) a `abajo` (el borde de arriba del panel, menos la
 * separación). Devuelve `null` si la tarjeta ya se ve entera, o si no hay franja.
 *
 * Una tarjeta MÁS ALTA que la franja se alinea arriba: se ve su cabecera, que es lo que dice qué
 * se está editando; centrarla dejaría la cabecera debajo del chrome. Lo mismo a lo ancho: manda
 * el borde izquierdo.
 */
export function vistaConPanelAbajo(
  v: VistaLienzo,
  nodo: { x: number; y: number; ancho: number; alto: number },
  libre: {
    izq: number; der: number; arriba: number; abajo: number;
    /**
     * El borde DERECHO del panel mediano (tercera tanda) y el piso que queda a su derecha. Una
     * tarjeta que arranca a la derecha del panel no está tapada: se mide contra `abajoSinPanel`
     * (encima de la fila del zoom), no contra el techo del panel. Ausentes = el panel de borde a
     * borde de antes.
     */
    panelDer?: number; abajoSinPanel?: number;
  },
): VistaLienzo | null {
  if (libre.abajo <= libre.arriba || libre.der <= libre.izq) return null;
  const top = v.ty + nodo.y * v.k;
  const alto = nodo.alto * v.k;
  const left = v.tx + nodo.x * v.k;
  const ancho = nodo.ancho * v.k;
  const alLado = libre.panelDer != null && left >= libre.panelDer;
  const abajo = alLado ? Math.max(libre.abajo, libre.abajoSinPanel ?? libre.abajo) : libre.abajo;
  let dy = 0;
  if (top + alto > abajo) dy = abajo - (top + alto);
  if (top + dy < libre.arriba) dy = libre.arriba - top;
  let dx = 0;
  if (left + ancho > libre.der) dx = libre.der - (left + ancho);
  if (left + dx < libre.izq) dx = libre.izq - left;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  return { ...v, tx: v.tx + dx, ty: v.ty + dy };
}

/**
 * LOS NÚMEROS DE LOS MUELLES de /chatbot. Viven acá y no en los componentes por la misma razón
 * que `muelles`: con un número en cada lado, el título vuelve a nacer debajo del buscador en
 * cuanto alguien toque uno (ya pasó con el inset contado dos veces, hallazgos-chatbot.md).
 */
export const MUELLE = {
  /** El hueco de las cosas que flotan contra el borde (la lista, «Probar»). */
  hueco: 16,
  /** La lista de automatizaciones, a la izquierda. */
  listaAncho: 320,
  /** «Probar», apilado arriba a la derecha (pedido literal, punto 8: «más ancho, no tan largo»). */
  probarAncho: 560,
  probarAnchoMin: 360,
  probarAltoMax: 420,
  probarAltoMin: 240,
  /** Lo que «Probar» y el editor toman como mucho del alto de la caja, cada uno. */
  fraccionAlto: 0.46,
  /**
   * EL EDITOR MEDIANO (tercera tanda, decisión 1): PEGADO A LA LISTA y de alto FIJO (una caja cuyo
   * alto es un tope salta al pasar de tarjeta).
   *
   * ⚠️ HASTA EL 09/10 IBA DE LA LISTA AL BORDE DERECHO, y Martín lo devolvió: «El editor no debe ser
   * tan ancho, ya te fuiste al otro extremo». En una ventana de 1440 medía 1112 de ancho por 360 de
   * alto, y el WhatsApp partido en dos columnas (el chat a un costado, el composer al otro) se leía
   * roto. Mediano y de una columna, como un teléfono.
   *
   * ⚠️ CUARTA TANDA, PUNTO 16: «haz más grande el editable de Email y WhatsApp». Estos números son
   * desde entonces los del editor de MENSAJE (WhatsApp y Email): de 720 × 420 a 840 × 560. Sigue
   * pegado a la lista y una columna; «Probar» no lo pisa por construcción (el ancho se corta antes
   * de él y el alto no pasa del chrome). Los de control miden lo suyo: `editorDeTarjeta`.
   */
  editorAnchoMax: 840,
  editorAltoMax: 560,
  editorAltoMin: 280,
  /** Lo que el editor toma del alto de la caja (con el tope de arriba): 0,64 de 875 ya son 560. */
  editorFraccionAlto: 0.64,
  /**
   * EL ANCHO DE UN EDITOR DE CONTROL (cuarta tanda, punto 1). Con 560 de adentro entra la frase más
   * larga de una condición (`ANCHO` de app/chatbot/EditorCondicion.tsx) y el desplegable de una
   * acción sin cortar los títulos largos; a 840, un DELAY de una frase dejaba media caja vacía.
   */
  editorControlAncho: 600,
  /** Por debajo de este ancho útil el editor mediano no entra y cae al panel de columna (392). */
  apaisadoMin: 560,
  /** El aire entre «Probar» y el editor apilados. */
  separacion: 12,
} as const;

export type RectMuelle = { left: number; top: number; width: number; height: number };

export type Muelles = {
  /** Dónde va «Probar» (en coordenadas de la caja), o null si está cerrado. */
  probar: RectMuelle | null;
  /** El editor apaisado (la franja de abajo), o null si es de columna o no está abierto. */
  editor: RectMuelle | null;
  /** La forma del editor: apaisado si hay ancho para sus dos columnas; si no, de columna. */
  editorForma: 'apaisado' | 'columna';
  /** «Probar» arriba y el editor abajo, o los dos lado a lado (ventana baja). null sin «Probar». */
  disposicion: 'apilados' | 'lado' | null;
  /** El alto del editor apaisado (el `panelAlto` del lienzo), esté abierto o no. */
  editorAlto: number;
  /**
   * El ANCHO del editor mediano (el `panelAncho` del lienzo cuando es apaisado), esté abierto o no:
   * hasta `MUELLE.editorAnchoMax`, pegado a la lista. Lo dibujado y lo reservado salen de acá.
   */
  editorAncho: number;
  /**
   * Lo que cada cosa que flota sobre el lienzo tiene que dejar libre:
   *   · `izq`: la lista (el chrome, el zoom, el panel y el encuadre: `Lienzo.insetIzq`);
   *   · `der`: lo que «Probar» tapa a la derecha en la franja de ARRIBA (el encuadre y el panel
   *     de columna: `Lienzo.insetDer`);
   *   · `derChrome`: lo que tapa a la altura del chrome (apilado, «Probar» empieza debajo: 0);
   *   · `derAbajo`: lo que tapa en la franja de ABAJO («Publicar» y el panel apaisado; apilado: 0).
   */
  insets: { izq: number; der: number; derChrome: number; derAbajo: number };
};

/**
 * DÓNDE VA CADA COSA QUE FLOTA SOBRE EL LIENZO DE /chatbot: la lista, «Probar» y el editor.
 *
 * Pedido literal (segunda tanda, puntos 3 y 8): «El editor de WhatsApp debes hacerlo más ancho
 * que largo, sino, se amontona todo» y «El "Probar" debe ser más ancho también, no tan largo,
 * sino, se rompe el diseño». Con los dos anchos y anclados donde estaban, se pisan (R3: con la
 * lista y «Probar» abiertos quedaban ~500 px de lienzo y el editor ocupaba 392). La salida
 * (decisión 11): «Probar» arriba a la derecha, debajo del chrome, y el editor en la franja de
 * abajo, pegado a la lista. Si apilados no entran (una ventana baja), van lado a lado:
 * «Probar» de arriba a abajo a la derecha y el editor entre la lista y él.
 *
 * Desde la tercera tanda el editor es MEDIANO (`MUELLE.editorAnchoMax`): ya no llega al borde
 * derecho. «Probar» sigue sin tocarlo porque el editor se corta antes de «Probar» (lado a lado).
 * El rectángulo `editor` es el del editor MÁS GRANDE (el de un mensaje); el de una tarjeta de control
 * es más chico y comparte la esquina de abajo a la izquierda (`editorDeTarjeta`), así que cabe adentro.
 *
 * ⚠️ UNA SOLA FUNCIÓN, PURA. Lo decide esto y nada más: la lista, el lienzo y «Probar» leen el
 * resultado. Repartida en tres componentes, esta aritmética ya produjo el inset contado dos veces.
 *
 * ⚠️ «PROBAR» NO DEPENDE DE SI EL EDITOR ESTÁ ABIERTO. Abrir una tarjeta no puede cambiarle el
 * tamaño a «Probar»: se le correría el chat en el medio de una prueba. Por eso la disposición se
 * decide con el alto de la caja (lo que NO cambia al abrir el editor) y `editorAbierto` sólo dice
 * si se devuelve el rectángulo del editor. Es la regla de la casa: una medición que cambia lo que
 * mide no puede decidir.
 */
export function muelles(
  caja: { w: number; h: number },
  op: { listaAbierta: boolean; probarAbierto: boolean; editorAbierto: boolean },
): Muelles {
  const { w, h } = caja;
  const H = MUELLE.hueco;
  const izq = op.listaAbierta ? MUELLE.listaAncho + H * 2 : 0;
  const bajo = PANEL_MARGEN + ZOOM_ALTO;
  const editorAlto = Math.max(0, Math.min(
    MUELLE.editorAltoMax,
    Math.max(MUELLE.editorAltoMin, Math.round(h * MUELLE.editorFraccionAlto)),
    h - bajo - CHROME_ALTO,
  ));
  // El lugar que hay entre la lista y lo que tapa la derecha abajo; el editor toma hasta 720 de eso,
  // pegado a la lista (decisión 1). Sobre lo que queda a su derecha sigue el lienzo.
  const lugarEditor = (derAbajo: number) => w - izq - derAbajo - PANEL_MARGEN * 2;
  const anchoEditor = (derAbajo: number) => Math.min(MUELLE.editorAnchoMax, lugarEditor(derAbajo));
  const forma = (derAbajo: number): 'apaisado' | 'columna' => (lugarEditor(derAbajo) >= MUELLE.apaisadoMin ? 'apaisado' : 'columna');
  const editor = (derAbajo: number): RectMuelle | null => (op.editorAbierto && forma(derAbajo) === 'apaisado'
    ? { left: izq + PANEL_MARGEN, top: h - bajo - editorAlto, width: anchoEditor(derAbajo), height: editorAlto }
    : null);

  if (!op.probarAbierto) {
    return { probar: null, editor: editor(0), editorForma: forma(0), disposicion: null, editorAlto, editorAncho: anchoEditor(0), insets: { izq, der: 0, derChrome: 0, derAbajo: 0 } };
  }

  // ⚠️ CUARTA TANDA, PUNTO 3: «En "Probar", si tiene que ser más grande el desplegable, sino, no se
  // lee el mensaje». Apilado entre el chrome y el editor medía ~330 de alto y el chat quedaba en
  // ~150. Ahora va SIEMPRE lado a lado: de DEBAJO del chrome hasta abajo, a la derecha, y el editor
  // entre la lista y él. Debajo del chrome y no desde arriba: el «▶ Probar» del chrome se vuelve
  // «Cerrar» en el MISMO lugar, así que el chrome no se corre (`derChrome: 0`).
  const anchoL = Math.max(0, Math.min(
    w - izq - H * 2,
    Math.max(MUELLE.probarAnchoMin, Math.min(MUELLE.probarAncho, Math.round((w - izq) * 0.4))),
  ));
  const der = anchoL + H * 2;
  return {
    probar: { left: w - H - anchoL, top: CHROME_ALTO, width: anchoL, height: Math.max(0, h - CHROME_ALTO - H) },
    editor: editor(der), editorForma: forma(der), disposicion: 'lado', editorAlto, editorAncho: anchoEditor(der),
    insets: { izq, der, derChrome: 0, derAbajo: der },
  };
}

// ── El tamaño del editor, por TIPO de tarjeta (cuarta tanda, punto 1) ──────────────────

/** El ancho del panel de COLUMNA (ventana angosta, `editorForma: 'columna'`): el de siempre. */
export const PANEL_COLUMNA_ANCHO = 392;

/**
 * EL ALTO DEL EDITOR DE CADA TARJETA DE CONTROL, con la cabecera incluida (62 px: relleno, borde, el
 * renglón del título y su aire). Cada número es su contenido TÍPICO, medido sobre los editores:
 *   · DELAY, TAG, GO TO: una frase o un campo grande (48) y una línea debajo (el aviso de precisión
 *     del DELAY, el error de «＋ Nueva» etiqueta) → 140;
 *   · MAKO: el título, el mensaje con ~5 renglones y «＋ Dato del lead» → 280;
 *   · ACTION: el desplegable, lo que hace, el lead y dos o tres campos («Mover un lead de etapa»:
 *     producto, etapa y el monto de Ganado) → 400;
 *   · CONDITION y CRON: dos o tres filas con sus «＋» → 320; «Si responde», tres casos → 400.
 * Lo que no entra SCROLLEA adentro del panel: el panel no crece.
 *
 * ⚠️ POR TIPO, NUNCA POR CONTENIDO (AGENTS.md: «una caja cuyo alto es un tope cambia de tamaño, y se
 * lleva puesto lo que cuelga adentro»). Elegir una acción con cinco campos no le cambia el alto al
 * panel; pasar de una tarjeta a otra del mismo tipo, tampoco.
 */
export const ALTO_EDITOR_CONTROL: Readonly<Partial<Record<TipoNodo, number>>> = {
  espera: 140, etiqueta: 140, 'ir-a': 140,
  mako: 280,
  accion: 400,
  condicion: 320, entrada: 320, respuesta: 400,
};
const ALTO_EDITOR_CONTROL_OTRO = 320;

export type TallaEditor = { ancho: number; alto: number };

/**
 * QUÉ TAMAÑO TIENE EL EDITOR DE UNA TARJETA (cuarta tanda, punto 1, literal: «No me gusta que el editor
 * del CRON como muchos otros tengan tanto espacio en blanco y un desplegable chico arriba del todo,
 * mejora el diseño»). Las capturas: DELAY, ACTION y CONDITION en un panel de ~720 × 420 con un renglón
 * arriba y el resto vacío, porque TODOS medían lo del editor de WhatsApp.
 *
 *   · Un MENSAJE (WhatsApp o Email): el grande de `muelles` (`editorAncho` × `editorAlto`, punto 16).
 *   · Lo demás: `ALTO_EDITOR_CONTROL` de su tipo y `MUELLE.editorControlAncho` de ancho, nunca más
 *     que el de un mensaje (los dos comparten la esquina de abajo a la izquierda, así que si el
 *     grande no pisa a «Probar», el chico tampoco).
 *   · De columna (ventana angosta): `PANEL_COLUMNA_ANCHO` de ancho para todos; el alto, igual.
 *
 * Sin `muelles`, o con la caja todavía sin medir (`editorAlto` 0): alto 0, que el lienzo lee como
 * «el alto libre de siempre».
 */
export function editorDeTarjeta(
  m: Pick<Muelles, 'editorForma' | 'editorAncho' | 'editorAlto'> | null | undefined,
  tipo: TipoNodo | null | undefined,
): TallaEditor {
  const apaisado = m?.editorForma === 'apaisado';
  const anchoMensaje = m && apaisado ? m.editorAncho : PANEL_COLUMNA_ANCHO;
  const altoMensaje = Math.max(0, m?.editorAlto ?? 0);
  if (!tipo || tipo === 'mensaje') return { ancho: anchoMensaje, alto: altoMensaje };
  return {
    ancho: apaisado ? Math.min(MUELLE.editorControlAncho, anchoMensaje) : anchoMensaje,
    alto: Math.min(ALTO_EDITOR_CONTROL[tipo] ?? ALTO_EDITOR_CONTROL_OTRO, altoMensaje),
  };
}

// ── El revelado: las tarjetas aparecen de a una (segunda tanda, decisión 14) ───────────

/** Cuánto tarda una tarjeta en aparecer, cuánto sube y cuánto espera la siguiente. */
export const REVELAR_DURACION_MS = 220;
export const REVELAR_SUBE_PX = 8;
export const REVELAR_PASO_MS = 150;

/**
 * ¿YA TOCA VER ESTE NODO? Con «Crear con IA» las tarjetas aparecen de a una, en el orden que
 * da quien las creó (`orden`), sobre el layout FINAL: `cuantos` es cuántas ya aparecieron.
 *
 *   · Un nodo que no está en `orden` se ve siempre (el CRON, si quien ordena no lo nombra: es la
 *     tarjeta que ya estaba). Un revelado no puede esconder para siempre lo que no nombra.
 *   · `cuantos` Infinity = todo a la vista (sin revelado, terminado, o con `prefers-reduced-motion`).
 *
 * Una FLECHA se ve cuando se ven sus dos puntas: `aristaRevelada`.
 */
export function nodoRevelado(orden: readonly string[] | null | undefined, cuantos: number, id: string): boolean {
  if (!orden || !Number.isFinite(cuantos)) return true;
  const i = orden.indexOf(id);
  return i < 0 || i < cuantos;
}

export function aristaRevelada(orden: readonly string[] | null | undefined, cuantos: number, a: Pick<AristaFlujo, 'desde' | 'hasta'>): boolean {
  return nodoRevelado(orden, cuantos, a.desde) && nodoRevelado(orden, cuantos, a.hasta);
}

/** De dónde sale y a dónde llega la flecha. La salida es la de su puerto (`yDePuerto`); la
 *  llegada, el punto fijo de entrada del destino (`puntoDeEntrada`). */
function puntas(a: NodoFlujo, b: NodoFlujo, puerto?: string) {
  const e = puntoDeEntrada(b);
  return {
    x1: a.x + a.ancho,
    y1: yDePuerto(a, puerto),
    x2: e.x,
    y2: e.y,
  };
}
