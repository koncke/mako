'use client';

// =============================================================================
// Grafo — el mapa del segundo cerebro: lo que MaKo entendió del negocio
// =============================================================================
// El lenguaje visual sale de leer el `app.js`, el `app.css` y el worker reales de
// Obsidian. Lo que hay que saber antes de tocar nada:
//
// 1. TRES GRUPOS ANIDADOS POR NODO, Y NO ES CAPRICHO. Una animación CSS sobre
//    `transform` GANA en la cascada contra un `transform` escrito por JS. Si la
//    posición y la flotación vivieran en el mismo `<g>`, la flotación ganaría y el
//    nodo quedaría clavado en su keyframe — sin error, sin warning, y con el mapa
//    aparentando estar vivo porque flota. Un dueño por grupo:
//      · el de afuera lleva la POSICIÓN (la escribe la física con setAttribute)
//      · el del medio, la FLOTACIÓN (CSS, GPU, 0 ms de main thread)
//      · el de adentro, el POP de entrada (CSS)
//
// 2. EL COLOR ES OPT-IN Y TIENE TOPE. Obsidian tiene seis slots de grupo y su valor
//    por defecto es el MISMO gris de un nodo normal: el sistema está cableado y viene
//    apagado. Acá igual — monocromo por defecto, y un grupo que el usuario enciende.
//    Y hay un techo medido: sobre este fondo (#14161B) solo hay dos tokens con más
//    contraste que el gris base (6,55:1) que no estén ya tomados. `--primary`,
//    `--good` y `--bad` quedan por DEBAJO del gris: un nodo marcado con ellos se
//    vería menos importante que uno sin marcar.
//
// 3. EL HOVER NO SE REPINTA. Obsidian sí lo hace, pero acá el color significa autoría
//    y taparlo justo en el nodo que estás mirando sería perder el dato. El foco se
//    marca con tres señales no cromáticas: anillo, escala y todo lo demás atenuado.
//
// 4. `onWheel` de JSX no puede preventDefault (react-dom 19 lo registra passive), y
//    el drag nativo del navegador hay que apagarlo a mano o se come el paneo.
// =============================================================================

import { useMemo, useState, useRef, useEffect, useCallback, Fragment, type CSSProperties } from 'react';
import { AREAS, NIVEL1, AUTORIA_TEXTO, radioNodo, colorArea, type Cerebro, type NodoCerebro, type AreaId, type Punto } from '@/lib/cerebro-modelo';
import type { NodoFisico, Simulacion } from './fisica';
import { MONO } from '@/app/_ui/tokens';
import { Button, Eyebrow } from '@/app/_ui';
import { FiltroMapa, type PanelAbierto } from './FiltroMapa';
import { cuentaFiltros, filtroVacio, pasaFiltro, type EstadoFiltro } from '@/lib/cerebro-filtro';
import { NoResults } from '@/app/_ui/Estados';
// La misma máquina de matcheo que la barra del plan: palabras en cualquier orden, sin
// acentos ni mayúsculas, con frontera de palabra y plural tolerado. El módulo no lleva
// `server-only` justamente para poder compartirse con el navegador. Escribir una segunda
// hubiera dado dos búsquedas que se comportan distinto en la misma app.
import { matchNodo, CAMPOS_CEREBRO_DEFECTO, type CampoCerebro } from '@/lib/buscar-cerebro';
import { BuscadorCerebro, type EstadoIA } from './BuscadorCerebro';

// ⚠️ RELATIVOS AL ENCUADRE, no absolutos. Antes valían 0,5 y 4 contra k=1, que era el
// zoom de arranque cuando el mapa entraba por `preserveAspectRatio`. Ahora el mapa se
// encuadra contra la caja medida y arranca en un k que puede ser 1,8: con topes
// absolutos el usuario no podía alejarse ni un poco. No lo ve el typecheck — se ve como
// «el zoom se traba».
const K_MIN_REL = 0.35;
const K_MAX_REL = 6;
/** Umbral de clic vs arrastre, 5 px de pantalla al cuadrado (el mismo que Obsidian). */
const ARRASTRE2 = 25;
/** La `Rl` de Obsidian: cuánto se apaga lo que no toca al nodo en foco. */
const ATENUADO = 0.2;

/** Cuánto dura la salida de un nodo, en ms. Vive acá arriba y no como un 260 suelto
 *  adentro del `setTimeout` porque tiene que coincidir con la animación `cbg-out` del
 *  bloque de estilos: si el temporizador es más corto, los nodos se desmontan a mitad
 *  del fade y se ven cortarse. */
const MS_SALIDA = 300;
/** El «todavía no existe»: mismo círculo relleno, más apagado. Nunca un aro punteado. */
const PENDIENTE = 0.5;
/** Amplitud de la flotación, en unidades de mundo. Con 3 el recorrido era de ~2 px de
 *  pantalla y no se leía como flotar: se leía como que el texto TEMBLABA. 16 da un
 *  movimiento intencional. Va en unidades de mundo, así que el zoom lo escala solo. */
const FLOTE = 16;

type Vista = { k: number; x: number; y: number };

/** El atributo `draggable` es de HTML y React lo rechaza en un `<svg>`, así que el
 *  drag-and-drop nativo se corta acá: sin esto, arrastrar sobre un nodo levanta el
 *  «fantasma» de imagen del navegador y mata el paneo a mitad del gesto. */
const frenarDragNativo = (e: React.DragEvent) => e.preventDefault();

/** La ruta que devuelve una URL firmada para MIRAR el archivo (no para bajarlo). El
 *  `?ws=` de la pestaña NO viaja solo en un `src`: el parche de fetch de la app pisa
 *  `window.fetch`, y un `<iframe>` no pasa por ahí. Por eso se lo pega a mano — sin
 *  esto, el super-admin mirando a un cliente recibe un 404 «Archivo no encontrado». */
function urlPreview(idNodo: string): string {
  const id = idNodo.slice(4);   // saca el prefijo 'doc:'
  const ws = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ws') : null;
  return `/api/onboarding/archivero/download?id=${encodeURIComponent(id)}&preview=1${ws ? `&ws=${encodeURIComponent(ws)}` : ''}`;
}

const esImagen = (mime?: string | null) => !!mime && mime.startsWith('image/');
/** Qué se puede mostrar de verdad adentro del navegador. Un .docx o un .xlsx bajan, no
 *  se previsualizan: ofrecer «Ver» sobre ellos abre un visor vacío. */
const sePuedeVer = (mime?: string | null) => esImagen(mime) || (!!mime && (mime.includes('pdf') || mime.startsWith('text/')));

/** FNV-1a, el mismo hash que usa la semilla del layout en el servidor: así el nodo
 *  flota con la misma fase en cada visita en vez de sortearla en cada carga. */
