'use client';

// =============================================================================
// Lienzo — un grafo que se panea, se acerca, y se edita tocando un nodo
// =============================================================================
// El chrome de una pantalla tipo flujo, sin saber NADA de lo que dibuja. Lo usan
// los dos flujos del producto y el día que haya un tercero lo hereda gratis:
//
//   · `app/automations/FlujoLienzo.tsx`  — la conversación con un lead
//   · `app/agencia/FlujoAviso.tsx`   — lo que MaKo te dice a vos
//
// Nació genérico el 30/09/2026, el mismo día que el segundo: la primera versión
// tenía las burbujas de WhatsApp adentro del paneo, y copiarla habría dejado dos
// lienzos que se separan en la primera edición — que es la razón escrita por la
// que se borró el editor de diagramas del funnel.
//
// Quien lo usa pone TRES cosas: el grafo, cómo se dibuja cada nodo y qué se edita
// al tocarlo. Todo lo demás —el gesto, el encuadre, las curvas, el panel— es de acá.
//
// ── LAS CUATRO TRAMPAS DE UN LIENZO, TODAS MEDIDAS EN EL NAVEGADOR ─────────
// 1. El alto sale del VIEWPORT, nunca de un `aspect-ratio`: con proporción, el
//    lienzo medía 1444×1083 sobre un viewport de 900 — crecía justo en el monitor
//    donde más espacio hay. Y el padre estira con flex + `minHeight: 0`, porque
//    `height: 100%` contra un padre con `flex: 1` devuelve CERO en Safari.
// 2. `setPointerCapture` RETARGETEA todo lo que sigue al elemento que capturó, así
//    que en el `pointerup` el `e.target` es el CONTENEDOR: el nodo del clic se
//    anota en el `pointerdown`. Y el `release` puede tirar y llevarse el clic.
// 3. El movimiento se escribe con `transform` sobre un REF adentro del handler,
//    nunca con `setState`: un setState por `pointermove` redibuja el grafo entero
//    60 veces por segundo.
// 4. `touch-action: none` es obligatorio para el pellizco y ATRAPA el scroll de la
//    página: por eso el alto tiene tope y el lienzo no ocupa todo el largo.
//
// ── LAS SALIDAS (08/10/2026) ────────────────────────────────────────────────
// Un nodo con `puertos` dibuja un CÍRCULO por salida en su borde derecho. El ＋ del medio de
// una flecha inserta EN el puerto del que sale esa flecha. Todo es opcional: el lienzo de
// /mensajes no tiene puertos y se dibuja como siempre.
//
// ── LA SEXTA TANDA (09/10/2026): EL CÍRCULO «ENTONCES», ARRASTRAR, BORRAR, EL CLICK DERECHO ──
// El molde es ManyChat, con el pedido de Martín textual:
//   · 4  «cada paso tiene un círculo al final que dice "Entonces" y la flecha sale de ahí. Ya no
//        existe más el "+" al lado de una tarjeta, sino el círculo de abajo» → la salida de una
//        tarjeta es una fila al pie (`salidaAlPie`) con «Entonces ●» / «Siguiente paso ⊕», y el ＋
//        vive ADENTRO del círculo (uno por puerto: cada rama de una condición tiene el suyo).
//   · 5  «Si apreto en el circulo con el "+" un solo click, debería salir la flecha y al final de la
//        flecha el desplegable... Y si apreto y mantengo... arrastrar esa flecha a otra tarjeta» →
//        un CLIC asoma una flecha con el menú en la punta (`fantasma`); ARRASTRAR la lleva con el
//        cursor, atenúa todo menos la tarjeta de origen y la de abajo del cursor, y al soltar sobre
//        cualquier punto de una tarjeta llama a `onConectar` (la flecha entra a su punto fijo,
//        `puntoDeEntrada`). Soltar en el vacío no hace nada.
//   · 6  «Al lado del "+"... el icono de basura, así se puede eliminar esa flecha» → `onQuitarFlecha`,
//        al lado del círculo y en el medio de cada flecha.
//   · 2  «click derecho en el lienzo... crear una tarjeta, guardar... en una tarjeta, eliminar,
//        duplicar» → `menuLienzo` / `menuNodo`, con íconos. Sin ellos no hay menú (/mensajes).
//   · DELAY 1 «Que Delay no sea una tarjeta, que la flecha no se corte» → las esperas de una arista
//        (`AristaFlujo.esperas`) son pastillas sobre la flecha, y se editan tocándolas.

import { IDENTIDAD_SOCIAL } from '@/lib/canal-social';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SvcIcon, ICON, BrandDefs } from './ServicioVisual';
import { MakoLogo } from './MakoBrand';
// La papelera de la casa, roja siempre (sexta tanda, general 9): UNA definición para toda la app.
import { IconoBorrar, BotonBorrar } from '@/app/_ui/BotonBorrar';
import { Dropdown, IconoOpcion, type DropdownOption } from '../components/Dropdown';
import {
  curvaEntre, curvaPuntos, medioDeCurva, puntoDeCurva, tDePildora, posicionDePildora, puntoDeEntrada, puntoDePuerto, filaDePuerto,
  vistaConPanel, vistaConPanelAbajo, vistaAlCerrarPanel, yDePuerto, tieneFilas, rotuloDeFila, encuadreInicial,
  nodoRevelado, aristaRevelada,
  ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO, PANEL_MARGEN, ZOOM_ALTO, CHROME_ALTO, Z_EDITOR_APAISADO, Z_ACCION_LIENZO, ALTO_PILDORA_FLECHA,
  REVELAR_DURACION_MS, REVELAR_SUBE_PX, REVELAR_PASO_MS, ICONO_MAKO, ICONO_GMAIL, type VistaLienzo,
  type GrafoFlujo, type NodoFlujo, type TonoArista, type AristaFlujo, type PuertoNodo,
} from '@/lib/lienzo-grafo';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Cuánto se puede alejar y acercar. Los mismos topes que el mapa del segundo
 *  cerebro, que es el otro lienzo de la casa. */
const K_MIN = 0.4;
const K_MAX = 2.4;
/** Umbral de arrastre al cuadrado: por debajo de esto, el gesto fue un CLIC.
 *  Va al cuadrado para no sacar una raíz por cada `pointermove`. */
const ARRASTRE2 = 25;
/**
 * EL ANCHO DE TOQUE DE UNA FLECHA, en píxeles de PANTALLA (quinta tanda, punto 2: «ya no está la
 * opción de insertar un delay o condición algo en medio de una flecha»). El ＋ del medio no se había
 * roto: vivía en un cuadrado invisible de 28 px en el punto medio y la flecha no reaccionaba fuera de
 * él. Mientras la espera se dibujaba SOBRE la flecha («24 h»), la etiqueta marcaba dónde pasar el
 * cursor; al pasar la espera a su propia tarjeta (08/10) se perdió la pista. Ahora la flecha entera
 * es la zona: un segundo trazo transparente de este ancho, y pasar por cualquier punto muestra el ＋.
 */
const TOQUE_FLECHA = 16;
/**
 * Cuánto espera el ＋ de una flecha antes de apagarse al salir de ella. El ＋ va en el PUNTO MEDIO y
 * la flecha es una curva: ir en línea recta desde otro punto de la curva hasta el ＋ sale de la franja
 * de 16 px en una flecha con desnivel, y sin este respiro el botón se apaga en el camino (la misma
 * familia que el ＋ de la tarjeta que se apagaba a 8 px, AGENTS.md).
 */
const GRACIA_FLECHA_MS = 350;
/** Ancho del panel de edición, y el margen con el que se despega del borde. */
/**
 * Ancho del panel de edición. Es el DEFAULT: quien monta el lienzo puede pedir otro
 * con `panelAncho`, porque lo que entra adentro lo decide él. Lo pidió Martín con la
 * captura delante — «la sección de edición del mensaje tiene que ser MUCHO más
 * grande»— y subir la constante a secas se lo habría cambiado a TODOS los lienzos,
 * incluido el del chatbot, que no lo pidió.
 */
const PANEL_ANCHO = 328;
/* `PANEL_MARGEN` y `ZOOM_ALTO` (el alto de la barra de zoom, que vive en la MISMA esquina: el
   panel del nodo abre por encima de ella, porque medido, un panel de 328x355 en `bottom: 12` la
   tapaba ENTERA) viven en lib/lienzo-grafo.ts desde la segunda tanda: los usa también `muelles`,
   que calcula dónde va el editor apaisado, y con dos copias el rectángulo de `muelles` y el panel
   dibujado se separarían en la primera edición. La barra no se mueve: la esquina la pidió el dueño. */

export const COLOR_TONO: Record<TonoArista, string> = {
  normal: 'var(--border-strong)',
  buena: 'var(--good)',
  mala: 'var(--bad)',
  condicional: 'var(--primary)',
};

/**
 * UNA OPCIÓN DEL CLICK DERECHO (sexta tanda, punto 2). Con ícono siempre que se pueda (punto 10: «en
 * los desplegables, también siempre con ÍCONO»); `grupo` separa con una línea; `peligro` va en rojo
 * (lo que borra). Las arma quien monta el lienzo: el lienzo no sabe qué es una tarjeta.
 */
export type ItemMenuLienzo = {
  id: string; label: string; icono?: ReactNode; onElegir: () => void;
  peligro?: boolean; deshabilitado?: boolean; grupo?: number;
};

/** La opacidad de lo que NO es la tarjeta de origen ni la de abajo del cursor mientras se arrastra una flecha. */
const ATENUADO = 0.28;
/** Cuánto baja el ＋ del medio de una flecha que lleva una espera encima: si no, la pastilla lo tapa. */
const DESVIO_MEDIO = 22;
/** El círculo de una salida: su diámetro, y cuánto asoma la flecha al tocarlo (con el menú en la punta). */
const CIRCULO = 16;
const ASOMA_FLECHA = 118;

export function Lienzo({
  grafo, seleccion, onSeleccion, renderNodo, renderEditor, tituloEditor, accionesTitulo, accion,
  alto = 'min(54svh, 460px)', onMover, onAgregarTras, puedeAgregarTras, agregarOcupado = false, opcionesAgregar, opcionesEn, panelAncho = PANEL_ANCHO, chrome, herramientas, sinMarco = false, insetIzq = 0, insetDer = 0,
  insetDerChrome, insetDerAbajo, panelForma = 'columna', panelAlto, revelar = null,
  onBorrar, puedeBorrar, reservaAbajo = 0,
  onConectar, onQuitarFlecha, menuLienzo, menuNodo, nombreNodo,
}: {
  /**
   * ARRASTRAR UNA FLECHA (sexta tanda, punto 5): se soltó el ＋ del círculo de la salida `puerto` (la
   * FILA: 'sig', una rama, un caso) de `desde` sobre la tarjeta `hacia`. Lo que eso significa en el
   * dato lo decide quien monta (lib/flujo-edicion.ts, `conectar`). Sin esto, el círculo sólo agrega.
   */
  onConectar?: (desde: string, puerto: string, hacia: string) => void;
  /** La papelera de una flecha (sexta tanda, punto 6): al lado del círculo y en el medio de la flecha. */
  onQuitarFlecha?: (a: AristaFlujo) => void;
  /**
   * EL CLICK DERECHO (sexta tanda, punto 2): las opciones en el fondo del lienzo —`punto` es dónde se
   * hizo, en coordenadas del GRAFO (ahí nace una tarjeta suelta)— y en una tarjeta. El lienzo suma
   * «Centrar» al del fondo. Sin ninguno de los dos, el click derecho es el del navegador (/mensajes).
   */
  menuLienzo?: (punto: { x: number; y: number }) => ItemMenuLienzo[];
  menuNodo?: (id: string) => ItemMenuLienzo[];
  /** Cómo se nombra una tarjeta en un menú («Quitar la flecha a «WHATSAPP: Hola…»»). */
  nombreNodo?: (id: string) => string;
  grafo: GrafoFlujo;
  /** El nodo abierto. Va CONTROLADO: quien lo usa tiene que poder cerrarlo al
   *  borrar un paso, o el panel queda abierto sobre un nodo que ya no existe. */
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  renderNodo: (nodo: NodoFlujo, activo: boolean) => ReactNode;
  renderEditor: (nodo: NodoFlujo) => ReactNode;
  /** La cabecera del panel. Por default, el ícono y el título del nodo. */
  tituloEditor?: (nodo: NodoFlujo) => ReactNode;
  /** Lo que va al lado del título del panel, sin reemplazarlo (ícono y título siguen siendo del
   *  lienzo). `null` = nada. Se ignora si hay `tituloEditor`. */
  accionesTitulo?: (nodo: NodoFlujo) => ReactNode;
  /** El botón flotante de abajo a la derecha. */
  accion?: ReactNode;
  alto?: string;
  /** Mover una tarjeta. Sin esto el lienzo sólo se panea: los nodos no se agarran.
   *  Llega con la posición YA en coordenadas del grafo, no de la pantalla. */
  onMover?: (id: string, x: number, y: number) => void;
  /** Lo que va FLOTANDO sobre el lienzo, arriba a la izquierda: el título, el
   *  interruptor, la salida. Va acá y no arriba del lienzo por el pedido textual
   *  —«el lienzo tiene que ocupar absolutamente todo el recuadro, incluso donde
   *  dice cerrar el editor»—: un chrome que ocupa su propio renglón le come 80 px
   *  al dibujo, y en una caja de 460 eso es el 17%. */
  chrome?: ReactNode;
  /**
   * Lo que va PEGADO AL ZOOM, abajo a la izquierda: las herramientas del tablero
   * (deshacer, rehacer). Es un slot y no un botón cableado porque el estado de la
   * pila vive en quien monta el lienzo, no acá — cablearlo adentro obligaría al
   * Lienzo a saber qué se está editando.
   */
  herramientas?: ReactNode;
  /**
   * CUÁNTO SE CORREN A LA DERECHA LAS COSAS QUE FLOTAN (el chrome y la fila del zoom),
   * porque la pantalla tiene algo apoyado sobre el borde izquierdo del lienzo.
   *
   * ⚠️ NO ANGOSTA EL LIENZO, Y ESA ES LA DIFERENCIA QUE IMPORTA. En /automations la lista de
   * secuencias flota encima porque se pidió que «por atrás pase también la grilla»:
   * si esto fuera un `padding` del lienzo, la cuadrícula volvería a cortarse donde
   * empieza la lista, que es justo lo que se mandó corregir. Lo único que se mueve son
   * los controles — el dibujo sigue de borde a borde.
   *
   * Medido el 05/10/2026 con el arnés: sin esto, el título flotante nace DEBAJO de la
   * lista y el buscador se come sus clicks («input … intercepts pointer events»). No da
   * error y en pantalla se lee como un título que no se puede editar.
   */
  insetIzq?: number;
  /**
   * LO MISMO DEL LADO DERECHO: cuánto se corre lo que flota a la derecha cuando la
   * pantalla apoya algo sobre ese borde (el panel de «Probar» de /automations).
   *
   * ⚠️ SON CUATRO LUGARES, como el inset izquierdo (AGENTS.md, «apoyar algo sobre el borde
   * de un lienzo»): el chrome (su borde derecho), «Publicar» (`accion`), el ANCHO del
   * panel del nodo (que abre a la izquierda y no puede meterse debajo) y el ENCUADRE, que
   * es el que no se ve: centrar sobre el ancho entero mete la última columna debajo del
   * panel, y una tarjeta tapada no da error — no responde.
   */
  insetDer?: number;
  /**
   * LO DE LA DERECHA, POR FRANJA (segunda tanda, `muelles` en lib/lienzo-grafo.ts). Con «Probar»
   * apilado arriba a la derecha, debajo del chrome, lo que tapa depende de la ALTURA: a la altura
   * del chrome no tapa nada (`insetDerChrome`) y en la franja de abajo tampoco (`insetDerAbajo`:
   * «Publicar» y el panel apaisado). `insetDer` queda para el encuadre y el panel de columna.
   *
   * Ausentes = `insetDer`, que es lo de siempre: /mensajes y el recordatorio no cambian.
   */
  insetDerChrome?: number;
  insetDerAbajo?: number;
  /**
   * LO QUE EL ENCUADRE DEJA LIBRE ABAJO (revisión de la segunda tanda, 09/10/2026): la caja de
   * «Crear con IA» de una automatización VACÍA de /automations va abajo, y el CRON se encuadra arriba de
   * ella. Centrado en el alto entero, el CRON quedaba DEBAJO de la caja y no se podía tocar. Sólo
   * mueve el encuadre (y «Centrar»): el dibujo, los paneles y lo que flota no cambian. Default 0.
   */
  reservaAbajo?: number;
  /**
   * LA FORMA DEL PANEL DEL NODO (segunda tanda, decisión 10; pedido literal, punto 3: «El editor
   * de WhatsApp debes hacerlo más ancho que largo, sino, se amontona todo»).
   *
   *   · `columna` (default): anclado abajo a la izquierda, ancho `panelAncho`; alto libre, o FIJO
   *     si viene `panelAlto` (cuarta tanda, punto 1: el alto lo decide el tipo de tarjeta).
   *   · `apaisado`: la franja de abajo, de `insetIzq` a `insetDerAbajo`, con alto FIJO
   *     (`panelAlto`). Fijo y no un tope: una caja cuyo alto es un tope cambia de tamaño al
   *     pasar de una tarjeta a otra, y se lleva puesto lo que cuelga adentro (AGENTS.md).
   *
   * Quién decide la forma (y cuándo cae a columna en una ventana angosta) es `muelles`, con lo
   * que NO cambia al abrir el panel (el ancho de la caja). Sin `panelAlto`, es de columna.
   */
  panelForma?: 'columna' | 'apaisado';
  panelAlto?: number;
  /**
   * LAS TARJETAS APARECEN DE A UNA (segunda tanda, decisión 14: «Crear con IA»). En el orden de
   * `orden`, sobre el layout FINAL: el encuadre corre una sola vez, con el grafo entero, y lo
   * que todavía no toca está en su lugar con opacidad 0. `clave` cambia en cada revelado nuevo.
   *
   *   · cada tarjeta sube `REVELAR_SUBE_PX` en `REVELAR_DURACION_MS`, `REVELAR_PASO_MS` después
   *     de la anterior; una flecha aparece cuando están sus dos puntas;
   *   · un clic en cualquier lado lo completa (nadie espera una animación para poder trabajar);
   *   · con `prefers-reduced-motion`, todo junto.
   *
   * Ausente o null = todo a la vista, como siempre.
   */
  revelar?: { orden: string[]; clave: number } | null;
  /** Sin borde ni radio: cuando el lienzo ES el recuadro, el marco lo pone la caja
   *  de afuera y dos marcos anidados dejan un filete doble. */
  sinMarco?: boolean;
  /** Agregar un paso DESPUÉS de este nodo. Dibuja un «＋» al pasar el cursor por la
   *  tarjeta, a su derecha — que es donde va a aparecer lo que se agregue. Un botón
   *  suelto en una esquina no dice DÓNDE entra el paso; éste sí.
   *
   *  `puerto`: de qué salida. Lo pasan el ＋ de un punto vacío y el ＋ del medio de una
   *  flecha que sale de un puerto. Ausente = el nodo no tiene puertos (/mensajes).
   *
   *  `punto`: dónde quedó la PUNTA de la flecha que asomó al tocar el círculo (sexta tanda, punto 5),
   *  en coordenadas del grafo. Quien monta puede poner ahí la tarjeta nueva. */
  onAgregarTras?: (id: string, que: string, puerto?: string, punto?: { x: number; y: number }) => void;
  /**
   * Qué se puede agregar EN un lugar (un nodo, una de sus salidas, el medio de una
   * flecha). Gana sobre `opcionesAgregar` y sobre su filtro del medio, que es de /mensajes:
   * en una conversación con ramas un mensaje entre dos tarjetas es lo normal, y debajo de
   * «Si responde» no se puede esperar.
   */
  opcionesEn?: (nodo: string, puerto: string | undefined, medio: boolean) => DropdownOption[];
  /**
   * La papelera de la cabecera del panel. Reemplaza al «Quitar este mensaje» de abajo de
   * cada editor: borrar es de la TARJETA, no de uno de sus campos, y al pie del editor
   * quedaba lejos y distinto en cada clase de tarjeta.
   */
  onBorrar?: (id: string) => void;
  puedeBorrar?: (id: string) => boolean;
  /** En qué nodos tiene sentido el ＋. Sin esto sale en TODOS, incluido el de entrada
   *  — y el paso que agrega ahí no cuelga de él sino del mensaje, así que el botón
   *  señala un lugar y el paso cae en otro. Eso es el «se comporta de manera random». */
  puedeAgregarTras?: (id: string) => boolean;
  /**
   * Si viene, el ＋ PREGUNTA qué crear en vez de crear una sola cosa. Un desplegable
   * de una opción es una pregunta ya contestada, así que sin esto el ＋ sigue siendo
   * un botón — que es lo correcto para un lienzo con un solo tipo de paso.
   */
  /**
   * Qué se puede agregar. Lista PLANA: emoji + título, sin categorías ni subtítulos.
   *
   * ⚠️ ESTUVO AGRUPADO UNA HORA, Y ERA LEER MAL EL PEDIDO. Martín pidió el desplegable
   * por secciones «para el desplegable de acciones de MaKo… que justamente son muchas», y
   * yo se lo puse acá: «no me refería a poner categorías dentro del "+", eso no tiene
   * sentido, son pocas opciones… vuelve a como estaba antes, solo con el título y el
   * emoji». Son cuatro opciones: agruparlas agrega un nivel para ahorrar nada.
   *
   * La regla que queda: un patrón de navegación se elige por el TAMAÑO de la lista, no
   * por coherencia visual con la lista de al lado.
   */
  opcionesAgregar?: DropdownOption[];
  /** Ancho del panel del nodo. El default (328) es el del lienzo del chatbot. */
  panelAncho?: number;
  /** Hay un guardado en vuelo: el ＋ se DESHABILITA, no se desmonta. Un control que
   *  desaparece bajo el dedo se lee como un clic que no registró. */
  agregarOcupado?: boolean;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const capa = useRef<HTMLDivElement | null>(null);
  const vista = useRef({ k: 1, tx: 0, ty: 0 });
  const gesto = useRef<{
    x0: number; y0: number; tx0: number; ty0: number; movido: number; nodo: string | null;
    /** La posición del nodo al empezar, en coordenadas del GRAFO. */
    nx0: number; ny0: number; arrastrandoNodo: boolean;
  } | null>(null);
  /** Lo que se está moviendo AHORA, para pintarlo sin pasar por el estado. */
  const movido = useRef<{ id: string; x: number; y: number } | null>(null);
  const [zoomTxt, setZoomTxt] = useState(100);
  /** Sobre qué tarjeta está el cursor. Es lo único que este lienzo guarda en el
   *  estado además de la selección: un hover por REF no re-dibujaría el botón. */
  const [encima, setEncima] = useState<string | null>(null);
  /** Sobre qué flecha está el cursor: es lo que muestra su ＋ del medio. */
  const [enFlecha, setEnFlecha] = useState<number | null>(null);
  /** El apagado diferido del ＋ de una flecha (`GRACIA_FLECHA_MS`). */
  const salidaFlecha = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entrarFlecha = (i: number) => {
    if (salidaFlecha.current) { clearTimeout(salidaFlecha.current); salidaFlecha.current = null; }
    setEnFlecha(i);
  };
  const salirFlecha = (i: number) => {
    // ⚠️ NO SE APAGA MIENTRAS HAYA UN MENÚ ABIERTO: el del ＋ se monta por PORTAL en el body, fuera
    // de la flecha, y al ir del botón al menú se dispara el leave (la misma regla que la tarjeta).
    if (document.querySelector('[role="listbox"]')) return;
    if (salidaFlecha.current) clearTimeout(salidaFlecha.current);
    salidaFlecha.current = setTimeout(() => { salidaFlecha.current = null; setEnFlecha((p) => (p === i ? null : p)); }, GRACIA_FLECHA_MS);
  };
  useEffect(() => () => { if (salidaFlecha.current) clearTimeout(salidaFlecha.current); }, []);
  /**
   * Se acaba de SOLTAR una tarjeta: el encuadre que dispare ese cambio de tamaño del dibujo no
   * reencuadra. Sin esto, soltar una tarjeta más allá del borde agranda `grafo.ancho`, cambia la
   * firma y el lienzo vuelve a centrar — o sea que acomodar una tarjeta deshace el paneo (el «rebota
   * solo» de las trampas de arriba, ahora por el arrastre). Vale una vez y se apaga sola.
   */
  const trasMover = useRef(false);
  /** Lo que el panel corrió, para devolverlo al cerrar. Ver `vistaAlCerrarPanel`. */
  const corrimiento = useRef<{ antes: VistaLienzo; aplicada: VistaLienzo } | null>(null);
  /** La última forma encuadrada: grafo + caja. Ver `encuadrar`. */
  const encuadrado = useRef('');
  const derChrome = insetDerChrome ?? insetDer;
  const derAbajo = insetDerAbajo ?? insetDer;
  const apaisado = panelForma === 'apaisado' && Number(panelAlto) > 0;
  /**
   * EL PANEL TIENE ALTO FIJO SI QUIEN MONTA LO DA, también de columna (cuarta tanda, punto 1). El
   * alto lo decide el TIPO de tarjeta (`editorDeTarjeta`, lib/lienzo-grafo.ts), nunca el contenido de
   * cada render. Sin `panelAlto` (el lienzo de /mensajes), el alto libre de siempre.
   */
  const altoFijo = Number(panelAlto) > 0;

  /**
   * LA FLECHA QUE ASOMA AL TOCAR UN CÍRCULO, con el menú de qué agregar EN SU PUNTA (sexta tanda,
   * punto 5: «debería salir la flecha y al final de la flecha el desplegable, no como hoy que el
   * desplegable sale al lado de la anterior tarjeta»). Coordenadas del grafo para la flecha y de
   * pantalla para el menú (que va por portal). Se cierra al elegir, con Escape o con cualquier clic.
   */
  const [fantasma, setFantasma] = useState<{
    desde: string; puerto: string; x1: number; y1: number; x2: number; y2: number; menuX: number; menuY: number;
    items: ItemMenuLienzo[];
  } | null>(null);
  const cerrarFantasma = useCallback(() => setFantasma(null), []);
  /**
   * LA FLECHA QUE SE ARRASTRA (sexta tanda, punto 5). En el estado va SÓLO lo que cambia pocas veces —de
   * qué tarjeta sale y sobre cuál está el cursor—, que es lo que atenúa y resalta. La punta que sigue
   * al cursor se escribe en el DOM (`flechaTemp`), nunca con setState: es la trampa 3.
   */
  const [arrastreFlecha, setArrastreFlecha] = useState<{ desde: string } | null>(null);
  const [sobreFlecha, setSobreFlecha] = useState<string | null>(null);
  const flechaTemp = useRef<SVGPathElement | null>(null);
  /** La `d` con que nace la flecha arrastrada (después la mueve `moverCirculo` sobre el DOM). */
  const dTemp = useRef('');
  const gestoFlecha = useRef<{
    desde: string; fila: string; puertoAgregar: string | null; x0: number; y0: number;
    activo: boolean; sobre: string | null; sx: number; sy: number; vacio: boolean;
  } | null>(null);
  /** El click derecho abierto (en coordenadas de PANTALLA: va por portal). */
  const [menu, setMenu] = useState<{ x: number; y: number; items: ItemMenuLienzo[] } | null>(null);
  const cerrarMenu = useCallback(() => setMenu(null), []);

  /** Un punto de la pantalla en coordenadas del grafo, y al revés (la vista vive en un ref). */
  const aGrafo = (clientX: number, clientY: number) => {
    const r = caja.current?.getBoundingClientRect();
    const v = vista.current;
    return { x: (clientX - (r?.left ?? 0) - v.tx) / v.k, y: (clientY - (r?.top ?? 0) - v.ty) / v.k };
  };
  const aPantalla = (x: number, y: number) => {
    const r = caja.current?.getBoundingClientRect();
    const v = vista.current;
    return { x: (r?.left ?? 0) + v.tx + x * v.k, y: (r?.top ?? 0) + v.ty + y * v.k };
  };

  /** Las opciones de un ＋ como opciones del menú, con su ícono y su grupo. */
  const comoItems = (opciones: OpcionAgrupada[], elegir: (v: string) => void): ItemMenuLienzo[] =>
    opciones.map((o) => ({
      id: o.value, label: o.label, grupo: o.grupo, deshabilitado: o.disabled,
      icono: o.icono ? <IconoOpcion icono={o.icono} /> : undefined,
      onElegir: () => elegir(o.value),
    }));

  /** ¿Qué tarjeta hay debajo del cursor (que no sea la de origen)? La pastilla de una espera no cuenta. */
  const tarjetaBajo = (clientX: number, clientY: number, salvo: string): string | null => {
    const el = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null;
    const id = el instanceof Element ? el.closest('[data-nodo]')?.getAttribute('data-nodo') ?? null : null;
    return id && id !== salvo && caja.current?.contains(el) ? id : null;
  };

  /**
   * EL GESTO DEL CÍRCULO: apretar, y o se suelta en el lugar (un CLIC: asoma la flecha con el menú en la
   * punta) o se arrastra (la flecha sigue al cursor y se conecta al soltar sobre una tarjeta). El
   * círculo captura el puntero: el `pointermove` y el `pointerup` le llegan a él aunque el cursor esté
   * sobre otra tarjeta, y por eso la de abajo se busca con `elementFromPoint`.
   */
  function bajarCirculo(e: React.PointerEvent, n: NodoFlujo, p: PuertoNodo, puertoAgregar: string | null) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = puntoDePuerto(n, p.id);
    gestoFlecha.current = { desde: n.id, fila: p.id, puertoAgregar, x0: e.clientX, y0: e.clientY, activo: false, sobre: null, sx: s.x, sy: s.y, vacio: p.vacio };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* el gesto sigue sin captura */ }
  }
  function moverCirculo(e: React.PointerEvent) {
    const g = gestoFlecha.current;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.activo) {
      if (dx * dx + dy * dy <= ARRASTRE2 || !onConectar) return;
      g.activo = true;
      const p0 = aGrafo(e.clientX, e.clientY);
      dTemp.current = curvaPuntos(g.sx, g.sy, p0.x, p0.y);
      setFantasma(null);
      setArrastreFlecha({ desde: g.desde });
    }
    const sobre = tarjetaBajo(e.clientX, e.clientY, g.desde);
    if (sobre !== g.sobre) { g.sobre = sobre; setSobreFlecha(sobre); }
    // Sobre una tarjeta, la punta ya va a SU punto de entrada: así se ve dónde va a quedar.
    const destino = sobre ? grafo.nodos.find((x) => x.id === sobre) : null;
    const fin = destino ? puntoDeEntrada(destino) : aGrafo(e.clientX, e.clientY);
    dTemp.current = curvaPuntos(g.sx, g.sy, fin.x, fin.y);
    flechaTemp.current?.setAttribute('d', dTemp.current);
  }
  function soltarCirculo(e: React.PointerEvent, cancelado = false) {
    const g = gestoFlecha.current;
    gestoFlecha.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ya se soltó */ }
    if (!g) return;
    if (g.activo) {
      setArrastreFlecha(null); setSobreFlecha(null);
      if (!cancelado && g.sobre) onConectar?.(g.desde, g.fila, g.sobre);
      return;
    }
    if (cancelado || g.puertoAgregar == null || !onAgregarTras) return;
    const n = grafo.nodos.find((x) => x.id === g.desde);
    if (!n) return;
    const puerto = g.puertoAgregar;
    const opciones: OpcionAgrupada[] = opcionesEn ? opcionesEn(n.id, puerto, false) : (opcionesAgregar ?? [{ value: 'accion', label: '＋' }]);
    // La flecha asoma hacia donde va a nacer la tarjeta: a la derecha, y más abajo si la salida ya
    // tenía su flecha (la nueva corre en paralelo, debajo).
    const fin = { x: g.sx + ASOMA_FLECHA, y: g.sy + (g.vacio ? 0 : 56) };
    const elegir = (v: string) => { setFantasma(null); onAgregarTras(n.id, v, puerto, fin); };
    // Una sola opción es una pregunta ya contestada (como `MasDeSalida`): se agrega directo.
    if (opciones.length === 1) { elegir(opciones[0].value); return; }
    const pant = aPantalla(fin.x, fin.y);
    setMenu(null);
    setFantasma({ desde: n.id, puerto, x1: g.sx, y1: g.sy, x2: fin.x, y2: fin.y, menuX: pant.x + 6, menuY: pant.y - 14, items: comoItems(opciones, elegir) });
  }

  /** La papelera de un círculo: con UNA flecha la saca; con varias, pregunta cuál. */
  function quitarDeFila(e: React.MouseEvent, flechas: AristaFlujo[]) {
    e.stopPropagation();
    if (!onQuitarFlecha || !flechas.length) return;
    if (flechas.length === 1) { onQuitarFlecha(flechas[0]); return; }
    setFantasma(null);
    setMenu({
      x: e.clientX, y: e.clientY,
      items: flechas.map((a, k) => ({
        id: `quitar-${k}`, label: `Quitar la flecha a «${nombreNodo?.(a.hasta) ?? grafo.nodos.find((x) => x.id === a.hasta)?.titulo ?? 'esa tarjeta'}»`,
        icono: <IconoBorrar size={16} />, peligro: true, onElegir: () => onQuitarFlecha(a),
      })),
    });
  }

  /**
   * EL CLICK DERECHO (sexta tanda, punto 2): en una tarjeta (o la pastilla de una espera), lo de esa
   * tarjeta; en el fondo, lo del lienzo con el punto donde se hizo. Adentro del panel, del chrome o del
   * zoom (`data-no-pan`) queda el del navegador: ahí se copia y se pega.
   */
  function onContextMenu(e: React.MouseEvent) {
    if (!menuLienzo && !menuNodo) return;
    const t = e.target as HTMLElement;
    if (!caja.current?.contains(t)) return;
    const pildora = t.closest('[data-pildora]')?.getAttribute('data-pildora') ?? null;
    if (!pildora && t.closest('[data-no-pan]')) return;
    const id = pildora ?? t.closest('[data-nodo]')?.getAttribute('data-nodo') ?? null;
    const items = id
      ? (menuNodo?.(id) ?? [])
      : [...(menuLienzo?.(aGrafo(e.clientX, e.clientY)) ?? []), { id: 'centrar', label: 'Centrar', icono: <IconoCentrar />, grupo: 99, onElegir: () => encuadrar(true) }];
    if (!items.length) return;
    e.preventDefault();
    setFantasma(null);
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  /**
   * EL REVELADO: cuántas tarjetas de `revelar.orden` ya aparecieron. Infinity = todas (sin
   * revelado, terminado o completado con un clic). Va en el estado porque cambia ~10 veces por
   * revelado, no 60 por segundo: no es la trampa 3.
   */
  const [revelados, setRevelados] = useState(Number.POSITIVE_INFINITY);
  const revelando = revelar != null && Number.isFinite(revelados) && revelados < revelar.orden.length;
  useEffect(() => {
    if (!revelar || !revelar.orden.length) { setRevelados(Number.POSITIVE_INFINITY); return; }
    // ⚠️ CON `prefers-reduced-motion`, TODO JUNTO: la animación es un adorno, y para quien la
    // pidió apagada es un mareo.
    const quieto = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (quieto) { setRevelados(Number.POSITIVE_INFINITY); return; }
    setRevelados(0);
    let k = 0;
    const t = setInterval(() => {
      k += 1;
      setRevelados((prev) => (Number.isFinite(prev) ? k : prev));
      if (k >= revelar.orden.length) clearInterval(t);
    }, REVELAR_PASO_MS);
    return () => clearInterval(t);
    // La clave ES el pedido: el mismo orden con otra clave vuelve a revelar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revelar?.clave]);
  // Un clic en CUALQUIER lado lo completa (la lista, el chrome, el lienzo): nadie espera una
  // animación para poder trabajar. En `document` y en captura, como los Escape de la casa: un
  // `pointerdown` que un hijo frene igual llega.
  useEffect(() => {
    if (!revelando) return;
    const completar = () => setRevelados(Number.POSITIVE_INFINITY);
    document.addEventListener('pointerdown', completar, true);
    return () => document.removeEventListener('pointerdown', completar, true);
  }, [revelando]);
  const verNodo = (id: string) => nodoRevelado(revelar?.orden, revelados, id);
  const estiloRevelado = (id: string): CSSProperties | undefined => (revelar ? {
    opacity: verNodo(id) ? 1 : 0,
    transform: verNodo(id) ? 'none' : `translateY(${REVELAR_SUBE_PX}px)`,
    transition: `opacity ${REVELAR_DURACION_MS}ms ease, transform ${REVELAR_DURACION_MS}ms ease`,
  } : undefined);

  /** Escribe la vista en el DOM. NUNCA pasa por setState: ver la trampa 3. */
  const pintar = useCallback(() => {
    const v = vista.current;
    if (capa.current) capa.current.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  }, []);

  /** Encuadra el grafo en la caja: entero si se lee, y si no, desde la entrada. */
  const encuadrar = useCallback((forzar = false) => {
    const c = caja.current;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (w === 0 || h === 0) return;
    // ⚠️ SÓLO SE REENCUADRA SI CAMBIÓ LA FORMA, o si lo pidió el botón «Centrar».
    // Sin esta guarda, cualquier cosa que reinstale el ResizeObserver —y `observe()`
    // dispara al suscribirse— vuelve a centrar la vista: medido en el navegador,
    // tocar un nodo devolvía el lienzo a su posición inicial y deshacía el paneo que
    // la persona acababa de hacer. El síntoma no se lee como un bug del encuadre:
    // se lee como que el lienzo «rebota solo».
    const firma = `${Math.round(grafo.ancho)}x${Math.round(grafo.alto)}@${w}x${h}+${insetIzq}+${insetDer}-${reservaAbajo}`;
    if (!forzar && encuadrado.current === firma) return;
    // Lo cambió soltar una tarjeta (`trasMover`): se anota la firma nueva y la vista NO se toca.
    if (!forzar && trasMover.current) { trasMover.current = false; encuadrado.current = firma; return; }
    encuadrado.current = firma;
    /**
     * ⚠️ EL ENCUADRE DESCUENTA EL INSET, Y NO ES COSMÉTICA: SIN ESO LA PRIMERA TARJETA
     * ES INALCANZABLE.
     *
     * El dibujo ocupa el ancho entero a propósito —se pidió que la cuadrícula pase por
     * detrás de la lista—, pero centrar sobre ese ancho mete el nodo de más a la
     * izquierda DEBAJO de la lista, que está encima y se come sus clicks. Medido el
     * 05/10/2026 con el arnés: hover sobre la tarjeta de entrada, 55 reintentos y
     * «<div class="mk-scroll-oscuro"> … intercepts pointer events». No da error: en
     * pantalla se ve la tarjeta y no responde, que se lee como que la app está rota.
     *
     * Lo que se centra es el ancho ÚTIL (el que nadie tapa); el `tx` arranca después
     * del inset. Lo tapado sigue dibujándose —la cuadrícula es lo que se quería ver
     * ahí— y nada del grafo nace abajo. El inset derecho (el panel de «Probar») se
     * descuenta igual: es el mismo problema contra el otro borde.
     */
    /**
     * ⚠️ EL ENCUADRE NUNCA ARRANCA ILEGIBLE (08/10/2026). Con las ramas, un flujo de antes
     * convertido a tarjetas (esperas, condiciones, «Si responde») mide diez columnas, y
     * «que entre todo» lo dejaba al 30 %: Martín abrió /automations y vio un dibujo de
     * tarjetas de tres píxeles. El zoom inicial tiene un piso legible y, si así no entra,
     * se ancla en la ENTRADA (el CRON): se arranca por el principio, como en ManyChat, y
     * el resto se recorre arrastrando. «Centrar» vuelve a esta misma vista.
     */
    // `reservaAbajo`: la franja de abajo que tapa algo de quien monta (ver la prop). El alto que se
    // le pasa es el ÚTIL, como el ancho: así el CRON de un flujo vacío nace arriba de la caja.
    vista.current = encuadreInicial(grafo, { w, h: Math.max(1, h - reservaAbajo), insetIzq, insetDer });
    const k = vista.current.k;
    setZoomTxt(Math.round(k * 100));
    pintar();
  }, [grafo.ancho, grafo.alto, insetIzq, insetDer, reservaAbajo, pintar]);

  useEffect(() => { encuadrar(); }, [encuadrar]);

  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const ro = new ResizeObserver(() => encuadrar());
    ro.observe(c);
    return () => ro.disconnect();
  }, [encuadrar]);

  // La rueda va con un listener NO PASIVO puesto a mano: React los registra
  // pasivos, así que un `onWheel` de JSX no puede llamar a preventDefault y la
  // página scrollea detrás del zoom.
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const v = vista.current;
      const kNuevo = Math.max(K_MIN, Math.min(K_MAX, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      // Zoom ANCLADO AL CURSOR: sin esto el dibujo se escapa de la vista y hay
      // que volver a encuadrar en cada rueda.
      vista.current = {
        k: kNuevo,
        tx: px - (px - v.tx) * (kNuevo / v.k),
        ty: py - (py - v.ty) * (kNuevo / v.k),
      };
      setZoomTxt(Math.round(kNuevo * 100));
      pintar();
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [pintar]);

  /**
   * ARRASTRAR UNA TARJETA LA LLEVA CON TODO LO QUE CUELGA DE ELLA, Y LAS FLECHAS LA SIGUEN.
   *
   * · Se mueve el ENVOLTORIO (`data-envoltorio`), no la tarjeta: adentro van el ＋ de pasar el
   *   cursor, los puntos de las salidas y sus ＋. Hasta la quinta tanda se movía sólo la tarjeta
   *   (`left`/`top`) y el ＋ a mano; con las salidas de /automations, los puntos y sus ＋ se quedaban en
   *   el lugar viejo mientras ella viajaba. `setPointerCapture` retargetea los eventos al contenedor,
   *   así que durante el arrastre no hay enter ni leave en los envoltorios: `encima` queda congelado
   *   en la agarrada y su ＋ viaja con ella.
   * · Las flechas que la tocan se recalculan con la MISMA curva (`curvaEntre`), y su ＋ del medio y su
   *   etiqueta van al punto medio nuevo: sin esto la tarjeta se despegaba de sus flechas hasta soltar.
   *
   * `dx`/`dy` en coordenadas del GRAFO (el delta del mouse ya dividido por el zoom). Con 0/0 devuelve
   * todo a lo que dice el estado (`soltarArrastre`).
   */
  function pintarArrastre(id: string, dx: number, dy: number) {
    const c = caja.current;
    if (!c) return;
    const env = c.querySelector(`[data-envoltorio="${id}"]`);
    if (env instanceof HTMLElement) env.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
    const mov = (n: NodoFlujo) => (n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n);
    grafo.aristas.forEach((a, i) => {
      if (a.desde !== id && a.hasta !== id) return;
      const d = grafo.nodos.find((n) => n.id === a.desde);
      const h = grafo.nodos.find((n) => n.id === a.hasta);
      if (!d || !h) return;
      const curva = curvaEntre(mov(d), mov(h), a.puerto);
      c.querySelectorAll(`[data-arista="${i}"]`).forEach((el) => el.setAttribute('d', curva));
      const m = medioDeCurva(mov(d), mov(h), a.puerto);
      c.querySelectorAll(`[data-arista-medio="${i}"]`).forEach((el) => {
        // El ＋ del medio de una flecha con una espera encima va un poco más abajo (`DESVIO_MEDIO`).
        const desvio = Number(el.getAttribute('data-desvio') ?? 0) || 0;
        if (el instanceof HTMLElement) { el.style.left = `${m.x}px`; el.style.top = `${m.y + desvio}px`; }
      });
      // Y las pastillas de sus esperas, en su punto de la curva.
      c.querySelectorAll(`[data-arista-pildora="${i}"]`).forEach((el) => {
        const p = puntoDeCurva(mov(d), mov(h), a.puerto, Number(el.getAttribute('data-t') ?? 0.5));
        if (el instanceof HTMLElement) { el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; }
      });
    });
  }
  const soltarArrastre = (id: string) => pintarArrastre(id, 0, 0);

  function onPointerDown(e: React.PointerEvent) {
    /**
     * ⚠️ UN EVENTO DE REACT BUBBLEA POR EL PORTAL; `closest()` CAMINA EL DOM.
     *
     * Los dos árboles no son el mismo, y esta función vivía sólo del segundo. Todo
     * `createPortal` a `body` —el menú de `Dropdown`, un `Confirm`, un popover
     * anclado— es hijo de React del panel del editor y hermano del contenedor en el
     * DOM: el click viaja hasta acá por el árbol de React, y el `data-no-pan` del
     * panel es invisible para el `closest`, porque el `e.target` está colgado del
     * `body`.
     *
     * Medido el 30/09/2026 con Playwright: abrir el desplegable de la unidad del CRON
     * y elegir «semana» CERRABA el panel del nodo, sin un solo error, sin un POST y
     * con la opción correctamente clickeada — o sea el desplegable leyéndose como
     * roto cuando lo que estaba mal era el guard del lienzo.
     *
     * La pregunta correcta no es «¿tiene un ancestro marcado?» sino «¿este pointer
     * cayó DENTRO del lienzo?». Un evento cuyo target del DOM está afuera no es un
     * gesto del lienzo, y no hay portal que se escape de eso.
     */
    const dentro = caja.current?.contains(e.target as Node) ?? false;
    if (!dentro) return;
    // ⚠️ SÓLO EL BOTÓN PRINCIPAL (sexta tanda): con el click derecho abriendo su menú, el botón 2 armaba
    // un gesto y al soltar SELECCIONABA la tarjeta (abría su panel debajo del menú).
    if (e.button !== 0) return;
    // Los controles de adentro del editor no arrastran el lienzo.
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    const v = vista.current;
    // ⚠️ EL NODO SE ANOTA ACÁ, EN EL POINTERDOWN, Y NO AL SOLTAR. `setPointerCapture`
    // RETARGETEA todos los eventos siguientes al elemento que capturó: en el
    // `pointerup` el `e.target` ya es el contenedor, así que buscar el nodo ahí
    // devuelve null SIEMPRE. Medido en el navegador: tocar un paso no abría nada, y
    // el handler se leía perfecto.
    const id = (e.target as HTMLElement).closest('[data-nodo]')?.getAttribute('data-nodo') ?? null;
    const n = id ? grafo.nodos.find((x) => x.id === id) : null;
    gesto.current = {
      x0: e.clientX, y0: e.clientY, tx0: v.tx, ty0: v.ty, movido: 0, nodo: id,
      nx0: n?.x ?? 0, ny0: n?.y ?? 0,
      // Agarrar una TARJETA la mueve a ella; agarrar el fondo panea el lienzo. Es
      // la misma distinción que hace cualquier editor de nodos, y sin ella no hay
      // forma de acomodar el dibujo.
      arrastrandoNodo: Boolean(id) && Boolean(onMover),
    };
    try { caja.current?.setPointerCapture(e.pointerId); } catch { /* el gesto sigue sin captura */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    g.movido = Math.max(g.movido, dx * dx + dy * dy);
    if (g.arrastrandoNodo && g.nodo) {
      // ⚠️ EL DELTA SE DIVIDE POR EL ZOOM. Al 50%, mover el mouse 100 px tiene que
      // mover la tarjeta 200 en coordenadas del grafo, o el dibujo se despega del
      // cursor — y cuanto más lejos del 100%, más se despega.
      const k = vista.current.k || 1;
      movido.current = { id: g.nodo, x: g.nx0 + dx / k, y: g.ny0 + dy / k };
      // Se escribe sobre el DOM, no con setState: un setState por `pointermove` redibuja el
      // grafo entero 60 veces por segundo.
      pintarArrastre(g.nodo, dx / k, dy / k);
      return;
    }
    vista.current = { ...vista.current, tx: g.tx0 + dx, ty: g.ty0 + dy };
    pintar();
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesto.current;
    gesto.current = null;
    // ⚠️ EL RELEASE VA ADENTRO DE UN try, Y DESPUÉS DE RESOLVER EL CLIC. Tirar acá
    // —`InvalidPointerId` si la captura no llegó a tomarse— abortaba el handler y
    // el nodo no se abría, con el código leyéndose perfecto.
    if (!g) return;
    // El CLIC se resuelve acá y no en un onClick del nodo: con la captura puesta,
    // los eventos siguientes van al contenedor y el onClick del hijo no dispara.
    // Lo que el arrastre escribió a mano en el DOM vuelve a lo que dice el ESTADO, y recién después
    // se avisa: el render del cambio (en este mismo evento, antes de pintar) pone lo nuevo. Al revés,
    // un soltar que no cambia el estado dejaría la tarjeta dibujada donde no está.
    if (g.arrastrandoNodo && g.nodo) soltarArrastre(g.nodo);
    if (g.movido <= ARRASTRE2) onSeleccion(g.nodo && seleccion === g.nodo ? null : g.nodo);
    else if (g.arrastrandoNodo && movido.current) {
      // El guardado va al SOLTAR, no en cada píxel: un POST por `pointermove` son
      // sesenta por segundo contra la misma fila.
      trasMover.current = true;
      setTimeout(() => { trasMover.current = false; }, 0);
      onMover?.(movido.current.id, Math.round(movido.current.x), Math.round(movido.current.y));
    }
    movido.current = null;
    try { caja.current?.releasePointerCapture(e.pointerId); } catch { /* ya se soltó */ }
  }

  // ⚠️ EL PANEL NO PUEDE TAPAR EL NODO QUE SE ESTÁ EDITANDO. Está anclado abajo a
  // la izquierda —donde siempre entra, sin la matemática de un popover que se da
  // vuelta contra el borde— y por eso los nodos de la primera columna quedaban
  // detrás: se escribía a ciegas sobre una burbuja que no se veía.
  //
  // Se corre el LIENZO, no el panel: mover el panel lo llevaría a tapar otra cosa,
  // y correr la vista es lo que la persona haría a mano. Sólo cuando hace falta, y
  // nunca al revés — si el nodo ya se ve, no se toca nada.
  useEffect(() => {
    if (!caja.current) return;
    // ⚠️ AL CERRAR, SE DEVUELVE LO QUE EL PANEL SE LLEVÓ. Ver `vistaAlCerrarPanel`.
    if (!seleccion) {
      const c = corrimiento.current;
      if (!c) return;
      corrimiento.current = null;
      const vuelta = vistaAlCerrarPanel(vista.current, c.aplicada, c.antes);
      if (!vuelta) return;
      vista.current = vuelta;
      pintar();
      return;
    }
    const elegido = grafo.nodos.find((x) => x.id === seleccion);
    if (!elegido) return;
    // Una espera que va en una flecha no tiene tarjeta: lo que no se puede tapar es su PASTILLA.
    const n = elegido.enFlecha ? { ...elegido, ...(posicionDePildora(grafo, elegido.id) ?? {}) } : elegido;
    // Las dos cuentas viven en `lib/lienzo-grafo.ts`, sin `server-only`, para que
    // tengan test: adentro de este efecto no las puede importar nadie.
    // El panel abre a `PANEL_MARGEN + insetIzq`, así que el borde contra el que se
    // corre el lienzo para no taparlo es ése, no el del contenedor. Y a la derecha, el
    // nodo no se corre más allá de lo que se ve: con «Probar» abierto (`insetDer`) quedaba
    // DEBAJO del teléfono (revisión, lienzo-4).
    // Con el panel APAISADO (la franja de abajo) se corre en VERTICAL: la tarjeta queda arriba
    // del panel, entre la lista y lo que tapa la derecha, y debajo del chrome.
    const prox = apaisado
      ? vistaConPanelAbajo(vista.current, n, {
        izq: insetIzq + PANEL_MARGEN, der: caja.current.clientWidth - insetDer - PANEL_MARGEN,
        arriba: chrome ? CHROME_ALTO : PANEL_MARGEN,
        abajo: caja.current.clientHeight - (PANEL_MARGEN + ZOOM_ALTO) - Number(panelAlto) - PANEL_MARGEN,
        // El panel es mediano: lo que arranca a su derecha no está tapado y no se corre.
        panelDer: insetIzq + PANEL_MARGEN + panelAncho + PANEL_MARGEN,
        abajoSinPanel: caja.current.clientHeight - (PANEL_MARGEN + ZOOM_ALTO) - PANEL_MARGEN,
      })
      : vistaConPanel(vista.current, n.x, panelAncho, PANEL_MARGEN + insetIzq, {
        separacion: PANEL_MARGEN, nodoAncho: n.ancho, tope: caja.current.clientWidth - insetDer,
      });
    if (!prox) return;
    // El `antes` se guarda UNA vez: abrir un segundo nodo que necesite más corrimiento
    // no puede perder la vista original, que es a la que hay que volver.
    corrimiento.current = { antes: corrimiento.current?.antes ?? vista.current, aplicada: prox };
    vista.current = prox;
    pintar();
    // `grafo.nodos` cambia en cada tecla del editor; la dependencia es el NODO
    // elegido, o esto volvería a correr la vista mientras se escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion]);

  const nodoSel = grafo.nodos.find((n) => n.id === seleccion) ?? null;
  const zoom = (f: number) => {
    const v = vista.current;
    const k = Math.max(K_MIN, Math.min(K_MAX, v.k * f));
    vista.current = { ...v, k };
    setZoomTxt(Math.round(k * 100));
    pintar();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div
        ref={caja}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        // ⚠️ `overflow: hidden` NO impide que el contenedor se scrollee POR CÓDIGO, y
        // eso desincroniza el dibujo de la vista: el `transform` sigue diciendo una
        // cosa y en pantalla todo está corrido. Pasa solo — al enfocar un input de un
        // nodo que quedó fuera de cuadro, con el buscar-en-página del navegador, o con
        // cualquier `scrollIntoView`. Medido acá: un nodo a 1652 px se «movió» 330 px
        // con el transform intacto. La vista la gobierna el transform y nada más.
        onScroll={(e) => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}
        style={{
          position: 'relative', flex: 1, minHeight: alto, overflow: 'hidden',
          borderRadius: sinMarco ? 0 : 14, border: sinMarco ? 'none' : '1px solid var(--border)',
          background: 'var(--surface-2)',
          // ⚠️ CUADRÍCULA, NO PUNTOS. Pedido el 05/10/2026: «el fondo de la pizarra
          // tenga la cuadricula típica». El punteado hacía su trabajo —que el paneo se
          // SIENTA, porque arrastrar un lienzo liso parece que no hizo nada— y la
          // cuadrícula hace ese mismo trabajo mejor: las líneas dan dirección, así que
          // también se ve CUÁNTO se movió y si quedó derecho.
          //
          // Dos capas de líneas de 1 px y no una imagen: se repinta sola a cualquier
          // zoom y no pesa un byte. El color es el borde de la casa a media opacidad —
          // una cuadrícula al 100% compite con las tarjetas, que es lo que tiene que
          // mirar el ojo.
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px),'
            + 'linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '22px 22px, 22px 22px',
          backgroundPosition: '-1px -1px, -1px -1px',
          opacity: 1,
          touchAction: 'none', cursor: 'grab', userSelect: 'none',
        }}
      >
        <div ref={capa} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', willChange: 'transform' }}>
          <svg width={grafo.ancho} height={grafo.alto} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <defs>
              {(Object.keys(COLOR_TONO) as TonoArista[]).map((t) => (
                <marker key={t} id={`punta-${t}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill={COLOR_TONO[t]} />
                </marker>
              ))}
            </defs>
            {/* Mientras se arrastra una flecha, las de verdad se atenúan con el resto (punto 5). */}
            <g opacity={arrastreFlecha ? ATENUADO : 1} style={{ transition: 'opacity .12s ease' }}>
            {grafo.aristas.map((a, i) => {
              const d = grafo.nodos.find((n) => n.id === a.desde);
              const h = grafo.nodos.find((n) => n.id === a.hasta);
              if (!d || !h) return null;
              // Revelando, una flecha aparece cuando ya están sus dos puntas.
              const vista = !revelar || aristaRevelada(revelar.orden, revelados, a);
              // La flecha con el cursor encima se marca (más opaca y un poco más gruesa): es la pista de
              // que se puede tocar, que antes daba la etiqueta «24 h».
              const tocada = enFlecha === i;
              return (
                <path key={i} data-arista={i} d={curvaEntre(d, h, a.puerto)} fill="none" stroke={COLOR_TONO[a.tono]}
                  strokeWidth={tocada ? 2.4 : 1.6} strokeDasharray={a.tono === 'condicional' ? '5 4' : undefined}
                  markerEnd={`url(#punta-${a.tono})`} opacity={vista ? (tocada ? 1 : 0.85) : 0}
                  style={revelar ? { transition: `opacity ${REVELAR_DURACION_MS}ms ease` } : undefined} />
              );
            })}
            </g>
            {/* LA FLECHA QUE ASOMA (un clic en el círculo: el menú va en su punta) y LA QUE SE ARRASTRA
                (sigue al cursor; su `d` la escribe `moverCirculo` en el DOM). En el color primario y
                punteadas: todavía no son una flecha del flujo. */}
            {fantasma && (
              <path d={curvaPuntos(fantasma.x1, fantasma.y1, fantasma.x2, fantasma.y2)} fill="none" stroke={COLOR_TONO.condicional}
                strokeWidth={1.8} strokeDasharray="5 4" markerEnd="url(#punta-condicional)" />
            )}
            {arrastreFlecha && (
              <path ref={flechaTemp} data-flecha-arrastrada d={dTemp.current} fill="none" stroke={COLOR_TONO.condicional}
                strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#punta-condicional)" />
            )}
            {/*
              ⚠️ LA ZONA DE TOQUE DE CADA FLECHA: un segundo trazo, transparente y gordo, encima del que
              se ve (`TOQUE_FLECHA`). Pasar el cursor por CUALQUIER punto de la flecha muestra su ＋ del
              medio; antes sólo lo mostraba un cuadrado invisible de 28 px en el punto medio.

              · `pointerEvents: 'stroke'` en el trazo: el `<svg>` va con `none` (el fondo panea), y
                `stroke` cuenta el trazo aunque sea transparente (el valor del `stroke` no afecta).
              · ⚠️ EL ANCHO SE DIVIDE POR EL ZOOM, y NO con `vectorEffect='non-scaling-stroke'`: el
                zoom es un `transform: scale(k)` de CSS sobre la capa HTML, y Chromium calcula el
                trazo «que no escala» sólo con las transformaciones de ADENTRO del svg. Medido el
                09/10/2026 en Chrome con `elementFromPoint`, capa al 40 %: con el efecto y 16, la
                franja daba 6,5 px (= 16 a secas); con 16 / k, 16,5 px. Es la regla de la casa («una
                medida adentro de una capa con scale(k) se ve k veces más chica») con el mismo arreglo
                que la zona del ＋: el inverso del zoom que la pantalla ya muestra.
              · Va DESPUÉS de las flechas que se ven y ANTES de las tarjetas (que se dibujan encima):
                sobre una tarjeta manda la tarjeta.
              · Sin ＋ que mostrar (sin `onAgregarTras`, `sinMas`, revelando) no hay zona.
            */}
            {((onAgregarTras && (opcionesEn || opcionesAgregar)) || onQuitarFlecha) && !revelando && !arrastreFlecha && grafo.aristas.map((a, i) => {
              if (a.sinMas) return null;
              const d = grafo.nodos.find((n) => n.id === a.desde);
              const h = grafo.nodos.find((n) => n.id === a.hasta);
              if (!d || !h) return null;
              return (
                <path key={`toque-${i}`} data-arista={i} data-toque-flecha={i} d={curvaEntre(d, h, a.puerto)}
                  fill="none" stroke="transparent" strokeWidth={(TOQUE_FLECHA * 100) / zoomTxt}
                  style={{ pointerEvents: 'stroke' }}
                  onPointerEnter={() => entrarFlecha(i)} onPointerLeave={() => salirFlecha(i)} />
              );
            })}
          </svg>

          {/* Las etiquetas de las flechas son HTML, no <text>: llevan fondo, radio
              y el tipo de la casa, y un <text> de SVG no hereda nada de eso. */}
          {/*
            ⚠️ EL ＋ DE LA FLECHA: AGREGAR ALGO EN EL MEDIO.
            Pedido el 04/10/2026: «si paso el cursor por una flecha, debería dejarme
            agregar un condicional en medio. O también un "Delay"». El ＋ de la
            TARJETA agrega DESPUÉS de ella; el de la flecha agrega ENTRE dos, que es
            lo mismo dicho desde el otro lado — y por eso inserta tras el nodo de
            ORIGEN, reusando el mismo camino y el mismo índice. Un segundo mecanismo
            de inserción sería el segundo lugar donde la cuenta de `paso-<i>` puede
            quedar mal.

            Va con una zona de hover PROPIA y gorda (28 px), no sobre el `<path>`: un
            trazo de 1,6 px es imposible de apuntar, que es la misma medición que ya
            obligó a darle al ＋ de la tarjeta un puente de 8 px de padding. Y desde la
            quinta tanda la FLECHA ENTERA también la enciende (la zona de toque del
            `<svg>`, arriba): la zona del medio queda como el lugar del botón y como el
            puente entre la flecha y él.

            ⚠️ CON PUERTOS, INSERTA EN EL PUERTO DE LA FLECHA (`a.puerto`), no «después
            del nodo»: con N salidas eso es ambiguo, y el ＋ de la rama de abajo agregaba
            en la de arriba.

            ⚠️ Y AL LADO, LA PAPELERA DE ESA FLECHA (sexta tanda, punto 6): borra exactamente
            la flecha sobre la que está el cursor (`onQuitarFlecha`). Con una espera encima de
            la flecha (sus pastillas), el par baja `DESVIO_MEDIO` para no taparla.
          */}
          {((onAgregarTras && (opcionesEn || opcionesAgregar)) || onQuitarFlecha) && grafo.aristas.map((a, i) => {
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h || a.sinMas) return null;
            // Mientras se revela no hay dónde insertar: la flecha todavía no está. Y mientras se
            // arrastra otra flecha, tampoco: el ＋ quedaría bajo el cursor.
            if (revelando || arrastreFlecha) return null;
            const m = medioDeCurva(d, h, a.puerto);
            const abierta = enFlecha === i;
            const desvio = a.esperas?.length ? DESVIO_MEDIO : 0;
            const conMas = Boolean(onAgregarTras && (opcionesEn || opcionesAgregar));
            return (
              <div key={`mas-${i}`} data-no-pan data-arista-medio={i} data-desvio={desvio}
                onPointerEnter={() => entrarFlecha(i)}
                onPointerLeave={() => salirFlecha(i)}
                style={{
                  position: 'absolute', left: m.x, top: m.y + desvio,
                  // ⚠️ LA ZONA SE MIDE EN PÍXELES DE PANTALLA, NO DEL GRAFO. Vive adentro
                  // de la capa transformada, así que sus 28 px son 28 × k: medido en el
                  // navegador el 04/10/2026, con el lienzo al 22% la zona daba **6 px** y
                  // el ＋ adentro 5 — o sea inalcanzable, que es el mismo problema que
                  // obligó a no colgarla del `<path>` de 1,6 px. El `scale` inverso la
                  // deja del mismo tamaño a cualquier zoom, y al ＋ también.
                  transform: `translate(-50%, -50%) scale(${100 / zoomTxt})`,
                  minWidth: 28, height: 28, gap: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {abierta && conMas && onAgregarTras && (
                  <Dropdown
                    value="" ariaLabel="Agregar algo en el medio"
                    sinFlecha botonLabel="＋" disabled={agregarOcupado}
                    buttonStyle={{ width: 22, height: 22, padding: 0, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1 }}
                    // En el MEDIO de una flecha de /mensajes no se ofrece un mensaje: un
                    // canal se prende para el mensaje entero, no entre dos pasos. Quien
                    // pasa `opcionesEn` decide lo suyo.
                    {...menuDeOpciones(opcionesEn ? opcionesEn(a.desde, a.puerto, true) : (opcionesAgregar ?? []).filter((o) => o.value === 'delay' || o.value === 'condicional' || o.value === 'accion'))}
                    onChange={(v) => v && onAgregarTras(a.desde, v, a.puerto)}
                  />
                )}
                {abierta && onQuitarFlecha && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onQuitarFlecha(a); setEnFlecha(null); }} disabled={agregarOcupado}
                    aria-label="Borrar esta flecha" title="Borrar esta flecha" data-quitar-flecha={i}
                    style={{ ...estiloPapelera, width: 22, height: 22 }}><IconoBorrar size={13} /></button>
                )}
              </div>
            );
          })}

          {/* LAS ESPERAS QUE VAN EN UNA FLECHA (sexta tanda, DELAY 1: «que la flecha no se corte, que
              sea algo en medio de la flecha, más sutil»): una pastilla por espera, repartidas sobre la
              curva (`tDePildora`). Se tocan para editarlas (abren su panel como una tarjeta) y el click
              derecho les da su menú. No son `data-nodo`: no se arrastran ni reciben una flecha. */}
          {grafo.aristas.map((a, i) => {
            if (!a.esperas?.length) return null;
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h) return null;
            const vista = !revelar || aristaRevelada(revelar.orden, revelados, a);
            return a.esperas.map((e, k) => {
              const t = tDePildora(k, a.esperas!.length);
              const p = puntoDeCurva(d, h, a.puerto, t);
              const activa = seleccion === e.id;
              return (
                <button key={`pildora-${i}-${e.id}`} type="button" data-no-pan data-pildora={e.id} data-arista-pildora={i} data-t={t}
                  onClick={(ev) => { ev.stopPropagation(); onSeleccion(activa ? null : e.id); }}
                  title={`Esperar ${e.texto}`} aria-label={`Esperar ${e.texto}`} aria-pressed={activa}
                  style={{
                    position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)',
                    height: ALTO_PILDORA_FLECHA, padding: '0 9px', borderRadius: 999, whiteSpace: 'nowrap',
                    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontFamily: SANS,
                    background: 'var(--surface)', border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
                    boxShadow: activa ? '0 0 0 3px var(--primary-bg)' : 'none',
                    fontSize: 11, fontWeight: 600, color: 'var(--dim)',
                    opacity: !vista ? 0 : arrastreFlecha ? ATENUADO : 1, transition: 'opacity .12s ease',
                  }}>
                  <span aria-hidden style={{ fontSize: 11 }}>⏳</span>{e.texto}
                </button>
              );
            });
          })}

          {grafo.aristas.map((a, i) => {
            if (!a.etiqueta) return null;
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h) return null;
            const m = medioDeCurva(d, h, a.puerto);
            return (
              <div key={`et-${i}`} data-arista-medio={i} style={{
                position: 'absolute', left: m.x, top: m.y, transform: 'translate(-50%, -50%)',
                padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                background: 'var(--surface)', border: `1px solid ${COLOR_TONO[a.tono]}`,
                fontSize: 10.5, color: 'var(--dim)', fontFamily: SANS, pointerEvents: 'none',
              }}>{a.etiqueta}</div>
            );
          })}

          {grafo.nodos.filter((n) => !n.enFlecha).map((n) => (
            /**
             * ⚠️ EL ENVOLTORIO MIDE 0×0: SU REGIÓN DE HOVER ES LA UNIÓN DE SUS HIJOS.
             *
             * `capa` es `position:absolute` sin ancho ni alto, y los descendientes
             * ABSOLUTOS no cuentan para el shrink-to-fit de un absoluto, así que este
             * div no tiene caja propia. Cualquier separación entre la tarjeta y el ＋
             * es aire de `capa`, no del envoltorio — y cruzarlo dispara `pointerleave`,
             * que desmonta el botón justo cuando el cursor va hacia él.
             *
             * Medido con Playwright: el ＋ vivía 8 px afuera y se apagaba en el paso 9
             * de 10 del camino del cursor. No era difícil de apretar: era INALCANZABLE.
             * El dueño: «no me deja apretar el botón de + al lado de cada caja, porque
             * al intentar arrastrar el cursor, desaparece el botón de +».
             *
             * La cura es que no haya aire: el ＋ va adentro de un span que ARRANCA en el
             * borde de la tarjeta y se come los 8 px como padding. El puente es
             * continuo, y como es el span el que tiene caja, el hover no se corta.
             * (Un `margin` no sirve: el margen no recibe eventos de puntero.)
             */
            <div key={n.id} data-envoltorio={n.id}
              // Revelando: opacidad 0 y unos px abajo hasta que le toque. El envoltorio mide 0×0,
              // pero la opacidad y el `transform` se aplican igual a todo lo que pinta adentro (y por
              // eso el ARRASTRE mueve este envoltorio: la tarjeta, su ＋ y sus salidas, juntos).
              //
              // ⚠️ Y MIENTRAS SE ARRASTRA UNA FLECHA, TODO SE ATENÚA MENOS LA TARJETA DE ORIGEN Y LA DE
              // ABAJO DEL CURSOR (sexta tanda, punto 5: «que se ponga un poco opaco todo el resto menos
              // la tarjeta de origen... y cuando la paso por arriba de otra tarjeta también se le quita
              // lo opaco»). Revelando, manda el revelado.
              style={{
                ...estiloRevelado(n.id),
                ...(arrastreFlecha && n.id !== arrastreFlecha.desde && n.id !== sobreFlecha
                  ? { opacity: ATENUADO, transition: 'opacity .12s ease' }
                  : arrastreFlecha ? { transition: 'opacity .12s ease' } : {}),
              }}
              onPointerEnter={() => setEncima(n.id)}
              /**
               * ⚠️ NO SE APAGA MIENTRAS HAYA UN MENU ABIERTO. El ＋ sólo existe con
               * `encima === n.id`, y el menú del desplegable se monta por PORTAL en el
               * body, fuera de esta caja: al ir del botón al menú se dispara el leave y
               * el menú se desmonta CON el botón, en el medio del gesto. Es la misma
               * familia que el bug de los 8 px que ya está medido acá abajo.
               */
              onPointerLeave={() => { if (document.querySelector('[role="listbox"]')) return; setEncima((prev) => (prev === n.id ? null : prev)); }}
              onFocus={() => setEncima(n.id)}
              onBlur={() => setEncima((prev) => (prev === n.id ? null : prev))}
            >
              {/* La de abajo del cursor mientras se arrastra una flecha va resaltada como elegida: es
                  donde va a entrar. */}
              {renderNodo(n, seleccion === n.id || sobreFlecha === n.id)}
              {/* Un nodo CON puertos agrega desde sus puntos (abajo), no desde el ＋ de
                  pasar el cursor: dos ＋ en la misma tarjeta prometerían dos lugares. */}
              {onAgregarTras && !n.puertos && encima === n.id && (puedeAgregarTras?.(n.id) ?? true) && (
                <span
                  // ⚠️ El `data-no-pan` va en el SPAN y no sólo en el botón: un
                  // pointerdown en los 8 px de padding no encuentra `[data-nodo]` —el
                  // span no está adentro de la tarjeta— y el lienzo lo tomaría como un
                  // gesto de PANEO. Con la marca, sale por el early return.
                  data-no-pan data-mas={n.id}
                  style={{
                    position: 'absolute', left: n.x + n.ancho, top: n.y + 10,
                    paddingLeft: 8, paddingTop: 8, paddingBottom: 8, paddingRight: 8,
                    display: 'inline-flex', lineHeight: 0,
                  }}
                >
                  {opcionesAgregar ? (
                    <Dropdown
                      value="" ariaLabel="Agregar algo después de esta tarjeta"
                      sinFlecha botonLabel="＋" disabled={agregarOcupado}
                      buttonStyle={{ width: 26, height: 26, padding: 0, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, lineHeight: 1 }}
                      options={opcionesAgregar}
                      onChange={(v) => v && onAgregarTras(n.id, v)}
                    />
                  ) : (
                    <button
                    onClick={() => onAgregarTras(n.id, 'accion')} disabled={agregarOcupado}
                    title="Agregar un paso después de este" aria-label="Agregar un paso después de este"
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      cursor: agregarOcupado ? 'default' : 'pointer', opacity: agregarOcupado ? 0.5 : 1,
                      border: '1px solid var(--border-strong)', background: 'var(--surface)',
                      color: 'var(--dim)', fontFamily: SANS, fontSize: 14, lineHeight: 1,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,.10)',
                    }}
                  >＋</button>
                  )}
                </span>
              )}
              {/*
                ⚠️ UN CÍRCULO POR SALIDA, EN EL BORDE DERECHO, CON SU ＋ ADENTRO (sexta tanda, punto 4:
                «Ya no existe más el "+" al lado de una tarjeta, sino el círculo de abajo, que ahí si
                puedes poner el "+"»). Lo dibuja el lienzo AFUERA de la tarjeta (acá, no en `TarjetaNodo`)
                para que quede exactamente donde sale la flecha: los dos leen `yDePuerto`. El texto de la
                fila («Entonces» / «Siguiente paso», o el de la rama) es de la tarjeta.

                · Hueco (borde de color, fondo blanco): la salida está vacía. Lleno: ya sigue en algo.
                · El ＋ va adentro cuando se puede agregar ahí: con la salida vacía (continúa el hilo) o
                  con una que admite flechas en paralelo (`paralelo`: abre otra que corre a la vez; desde
                  el RESULTADO de una condición es `par@<fila>`, cuarta tanda, punto 8).
                · UN CLIC asoma la flecha con el menú en su punta; ARRASTRAR la lleva a otra tarjeta
                  (`onConectar`). Ver `bajarCirculo`. El círculo no depende del hover: una salida vacía
                  es algo que falta, y lo que falta se ve sin buscarlo.
                · ⚠️ LA PAPELERA DE SUS FLECHAS (punto 6), PEGADA AL CÍRCULO: el par es un solo span que
                  arranca en el círculo, así el cursor no cruza aire entre los dos (el bug de los 8 px de
                  acá arriba). Va al pasar el cursor por la tarjeta: siempre a la vista, una papelera por
                  salida llenaría el lienzo.
              */}
              {(n.puertos ?? []).map((p) => {
                const y = yDePuerto(n, p.id);
                const puede = Boolean(onAgregarTras) && (puedeAgregarTras?.(n.id) ?? true);
                const color = p.tono ? COLOR_TONO[p.tono] : 'var(--primary)';
                const enParalelo = p.id === 'sig' ? 'par' : `par@${p.id}`;
                const puertoAgregar = p.vacio ? p.id : p.paralelo ? enParalelo : null;
                const conMas = puede && puertoAgregar != null;
                // Se arrastra desde donde se puede sumar una flecha (vacía, o que admite paralelo): de
                // una salida llena que no admite más, una flecha nueva no tiene a dónde ir.
                const arrastrable = Boolean(onConectar) && conMas;
                // Las flechas que salen de ESTA fila (la principal y las que salen en paralelo de ella).
                const flechas = onQuitarFlecha ? grafo.aristas.filter((a) => a.desde === n.id && !a.sinMas && (filaDePuerto(n, a.puerto) ?? 'sig') === p.id) : [];
                const conPapelera = flechas.length > 0 && !arrastreFlecha && (encima === n.id || seleccion === n.id);
                const titulo = p.rotulo ? `«${p.rotulo}»` : 'esta salida';
                return (
                  <span key={`pt-${n.id}-${p.id}`} data-no-pan data-salida={`${n.id}:${p.id}`}
                    style={{ position: 'absolute', left: n.x + n.ancho - CIRCULO / 2, top: y, transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', gap: 2, lineHeight: 0 }}>
                    <button type="button" data-mas-puerto={`${n.id}:${p.id}`} disabled={agregarOcupado && !arrastrable}
                      aria-label={conMas ? `Agregar en ${titulo}` : `Salida ${titulo}`}
                      title={conMas ? (arrastrable ? 'Clic: agregar · Arrastrar: conectar' : 'Agregar') : undefined}
                      onPointerDown={(e) => { if (!conMas && !arrastrable) return; bajarCirculo(e, n, p, conMas && !agregarOcupado ? puertoAgregar : null); }}
                      onPointerMove={moverCirculo}
                      onPointerUp={(e) => soltarCirculo(e)}
                      onPointerCancel={(e) => soltarCirculo(e, true)}
                      style={{
                        width: CIRCULO, height: CIRCULO, padding: 0, borderRadius: 999, boxSizing: 'border-box', flex: 'none',
                        border: `1.5px solid ${color}`, background: p.vacio ? 'var(--surface)' : color,
                        color: p.vacio ? color : 'var(--surface)', fontSize: 11, fontWeight: 700, lineHeight: 1, fontFamily: SANS,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        cursor: conMas || arrastrable ? 'pointer' : 'default', touchAction: 'none',
                        boxShadow: '0 1px 3px rgba(0,0,0,.12)',
                      }}>{conMas ? '＋' : null}</button>
                    {conPapelera && (
                      <button type="button" data-quitar-salida={`${n.id}:${p.id}`} onClick={(e) => quitarDeFila(e, flechas)} disabled={agregarOcupado}
                        aria-label={flechas.length === 1 ? 'Borrar esta flecha' : 'Borrar una flecha'} title={flechas.length === 1 ? 'Borrar esta flecha' : 'Borrar una flecha'}
                        style={estiloPapelera}><IconoBorrar size={13} /></button>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* TODO LO QUE NO ES EL DIBUJO FLOTA. Va fuera de la capa transformada —o se
            achica con el zoom— y encima del lienzo, no arriba: el recuadro entero es
            el lienzo. */}
        {/* ⚠️ SIN ESTO EL LOGO SALE VACÍO, sin error y sin hueco visible: `SvcIcon`
            dibuja un `<use href="#ic-…">` y los símbolos los define `BrandDefs`. Va
            condicionado a que ALGÚN nodo use una marca, para no sembrar ids
            duplicados en las pantallas que no los necesitan. */}
        {grafo.nodos.some((n) => ICON[n.icono]) && <BrandDefs />}

        {chrome && (
          <div data-no-pan style={{ position: 'absolute', left: insetIzq, right: derChrome, top: 0, padding: 14, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>{chrome}</div>
          </div>
        )}

        {/* El zoom abajo a la izquierda, y el porcentaje AL COSTADO: entre los dos
            botones obliga a apuntar a un blanco que se mueve cuando el número cambia
            de ancho (100% → 33%). */}
        <div data-no-pan style={{ position: 'absolute', left: 12 + insetIzq, bottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BotonChico onClick={() => zoom(1 / 1.2)} rotulo="Alejar">−</BotonChico>
          <BotonChico onClick={() => zoom(1.2)} rotulo="Acercar">＋</BotonChico>
          <BotonChico onClick={() => encuadrar(true)} rotulo="Centrar">⤢</BotonChico>
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginLeft: 2 }}>{zoomTxt}%</span>
          {/* ⚠️ HERRAMIENTAS DEL TABLERO, EN SU PROPIO GRUPO Y PEGADAS AL ZOOM.
              Pedido con la captura delante: «los botones de retroceder en una sección
              aparte, pero abajo a la izquierda, cerca de los botones de zoom». Estaban
              arriba, colgando bajo la tarjeta del título, donde se leían como parte del
              título y no del lienzo.

              Van en ESTA fila y no en un renglón encima del zoom porque el panel del
              nodo abre justo ahí: `ZOOM_ALTO` existe para que ese panel no lo tape, y un
              segundo renglón volvería a quedar debajo. El separador es lo que los hace
              «una sección aparte» sin sumar altura. */}
          {herramientas && (
            <>
              <span aria-hidden style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px', flex: 'none' }} />
              {herramientas}
            </>
          )}
        </div>

        {/* `data-esquina-ocupada`: la esquina de los avisos sube para no taparlo (EsquinaAvisos).
            `Z_ACCION_LIENZO`: encima del panel apaisado, que va DESPUÉS en el DOM y le tapaba el
            primer renglón al error que frena Publicar (lib/lienzo-grafo.ts, «Las capas»). */}
        {accion && <div data-no-pan data-esquina-ocupada style={{ position: 'absolute', right: 12 + derAbajo, bottom: 12, zIndex: Z_ACCION_LIENZO }}>{accion}</div>}

        {/* EL EDITOR. Va acá adentro y en coordenadas de PANTALLA: si viviera en la
            capa transformada, el zoom le cambiaría el tamaño a los inputs. */}
        {nodoSel && (
          <div
            data-no-pan
            data-panel-forma={apaisado ? 'apaisado' : 'columna'}
            style={{
              // Las TRES cosas que flotan llevan el inset, no dos: el chrome, la fila
              // del zoom y ESTE panel, que abre justo abajo a la izquierda — o sea exactamente
              // donde se apoya la lista de secuencias de /automations. Medido con el arnés: la
              // flecha del selector de disparo no se podía apretar («aside … intercepts
              // pointer events»), con el panel dibujado y a la vista.
              position: 'absolute', left: PANEL_MARGEN + insetIzq, bottom: PANEL_MARGEN + ZOOM_ALTO,
              ...(apaisado
                // APAISADO: la franja de abajo, de la lista a lo que tapa la derecha EN ESA FRANJA,
                // con alto FIJO. Es exactamente el rectángulo `editor` de `muelles` (los mismos
                // PANEL_MARGEN y ZOOM_ALTO, importados de lib/lienzo-grafo.ts): con dos cuentas, el
                // panel y lo que `muelles` le reserva se separarían. El contenido va en columna y
                // llena el alto, así un editor de dos columnas puede usar el 100 %.
                // `Z_EDITOR_APAISADO`: llega al rincón de abajo a la derecha, encima de la esquina
                // de avisos (z 55) y de las cajas de «Crear con IA» (z 4). lib/lienzo-grafo.ts.
                //
                // ⚠️ MEDIANO DESDE LA TERCERA TANDA (decisión 1): `panelAncho` (el `editorAncho` de
                // `muelles`, hasta 720) pegado a la lista, y no de la lista al borde derecho — «ya te
                // fuiste al otro extremo». El tope por si la caja se achica entre dos cálculos.
                ? {
                  width: panelAncho, maxWidth: `calc(100% - ${PANEL_MARGEN * 2 + insetIzq + derAbajo}px)`,
                  height: panelAlto, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', zIndex: Z_EDITOR_APAISADO,
                }
                : {
                  width: panelAncho,
                  // Y con algo apoyado a la DERECHA (el panel de «Probar»), el ancho se topa ahí:
                  // en una ventana angosta el editor se metería debajo de ese panel.
                  // ⚠️ `width` y `maxWidth` son el ancho EXTERIOR: `app/globals.css` pone
                  // `* { box-sizing: border-box }`. Hasta el 08/10/2026 este comentario decía «de
                  // contenido» y el tope le restaba 30 px más (el relleno y el borde, contados dos
                  // veces): en una ventana angosta el editor quedaba 30 px más angosto de lo que
                  // entraba (hallazgos-chatbot.md, «Con «Probar» abierto…»).
                  maxWidth: `calc(100% - ${PANEL_MARGEN * 2 + insetIzq + insetDer}px)`,
                  maxHeight: `calc(100% - ${24 + ZOOM_ALTO}px)`,
                  // Con alto por tipo (cuarta tanda, punto 1), en columna flex como el apaisado: el
                  // contenido scrollea adentro y el panel no salta de tamaño entre dos tarjetas.
                  ...(altoFijo
                    ? { height: panelAlto, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }
                    : { overflowY: 'auto' as const }),
                }),
              padding: 14, borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              boxShadow: '0 12px 32px rgba(0,0,0,.14)', cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flex: 'none' }}>
              {tituloEditor ? tituloEditor(nodoSel) : (() => {
                // Lo que va PEGADO al título (cuarta tanda, punto 15: «el botón de MaKo arriba del
                // todo, al lado del título de WhatsApp»): sin esto el título se lleva el ancho.
                const extra = accionesTitulo ? accionesTitulo(nodoSel) : null;
                return (
                  <>
                    <IconoNodo icono={nodoSel.icono} tam={17} />
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: extra ? '0 1 auto' : 1, minWidth: 0 }}>{nodoSel.titulo}</div>
                    {extra && <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{extra}</div>}
                  </>
                );
              })()}
              {/* ⚠️ NO dice «Cerrar el editor»: ése es el de la pantalla, y con los dos
                  con el mismo rótulo había dos ✕ que cierran cosas distintas — el de
                  arriba se va del mensaje (y pregunta si publicar), éste sólo repliega
                  el panel de un nodo. Medido con Playwright: `getByLabel('Cerrar el
                  editor')` resolvía a DOS. */}
              {/* La papelera de la casa, ROJA (sexta tanda, general 9: «Cambia el botón de BORRAR con ese
                  ícono de basura que no se ve... Y que siempre el ícono de borrar sea rojo»). Hasta la
                  segunda pasada era un 🗑 en `--faint`, el que más se ve del lienzo. */}
              {onBorrar && (puedeBorrar?.(nodoSel.id) ?? true) && (
                <BotonBorrar talla="sm" title="Borrar esta tarjeta" style={{ marginLeft: 'auto' }}
                  onClick={() => { const id = nodoSel.id; onSeleccion(null); onBorrar(id); }} />
              )}
              <button onClick={() => onSeleccion(null)} aria-label="Cerrar este paso" title="Cerrar este paso"
                style={{ marginLeft: onBorrar && (puedeBorrar?.(nodoSel.id) ?? true) ? 0 : 'auto', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            {altoFijo
              // En COLUMNA flex: los editores anchos (WhatsApp en fila, el email tipo Gmail) estiran
              // con `flex: 1` + `min-height: 0`. Nunca `height: 100%`, que Safari resuelve a cero.
              ? <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{renderEditor(nodoSel)}</div>
              : renderEditor(nodoSel)}
          </div>
        )}
      </div>
      {/* Los dos menús van por PORTAL al `body`: el lienzo vive adentro de cajas con `overflow` y
          `transform`, y un menú nacido ahí se recortaría (el mismo criterio que el `Dropdown`). */}
      {fantasma && <MenuFlotante x={fantasma.menuX} y={fantasma.menuY} items={fantasma.items} onCerrar={cerrarFantasma} etiqueta="Qué agregar" />}
      {menu && <MenuFlotante x={menu.x} y={menu.y} items={menu.items} onCerrar={cerrarMenu} etiqueta="Opciones" />}
    </div>
  );
}

/**
 * UN MENÚ FLOTANTE: el del click derecho y el de la punta de la flecha que asoma (sexta tanda). Cada
 * opción con su ícono (punto 10) y los grupos separados con una línea. Se acomoda adentro de la
 * ventana (se da vuelta hacia arriba o hacia la izquierda si no entra) y se cierra con Escape, con un
 * clic afuera, con la rueda o al redimensionar.
 *
 * ⚠️ EL ESCAPE SE FRENA CON `stopImmediatePropagation` (AGENTS.md, «un popover anclado también es una
 * capa»): todos los Escape de la casa viven en `document` y en captura, y con `stopPropagation` el
 * del panel del nodo —o el de un modal de abajo— también cerraba.
 */
function MenuFlotante({ x, y, items, onCerrar, etiqueta }: {
  x: number; y: number; items: ItemMenuLienzo[]; onCerrar: () => void; etiqueta: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [lugar, setLugar] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    setLugar({
      left: x + w + 8 > vw ? Math.max(8, x - w) : x,
      top: y + h + 8 > vh ? Math.max(8, y - h) : y,
    });
    // El foco entra al primero: con el menú abierto ya se elige con las flechas y Enter.
    el.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [x, y]);
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onCerrar(); };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onCerrar(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const botones = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      if (!botones.length) return;
      e.preventDefault();
      const i = botones.indexOf(document.activeElement as HTMLButtonElement);
      const sig = e.key === 'ArrowDown' ? (i + 1) % botones.length : (i - 1 + botones.length) % botones.length;
      botones[sig].focus();
    };
    const cerrar = () => onCerrar();
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    window.addEventListener('wheel', cerrar, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
      window.removeEventListener('wheel', cerrar, { capture: true });
    };
  }, [onCerrar]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} role="menu" aria-label={etiqueta} data-menu-lienzo
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', left: lugar?.left ?? x, top: lugar?.top ?? y, zIndex: 1000,
        visibility: lugar ? 'visible' : 'hidden', minWidth: 214, maxWidth: 300, padding: 5, borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 32px rgba(0,0,0,.18)',
        fontFamily: SANS,
      }}>
      <style>{'.lz-item{background:transparent}.lz-item:hover:not(:disabled),.lz-item:focus-visible{background:var(--surface-2);outline:none}'}</style>
      {items.map((it, k) => (
        <Fragment key={it.id}>
          {k > 0 && (items[k - 1].grupo ?? 0) !== (it.grupo ?? 0) && <div role="separator" style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />}
          <button type="button" role="menuitem" className="lz-item" disabled={it.deshabilitado}
            onClick={() => { onCerrar(); it.onElegir(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px',
              borderRadius: 8, border: 'none', cursor: it.deshabilitado ? 'default' : 'pointer', fontFamily: SANS,
              fontSize: 13.5, fontWeight: 600, color: it.peligro ? 'var(--bad)' : 'var(--ink)', opacity: it.deshabilitado ? 0.45 : 1,
            }}>
            <span aria-hidden style={{ width: 18, height: 18, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: it.peligro ? 'var(--bad)' : 'var(--dim)' }}>{it.icono}</span>
            <span style={{ minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
          </button>
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}

/*
 * (Acá vivía `IconoBorrar`, el `trash` de app/_components/icons.tsx pintado de rojo: el mismo dibujo que
 * Martín pidió cambiar —sexta tanda, general 9: «ese ícono de basura que no se ve, no se entiende»—. Desde
 * la segunda pasada la papelera del lienzo es la de la casa, UNA definición: `IconoBorrar` y
 * `BotonBorrar` de app/_ui/BotonBorrar.tsx, rojos siempre.)
 */

/** El botón de la papelera de una flecha: chico, redondo, con el borde de la casa. */
const estiloPapelera: CSSProperties = {
  width: CIRCULO + 4, height: CIRCULO + 4, padding: 0, borderRadius: 999, flex: 'none',
  border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.12)',
};

/** «Centrar»: el marco con sus cuatro esquinas. */
export function IconoCentrar({ tam = 16 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><circle cx="12" cy="12" r="2.2" />
    </svg>
  );
}

/**
 * «ACOMODAR» (sexta tanda, punto 14: «pon un botón de ícono para "acomodar" todas las tarjetas»):
 * tres tarjetas unidas como un árbol, que es lo que hace (vuelve al layout automático).
 */
export function IconoAcomodar({ tam = 16 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="9.5" width="6" height="5" rx="1.4" /><rect x="15" y="3.5" width="6" height="5" rx="1.4" /><rect x="15" y="15.5" width="6" height="5" rx="1.4" />
      <path d="M9 12h3M12 6v12M12 6h3M12 18h3" />
    </svg>
  );
}

/**
 * La tarjeta de un nodo. La forma es del lienzo; el CONTENIDO lo pone quien lo usa.
 *
 * ⚠️ CON `puertos` LA TARJETA TIENE ALTO FIJO y sus filas de salida van PEGADAS AL PIE.
 * El punto de cada salida lo dibuja el lienzo afuera (`yDePuerto`), contando desde el pie:
 * si la tarjeta creciera con su contenido, las filas se correrían y cada flecha saldría de
 * la fila de al lado. Lo que no entra en el contenido se corta; entero está en el editor.
 * Sin `puertos` (el lienzo de /mensajes) crece como siempre.
 */
export function TarjetaNodo({ nodo, activo, roto, children }: {
  nodo: NodoFlujo; activo: boolean; roto?: boolean; children: ReactNode;
}) {
  const tinte = tinteDeControl(nodo) ?? identidadDeTarjeta(nodo);
  const borde = activo ? 'var(--primary)' : roto ? 'var(--bad)' : (tinte?.borde ?? 'var(--border)');
  const fijo = nodo.puertos !== undefined;
  const filas = tieneFilas(nodo) ? (nodo.puertos ?? []) : [];
  // SUELTA (sexta tanda, punto 7): borde punteado, como la píldora de una espera. Elegida, el de siempre.
  const trazo = nodo.suelta && !activo ? 'dashed' : 'solid';
  /**
   * ⚠️ LA ESPERA ES UNA PÍLDORA (segunda tanda, decisión 9): «⏳ 24 h» en UNA línea, sin
   * cabecera. Su alto y su ancho los estima lib/flujo-conversacion.ts (el punto de salida se
   * calcula de ahí: `yDePuerto` con un alto de ~44 sale de la mitad, que es donde está el texto).
   */
  if (nodo.familia === 'control' && nodo.tipo === 'espera') {
    return (
      <div data-nodo={nodo.id} role="button" tabIndex={0} aria-pressed={activo} title={nodo.titulo}
        style={{
          position: 'absolute', left: nodo.x, top: nodo.y, width: nodo.ancho, height: nodo.alto,
          borderRadius: 999, background: 'var(--surface-2)',
          border: `${BORDE_NODO}px ${activo || roto ? 'solid' : 'dashed'} ${activo || roto ? borde : 'var(--border-strong)'}`,
          boxShadow: activo ? '0 0 0 3px var(--primary-bg)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 14px',
          boxSizing: 'border-box', cursor: 'pointer', fontFamily: SANS, overflow: 'hidden',
        }}>
        <IconoNodo icono={nodo.icono} tam={15} />
        <span style={{ minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
        {nodo.advertencia && <span title={nodo.advertencia} style={{ flex: 'none', fontSize: 10.5, color: 'var(--warn)' }}>⚠</span>}
      </div>
    );
  }
  return (
    <div
      data-nodo={nodo.id}
      role="button" tabIndex={0} aria-pressed={activo}
      style={{
        position: 'absolute', left: nodo.x, top: nodo.y, width: nodo.ancho,
        ...(fijo ? { height: nodo.alto, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : { minHeight: nodo.alto }),
        // El patrón (el papel de chat de WhatsApp) va en el MISMO `background`, como capa encima del
        // color: `background` + `backgroundImage` sueltos son shorthand y longhand peleando en React.
        borderRadius: 13, border: `${BORDE_NODO}px ${trazo} ${nodo.suelta && !activo && !roto ? 'var(--border-strong)' : borde}`,
        background: tinte && 'patron' in tinte && tinte.patron ? `${tinte.patron} 0 0 / 14px 14px, ${tinte.fondo}` : (tinte?.fondo ?? 'var(--surface)'),
        boxShadow: activo ? '0 0 0 3px var(--primary-bg)' : '0 1px 2px rgba(0,0,0,.05)',
        padding: fijo ? `11px 11px ${PIE_PUERTOS}px` : 11, boxSizing: 'border-box', cursor: 'pointer', fontFamily: SANS,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, flex: 'none' }}>
        <IconoNodo icono={nodo.icono} tam={15} />
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: tinte?.titulo ?? 'var(--dim)', fontWeight: nodo.canal || nodo.tipo === 'mako' ? 700 : undefined }}>
          {nodo.titulo}
        </span>
        {nodo.advertencia && (
          <span title={nodo.advertencia} style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--warn)' }}>⚠</span>
        )}
      </div>
      {fijo ? <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div> : children}
      {filas.map((p) => {
        // LA SALIDA AL PIE (sexta tanda, punto 4): «Entonces» / «Siguiente paso» a la DERECHA, pegado
        // al círculo que dibuja el lienzo sobre el borde, y sin filete (no es una rama: es la salida).
        const alPie = p.rotulo == null && nodo.salidaAlPie;
        const texto = rotuloDeFila(nodo, p);
        return (
          <div key={p.id} title={texto} data-fila-salida={p.id}
            style={{
              flex: 'none', height: ALTO_PUERTO, boxSizing: 'border-box', borderTop: alPie ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: alPie ? 'flex-end' : undefined, paddingRight: alPie ? 12 : 6,
              fontSize: 11.5, fontWeight: alPie ? 600 : undefined,
              color: alPie ? (p.vacio ? 'var(--faint)' : 'var(--dim)') : p.tono === 'mala' ? 'var(--dim)' : 'var(--ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{texto}</span>
            {/* La marca CEDE último: el rótulo se corta con «…» antes que ella (flex: none). */}
            {p.marca && (
              <span style={{ marginLeft: 'auto', flex: 'none', padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, color: 'var(--warn)', border: '1px solid var(--warn)', background: 'var(--surface)' }}>{p.marca}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * EL TINTE DE UNA TARJETA DE CONTROL (segunda tanda, decisión 9), o null para la blanca de
 * siempre (contenido, o sin `familia`: /mensajes).
 *
 * ⚠️ SÓLO TOKENS QUE SE REDEFINEN EN OSCURO (`--primary-bg`, `--primary-weak`, `--primary-strong`,
 * `--surface-2`, `--border`). `--wa*`, `--mako`, `--mako-lite` y las `--grafo-*` NO se redefinen:
 * como fondo de una tarjeta quedan, en oscuro, un rectángulo pastel claro (R3, medido en
 * app/globals.css). La etiqueta va con SU color, como `ChipEtiqueta` (fondo color+24, borde
 * color+66): sobre cualquier fondo es el mismo color transparente.
 */
export function tinteDeControl(n: Pick<NodoFlujo, 'familia' | 'tipo' | 'color'>): { fondo: string; borde: string; titulo: string } | null {
  if (n.familia !== 'control') return null;
  if (n.tipo === 'condicion') return { fondo: 'var(--primary-bg)', borde: 'var(--primary-weak)', titulo: 'var(--primary-strong)' };
  if (n.tipo === 'etiqueta' && typeof n.color === 'string' && /^#[0-9a-f]{6}$/i.test(n.color)) {
    return { fondo: `${n.color}24`, borde: `${n.color}66`, titulo: 'var(--ink)' };
  }
  return { fondo: 'var(--surface-2)', borde: 'var(--border)', titulo: 'var(--dim)' };
}

/**
 * LA IDENTIDAD DE UNA TARJETA QUE MANDA ALGO (tercera tanda, decisión 5; pedido literal: «pon un
 * diseño característico a las tarjetas de WhatsApp e Email, que hagan recordar a esas Apps,
 * colores, etc...»), o null para la blanca de siempre.
 *
 *   · WHATSAPP: el verde de la marca en el borde y el título, y el fondo de chat (un punteado
 *     verde muy suave, como el papel tapiz de WhatsApp);
 *   · EMAIL: el blanco de Gmail (la superficie) y el rojo del sobre en el título;
 *   · MAKO: el dorado de MaKo, que le escribe al grupo del negocio.
 *
 * ⚠️ LOS VERDES, ROJOS Y DORADOS SE MEZCLAN CON TOKENS QUE SE REDEFINEN EN OSCURO (`color-mix` con
 * `--surface`, `--surface-2`, `--border` y `--ink`), nunca solos: `--wa*` y `--mako` no se redefinen
 * (R3), y un `#25D366` puro de fondo en oscuro es un rectángulo fosforescente. Mezclado con la
 * superficie, en claro es un verde agua y en oscuro un verde noche; mezclado con la tinta, el título
 * se oscurece en claro y se aclara en oscuro, así se lee en los dos.
 */
export function identidadDeTarjeta(n: Pick<NodoFlujo, 'canal' | 'tipo'>): { fondo: string; borde: string; titulo: string; patron?: string } | null {
  if (n.canal === 'whatsapp') {
    return {
      fondo: 'color-mix(in srgb, #25D366 7%, var(--surface))',
      borde: 'color-mix(in srgb, #25D366 50%, var(--border))',
      titulo: 'color-mix(in srgb, #128C7E 70%, var(--ink))',
      patron: 'radial-gradient(color-mix(in srgb, #25D366 22%, transparent) 1px, transparent 1.2px)',
    };
  }
  if (n.canal === 'email') {
    return { fondo: 'var(--surface)', borde: 'color-mix(in srgb, #EA4335 35%, var(--border))', titulo: 'color-mix(in srgb, #EA4335 80%, var(--ink))' };
  }
  // Instagram y Messenger (sexta tanda, parte «canales»): sus colores viven con el canal (lib/canal-social.ts).
  if (n.canal === 'instagram' || n.canal === 'messenger') {
    const c = IDENTIDAD_SOCIAL[n.canal];
    return { fondo: c.fondo, borde: c.borde, titulo: c.titulo };
  }
  if (n.tipo === 'mako') {
    return { fondo: 'color-mix(in srgb, #C9A227 8%, var(--surface))', borde: 'color-mix(in srgb, #C9A227 45%, var(--border))', titulo: 'color-mix(in srgb, #A07E14 70%, var(--ink))' };
  }
  return null;
}

export function BotonChico({ children, onClick, rotulo }: { children: ReactNode; onClick: () => void; rotulo: string }) {
  return (
    <button data-no-pan onClick={onClick} title={rotulo} aria-label={rotulo}
      style={{
        width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-strong)',
        background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer',
        fontFamily: SANS, fontSize: 13, lineHeight: 1, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
      }}>{children}</button>
  );
}

/*
 * (Acá vivía `MasDeSalida`, el ＋ de una salida como desplegable pegado a la tarjeta. Desde la sexta
 * tanda el ＋ va ADENTRO del círculo y su menú en la punta de la flecha que asoma (`soltarCirculo` +
 * `MenuFlotante`); con una sola opción sigue sin menú: se agrega directo.)
 */

/** Una opción del ＋ que dice a qué GRUPO pertenece (los grupos van separados por una línea). */
type OpcionAgrupada = DropdownOption & { grupo?: number };

/**
 * El menú de un ＋: una lista plana, o grupos separados por una línea cuando las opciones traen
 * `grupo` (cuarta tanda, punto 10: «separa las secciones con divider, por ejemplo WhatsApp y Email
 * juntos»). Con grupos es más ancho: un ＋ de 22 px abría un menú apretado.
 */
function menuDeOpciones(opciones: OpcionAgrupada[]) {
  if (!opciones.some((o) => o.grupo != null)) return { options: opciones };
  const grupos = new Map<number, DropdownOption[]>();
  for (const o of opciones) {
    const g = o.grupo ?? 0;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(o);
  }
  const lista = [...grupos.entries()].sort((a, b) => a[0] - b[0]).map(([, options]) => ({ title: '', options }));
  return { columns: [lista], alContenido: true, menuMinAncho: 230 };
}

/** El estilo de un input adentro del panel. Vive acá para que los dos lienzos no
 *  lo copien: un editor que se ve distinto según qué flujo abriste es el olor de
 *  dos piezas que ya empezaron a separarse. */
export const inpLienzo: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)',
  fontSize: 13, fontFamily: SANS, outline: 'none',
};

export const rotuloLienzo: CSSProperties = {
  fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
  color: 'var(--dim)', display: 'block', marginBottom: 6,
};

/**
 * EL CAMPO PROTAGONISTA DE UN EDITOR DE CONTROL (cuarta tanda, punto 1: «tanto espacio en blanco y un
 * desplegable chico arriba del todo»). DELAY, TAG, ACTION y GO TO tienen UNA cosa que elegir: ésa va
 * grande y de ancho completo (48 de alto, letra de 16), y el panel mide lo suyo (`editorDeTarjeta`,
 * lib/lienzo-grafo.ts). Vive acá, al lado de `inpLienzo`, para que los editores no lo copien: un
 * selector grande en una tarjeta y chico en la de al lado es el olor de dos piezas separándose.
 *
 *   · `campoGrande`: un input (el número de un DELAY).
 *   · `botonGrande`: el `buttonStyle` de un `Dropdown` (la unidad, la acción, la etiqueta).
 */
export const ALTO_CAMPO_GRANDE = 48;
export const campoGrande: CSSProperties = {
  ...inpLienzo, minHeight: ALTO_CAMPO_GRANDE, padding: '11px 14px', borderRadius: 11, fontSize: 16, fontWeight: 600,
};
export const botonGrande: CSSProperties = {
  minHeight: ALTO_CAMPO_GRANDE, padding: '11px 14px', borderRadius: 11, fontSize: 16, fontWeight: 600,
};

/**
 * El ícono de un nodo: el LOGO de la marca cuando lo hay, el emoji cuando no.
 *
 * Pedido con la captura delante: «WhatsApp y Email con los logos de los mismos,
 * tenemos los logos». Y los teníamos: el catálogo de `ServicioVisual` es el mismo que
 * usan las integraciones y los tiles de notificaciones, así que WhatsApp sale con su
 * verde oficial y el mail con el logo de Resend — un logo ajeno es peor que uno
 * inventado, y esto vive en un solo lugar.
 *
 * ⚠️ ES UN SOLO CAMPO, A PROPÓSITO. La tentación es sumar un `logo?:` al lado de
 * `icono` y que el render elija — y dos campos para el mismo renglón es exactamente
 * cómo se muere uno de los dos (ya pasó acá con `sub` y `titulo`). El valor DICE qué
 * es: si `icono` es una clave del catálogo de marcas, se dibuja la marca; si es
 * cualquier otra cosa, es texto. Un emoji nunca va a ser una clave.
 */
export function IconoNodo({ icono, tam }: { icono: string; tam: number }) {
  if (ICON[icono]) return <SvcIcon k={icono} size={Math.round(tam * 0.74)} box={tam + 7} radius={6} />;
  // MaKo: su logo (la tarjeta que le escribe al grupo del negocio). Sin animación: en un lienzo con
  // N tarjetas, N logos rebotando al abrir es ruido.
  if (icono === ICONO_MAKO) return <MakoLogo size={tam + 7} animate={false} />;
  // El sobre de Gmail (decisión 5: «el sobre rojo»). Dibujado acá y no del catálogo de marcas:
  // `email` ahí es el logo de Resend, que es por dónde sale, no lo que la persona reconoce.
  if (icono === ICONO_GMAIL) {
    const s = tam + 5;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden style={{ display: 'block', flex: 'none' }}>
        <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#fff" stroke="#EA4335" strokeWidth="1.6" />
        <path d="M3.2 6.4 12 13l8.8-6.6" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  return <span style={{ fontSize: tam - 2 }}>{icono}</span>;
}