function hashDe(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function Grafo({ cerebro, onAbrirArea, onVerse, filtro, onFiltro: setFiltro, areaAbierta = null }: {
  cerebro: Cerebro;
  /** Qué área está abierta abajo, para marcarla en el navegador de la derecha. Antes acá
   *  entraba `areaResaltada`, que la prendía el cursor sobre una TARJETA del hub — y esas
   *  tarjetas ya no existen. Se fue con ellas el efecto que hacía re-renderizar el mapa
   *  entero en cada movimiento del mouse. */
  areaAbierta?: AreaId | null;
  /** Abre el área abajo, en la misma página. Es la costura entre las dos mitades de la
   *  pantalla. Si no se pasa, la tarjeta no ofrece la acción — nunca se promete un
   *  botón que no lleva a ningún lado. */
  /** @param saltar si además hay que traer la sección a la vista. Lo pide el botón
   *  «Abrir», que es una intención explícita de ir a editar; NO lo pide el click en un
   *  nodo, que abre la sección igual pero sin moverle la pantalla a nadie: uno toca un
   *  punto para leerlo, y que la página se vaya sola al formulario de abajo es perder
   *  de vista justo lo que se acaba de tocar. */
  onAbrirArea?: (area: AreaId | null, saltar?: boolean) => void;
  /** Qué se está viendo AHORA, para que el exportador pueda bajar exactamente eso.
   *  Se publica el RESULTADO (la lista de ids) y no los criterios: el filtro son tres
   *  dimensiones que se combinan más la búsqueda por texto y la de MaKo, y mandar los
   *  criterios obligaría a reimplementar el predicado del otro lado. Dos
   *  implementaciones de «qué se ve» divergen — este archivo ya pagó ese bug entre el
   *  contador y el dibujo. */
  onVerse?: (info: { ids: string[]; recortado: boolean }) => void;
  /** El filtro lo posee el padre. No es un capricho de arquitectura: el botón de
   *  exportar es HERMANO del mapa, y exportar y mirar tienen que ser el mismo recorte.
   *  Con el estado adentro del grafo, el exportador tenía que aprender su propio
   *  vocabulario de «qué me llevo», y el usuario dos sistemas para una sola idea. */
  filtro: EstadoFiltro;
  onFiltro: (f: EstadoFiltro | ((prev: EstadoFiltro) => EstadoFiltro)) => void;
}) {
  const { nodos, aristas, cuenta, posiciones, encuadre } = cerebro;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const vista = useRef<Vista>({ k: 1, x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  /** El rAF del vuelo de cámara. Vive acá arriba porque lo cortan el zoom y el paneo,
   *  que se declaran mucho antes que el vuelo. */
  const vueloRef = useRef<number | null>(null);
  const cortarVuelo = useCallback(() => {
    if (vueloRef.current != null) { cancelAnimationFrame(vueloRef.current); vueloRef.current = null; }
  }, []);

  const [kPaso, setKPaso] = useState(1);
  const [zoomPct, setZoomPct] = useState(100);
  // El zoom que hace entrar el mapa entero, en ESTADO además de en el ref de más abajo:
  // el render lo necesita para decidir el fade de las etiquetas, y un ref no re-renderiza.
  const [kFitEstado, setKFitEstado] = useState(1);
  // Unidades de mundo por píxel. Lo necesitan el tamaño de la etiqueta y el descarte por
  // colisión, y depende del LIENZO, no del zoom.
  const [uEstado, setUEstado] = useState(1);
  const [activo, setActivo] = useState<string | null>(null);
  const [fijado, setFijado] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  /** Dónde busca. Por defecto en el nombre, que es lo que se ve dibujado en el mapa; el
   *  contenido y la procedencia se prenden a mano porque encuentran mucho más y a veces
   *  eso es ruido. */
  const [campos, setCampos] = useState<CampoCerebro[]>(CAMPOS_CEREBRO_DEFECTO);
  const [ia, setIa] = useState<EstadoIA>({ pensando: false, ids: null, explico: '' });
  const [verTodas, setVerTodas] = useState(false);
  const [textoEntero, setTextoEntero] = useState(false);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);
  /** El documento que se está previsualizando sobre el lienzo, o null. */
  const [verDoc, setVerDoc] = useState<NodoCerebro | null>(null);
  /**
   * EL FILTRO. Tres dimensiones que se COMBINAN —carpeta, sección y quién lo
   * escribió—, con AND entre ellas y OR adentro de cada una. Es la misma semántica
   * del tablero (`passes` en app/plan/board/BoardShell.tsx:390).
   *
   * La versión anterior era UNA cadena con prefijo y un solo valor a la vez, con el
   * argumento de que «no hay estados imposibles que sanear». Era cierto y era el
   * problema: hacía imposible también el estado que uno más quiere —«de lo que
   * dedujo MaKo, qué hay en Oferta»— y obligaba a elegir cuál de las dos preguntas
   * contestaba el mapa.
   *
   * `Set` vacío significa TODOS, no «ninguno»: así el estado inicial y el estado
   * limpio son el mismo objeto y no hay forma de dejar la pantalla en blanco sin
   * haberlo pedido.
   */
  const [filtroAbierto, setFiltroAbierto] = useState<PanelAbierto>(null);

  /**
   * EL ANCHO DEL PANEL, arrastrable. Los topes NO son un detalle: sin ellos se puede
   * dejar el lienzo en 200 px, y ahí el layout del grafo —que se calcula en el
   * servidor sobre un encuadre cuadrado— se dibuja tan chico que el mapa deja de ser
   * legible y no hay forma obvia de volver. El mínimo del MAPA es lo que manda; el
   * máximo del panel es lo que sobre.
   */
  const [anchoCol, setAnchoCol] = useState(400);
  const arrastreCol = useRef<{ x0: number; ancho0: number } | null>(null);
  const COL_MIN = 300;
  const COL_MAX = 620;
  const MAPA_MIN = 460;

  const acotarCol = useCallback((px: number) => {
    const total = marcoRef.current?.getBoundingClientRect().width ?? 1200;
    return Math.max(COL_MIN, Math.min(COL_MAX, Math.min(px, total - MAPA_MIN)));
  }, []);

  const tirarCol = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastreCol.current = { x0: e.clientX, ancho0: anchoCol };
  };
  const moverCol = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrastreCol.current;
    if (!a) return;
    // Se ensancha arrastrando hacia la IZQUIERDA: el panel crece comiéndole al mapa.
    setAnchoCol(acotarCol(a.ancho0 + (a.x0 - e.clientX)));
  };
  const soltarCol = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastreCol.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const hayFiltro = cuentaFiltros(filtro) > 0;


  const porId = useMemo(() => new Map(nodos.map((n) => [n.id, n])), [nodos]);

  const grados = useMemo(() => {
    const g: Record<string, number> = {};
    for (const n of nodos) g[n.id] = 0;
    for (const a of aristas) { if (a.de in g) g[a.de]++; if (a.a in g) g[a.a]++; }
    return g;
  }, [nodos, aristas]);

  const vecinos = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => { const s = m.get(a) ?? new Set<string>(); s.add(b); m.set(a, s); };
    for (const e of aristas) { add(e.de, e.a); add(e.a, e.de); }
    return m;
  }, [aristas]);

  /** El nodo RESALTADO en el mapa: el fijado, o el que está debajo del cursor. */
  const sel = fijado ?? activo;
  /**
   * El nodo que muestra la COLUMNA de la derecha: solo el fijado.
   *
   * ⚠️ Antes era `sel`, o sea que también el hover. Eso tenía sentido cuando la tarjeta
   * FLOTABA sobre el lienzo y desaparecía sola; ahora que vive afuera, en una columna
   * fija que además comparte lugar con el navegador de áreas, seguir al cursor hace que
   * cruzar el mapa con el mouse cambie la columna entera cinco veces por segundo. Se
   * mira tocando, que es lo que ya hacía falta para actuar sobre el nodo.
   */
  const nodoSel = fijado ? porId.get(fijado) ?? null : null;
  // Se reinician con CADA cambio de nodo, no solo cuando se llega volando: pasar el
  // cursor por otro punto también cambia el panel, y sin esto el nuevo aparecía con el
  // «Leer todo» ya desplegado del anterior.
  useEffect(() => { setTextoEntero(false); setVerTodas(false); }, [sel]);
  const cerca = useMemo(() => (sel ? new Set([sel, ...(vecinos.get(sel) ?? [])]) : null), [sel, vecinos]);

  // El fade de etiquetas de Obsidian: clamp(log2(zoom) + 1, 0, 1), pero con el zoom
  // RELATIVO AL ENCUADRE y no absoluto. Antes se medía contra k=1, que era el zoom de
  // arranque cuando el mapa entraba por `preserveAspectRatio`; ahora el mapa arranca en
  // el k que lo hace entrar, y ese k depende de cuántos nodos tenga el workspace. Con
  // la fórmula vieja, dos clientes con el mismo zoom aparente veían distinta cantidad
  // de texto sin ninguna razón.
  //
  // ⚠️ PENDIENTE, y no se arregla bajando la opacidad: en el racimo más denso las
  // etiquetas SE PISAN entre sí. Atenuarlas todas las hace más difíciles de leer sin
  // resolver el solape. La salida real es no dibujar la etiqueta cuando su caja choca
  // con otra ya dibujada, que es trabajo aparte.
  // ⚠️ EL FADE DE OBSIDIAN (clamp(log2(zoom)+1)) SE FUE, y conviene saber por qué para
  // no reponerlo: hacía el mismo trabajo que la regla de NIVEL pero peor. Los dos decidían
  // qué etiqueta se ve según el zoom, y superpuestos se anulaban — el fade apagaba TODO
  // por debajo del encuadre, incluidas las carpetas madre, que son justamente las que el
  // dueño pidió que no desaparezcan nunca. La regla de nivel dice lo mismo con una
  // jerarquía real detrás.

  /** ¿Este nodo pasa el filtro? La raíz pasa siempre: es el centro del mapa y sacarla
   *  deja las áreas colgando de la nada.
   *
   *  Los nodos de ÁREA y de CARPETA pasan siempre cuando se filtra por AUTORÍA (son el
   *  andamiaje: apagarlos deja las etiquetas flotando sin racimo) pero NO cuando se
   *  filtra por carpeta o por sección — ahí justamente lo que se pide es quedarse con
   *  una rama, y dejar el andamiaje de las otras dibujado sería no haber filtrado. */
  /** El predicado vive en lib/cerebro-filtro.ts: lo comparten el mapa y el exportador.
   *  Dos ideas de «qué se ve» divergen, y acá el costo es que el ZIP traiga algo
   *  distinto de lo que la pantalla mostró. */
  const pasaVer = useCallback((n: NodoCerebro) => pasaFiltro(n, filtro), [filtro]);


  // Refs para que `visible()` no cambie de identidad en cada tecla: lo consumen el
  // dibujo de las aristas y el descarte de etiquetas.
  const buscaRef = useRef('');
  const iaRef = useRef<boolean>(false);
  const idsResultadoRef = useRef<Set<string>>(new Set());

  /**
   * ¿Este nodo pasa TODOS los filtros? Es la ÚNICA función que lo decide, y de acá salen
   * las tres cosas que se dibujan: el nodo, sus aristas y su etiqueta.
   *
   * ⚠️ Antes había tres criterios distintos y el de las ARISTAS ignoraba dos filtros.
   * Medido con «los escribiste tú» puesto: 47 de 67 nodos se atenuaban… y las 119 líneas
   * y las 49 etiquetas seguían a opacidad plena. O sea que filtrar apagaba los puntos y
   * dejaba intacta la telaraña, que es el 70% de la tinta de la pantalla — por eso «no
   * parecía filtrar».
   */
  const visible = useCallback((n: NodoCerebro): boolean => {
    if (!pasaVer(n)) return false;
    // Con MaKo la lista manda aunque el texto no matchee nada por letras: es justamente
    // el caso que la búsqueda por texto no cubre.
    if ((buscaRef.current.trim() !== '' || iaRef.current) && !idsResultadoRef.current.has(n.id)) return false;
    return true;
  }, [pasaVer]);

  // ── QUÉ ETIQUETAS SE DIBUJAN ───────────────────────────────────────────────
  // Con el tamaño arreglado, el texto pasa de 4,32 px ilegibles a 12 px reales — y ahí
  // aparece el problema que estaba TAPADO: medido, 17 pares de cajas se pisan (43% de
  // las etiquetas). Por eso los dos cambios van juntos; el del tamaño solo deja la
  // pantalla peor que antes.
  //
  // Se descartan por COLISIÓN, en orden de grado descendente: el nodo más conectado gana
  // su etiqueta y el que llega después la cede. Es lo que hace Obsidian, y tiene la
  // propiedad que importa: al ACERCARSE los nodos se separan en pantalla, las cajas
  // dejan de chocar y las etiquetas aparecen solas. O sea que acercarse por fin sirve.
  //
  // ⚠️ Por render CONDICIONAL, nunca con `opacity: 0`: este documento ya midió que un
  // nodo invisible cuesta lo mismo que uno dibujado.
  /** Los nodos que hay que RENDERIZAR: los que pasan el filtro más los que se están
   *  yendo. Es la lista que recorre el dibujo; `visible()` decide cuáles de esos están
   *  de verdad adentro. */
  /** Los ids que pasan el filtro AHORA.
   *  ⚠️ `campos` e `ia.ids` van en las deps aunque `visible()` los lea por ref: sin
   *  ellos, ampliar la búsqueda a «todo» actualizaba el contador a 14 y el mapa seguía
   *  mostrando 5. El contador y el dibujo tienen que salir del mismo cálculo. */
  const visiblesIds = useMemo(() => {
    const s = new Set<string>();
    for (const n of nodos) if (visible(n)) s.add(n.id);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodos, visible, filtro, busca, campos, ia.ids]);

  // ── QUIÉN ESTÁ SALIENDO ────────────────────────────────────────────────────
  // Un nodo filtrado no puede desaparecer de golpe: hace la animación de entrada al
  // revés y RECIÉN AHÍ se desmonta. Mientras dura sigue montado con la clase `cbg-fuera`.
  //
  // ⚠️ ESTO SE CALCULA DURANTE EL RENDER, NO EN UN useEffect, y las dos cosas importan.
  // La versión con efecto tenía dos fallas que juntas daban el síntoma «no desaparecen,
  // se bugean»:
  //
  //   1. UN FRAME DE MÁS. Un `useEffect` corre DESPUÉS de pintar. En el render del
  //      cambio de filtro, `saliendo` todavía era el valor viejo, así que los nodos que
  //      se iban ya no estaban montados: se pintaba un frame SIN ellos, el efecto los
  //      volvía a meter, y recién ahí empezaba el fade. Se veía desaparecer de golpe,
  //      reaparecer y recién ahí desvanecerse.
  //   2. SALÍAN TODOS, NO LOS QUE SE IBAN. El efecto ponía en `saliendo` a **todos** los
  //      nodos invisibles, no a los que acababan de dejar de serlo. Con el filtro puesto
  //      y cualquier tecla en el buscador, los ~50 nodos escondidos se montaban de nuevo
  //      para volver a desvanecerse. Eso es el parpadeo.
  //
  // El patrón es el de React para estado derivado: `setState` durante el render descarta
  // el render en curso y vuelve a correr ANTES de pintar, así que no hay frame
  // intermedio. `previos` es el conjunto del último render COMMITEADO, que es lo único
  // contra lo que tiene sentido comparar para saber quién se fue.
  const [transicion, setTransicion] = useState<{ previos: Set<string>; saliendo: Set<string> }>(
    () => ({ previos: new Set<string>(), saliendo: new Set<string>() }),
  );
  const mismosIds = (a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    for (const id of a) if (!b.has(id)) return false;
    return true;
  };
  if (!mismosIds(transicion.previos, visiblesIds)) {
    const sal = new Set<string>();
    for (const id of transicion.previos) if (!visiblesIds.has(id)) sal.add(id);
    setTransicion({ previos: visiblesIds, saliendo: sal });
  }
  const saliendo = transicion.saliendo;

  const montados = useMemo(
    () => nodos.filter((n) => visiblesIds.has(n.id) || saliendo.has(n.id)),
    [nodos, visiblesIds, saliendo],
  );

  /** Los nodos que son un DATO, no andamio. La raíz, las carpetas y los nodos de área
   *  existen para sostener el dibujo y pasan el filtro casi siempre; contarlos rompe las
   *  dos cosas que se apoyan en este número:
   *   · el «N de M» daba 66 cuando la barra dice «56 datos» — dos números para lo mismo;
   *   · el estado vacío NO APARECÍA NUNCA, porque con la raíz siempre adentro el mínimo
   *     alcanzable era 1. Medido: filtrando por una sección vacía quedaba el nodo raíz
   *     solo en el lienzo, sin un mensaje que dijera qué pasó.
   */
  const esDato = (n: NodoCerebro) => n.id !== 'raiz' && !n.id.startsWith('area:') && !n.id.startsWith('n1:');
  const datosTotal = useMemo(() => nodos.filter(esDato).length, [nodos]);
  const datosVisibles = useMemo(() => montados.filter(esDato).length, [montados]);

  // Publica hacia arriba lo que se está viendo. El callback va por ref para que un
  // padre que lo redefine en cada render no dispare el efecto en cada render.
  const onVerseRef = useRef(onVerse);
  onVerseRef.current = onVerse;
  const recortado = hayFiltro || busca.trim() !== '' || ia.ids !== null;
  useEffect(() => {
    onVerseRef.current?.({ ids: [...visiblesIds], recortado });
  }, [visiblesIds, recortado]);

  // Terminada la salida, se desmontan. El `t.saliendo === saliendo` es lo que hace que un
  // segundo cambio de filtro a mitad de camino no lo pise: si ya hay otra tanda saliendo,
  // este temporizador viejo no tiene nada que limpiar.
  useEffect(() => {
    if (!saliendo.size) return;
    const t = window.setTimeout(
      () => setTransicion((prev) => (prev.saliendo === saliendo ? { ...prev, saliendo: new Set<string>() } : prev)),
      MS_SALIDA,
    );
    return () => window.clearTimeout(t);
  }, [saliendo]);

  const etiquetasVisibles = useMemo(() => {
    const alto = (12 * uEstado) / kPaso;          // la caja, en unidades locales del <g>
    const cajas: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    const ok = new Set<string>();
    // ── EL ZOOM MANDA POR NIVEL ─────────────────────────────────────────────
    // Es la lógica de carpetas: de lejos se leen las cinco madre, al acercarse aparecen
    // las áreas, y más cerca los datos. La carpeta madre NUNCA pierde su título — es lo
    // único que orienta cuando el mapa entero entra en la pantalla.
    // El zoom REAL, no el cuantizado. `kPaso` se redondea a cuartos para el fade viejo,
    // y con eso los umbrales de nivel daban saltos: al encuadre podía caer del lado
    // equivocado y el mapa arrancaba con 13 nombres de 72.
    const z = zoomPct / 100;
    const nivelDe = (id: string) => (id.startsWith('n1:') ? 1 : id.startsWith('area:') || id === 'raiz' ? 2 : 3);
    const entraPorNivel = (id: string) => {
      const n = nivelDe(id);
      if (n === 1) return true;         // siempre
      // El encuadre (z = 1) es el estado NORMAL, no «lejos»: ahí se ve todo lo que
      // entra por colisión. Los umbrales están para cuando el usuario se ALEJA, que es
      // lo que pidió — «si haces zoom out vayan desapareciendo títulos y queden los más
      // importantes». Con el umbral en 1,35 el nivel 3 no aparecía nunca al encuadre y
      // el mapa arrancaba con 13 nombres de 72.
      if (n === 2) return z >= 0.5;     // se van al alejarse a la mitad
      return z >= 0.92;                 // los datos, apenas uno se aleja
    };
    // Sobre los que PASAN el filtro, no sobre todos: antes una etiqueta que había
    // perdido su caja contra un nodo filtrado seguía sin dibujarse. Al filtrar tiene que
    // pasar lo contrario — se libera espacio y aparecen más nombres.
    const orden = nodos.filter((n) => entraPorNivel(n.id) && visible(n)).sort((a, b) => {
      const d = (grados[b.id] ?? 0) - (grados[a.id] ?? 0);
      return d !== 0 ? d : a.id < b.id ? -1 : 1;   // desempate estable
    });
    for (const n of orden) {
      const p = posiciones[n.id];
      if (!p) continue;
      // Los factores salen de MEDIR la caja real en el navegador, no de estimarlos: el
      // alto renderizado de una etiqueta de 12 px es 16 px (la caja incluye el
      // interlineado), o sea 1,33 — con el 1,15 que tenía puesto quedaban 10 pares
      // pisados. Se le suma un margen: dos etiquetas que se tocan justo se leen igual de
      // mal que dos que se pisan.
      const ancho = Math.min(n.etiqueta.length, 34) * alto * 0.58 + alto * 0.6;
      const y0 = p.y + radioNodo(grados[n.id] ?? 0) + 6 / Math.sqrt(kPaso);
      const c = { x0: p.x - ancho / 2, x1: p.x + ancho / 2, y0: y0 - alto * 0.2, y1: y0 + alto * 1.55 };
      if (cajas.some((b) => c.x0 < b.x1 && c.x1 > b.x0 && c.y0 < b.y1 && c.y1 > b.y0)) continue;
      // ⚠️ Y TAMPOCO PUEDE TAPAR EL PUNTO DE OTRO NODO. Esto no importaba mientras la
      // etiqueta era decorativa; desde que es CLICABLE, una que cae encima del círculo
      // del vecino le roba el click y abre un dato que nadie quiso abrir — que es
      // exactamente lo que el dueño pidió evitar. Se descarta la etiqueta, no el nodo:
      // perder un nombre es barato, un click que abre otra cosa no.
      const tapaUnPunto = orden.some((otro) => {
        if (otro.id === n.id) return false;
        const q = posiciones[otro.id];
        if (!q) return false;
        const r = radioNodo(grados[otro.id] ?? 0);
        return q.x + r > c.x0 && q.x - r < c.x1 && q.y + r > c.y0 && q.y - r < c.y1;
      });
      if (tapaUnPunto) continue;
      cajas.push(c);
      ok.add(n.id);
    }
    return ok;
  }, [nodos, posiciones, grados, kPaso, uEstado, zoomPct, visible, filtro, busca, campos, ia.ids]);

  const radioMundo = useCallback((n: NodoCerebro) => radioNodo(grados[n.id] ?? 0), [grados]);
  const kr = Math.sqrt(kPaso);
  const radioDe = (n: NodoCerebro) => radioMundo(n) / kr;

  // ── El orden de entrada: por GRADO, no por índice del array ────────────────
  // Así el mapa se arma de adentro hacia afuera —la raíz y las áreas primero, las
  // hojas al final— y el ojo entiende la estructura antes de que llegue el detalle.
  // Por índice del array el orden no significaba nada.
  //
  // ⚠️ Y se rankea sobre lo que está MONTADO, no sobre el mapa entero. El puesto se usa
  // como retardo (12 ms cada uno), así que con el ranking global un filtro que deja 8
  // nodos podía darle al último el puesto 55 del mapa: 660 ms mirando un lienzo vacío
  // antes de que apareciera. Rankeando sobre lo montado, ocho nodos terminan de entrar
  // en 84 ms y el mapa completo conserva su cascada de siempre.
  const ordenEntrada = useMemo(() => {
    const orden = [...montados].sort((a, b) => {
      const d = (grados[b.id] ?? 0) - (grados[a.id] ?? 0);
      return d !== 0 ? d : a.id < b.id ? -1 : 1;   // desempate estable
    });
    return new Map(orden.map((n, i) => [n.id, i]));
  }, [montados, grados]);

  // ── Color ──────────────────────────────────────────────────────────────────
  // Precedencia, de arriba abajo, el primero que matchea gana. Es la de Obsidian:
  // el color de grupo gana contra el tipo pero nunca tapa un estado interactivo.
  const rellenoDe = (n: NodoCerebro): string => {
    if (n.id === 'raiz') return 'var(--ink)';
    if (n.alerta) return 'var(--warn-fill)';
    if (n.destacado) return 'var(--mako)';
    return colorArea(n.area);
    return 'var(--dim)';
  };



  const opacidadDe = (n: NodoCerebro): number => {
    const base = n.autoria === 'pendiente' ? PENDIENTE : 1;
    if (n.id === 'raiz') return base;
    // El filtro ATENÚA, nunca desmonta: el mapa tiene que seguir siendo el mismo mapa
    // con una parte encendida, o se pierde la referencia de dónde estaba cada cosa.
    if (!pasaVer(n)) return ATENUADO * 0.5;
    // Buscar ATENÚA en vivo, igual que el filtro: se ve dónde están los resultados
    // dentro del mapa, que es la mitad de para qué sirve buscar en un grafo.
    if (busca.trim() !== '' && !idsResultado.has(n.id)) return ATENUADO * 0.5;
    if (cerca) return cerca.has(n.id) ? base : ATENUADO;
    if (areaFoco) return n.area === areaFoco ? base : ATENUADO;
    return base;
  };

  // ── Física viva (solo durante un gesto) ────────────────────────────────────
  const simRef = useRef<Simulacion | null>(null);
  const nodoRefs = useRef(new Map<string, SVGGElement | null>());
  const aristaRefs = useRef(new Map<number, SVGLineElement | null>());
  const arrastrando = useRef<string | null>(null);

  /** La posición BASE de cada nodo: la del servidor, o la que mueve la física mientras
   *  dura un arrastre. Encima de esto se suman los desplazamientos de animación. */
  const baseRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const t0 = useRef(0);
  const animRef = useRef<number | null>(null);

  /** Escribe TODO en el DOM: los nodos y los extremos de cada arista. NO pasa por React
   *  —un setState por frame durante un arrastre son 60 renders de 50 nodos— y sobre todo
   *  es UN SOLO lugar.
   *
   *  ⚠️ POR QUÉ ACÁ Y NO EN CSS. La flotación y la entrada vivían como animaciones CSS
   *  sobre grupos anidados. Funcionaban para los nodos y dejaban las ARISTAS clavadas:
   *  una línea es un <line> con cuatro coordenadas y no tiene forma de enterarse de que
   *  el `transform` de un grupo movió sus puntas. Se veían líneas colgando en el aire
   *  durante la entrada, y sin seguir a los nodos mientras flotaban. La única forma de
   *  que las líneas acompañen es que el mismo bucle que mueve los nodos recalcule sus
   *  extremos — o sea, que la animación sea JS y no CSS. */
  const pintar = useCallback((tMs: number) => {
    const base = baseRef.current;
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of nodos) {
      const b = base.get(n.id) ?? posiciones[n.id];
      if (!b) continue;
      const h = hashDe(n.id);
      // FLOTACIÓN: dos senoides de períodos que no son múltiplos entre sí, con fase
      // derivada del hash del id — el nodo flota igual en cada visita.
      const fx = FLOTE * Math.sin((tMs / 7100) * Math.PI * 2 + (h % 6283) / 1000);
      const fy = FLOTE * Math.sin((tMs / 11300) * Math.PI * 2 + ((h >>> 7) % 6283) / 1000);
      // ENTRADA: nace desplazado hacia afuera y el desvío decae hasta cero.
      const demora = Math.min((ordenEntrada.get(n.id) ?? 0) * 12, 700);
      const u = Math.min(1, Math.max(0, (tMs - demora) / 900));
      // Lo que QUEDA del desvío: 1 al empezar, 0 al llegar, con desaceleración larga.
      const resto = (1 - u) ** 3;
      const d = Math.hypot(b.x, b.y) || 1;
      const lejos = (260 + (h % 220)) * resto;
      pos.set(n.id, { x: b.x + fx + (b.x / d) * lejos, y: b.y + fy + (b.y / d) * lejos });
    }
    for (const [id, g] of nodoRefs.current) {
      const f = pos.get(id);
      if (g && f) g.setAttribute('transform', `translate(${f.x.toFixed(2)} ${f.y.toFixed(2)})`);
    }
    aristas.forEach((e, i) => {
      const l = aristaRefs.current.get(i);
      const a = pos.get(e.de);
      const b = pos.get(e.a);
      const na = porId.get(e.a);
      const nb = porId.get(e.de);
      if (!l || !a || !b || !na || !nb) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const ra = radioMundo(nb);
      const rb = radioMundo(na);
      l.setAttribute('x1', (a.x + (dx / d) * ra).toFixed(2));
      l.setAttribute('y1', (a.y + (dy / d) * ra).toFixed(2));
      l.setAttribute('x2', (b.x - (dx / d) * rb).toFixed(2));
      l.setAttribute('y2', (b.y - (dy / d) * rb).toFixed(2));
    });
  }, [aristas, porId, radioMundo, nodos, posiciones, ordenEntrada]);

  // El bucle. Corre siempre salvo que el usuario pida movimiento reducido, en cuyo caso
  // se pinta UNA vez en las posiciones finales y no se enciende nada.
  useEffect(() => {
    baseRef.current = new Map(Object.entries(posiciones));
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { pintar(99_999); return; }
    t0.current = performance.now();
    const latir = () => { pintar(performance.now() - t0.current); animRef.current = requestAnimationFrame(latir); };
    animRef.current = requestAnimationFrame(latir);
    return () => { if (animRef.current != null) cancelAnimationFrame(animRef.current); animRef.current = null; };
  }, [posiciones, pintar]);

  useEffect(() => () => { simRef.current?.destruir(); simRef.current = null; }, []);
  useEffect(() => cortarVuelo, [cortarVuelo]);

  /** Carga d3-force la primera vez que hace falta y nada más. */
  const asegurarSim = useCallback(async (): Promise<Simulacion | null> => {
    if (simRef.current) return simRef.current;
    const { crearSimulacion } = await import('./fisica');
    if (simRef.current) return simRef.current;   // por si dos gestos entraron a la vez
    const radios = Object.fromEntries(nodos.map((n) => [n.id, radioMundo(n)]));
    simRef.current = await crearSimulacion(posiciones, radios, (fisicos: NodoFisico[]) => {
      // La física NO dibuja: mueve la base y el bucle de arriba se encarga. Si dibujara
      // ella también, habría dos escritores del mismo atributo peleándose por frame.
      for (const f of fisicos) baseRef.current.set(f.id, { x: f.x, y: f.y });
    });
    return simRef.current;
  }, [posiciones, nodos, radioMundo]);

  // ── Zoom y paneo ───────────────────────────────────────────────────────────
  const aplicar = useCallback(() => {
    rafRef.current = null;
    const g = gRef.current;
    if (!g) return;
    const v = vista.current;
    g.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    g.style.setProperty('--k', String(v.k));
    const paso = Math.round(v.k * 4) / 4;
    setKPaso((prev) => (prev === paso ? prev : paso));
    // El porcentaje sale del zoom REAL, no del `kPaso` cuantizado a cuartos: con el
    // cuantizado, el mapa recién encuadrado marcaba «89%» sin que nadie hubiera tocado
    // nada, que se lee como que arranca mal puesto. 100% = el encuadre.
    const pct = kFit.current ? Math.round((v.k / kFit.current) * 100) : 100;
    setZoomPct((prev) => (prev === pct ? prev : pct));
  }, []);

  const pedirPintado = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(aplicar);
  }, [aplicar]);

  /** Un punto de pantalla a coordenadas del viewBox. `getScreenCTM` fuerza layout:
   *  se llama por gesto, no por frame. */
  const aMundo = useCallback((cx: number, cy: number): Punto | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    const q = p.matrixTransform(ctm.inverse());
    return { x: q.x, y: q.y };
  }, []);

  /** Del viewBox al mundo, deshaciendo el zoom/paneo. */
  const aMundoReal = useCallback((cx: number, cy: number): Punto | null => {
    const p = aMundo(cx, cy);
    if (!p) return null;
    const v = vista.current;
    return { x: (p.x - v.x) / v.k, y: (p.y - v.y) / v.k };
  }, [aMundo]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = aMundo(e.clientX, e.clientY);
      if (!pt) return;
      const unidad = e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002;
      cortarVuelo();
      const factor = Math.pow(2, -e.deltaY * unidad * (e.ctrlKey ? 10 : 1));
      const v = vista.current;
      const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, v.k * factor));
      const mx = (pt.x - v.x) / v.k;
      const my = (pt.y - v.y) / v.k;
      vista.current = { k, x: pt.x - mx * k, y: pt.y - my * k };
      tocoElZoom.current = true;
      pedirPintado();
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [aMundo, pedirPintado, cortarVuelo]);

  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const arrastre = useRef<{ x0: number; y0: number; vx: number; vy: number; movido: boolean } | null>(null);
  const pellizco = useRef<{ d0: number; k0: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // La captura va sobre el SVG, NO sobre `e.target`. Si se captura sobre el
    // `<circle>` que se tocó, el primer re-render de React lo reemplaza y la captura
    // se pierde a mitad del gesto: el paneo se corta solo.
    cortarVuelo();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const v = vista.current;
      arrastre.current = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, movido: false };
    } else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      pellizco.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: vista.current.k };
      arrastre.current = null;
      arrastrando.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pellizco.current && punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const medio = aMundo((a.x + b.x) / 2, (a.y + b.y) / 2);
      if (!medio) return;
      const v = vista.current;
      const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, pellizco.current.k0 * (d / pellizco.current.d0)));
      const mx = (medio.x - v.x) / v.k;
      const my = (medio.y - v.y) / v.k;
      vista.current = { k, x: medio.x - mx * k, y: medio.y - my * k };
      tocoElZoom.current = true;
      pedirPintado();
      return;
    }

    const arr = arrastre.current;
    if (!arr) return;
    const dx = e.clientX - arr.x0;
    const dy = e.clientY - arr.y0;
    if (!arr.movido && dx * dx + dy * dy <= ARRASTRE2) return;
    arr.movido = true;

    // Si el gesto empezó sobre un nodo, se arrastra el NODO. Si no, se panea el mapa.
    if (arrastrando.current) {
      const p = aMundoReal(e.clientX, e.clientY);
      if (p) simRef.current?.mover(p.x, p.y);
      return;
    }
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    // ⚠️ `min(ancho, alto)` y NO `width`. El viewBox es CUADRADO y el svg lo mete con
    // `xMidYMid meet`, o sea que la escala real la fija el lado CHICO de la caja. Con
    // `width` el mapa se arrastraba al 75% de la velocidad del dedo en un lienzo 4:3, y
    // al 40% en uno apaisado. La rueda y el pellizco no tenían el bug: pasan por
    // `aMundo()`, que usa la matriz real del SVG.
    const escala = encuadre.lado / Math.min(caja.width, caja.height);
    vista.current = { ...vista.current, x: arr.vx + dx * escala, y: arr.vy + dy * escala };
    pedirPintado();
  };

  const soltar = (e: React.PointerEvent<SVGSVGElement>) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) {
      const quieto = arrastre.current && !arrastre.current.movido;
      const sobreNodo = arrastrando.current;
      if (sobreNodo) simRef.current?.soltar();
      // ⚠️ El clic se resuelve ACÁ y no con un onClick en el nodo. `setPointerCapture`
      // RETARGETEA todos los eventos siguientes al elemento que capturó —el <svg>—,
      // así que el `click` nunca llega al <circle> y el onClick del nodo no dispara.
      // Es lo que rompió poder fijar un nodo para leer su detalle.
      if (quieto) {
        // Clic sobre un nodo: si ya estaba fijado se suelta; si no, se vuela hasta él.
        // Clic en el fondo: se suelta.
        if (sobreNodo && fijado !== sobreNodo) irA(sobreNodo);
        else soltarNodo();
      }
      arrastrando.current = null;
      arrastre.current = null;
    }
  };

  const agarrarNodo = (id: string) => (e: React.PointerEvent) => {
    // ⚠️ SIN `stopPropagation`. Es lo que rompía el arrastre entero: cortaba la
    // burbuja antes de que el `onPointerDown` del <svg> registrara el puntero, así
    // que `onPointerMove` salía por la guarda de `punteros` y no se movía nada.
    // El orden de React ya es el correcto — el nodo dispara ANTES que el lienzo —,
    // así que cuando el <svg> arma el gesto, `arrastrando` ya está puesto.
    arrastrando.current = id;
    const p = aMundoReal(e.clientX, e.clientY);
    void asegurarSim().then((s) => {
      if (arrastrando.current === id && p) s?.agarrar(id, p.x, p.y);
    });
  };


  const areaDe = (id: AreaId) => AREAS.find((a) => a.id === id)!;

  /** Cuántos datos REALES tiene cada sección. No cuenta el nodo de la propia área ni los
   *  pendientes: un «3 datos» que incluye lo que falta miente sobre lo que hay. */
  const porArea = useMemo(() => {
    const c: Partial<Record<AreaId, number>> = {};
    for (const n of nodos) {
      if (n.id === 'raiz' || n.id.startsWith('area:') || n.id.startsWith('n1:') || n.autoria === 'pendiente') continue;
      c[n.area] = (c[n.area] ?? 0) + 1;
    }
    return c;
  }, [nodos]);

  /** El área «en foco» no es un estado propio: ES el filtro cuando hay UNA sección
   *  elegida. Con dos o más no hay foco — atenuar «todo menos estas tres» no dice nada
   *  que el propio filtro no diga ya escondiéndolas. */
  const areaFoco: AreaId | null = filtro.areas.size === 1 ? [...filtro.areas][0] : null;

  /** Los dos nodos con significado propio: el Norte (dorado) y el cuello de botella
   *  (naranja). El lienzo los pintaba distinto y no los explicaba en ningún lado. */
  const destacado = useMemo(() => nodos.find((n) => n.destacado) ?? null, [nodos]);
  const alerta = useMemo(() => nodos.find((n) => n.alerta) ?? null, [nodos]);

  /** Los accesos directos del «Ir a». No es una lista escrita a mano: sale de lo que el
   *  mapa YA sabe — los dos nodos con significado propio primero, y después el nodo más
   *  conectado de cada área, que es el que resume esa parte del negocio. */
  const accesos = useMemo(() => {
    const out: Array<{ value: string; label: string }> = [];
    const norte = nodos.find((n) => n.destacado);
    const cuello = nodos.find((n) => n.alerta);
    if (norte) out.push({ value: norte.id, label: `Tu Norte · ${norte.etiqueta}` });
    if (cuello) out.push({ value: cuello.id, label: `Tu cuello de botella · ${cuello.etiqueta}` });
    for (const a of AREAS) {
      const dentro = nodos.filter((n) => n.area === a.id && !n.id.startsWith('area:') && n.id !== 'raiz' && n.autoria !== 'pendiente');
      if (!dentro.length) continue;
      const mejor = dentro.reduce((x, y) => ((grados[y.id] ?? 0) > (grados[x.id] ?? 0) ? y : x));
      if (mejor.id === norte?.id || mejor.id === cuello?.id) continue;
      out.push({ value: mejor.id, label: `${a.nombre} · ${mejor.etiqueta}` });
    }
    return out;
  }, [nodos, grados]);

  /** Los nodos que matchean, ordenados por grado: el más conectado primero, que es el
   *  que más probablemente se estaba buscando. */
  const resultados = useMemo(() => {
    // Con MaKo, la lista la eligió el modelo y se respeta SU orden: lo pusimos a ordenar
    // «del que más responde al que menos» y reordenarlo por grado acá tiraría eso.
    if (ia.ids) {
      const pos = new Map(ia.ids.map((id, i) => [id, i]));
      return nodos.filter((n) => pos.has(n.id)).sort((a, b) => (pos.get(a.id)! - pos.get(b.id)!));
    }
    const q = busca.trim();
    if (!q) return [] as NodoCerebro[];
    return nodos
      .filter((n) => matchNodo(n, q, campos))
      .sort((a, b) => (grados[b.id] ?? 0) - (grados[a.id] ?? 0));
  }, [busca, nodos, grados, campos, ia.ids]);

  /** Le pide a MaKo que lea el mapa. El resultado son IDS, no texto: el modelo elige y el
   *  filtro sigue siendo el mismo de siempre. */
  const buscarConIA = useCallback(async (texto: string) => {
    setIa({ pensando: true, ids: null, explico: '' });
    try {
      const r = await fetch('/api/second-brain/buscar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texto }), signal: AbortSignal.timeout(60_000),
      });
      const j = await r.json();
      setIa({ pensando: false, ids: Array.isArray(j?.ids) ? j.ids : [], explico: String(j?.explico ?? '') });
    } catch {
      setIa({ pensando: false, ids: [], explico: 'No se pudo consultar a MaKo.' });
    }
  }, []);
  const primerMatch = resultados[0] ?? null;
  const idsResultado = useMemo(() => new Set(resultados.map((n) => n.id)), [resultados]);
  buscaRef.current = busca;
  iaRef.current = ia.ids !== null;
  idsResultadoRef.current = idsResultado;
  /** Por dónde va el ciclo del Enter. Se reinicia con cada búsqueda nueva. */
  const cursorBusca = useRef(0);
  useEffect(() => { cursorBusca.current = 0; }, [busca, campos, ia.ids]);

  /** Los vecinos del nodo fijado CON su motivo. El motivo ya venía calculado en cada
   *  arista y no lo leía nadie. */
  const conexiones = useMemo(() => {
    if (!fijado) return [];
    const out: Array<{ nodo: NodoCerebro; motivo?: string }> = [];
    for (const e of aristas) {
      const otro = e.de === fijado ? e.a : e.a === fijado ? e.de : null;
      if (!otro) continue;
      const n = porId.get(otro);
      if (n) out.push({ nodo: n, motivo: e.motivo });
    }
    return out;
  }, [fijado, aristas, porId]);

  const vb = `${encuadre.x} ${encuadre.y} ${encuadre.lado} ${encuadre.lado}`;

  // ── EL ENCUADRE ────────────────────────────────────────────────────────────
  // ⚠️ ESTO Y EL ALTO DEL LIENZO SON UN SOLO CAMBIO. El servidor devuelve un encuadre
  // CUADRADO (`lado`), el svg lo mete con `xMidYMid meet` y por lo tanto el cuadrado
  // entra por el lado CHICO: en un lienzo apaisado se desperdicia el 60% del ancho.
  // Poner el lienzo apaisado SIN esto empeora el grafo en vez de mejorarlo.
  // Se calcula el bbox REAL de los nodos (con su radio) y se lo escala a la caja medida.
  const kFit = useRef(1);
  const tocoElZoom = useRef(false);
  /** `ajustar` se declara más abajo que `soltarNodo`, y `soltarNodo` lo necesita. El ref evita
   *  reordenar 200 líneas por una llamada. */
  const ajustarRef = useRef<(() => void) | null>(null);

  const bbox = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodos) {
      const p = posiciones[n.id];
      if (!p) continue;
      const r = radioNodo(grados[n.id] ?? 0);
      x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r);
      x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r);
    }
    if (!Number.isFinite(x0)) return null;
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }, [nodos, posiciones, grados]);

  /** Encuadra el mapa entero en la caja que hay. Es UNA función y TRES features: el
   *  encuadre inicial, el botón «Ajustar a la vista» y el centrado del buscador. */
  const ajustar = useCallback(() => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja || !bbox || !caja.width || !caja.height) return;
    // Cuántas unidades de mundo entran en la caja, sabiendo que `meet` escala por el
    // lado chico.
    const porPixel = Math.min(caja.width, caja.height) / encuadre.lado;
    const anchoU = caja.width / porPixel;
    const altoU = caja.height / porPixel;
    const aire = 24 / porPixel;
    const k = Math.min((anchoU - 2 * aire) / (bbox.w || 1), (altoU - 2 * aire) / (bbox.h || 1));
    kFit.current = k;
    setKFitEstado((prev) => (Math.abs(prev - k) < 1e-6 ? prev : k));
    // ⚠️ CUÁNTAS UNIDADES DE MUNDO ENTRAN EN UN PÍXEL. El <g> se escala DOS veces —por el
    // zoom del paneo (`--k`) y por la escala del viewBox— y el CSS de la etiqueta solo
    // compensaba la primera. Resultado medido: el texto se dibujaba a 4,32 px SIEMPRE, a
    // cualquier zoom, porque el /k se cancelaba y quedaba 12 × 0,36. O sea que acercarse
    // NO agrandaba el texto, que es justo el único mecanismo con el que Obsidian hace
    // legible un racimo denso. Se escribe acá y en el ResizeObserver, nunca por frame:
    // depende del tamaño del lienzo, no del zoom.
    svgRef.current?.style.setProperty('--u', String(1 / porPixel));
    setUEstado((prev) => (Math.abs(prev - 1 / porPixel) < 1e-9 ? prev : 1 / porPixel));
    const cxU = encuadre.x + encuadre.lado / 2;
    const cyU = encuadre.y + encuadre.lado / 2;
    vista.current = { k, x: cxU - k * bbox.cx, y: cyU - k * bbox.cy };
    pedirPintado();
  }, [bbox, encuadre, pedirPintado]);
  ajustarRef.current = ajustar;

  /** Zoom desde los botones. Va contra el CENTRO del lienzo, no contra el cursor: el
   *  botón no tiene una posición en el mapa. */
  const zoomPaso = useCallback((factor: number) => {
    const caja = svgRef.current?.getBoundingClientRect();
    if (!caja) return;
    const pt = aMundo(caja.left + caja.width / 2, caja.top + caja.height / 2);
    if (!pt) return;
    const v = vista.current;
    const k = Math.min(kFit.current * K_MAX_REL, Math.max(kFit.current * K_MIN_REL, v.k * factor));
    vista.current = { k, x: pt.x - ((pt.x - v.x) / v.k) * k, y: pt.y - ((pt.y - v.y) / v.k) * k };
    tocoElZoom.current = true;
    pedirPintado();
  }, [aMundo, pedirPintado]);

  // ── EL VUELO DE CÁMARA ─────────────────────────────────────────────────────
  // Antes esto TELETRANSPORTABA: el mapa aparecía de golpe en otro lado y no quedaba
  // claro que uno se hubiera movido, ni hacia dónde. Ahora se interpola la vista entera
  // —posición y zoom— para que el ojo siga el recorrido y entienda dónde quedó parado.
  /** Fija un nodo y VUELA hasta él. Lo usan el buscador, el clic sobre un nodo, los
   *  accesos del desplegable y cada conexión de la tarjeta. */
  /**
   * SOLTAR: dejar de mirar un nodo. Es UNA función y no tres líneas repetidas porque
   * son tres cosas que tienen que pasar SIEMPRE juntas, y antes cada salida hacía una
   * parte distinta: el clic en el fondo solo soltaba el nodo, la ✕ solo soltaba el nodo,
   * y Escape también. Resultado: se dejaba de mirar el dato y la pantalla quedaba
   * acercada sobre él, con la sección de abajo abierta en un área que ya no venía de
   * ningún lado. El mapa y sus dos paneles tienen que decir lo mismo en todo momento.
   */
  const soltarNodo = useCallback(() => {
    setFijado(null);
    onAbrirArea?.(null);
    // Vuelve al encuadre completo. `tocoElZoom` en false es lo que además le devuelve el
    // control al re-encuadre automático del ResizeObserver.
    tocoElZoom.current = false;
    ajustarRef.current?.();
  }, [onAbrirArea]);

  // ⚠️ SI EL NODO FIJADO SE VA DEL MAPA, SE SUELTA. Filtrar dejaba la columna de la
  // derecha mostrando el detalle de un punto que ya no estaba dibujado, y la sección de
  // abajo abierta en su área: los dos paneles hablando de algo invisible. El panel sigue
  // al mapa, nunca al revés.
  useEffect(() => {
    if (fijado && !visiblesIds.has(fijado)) soltarNodo();
  }, [fijado, visiblesIds, soltarNodo]);

  const irA = useCallback((id: string, fijar = true) => {
    const p = posiciones[id];
    // `fijar` es opcional porque los renglones del navegador vuelan a un área SIN
    // abrirla: si fijaran, el primer click reemplazaría el navegador por el detalle del
    // nodo de área y para seguir recorriendo habría que cerrarlo cada vez.
    if (fijar) {
      setFijado(id);
      // Y ABRE SU SECCIÓN ABAJO, sin saltar. El detalle de la derecha contesta «qué es
      // esto»; la sección de abajo contesta «cómo lo cambio», y tenerla ya abierta es la
      // diferencia entre leer el mapa y trabajar sobre él. La carpeta madre no tiene
      // sección propia (su `area` es prestada de su primera hija), así que no abre nada.
      const n = porId.get(id);
      if (n && n.id !== 'raiz' && !n.id.startsWith('n1:')) onAbrirArea?.(n.area, false);
    }
    setVerTodas(false);
    setTextoEntero(false);
    if (!p) return;
    if (!svgRef.current) return;
    // ⚠️ EL CENTRO DE LO VISIBLE ES EL CENTRO DEL viewBox, y no «medio ancho visible».
    // El viewBox es CUADRADO y entra con `xMidYMid meet`, o sea que se escala por el lado
    // corto y se CENTRA en el largo: lo visible se extiende más allá del viewBox por los
    // dos costados, en partes iguales. Calcularlo como `encuadre.x + anchoVisible/2`
    // dejaba el nodo 317 px a la derecha del centro — medido. `ajustar()` ya lo hacía
    // bien; esto no, y el error venía desde antes del vuelo: el buscador «centraba» un
    // nodo y lo dejaba corrido.
    const cxU = encuadre.x + encuadre.lado / 2;
    const cyU = encuadre.y + encuadre.lado / 2;
    // Se ACERCA, nunca se aleja: si el usuario ya estaba mirando de cerca se respeta su
    // zoom, y si venía del encuadre completo se lo lleva a 2,2× — lo suficiente para que
    // el nodo y sus vecinos sean el tema de la pantalla, sin perder el contexto de dónde
    // está eso dentro del mapa.
    const k = Math.min(kFit.current * K_MAX_REL, Math.max(vista.current.k, kFit.current * 2.2));
    const destino = { k, x: cxU - k * p.x, y: cyU - k * p.y };
    const desde = { ...vista.current };
    tocoElZoom.current = true;
    cortarVuelo();

    // Quien pidió menos movimiento salta directo. El archivo ya consulta este mismo
    // matchMedia para apagar la flotación.
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      vista.current = destino;
      pedirPintado();
      return;
    }

    const t0 = performance.now();
    const DURACION = 520;   // medido a ojo: menos se siente un salto, más se siente lento
    const paso = () => {
      const t = Math.min(1, (performance.now() - t0) / DURACION);
      // easeInOutCubic: arranca y termina despacio, así el ojo engancha el recorrido.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      vista.current = {
        k: desde.k + (destino.k - desde.k) * e,
        x: desde.x + (destino.x - desde.x) * e,
        y: desde.y + (destino.y - desde.y) * e,
      };
      // Se escribe por el MISMO rAF que todo lo demás. Un segundo bucle propio pelearía
      // con `aplicar()` por el mismo atributo, que es el defecto que este archivo ya
      // documenta con la flotación y la física.
      pedirPintado();
      vueloRef.current = t < 1 ? requestAnimationFrame(paso) : null;
    };
    vueloRef.current = requestAnimationFrame(paso);
  }, [posiciones, encuadre, pedirPintado, cortarVuelo, porId, onAbrirArea]);

  // ⚠️ Pantalla completa con la Fullscreen API sobre `.cbg`, NUNCA con un overlay
  // `position:fixed`. En esta app los z-index son literales y ya se quemó: la pila de
  // modales arranca en 130, la sidebar está en 60 y los flyouts en 2000, así que un
  // `zIndex:100` queda pintado DEBAJO del backdrop sin error ni síntoma. El top layer
  // del navegador no compite con ningún z, y trae Escape gratis.
  const marcoRef = useRef<HTMLDivElement | null>(null);
  const pantallaCompleta = useCallback(() => {
    const el = marcoRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const alCambiar = () => setEnPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  // Escape suelta el nodo fijado. Sin esto, la única salida es volver a hacer clic en
  // el mismo punto o en el fondo, y ninguna de las dos está escrita en ningún lado: se
  // lee como que el grafo se colgó atenuado.
  useEffect(() => {
    if (!fijado) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') soltarNodo(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [fijado]);

  // Al montar y en cada cambio de tamaño — salvo que el usuario ya haya tocado el zoom,
  // porque re-encuadrarle el mapa mientras lo mira es peor que dejarlo descuadrado.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    ajustar();
    const ro = new ResizeObserver(() => { if (!tocoElZoom.current) ajustar(); });
    ro.observe(el);
    const alSalir = () => ajustar();
    document.addEventListener('fullscreenchange', alSalir);
    return () => { ro.disconnect(); document.removeEventListener('fullscreenchange', alSalir); };
  }, [ajustar]);


  return (
    <div className="cbg" ref={marcoRef} style={{ ['--cbg-col' as string]: `${anchoCol}px` }}>
      <style>{`
        /* ⚠️ EL ALTO NO SE DERIVA DEL ANCHO. Antes el svg llevaba \`aspect-ratio: 4/3\`
           con \`height:auto\`, así que el lienzo CRECÍA justo en el monitor donde más
           espacio hay: en 1920 con la sidebar plegada daba 1444×1083 sobre un viewport
           de 900, y se veía el tercio de arriba. Ése era el problema de fondo detrás de
           «quiero que el grafo sea el protagonista» — no que el lienzo fuera chico.
           Ahora el alto sale del VIEWPORT y el ancho se toma todo lo que haya.
           El 280 sale de MEDIR, no de estimar: 183 hasta el borde de arriba del lienzo
           (padding de Pagina + PageHeader + los 46 de la barra de control), 66 del
           título «Áreas» con su separación, y 31 de ASOMO de la primera fila de
           tarjetas. El asomo es el punto: sin él la pantalla termina justo donde
           termina el lienzo y miente diciendo que no hay nada más abajo. La primera
           versión restaba 240 y la grilla quedaba 9 px POR DEBAJO del pliegue.
           \`svh\` y NO \`dvh\`: en mobile \`dvh\` cambia cuando se esconde la barra del
           navegador, el lienzo se redimensiona a mitad del scroll y el re-encuadre da
           tirones. */
        /* EL LIENZO NO TIENE CONTENEDOR. Ni fondo propio, ni borde, ni radio, ni
           sombra: los nodos se dibujan directamente sobre el fondo de la página. Esa es
           la diferencia entre «flotar» y «estar adentro de una caja», y las dos
           versiones anteriores eran caja — primero oscura con borde, después blanca con
           sombra sobre una página gris. Una caja con sombra sigue siendo una caja.
           La regla de Linear: la estructura se siente, no se ve.
           ⚠️ Si alguna vez esto vuelve a llevar un background, tiene que ser el MISMO
           valor que el de la página, y entonces no hace falta escribirlo. */
        /* DOS COLUMNAS: el mapa a la izquierda, el detalle a la derecha y AFUERA del
           lienzo. Antes el panel flotaba ENCIMA del mapa y tapaba nodos; y la columna no
           queda vacía cuando no hay nada elegido, porque ahí vive la navegación por
           carpetas — que es lo que reemplazó a las tarjetas de abajo. */
        .cbg {
          display: grid; grid-template-columns: minmax(0, 1fr) 14px var(--cbg-col, 400px); gap: 4px;
          align-items: start;
          --cbg-alto: clamp(420px, calc(100svh - 280px), 760px);
          --cbg-texto: var(--ink);
          --cbg-tenue: var(--dim);
          --cbg-linea: var(--border);
          /* Las dos luminosidades de la telaraña. Van acá y NO como opacity sobre un
             gris: una arista translúcida sobre fondo oscuro se ve lavada y sucia, que es
             exactamente lo que ya está escrito arriba de --sidebar-line. Opaco, a dos
             escalones del fondo el apagado y a cuatro el encendido. */
          --cbg-arista: var(--border-strong);
          --cbg-arista-viva: var(--dim);
        }
        .cbg .cbg-marco {
          /* SE TOPEA EL ASPECTO, NO EL ANCHO. El alto sale del viewport —eso está bien y
             ya está documentado— pero el ancho se tomaba TODO lo que hubiera, así que
             cuanto más grande el monitor más buzón se volvía el marco. Medido: 2,07:1 en
             1440 y 3,16:1 en 2560, con el grafo llenando el 46% y el 31% del ancho
             respectivamente (a lo alto llena 92-95% siempre, o sea que el problema es el
             ancho y no el alto). Con el tope, en 1440 el marco pasa de 1282 a 992 px y el
             grafo de llenar 46% a 60%.
             ⚠️ El grafo DIBUJADO no cambia de tamaño —lo fija el alto—: lo que cambia es
             el encuadre. No toca el layout del servidor ni la línea base de medir-grafo. */
        }
        /* El recorte vive acá y no en el marco: el SVG es lo único que hay que
           recortar, y en el marco además cortaba el panel del filtro, que es
           absolute y sale de la barra hacia abajo. */
        .cbg .cbg-lienzo { position: relative; height: var(--cbg-alto); overflow: hidden; }
        .cbg .cbg-barra {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          min-height: 46px; padding: 0 2px 10px;
          font-size: 12px; color: var(--cbg-tenue);
        }
        .cbg .cbg-chip {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: 1px solid transparent; border-radius: 999px;
          padding: 4px 9px; cursor: pointer; color: var(--cbg-tenue);
          font: inherit; line-height: 1;
        }
        .cbg .cbg-chip:hover { border-color: var(--cbg-linea); color: var(--cbg-texto); }
        .cbg .cbg-chip[aria-pressed="true"] { border-color: var(--border-strong); color: var(--cbg-texto); background: var(--surface-2); }
        .cbg .cbg-ico {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px; border: 1px solid transparent;
          background: none; color: var(--cbg-tenue); cursor: pointer;
        }
        .cbg .cbg-ico:hover { border-color: var(--cbg-linea); color: var(--cbg-texto); }
        .cbg .cbg-chip:focus-visible, .cbg .cbg-ico:focus-visible {
          outline: 2px solid var(--mako); outline-offset: 2px;
        }
        /* La tarjeta de detalle FLOTA sobre el lienzo en vez de comerle una columna de
           300 px que el 90% del tiempo está vacía. Y es gratis: el encuadre es cuadrado,
           así que en un lienzo apaisado quedan cientos de píxeles de aire a cada lado
           donde no hay un solo nodo. */
        /* ── EL TIRADOR ────────────────────────────────────────────────────────
           Una columna propia de 14 px entre el mapa y el panel. Es su propia celda de
           la grilla y no un elemento absolute encima del borde: así el área de agarre
           existe de verdad —14 px es lo mínimo cómodo con el mouse— sin robarle
           píxeles al lienzo ni taparle nada al panel.
           EL ASA ESTÁ SIEMPRE. La primera versión la revelaba al pasar el cursor, con
           el argumento de que un asa permanente compite con las líneas del panel. El
           argumento era malo: una funcionalidad que solo se descubre pasando el mouse
           por una franja de 14 px es una funcionalidad que nadie encuentra. Apagada
           —del color de la línea— no compite con nada; al acercarse se enciende. */
        .cbg .cbg-tirador {
          align-self: stretch; height: var(--cbg-alto);
          display: flex; align-items: center; justify-content: center;
          cursor: col-resize; touch-action: none;
          border: none; background: none; padding: 0;
        }
        .cbg .cbg-tirador::before {
          content: ''; width: 3px; height: 40px; border-radius: 999px;
          background: var(--cbg-linea); opacity: .75;
          transition: opacity .15s, background .15s, height .15s;
        }
        .cbg .cbg-tirador:hover::before,
        .cbg .cbg-tirador:focus-visible::before,
        .cbg .cbg-tirador[data-arrastrando="1"]::before {
          opacity: 1; background: var(--primary); height: 56px;
        }
        .cbg .cbg-tirador:focus-visible { outline: 2px solid var(--mako); outline-offset: -2px; border-radius: 4px; }

        /* La barra de scroll del panel, con los tokens del tema. La del navegador es
           blanca y gruesa por defecto: sobre un panel oscuro se lee como un error de
           pintado. Va el ancho fino MAS el color en dos propiedades: Firefox entiende
           scrollbar-color y los WebKit entienden el pseudo-elemento. */
        .cbg .cbg-detalle { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
        .cbg .cbg-detalle::-webkit-scrollbar { width: 10px; }
        .cbg .cbg-detalle::-webkit-scrollbar-track { background: transparent; }
        .cbg .cbg-detalle::-webkit-scrollbar-thumb {
          background: var(--border-strong); border-radius: 999px;
          border: 3px solid var(--surface); background-clip: padding-box;
        }
        .cbg .cbg-detalle::-webkit-scrollbar-thumb:hover { background: var(--faint); }

        /* La columna SÍ es una superficie, y no se contradice con lo de arriba: lo que
           no puede tener contenedor es el MAPA. Un panel de lectura sin ningún borde al
           lado de un lienzo del mismo color no se lee como panel, se lee como texto
           tirado sobre el grafo. Un escalón de luminosidad y una línea: sentido, no
           visto. Sin sombra — en oscuro una sombra de tinta no separa nada, separa el
           borde. */
        .cbg .cbg-detalle {
          max-height: var(--cbg-alto); overflow-y: auto;
          background: var(--surface); border: 1px solid var(--cbg-linea);
          border-radius: 14px; padding: 20px;
        }
        /* ── LO CLICKEABLE TIENE QUE VERSE CLICKEABLE ──────────────────────────
           Las conexiones y el rótulo del área eran <button> con aspecto de texto suelto:
           funcionaban y nadie los tocaba, que es la peor combinación — el trabajo estaba
           hecho y no se cobraba. Cursor, superficie al pasar, y una flecha que aparece
           para decir «esto te lleva a algún lado». */
        .cbg .cbg-link {
          display: flex; align-items: center; gap: 8px; width: 100%;
          text-align: left; background: none; border: none;
          border-radius: 8px; padding: 6px 8px; margin-left: -8px; cursor: pointer;
          font: inherit; color: var(--ink); line-height: 1.45;
        }
        .cbg .cbg-link:hover { background: var(--surface-2); }
        .cbg .cbg-link:focus-visible { outline: 2px solid var(--mako); outline-offset: 1px; }
        .cbg .cbg-link .cbg-flecha { flex: none; color: var(--faint); opacity: 0; transition: opacity .12s, transform .12s; }
        .cbg .cbg-link:hover .cbg-flecha { opacity: 1; transform: translateX(2px); }
        /* El rótulo del área es un FILTRO, no un título. */
        .cbg .cbg-area-btn {
          display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
          background: none; border: 1px solid transparent; border-radius: 999px;
          padding: 3px 8px; margin-left: -8px; font: inherit;
        }
        .cbg .cbg-area-btn:hover { border-color: var(--border); background: var(--surface-2); }
        .cbg .cbg-area-btn:focus-visible { outline: 2px solid var(--mako); outline-offset: 1px; }
        /* La previsualización del documento, sobre el lienzo. */
        .cbg .cbg-visor {
          position: absolute; inset: 12px; z-index: 2;
          background: var(--surface); border: 1px solid var(--border-strong);
          border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: 0 12px 40px rgba(10,12,16,.4);
        }
        .cbg:fullscreen { --cbg-alto: calc(100svh - 46px); }
        .cbg:fullscreen .cbg-marco { border-radius: 0; border: none; height: 100svh; }
        /* user-select y -webkit-user-drag NO son adorno: sin ellos, arrastrar sobre un
           nodo dispara el drag-and-drop NATIVO del navegador — aparece el «fantasma»
           de la imagen, se cancelan los pointer events y el paneo se muere a mitad de
           camino. Es el síntoma de «al hacer clic parece que agarra una imagen». */
        /* ⚠️ EL LIENZO SE NOMBRA, NO SE DEDUCE POR TIPO DE ELEMENTO. Esta regla decía
           «.cbg svg» y matcheaba TODOS los svg de adentro del componente — incluidas las
           flechas de 13x13 de cada conexión del panel y el chevron de «Leer todo». Un
           width:100% de una hoja de estilos le gana al atributo width="13", porque los
           atributos de presentación tienen la especificidad MÁS BAJA que existe.
           Medido: la flecha computaba 270 px, se quedaba con 270 de los 286 px de la
           fila y dejaba el texto en 0 — de ahí que el panel se viera roto y que su
           scroll fuera de 1463 px sobre una caja de 644. También heredaban el cursor de
           agarre y el touch-action del lienzo.
           REGLA: un selector de dos partes adentro de un componente que además contiene
           íconos es un selector ABIERTO. */
        .cbg .cbg-mapa {
          width: 100%; height: 100%; display: block;
          touch-action: none; cursor: grab;
          user-select: none; -webkit-user-select: none; -webkit-user-drag: none;
        }
        .cbg .cbg-mapa * { -webkit-user-drag: none; }
        .cbg .cbg-mapa:active { cursor: grabbing; }
        .cbg .cbg-nodo { cursor: pointer; }

        /* LA FLOTACIÓN. Va en su propio grupo porque una animación CSS sobre transform
           le gana al transform que escribe la física: en el mismo elemento, el nodo
           quedaría clavado en su keyframe.
           ⚠️ Y son DOS grupos, uno por eje, por la misma razón de cascada: las dos
           animaciones animan la MISMA propiedad (transform), así que puestas en el
           mismo elemento la segunda pisa a la primera y el nodo se mueve en un solo
           eje. Medido con Playwright: con las dos juntas el desplazamiento real era
           de 0,03 px, o sea ninguno.
           Períodos que no son múltiplos entre sí: la órbita no se cierra y no se lee
           mecánica. */

        /* will-change promueve el grupo a su propia capa del compositor. Sin esto el
           navegador re-rasteriza el TEXTO en cada frame y se ve tembloroso, que es
           distinto de flotar. Con la capa, el texto se mueve como una imagen. */

        /* LA LLEGADA. El nodo no nace en su lugar: nace MÁS AFUERA, en la dirección
           que lo aleja del centro, y viaja hasta su posición. Va en su propio grupo
           porque también anima transform y pisaría al pop. Curva de desaceleración
           larga (sin overshoot): el que rebota es el pop, y dos rebotes encimados se
           leen como un error. */

        /* EL POP. easeOutBack sobrepasa ~1,10 y vuelve. Nunca desde scale(0): eso se
           lee como glitch y esconde el área de toque. */
        .cbg .cbg-pop { animation: cbg-in .42s cubic-bezier(.34,1.56,.64,1) backwards; }
        @keyframes cbg-in { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
        /* LA SALIDA ES LA ENTRADA AL REVÉS, y más corta: al filtrar uno quiere ver el
           resultado, no la despedida. El nodo se DESMONTA cuando termina — no se queda
           en opacity 0, que en SVG cuesta lo mismo que dibujarlo (medido, está en el
           documento). El desmonte lo hace React cuando la lista de salida se vacía. */
        .cbg .cbg-fuera .cbg-pop { animation: cbg-out .24s cubic-bezier(.4,0,.7,.2) forwards; }
        @keyframes cbg-out { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.6); } }

        /* EL HOVER: entra rápido, sale lento. Tres señales, ninguna cromática. */
        .cbg .cbg-cuerpo { transition: transform .14s cubic-bezier(.34,1.4,.64,1); }
        .cbg .cbg-nodo:hover .cbg-cuerpo, .cbg .cbg-nodo.cbg-sel .cbg-cuerpo { transform: scale(1.35); }
        .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: opacity .22s ease, fill .18s ease, stroke .18s ease; }
        .cbg .cbg-nodo:hover circle, .cbg .cbg-nodo:hover .cbg-et { transition-duration: .14s; }

        /* Sin halo, sin contorno, sin sombra, sin bold: Obsidian no tiene nada de eso. */
        /* ── LA ETIQUETA TAMBIÉN SE TOCA ───────────────────────────────────────
           Vive adentro del grupo del nodo, así que hereda sus handlers sin tocar el
           JSX: alcanza con dejar de ignorar el puntero. El nombre es lo que uno LEE,
           y obligar a apuntarle a un círculo de 8 px cuando hay un texto de 120 al
           lado es pedir puntería sin motivo.
           visiblePainted y no all: en un texto SVG eso significa
           que solo cuentan los TRAZOS de las letras, no la caja que las contiene.
           Con all, un nombre largo se convierte en un rectángulo invisible que
           tapa a sus vecinos. La otra mitad del cuidado está arriba, en el descarte
           por colisión: una etiqueta que caería sobre el punto de otro nodo no se
           dibuja. */
        .cbg .cbg-et {
          font-size: calc(12px * var(--u, 1) / var(--k, 1));
          fill: var(--cbg-texto); pointer-events: visiblePainted; cursor: pointer;
        }
        .cbg .cbg-nodo:hover .cbg-et { fill: var(--cbg-texto); text-decoration: underline; text-underline-offset: 3px; }
        /* ── LOS TÍTULOS DE JERARQUÍA SE VEN DISTINTO, SIEMPRE ──────────────────
           De lejos solo se leen las carpetas madre, así que se distinguen por
           eliminación; al acercarse aparecen 60 nombres más y esa distinción se pierde
           justo cuando más falta hace, que es cuando hay que orientarse adentro del
           racimo. Se marcan por FORMA (versalitas, tracking, peso), no por color: el
           color del mapa ya significa área, y sumarle un segundo significado lo rompe.
           La carpeta manda sobre la sección, y las dos sobre un dato. */
        .cbg .cbg-et-n1 {
          font-family: var(--font-mono, ui-monospace, monospace);
          /* MÁS GRANDE que una sección y que un dato, no más chico. La versalita en
             mono ya la distingue, pero si además es la más chica de las tres el ojo la
             lee como una nota al pie en vez de como el título que ordena el racimo. */
          font-size: calc(13.5px * var(--u, 1) / var(--k, 1));
          font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
          fill: var(--cbg-texto);
        }
        .cbg .cbg-et-area {
          font-size: calc(12.5px * var(--u, 1) / var(--k, 1));
          font-weight: 650; letter-spacing: .04em;
        }

        @media (prefers-reduced-motion: reduce) {
          .cbg .cbg-pop, .cbg .cbg-fuera .cbg-pop { animation: none; }
          .cbg .cbg-cuerpo, .cbg .cbg-nodo circle, .cbg .cbg-arista, .cbg .cbg-et { transition: none; }
          .cbg .cbg-nodo:hover .cbg-cuerpo, .cbg .cbg-nodo.cbg-sel .cbg-cuerpo { transform: none; }
        }
        /* El navegador de la columna. Renglones, no tarjetas: son once cosas del mismo
           tipo, y once cajas del mismo tamaño apiladas son el contenedor perezoso. */
        .cbg .cbg-nav-carpeta {
          font-family: var(--font-mono, ui-monospace, monospace); font-size: 10.5px;
          letter-spacing: .1em; text-transform: uppercase; font-weight: 700;
          color: var(--cbg-tenue); background: none; border: none; padding: 2px 0;
          cursor: pointer; text-align: left;
        }
        .cbg .cbg-nav-carpeta:hover { color: var(--cbg-texto); }
        .cbg .cbg-nav-carpeta[aria-pressed="true"] { color: var(--primary); }
        .cbg .cbg-nav-par { display: flex; align-items: center; gap: 4; border-radius: 8px; }
        .cbg .cbg-nav-par:hover { background: var(--surface-2); }
        .cbg .cbg-nav-fila {
          display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
          padding: 6px 8px; border-radius: 8px; border: none; background: none;
          color: var(--cbg-texto); font: inherit; font-size: 13px; cursor: pointer; text-align: left;
        }
        .cbg .cbg-nav-fila:hover { background: var(--surface-2); }
        /* AZUL, no dorado. La regla de color de la casa: dorado = MaKo («acá intervino
           la inteligencia»), azul = vos actuás (selección, foco). Una fila marcada
           porque el usuario la eligió es lo segundo; pintada de dorado decía que la
           había elegido MaKo. */
        .cbg .cbg-nav-fila[aria-pressed="true"] { background: var(--primary-bg); font-weight: 650; }
        .cbg .cbg-nav-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* «Abrir» SIEMPRE está visible. La primera versión lo revelaba al pasar el
           cursor, y eso rompe la regla de la casa: si algo es clicable, se tiene que
           notar que lo es sin tener que descubrirlo. Además es la única puerta que queda
           para completar un área desde que se fueron las tarjetas de abajo — esconderla
           detrás de un hover la deja sin puerta en pantallas táctiles. */
        .cbg .cbg-nav-abrir {
          flex: none; margin-right: 6px; padding: 3px 9px; border-radius: 999px;
          border: 1px solid var(--cbg-linea); background: var(--surface);
          color: var(--cbg-tenue); font: inherit; font-size: 11px; cursor: pointer;
          transition: color .12s, border-color .12s;
        }
        .cbg .cbg-nav-par:hover .cbg-nav-abrir { color: var(--cbg-texto); border-color: var(--border-strong); }
        .cbg .cbg-nav-abrir:hover { color: var(--primary); border-color: var(--primary-weak); }

        @media (max-width: 1100px) {
          /* Apilado: el detalle baja debajo del mapa. Una columna de 400 px sobre un
             lienzo de menos de 700 no deja mapa. Y sin dos columnas no hay nada que
             arrastrar. */
          .cbg { grid-template-columns: minmax(0, 1fr); }
          .cbg .cbg-detalle { max-height: none; }
          .cbg .cbg-tirador { display: none; }
        }
        @media (max-width: 900px) {
          /* El tope es OBLIGATORIO, no estético: el svg lleva \`touch-action:none\` para
             el pellizco, así que un lienzo alto ATRAPA el scroll de la página — el dedo
             apoyado sobre el grafo panea el mapa en vez de bajar. */
          .cbg { --cbg-alto: clamp(300px, 52svh, 440px); }
        }
      `}</style>

      <div className="cbg-marco">
        {/* ── LA BARRA DE CONTROL ────────────────────────────────────────────
            Acá viven las dos únicas señales cromáticas del lienzo que SIGNIFICAN algo
            —el Norte y el cuello de botella—, nombradas y clicables. Antes el mapa las
            pintaba de dorado y de naranja y no las explicaba en ningún lado. */}
        <div className="cbg-barra">
          {/* ── EL FILTRO ───────────────────────────────────────────────────
              Su anatomía y el porqué de cada pieza están en FiltroMapa.tsx. Acá solo
              viven el estado y los conteos, que salen del mismo cálculo que dibuja el
              mapa — un contador que no sale de ahí es un contador que se va a
              desincronizar, y ya pasó una vez (decía 14 y el mapa mostraba 5). */}
          <FiltroMapa
            filtro={filtro}
            onFiltro={setFiltro}
            abierto={filtroAbierto}
            onAbrir={setFiltroAbierto}
            conteoArea={porArea}
            conteoAutoria={{ mako: cuenta.mako, usuario: cuenta.usuario, falta: cuenta.pendientes }}
          />
          {/* «N de M», que el tablero no tiene y el CRM sí. Sin esto, filtrar y no ver
              nada es indistinguible de que el mapa esté vacío. */}
          {hayFiltro && (
            <span
              style={{ fontFamily: MONO, fontSize: 11, color: 'var(--cbg-tenue)', whiteSpace: 'nowrap' }}
              title={`Se muestran ${datosVisibles} de ${datosTotal} datos del mapa`}
            >
              <b style={{ fontWeight: 600, color: 'var(--cbg-texto)' }}>{datosVisibles}</b> de {datosTotal}
            </span>
          )}

          <span style={{ flex: 1 }} />
          <BuscadorCerebro
            q={busca}
            onQ={(v) => { setBusca(v); if (ia.ids !== null) setIa({ pensando: false, ids: null, explico: '' }); }}
            campos={campos}
            onCampos={setCampos}
            ia={ia}
            onBuscarIA={(t) => void buscarConIA(t)}
            onLimpiarIA={() => setIa({ pensando: false, ids: null, explico: '' })}
            resultados={resultados.length}
            total={nodos.length}
            portalTo={enPantallaCompleta ? marcoRef.current : null}
          />
          {/* El zoom es UN control (alejar · cuánto · acercar) y va junto. «Ajustar a la
              vista» y «Pantalla completa» son los dos que cambian el ENCUADRE, así que
              van juntos y al final. Antes «ajustar» quedaba del otro lado del zoom,
              separado del único botón con el que se emparenta. */}
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1 / 1.3)} title="Alejar">−</button>
          <span style={{ fontFamily: MONO, fontSize: 11, minWidth: 38, textAlign: 'center' }}>
            {zoomPct}%
          </span>
          <button type="button" className="cbg-ico" onClick={() => zoomPaso(1.3)} title="Acercar">+</button>
          <button type="button" className="cbg-ico" onClick={() => { tocoElZoom.current = false; ajustar(); }} title="Ajustar a la vista">⤢</button>
          <button type="button" className="cbg-ico" onClick={pantallaCompleta} title={enPantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}>⛶</button>
        </div>

        <div className="cbg-lienzo">
          <svg
            ref={svgRef}
            className="cbg-mapa"
            viewBox={vb}
            role="img"
            aria-label={`Mapa del segundo cerebro: ${cuenta.total} datos que MaKo entendió de tu negocio`}
            onDragStart={frenarDragNativo}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={soltar}
            onPointerCancel={soltar}
          >
            <g ref={gRef} style={{ ['--k' as string]: 1 }}>
              <g fill="none">
                {aristas.map((e, i) => {
                  const a = posiciones[e.de];
                  const b = posiciones[e.a];
                  const na = porId.get(e.a);
                  const nb = porId.get(e.de);
                  if (!a || !b || !na || !nb) return null;
                  const dx = b.x - a.x;
                  const dy = b.y - a.y;
                  const d = Math.hypot(dx, dy) || 1;
                  const ra = radioMundo(nb);
                  const rb = radioMundo(na);
                  if (d <= ra + rb) return null;
                  const viva = cerca ? cerca.has(e.de) && cerca.has(e.a) : true;
                  const enFoco = areaFoco ? na.area === areaFoco || nb.area === areaFoco : true;
                  // Una arista se dibuja solo si sus DOS puntas pasan el filtro. Antes
                  // esta línea miraba el nodo en foco y el área, e ignoraba el filtro de
                  // «Ver» y la búsqueda.
                  if (!visible(na) || !visible(nb)) return null;
                  const op = cerca ? (viva ? 1 : ATENUADO) : areaFoco ? (enFoco ? 1 : ATENUADO) : 1;
                  return (
                    <line
                      key={`${e.de}-${e.a}-${i}`}
                      ref={(el) => { aristaRefs.current.set(i, el); }}
                      className="cbg-arista"
                      x1={a.x + (dx / d) * ra} y1={a.y + (dy / d) * ra}
                      x2={b.x - (dx / d) * rb} y2={b.y - (dy / d) * rb}
                      // La arista en foco NO va dorada: eso diría «acá intervino MaKo»,
                      // que es falso. Es la línea normal subida dos escalones.
                      /* ⚠️ ESTO ESTABA INVERTIDO PARA OSCURO. El estado ENCENDIDO era
                         `--dim` (un gris oscuro) y el apagado `--border-strong` (casi
                         blanco): sobre fondo claro funcionaba, y sobre fondo oscuro la
                         arista apagada pasaba a ser lo más brillante de la pantalla y la
                         encendida se fundía con el fondo. Los dos tokens de acá se
                         redefinen con el tema, así que la relación «encendida más clara
                         que apagada» se mantiene en los dos. */
                      stroke={viva && cerca ? 'var(--cbg-arista-viva)' : 'var(--cbg-arista)'}
                      strokeWidth={1}
                      strokeOpacity={op}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>

              {montados.map((n) => {
                const p = posiciones[n.id];
                if (!p) return null;
                const r = radioDe(n);
                const esSel = sel === n.id;
                const h = hashDe(n.id);
                const i = ordenEntrada.get(n.id) ?? 0;
                return (
                  <g
                    key={n.id}
                    ref={(el) => { nodoRefs.current.set(n.id, el); }}
                    className={`cbg-nodo${esSel ? ' cbg-sel' : ''}${saliendo.has(n.id) ? ' cbg-fuera' : ''}`}
                    // Enganche de las pruebas (scripts/probar-solape.mjs). El id no se
                    // puede sacar del DOM de otra forma: las clases son todas iguales y
                    // la posición la reescribe el rAF, así que sin esto no hay manera de
                    // seguir a UN nodo entre dos frames.
                    data-nodo={n.id}
                    transform={`translate(${p.x} ${p.y})`}
                    onMouseEnter={() => setActivo(n.id)}
                    onMouseLeave={() => setActivo(null)}
                    onPointerDown={agarrarNodo(n.id)}
                  >
                      {/* ⚠️ EL `key` ES LO QUE HACE QUE LA ANIMACIÓN SE REPITA. Una
                          animación CSS corre AL MONTAR y no vuelve a correr porque le
                          agreguen o le saquen una clase. Sin esta línea el nodo que se
                          va y vuelve —filtrar y desfiltrar, que es el caso normal— se
                          quedaba plantado en su lugar: la salida se veía, la entrada de
                          vuelta no. Al cambiar la key React desmonta y remonta este `<g>`,
                          y ahí sí arranca de cero. Va acá adentro y no en el `<g>` de
                          afuera a propósito: ese tiene el `transform` que reescribe el
                          rAF y los refs de la física, y remontarlo haría saltar al nodo. */}
                      {/* ⚠️ EL RETARDO ES SOLO PARA LA ENTRADA. El `animationDelay` en
                          línea se lo come CUALQUIER animación que esté corriendo, así
                          que la salida también arrancaba escalonada —hasta 700 ms— y el
                          desmontaje corta a los 260: un nodo con 300 ms de retardo NUNCA
                          empezaba su fade, se quedaba a opacidad plena y desaparecía de
                          golpe cuando saltaba el temporizador. Como la mayoría de los
                          que se van caen en ese rango, la salida parecía no existir.
                          La salida va toda junta: es UN gesto —«esto se fue»— y
                          escalonarla no significa nada. */}
                      <g
                        key={saliendo.has(n.id) ? 'fuera' : 'dentro'}
                        className="cbg-pop"
                        style={{ animationDelay: saliendo.has(n.id) ? '0ms' : `${Math.min(i * 12, 700)}ms` }}
                      >
                        <g className="cbg-cuerpo">
                          <circle r={Math.max(r + 8 / kr, 16 / kr)} fill="transparent" />
                          <circle r={r} fill={rellenoDe(n)} opacity={opacidadDe(n)} />
                          {esSel && (
                            <circle r={r + 1.2 / kr} fill="none" stroke="var(--ink)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                          )}
                        </g>
                        {/* El nodo en foco y sus vecinos SIEMPRE llevan etiqueta: es lo
                            que se está mirando, y esconderla ahí sería el peor momento. */}
                        {(etiquetasVisibles.has(n.id) || esSel || (cerca?.has(n.id) ?? false)) && (
                          <text
                            className={`cbg-et${n.id.startsWith('n1:') ? ' cbg-et-n1' : n.id.startsWith('area:') ? ' cbg-et-area' : ''}`}
                            y={r + 6 / kr}
                            textAnchor="middle"
                            dominantBaseline="hanging"
                            opacity={esSel ? 1 : opacidadDe(n)}
                          >
                            {n.etiqueta}
                          </text>
                        )}
                      </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* ── LA PREVISUALIZACIÓN ────────────────────────────────────────────
              Vive DENTRO de `.cbg-lienzo`, no en un portal a document.body: el lienzo
              puede estar en pantalla completa, y en el top layer del navegador un portal
              al body queda invisible — sin error y sin síntoma. */}
          {verDoc && (
            <div className="cbg-visor" role="dialog" aria-label={`Vista previa de ${verDoc.etiqueta}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {verDoc.etiqueta}
                </span>
                <a
                  href={`/api/onboarding/archivero/download?id=${encodeURIComponent(verDoc.id.slice(4))}`}
                  style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', textDecoration: 'none' }}
                >Descargar</a>
                <button
                  type="button"
                  onClick={() => setVerDoc(null)}
                  aria-label="Cerrar la vista previa"
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--faint)', lineHeight: 1 }}
                >✕</button>
              </div>
              {esImagen(verDoc.mime)
                ? <img src={urlPreview(verDoc.id)} alt={verDoc.etiqueta} style={{ flex: 1, minHeight: 0, objectFit: 'contain', background: 'var(--surface-2)' }} />
                : <iframe src={urlPreview(verDoc.id)} title={verDoc.etiqueta} style={{ flex: 1, minHeight: 0, border: 'none' }} />}
            </div>
          )}

          {/* NADA PASA EL FILTRO. Es un estado distinto de «el mapa está vacío» y por eso
              es otro bloque: acá SÍ hay datos, lo que no hay es datos que pasen, y la
              salida es sacar el filtro. Sale de `NoResults` —el canónico de la casa— y
              no de un mensaje escrito acá: el tablero pinta un «—» que no dice que fue
              el filtro ni ofrece nada, y es su punto más flojo. */}
          {cuenta.total > 0 && hayFiltro && datosVisibles === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <NoResults
                inline
                detalle="Tu mapa tiene datos, pero ninguno pasa este filtro."
                onLimpiar={() => setFiltro(filtroVacio())}
              />
            </div>
          )}

          {/* Estado vacío: un mensaje que explica, nunca un cuadro con los campos en cero.
              Antes acá se leían cuatro ceros seguidos y un número mal contado. */}
          {cuenta.total === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 24,
            }}>
              <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>
                Todavía no sé nada de tu negocio
              </div>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', maxWidth: 340, lineHeight: 1.55 }}>
                Suelta tus documentos en El Archivero y el mapa se arma solo.
              </p>
              {onAbrirArea && (
                <Button variant="primary" onClick={() => onAbrirArea('documentos', true)}>Abrir El Archivero</Button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* El separador arrastrable. Es un `separator` con `aria-orientation` y responde a
          las flechas: un ancho que solo se puede cambiar con el mouse no lo puede cambiar
          quien navega con teclado. */}
      <div
        className="cbg-tirador"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ajustar el ancho del panel"
        aria-valuenow={anchoCol}
        aria-valuemin={COL_MIN}
        aria-valuemax={COL_MAX}
        tabIndex={0}
        data-arrastrando={arrastreCol.current ? '1' : '0'}
        onPointerDown={tirarCol}
        onPointerMove={moverCol}
        onPointerUp={soltarCol}
        onPointerCancel={soltarCol}
        onDoubleClick={() => setAnchoCol(400)}
        title="Arrastra para ajustar · doble clic para volver al ancho normal"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setAnchoCol((w) => acotarCol(w + 24)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setAnchoCol((w) => acotarCol(w - 24)); }
        }}
      />

          {/* ── LA TARJETA DE DETALLE ────────────────────────────────────────
              Flota sobre el lienzo. Dos modos, y la diferencia es deliberada:
              · AL PASO (hover) se LEE. Sin botones, porque la tarjeta flota: mover el
                mouse del nodo hacia ella cruza el lienzo, dispara el onMouseLeave y la
                tarjeta desaparecería justo antes del clic.
              · FIJADA (clic) se ACTÚA: conexiones clicables y la acción de abrir.
              El pie del modo lectura enseña ese contrato en una línea. */}
          {nodoSel && (
            <div className="cbg-detalle">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  className="cbg-area-btn"
                  onClick={() => setFiltro((f) => ({ ...f, areas: f.areas.has(nodoSel.area) ? new Set() : new Set([nodoSel.area]) }))}
                  aria-pressed={areaFoco === nodoSel.area}
                  title={areaFoco === nodoSel.area ? 'Ver todo' : `Ver solo ${areaDe(nodoSel.area).nombre}`}
                  style={{
                    fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                    color: areaFoco === nodoSel.area ? 'var(--primary)' : 'var(--faint)',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: areaDe(nodoSel.area).color, flex: 'none' }} />
                  {areaDe(nodoSel.area).nombre}
                </button>
                <span style={{ flex: 1 }} />
                {fijado && (
                  <>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>Fijado</span>
                    <button
                      type="button"
                      onClick={soltarNodo}
                      title="Soltar"
                      aria-label="Soltar el dato fijado"
                      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--faint)', lineHeight: 1 }}
                    >✕</button>
                  </>
                )}
              </div>

              <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 8 }}>
                {nodoSel.etiqueta}
              </div>
              {nodoSel.detalle && (
                <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                  {nodoSel.detalle}
                </p>
              )}

              {/* ── LOS DATOS DEL NODO ─────────────────────────────────────────
                  Antes todo esto se pegaba con « · » adentro del mismo párrafo, así que
                  cada productor tenía que elegir entre tirar campos o escribir un renglón
                  corrido ilegible. Como pares nombre/valor entran todos y se leen. */}
              {(nodoSel.datos ?? []).filter((d) => d.v && d.v.trim()).length > 0 && (
                <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', alignItems: 'baseline' }}>
                  {(nodoSel.datos ?? []).filter((d) => d.v && d.v.trim()).map((d) => (
                    <Fragment key={d.k}>
                      <dt style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', whiteSpace: 'nowrap' }}>{d.k}</dt>
                      <dd style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>{d.v}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}

              {/* ── LA PROSA LARGA ─────────────────────────────────────────────
                  ⚠️ El recorte anterior tenía un bug silencioso: clampeaba por LÍNEAS
                  (WebkitLineClamp) y decidía si mostrar «Leer todo» por CARACTERES (> 320).
                  O sea que había una banda entera —textos de ~270 a 320 caracteres— donde
                  el texto se cortaba y NO había ningún botón para verlo entero. Ahora el
                  que decide es uno solo: si hay cuerpo, hay botón. */}
              {nodoSel.cuerpo && (
                <div style={{ marginTop: 12 }}>
                  {textoEntero
                    ? <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>{nodoSel.cuerpo}</p>
                    : (
                      <button
                        type="button"
                        className="cbg-link"
                        onClick={() => setTextoEntero(true)}
                        style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}
                      >
                        <span style={{ flex: 1 }}>Leer lo que MaKo explica</span>
                        <svg className="cbg-flecha" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    )}
                </div>
              )}

              {(nodoSel.fuente || nodoSel.autoria) && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <Eyebrow>De dónde salió</Eyebrow>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', lineHeight: 1.5, marginTop: 4 }}>
                    {[nodoSel.fuente, AUTORIA_TEXTO[nodoSel.autoria]].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}

              {fijado && conexiones.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Eyebrow>Conectado con · {conexiones.length}</Eyebrow>
                  <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {conexiones.slice(0, verTodas ? undefined : 3).map((c) => (
                      <li key={c.nodo.id}>
                        <button
                          type="button"
                          className="cbg-link"
                          onClick={() => irA(c.nodo.id)}
                          title={`Ir a ${c.nodo.etiqueta}`}
                          style={{ fontSize: 'var(--fs-sm)' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: areaDe(c.nodo.area).color, flex: 'none' }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                          {c.nodo.etiqueta}
                          {/* `motivo` se venía calculando con cuidado en cada arista, viajaba al
                              browser en cada carga y no lo leía NADIE: el panel mostraba solo
                              «5 conexiones». Su propio tipo dice que es lo que hay que poder leer. */}
                          {c.motivo && <span style={{ color: 'var(--faint)' }}> — {c.motivo}</span>}
                          </span>
                          <svg className="cbg-flecha" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {conexiones.length > 3 && !verTodas && (
                    <button
                      type="button"
                      onClick={() => setVerTodas(true)}
                      style={{ background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}
                    >Ver las {conexiones.length}</button>
                  )}
                </div>
              )}

              {fijado && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Un documento se MIRA, no se «abre en su área»: el archivo está a un
                      clic y hasta ahora había que salir de la pantalla para verlo. Solo
                      aparece si de verdad se puede previsualizar — un .docx no se
                      previsualiza, y prometer un botón que no muestra nada es peor que no
                      tenerlo. */}
                  {nodoSel.id.startsWith('doc:') && sePuedeVer(nodoSel.mime) && (
                    <Button variant="primary" full onClick={() => setVerDoc(nodoSel)}>
                      Ver el documento
                    </Button>
                  )}
                  {/* TODA área se abre desde el mapa, incluido SU PROPIO NODO — que era
                      el más grande de su racimo, el primero que uno toca, y el único que
                      no ofrecía nada.
                      ⚠️ La carpeta MADRE no ofrece acción, y es a propósito: agrupa varias
                      áreas, así que no tiene un destino único. Su `area` es la de su
                      primera hija, o sea que un botón ahí diría «Completar Norte» estando
                      parado en «Negocio». La regla de la casa es que nunca se promete un
                      botón que no lleva a donde dice. Tampoco la raíz: es el negocio
                      entero, no un área. */}
                  {onAbrirArea && nodoSel.id !== 'raiz' && !nodoSel.id.startsWith('n1:') && (
                    <Button variant="secondary" full onClick={() => onAbrirArea(nodoSel.area, true)}>
                      {nodoSel.id.startsWith('area:')
                        ? `Completar ${areaDe(nodoSel.area).nombre}`
                        : `Abrir ${areaDe(nodoSel.area).nombre}`}
                    </Button>
                  )}
                </div>
              )}

            </div>
          )}


          {/* ── EL NAVEGADOR ────────────────────────────────────────────────
              La columna no se queda vacía cuando no hay nada elegido: acá vive la
              navegación por carpetas que REEMPLAZA a las tarjetas de abajo.

              Por qué se fueron las tarjetas: eran once cajas del mismo tamaño repitiendo
              lo que el mapa ya dibuja, debajo del mapa, y competían con él por ser la
              navegación de la pantalla. Acá la misma lista ocupa una columna, está SIEMPRE
              a la vista mientras se mira el mapa, y cada renglón hace las dos cosas que
              las tarjetas hacían por separado: volar hasta esa parte del mapa, y abrir la
              sección para completarla. */}
          {!nodoSel && (
            <div className="cbg-detalle">
              <Eyebrow>Tu negocio</Eyebrow>
              <p style={{ margin: '6px 0 14px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
                Toca un punto del mapa para verlo. O entra por acá:
              </p>

              {accesos.slice(0, 2).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                  {accesos.slice(0, 2).map((a) => (
                    <button key={a.value} type="button" className="cbg-nav-fila" onClick={() => irA(a.value)}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: a.value === destacado?.id ? 'var(--mako)' : 'var(--warn)' }} />
                      <span className="cbg-nav-txt">{a.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {NIVEL1.map((c: (typeof NIVEL1)[number]) => {
                const suyas = AREAS.filter((a) => a.padre === c.id);
                if (!suyas.length) return null;
                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <button
                      type="button"
                      className="cbg-nav-carpeta"
                      onClick={() => setFiltro((f) => {
                        const cs = new Set(f.carpetas);
                        if (cs.has(c.id)) cs.delete(c.id); else cs.add(c.id);
                        return { ...f, carpetas: cs };
                      })}
                      aria-pressed={filtro.carpetas.has(c.id)}
                      title={filtro.carpetas.has(c.id) ? `Dejar de ver solo ${c.nombre}` : `Ver solo ${c.nombre}`}
                    >
                      {c.nombre}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                      {suyas.map((a) => {
                        const n = porArea[a.id] ?? 0;
                        return (
                          <div key={a.id} className="cbg-nav-par">
                            <button
                              type="button"
                              className="cbg-nav-fila"
                              aria-pressed={filtro.areas.has(a.id)}
                              onClick={() => {
                                setFiltro((f) => {
                                  const as = new Set(f.areas);
                                  if (as.has(a.id)) as.delete(a.id); else as.add(a.id);
                                  return { ...f, areas: as };
                                });
                                irA(`area:${a.id}`, false);
                              }}
                              title={`Ver ${a.nombre} en el mapa`}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: a.color }} />
                              <span className="cbg-nav-txt">{a.nombre}</span>
                              {/* El conteo dice si hay algo; el «Falta» dice que no lo hay.
                                  Nunca un 0, que se lee como un dato que vale cero. */}
                              <span style={{ fontFamily: MONO, fontSize: 10.5, color: n ? 'var(--faint)' : 'var(--warn)', flex: 'none' }}>
                                {n || 'falta'}
                              </span>
                            </button>
                            {onAbrirArea && (
                              <button
                                type="button"
                                className="cbg-nav-abrir"
                                onClick={() => onAbrirArea(a.id, true)}
                                title={`Abrir ${a.nombre} para completarla`}
                                aria-label={`Abrir ${a.nombre} para completarla`}
                              >{areaAbierta === a.id ? 'Abierta' : 'Abrir'}</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}
