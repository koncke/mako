'use client';

// =============================================================================
// Lienzo — un grafo que se panea, se acerca, y se edita tocando un nodo
// =============================================================================
// El chrome de una pantalla tipo flujo, sin saber NADA de lo que dibuja. Lo usan
// los dos flujos del producto y el día que haya un tercero lo hereda gratis:
//
//   · `app/chatbot/FlujoLienzo.tsx`  — la conversación con un lead
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

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SvcIcon, ICON, BrandDefs } from './ServicioVisual';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import {
  curvaEntre, medioDeCurva, vistaConPanel, vistaAlCerrarPanel, type VistaLienzo,
  type GrafoFlujo, type NodoFlujo, type TonoArista,
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
/** Ancho del panel de edición, y el margen con el que se despega del borde. */
/**
 * Ancho del panel de edición. Es el DEFAULT: quien monta el lienzo puede pedir otro
 * con `panelAncho`, porque lo que entra adentro lo decide él. Lo pidió Martín con la
 * captura delante — «la sección de edición del mensaje tiene que ser MUCHO más
 * grande»— y subir la constante a secas se lo habría cambiado a TODOS los lienzos,
 * incluido el del chatbot, que no lo pidió.
 */
const PANEL_ANCHO = 328;
const PANEL_MARGEN = 12;
/** Alto de la barra de zoom, que vive en la MISMA esquina. El panel del nodo abre
 *  por encima de ella: medido, un panel de 328x355 en `bottom: 12` la tapaba
 *  ENTERA (solapamiento total), y con eso el zoom dejaba de existir justo cuando
 *  hay algo abierto que mirar. La barra no se mueve: la esquina la pidió el dueño.
 */
const ZOOM_ALTO = 40;

export const COLOR_TONO: Record<TonoArista, string> = {
  normal: 'var(--border-strong)',
  buena: 'var(--good)',
  mala: 'var(--bad)',
  condicional: 'var(--primary)',
};

export function Lienzo({
  grafo, seleccion, onSeleccion, renderNodo, renderEditor, tituloEditor, accion,
  alto = 'min(54svh, 460px)', onMover, onAgregarTras, puedeAgregarTras, agregarOcupado = false, opcionesAgregar, panelAncho = PANEL_ANCHO, chrome, herramientas, sinMarco = false, insetIzq = 0,
}: {
  grafo: GrafoFlujo;
  /** El nodo abierto. Va CONTROLADO: quien lo usa tiene que poder cerrarlo al
   *  borrar un paso, o el panel queda abierto sobre un nodo que ya no existe. */
  seleccion: string | null;
  onSeleccion: (id: string | null) => void;
  renderNodo: (nodo: NodoFlujo, activo: boolean) => ReactNode;
  renderEditor: (nodo: NodoFlujo) => ReactNode;
  /** La cabecera del panel. Por default, el ícono y el título del nodo. */
  tituloEditor?: (nodo: NodoFlujo) => ReactNode;
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
   * ⚠️ NO ANGOSTA EL LIENZO, Y ESA ES LA DIFERENCIA QUE IMPORTA. En /chatbot la lista de
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
  /** Sin borde ni radio: cuando el lienzo ES el recuadro, el marco lo pone la caja
   *  de afuera y dos marcos anidados dejan un filete doble. */
  sinMarco?: boolean;
  /** Agregar un paso DESPUÉS de este nodo. Dibuja un «＋» al pasar el cursor por la
   *  tarjeta, a su derecha — que es donde va a aparecer lo que se agregue. Un botón
   *  suelto en una esquina no dice DÓNDE entra el paso; éste sí. */
  onAgregarTras?: (id: string, que: string) => void;
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
  /** Lo que el panel corrió, para devolverlo al cerrar. Ver `vistaAlCerrarPanel`. */
  const corrimiento = useRef<{ antes: VistaLienzo; aplicada: VistaLienzo } | null>(null);
  /** La última forma encuadrada: grafo + caja. Ver `encuadrar`. */
  const encuadrado = useRef('');

  /** Escribe la vista en el DOM. NUNCA pasa por setState: ver la trampa 3. */
  const pintar = useCallback(() => {
    const v = vista.current;
    if (capa.current) capa.current.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.k})`;
  }, []);

  /** Encuadra el grafo entero en la caja. */
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
    const firma = `${Math.round(grafo.ancho)}x${Math.round(grafo.alto)}@${w}x${h}+${insetIzq}`;
    if (!forzar && encuadrado.current === firma) return;
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
     * ahí— y nada del grafo nace abajo.
     */
    const wUtil = Math.max(1, w - insetIzq);
    const k = Math.min(1, Math.min(wUtil / grafo.ancho, h / grafo.alto));
    vista.current = { k, tx: insetIzq + (wUtil - grafo.ancho * k) / 2, ty: (h - grafo.alto * k) / 2 };
    setZoomTxt(Math.round(k * 100));
    pintar();
  }, [grafo.ancho, grafo.alto, insetIzq, pintar]);

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
      // Se escribe sobre el nodo del DOM, no con setState: un setState por
      // `pointermove` redibuja el grafo entero 60 veces por segundo.
      const el = caja.current?.querySelector(`[data-nodo="${g.nodo}"]`);
      if (el instanceof HTMLElement) {
        el.style.left = `${movido.current.x}px`;
        el.style.top = `${movido.current.y}px`;
      }
      // ⚠️ Y EL ＋ SE MUEVE CON ELLA. `setPointerCapture` retargetea los eventos al
      // contenedor, así que durante todo el arrastre no se dispara ni un enter ni un
      // leave en los envoltorios: `encima` queda congelado en el nodo agarrado. Sin
      // esto, el botón se queda flotando en el lugar viejo mientras la tarjeta viaja —
      // justo en el gesto que el dueño nombró.
      const mas = caja.current?.querySelector(`[data-mas="${g.nodo}"]`);
      const nodoMov = grafo.nodos.find((x) => x.id === g.nodo);
      if (mas instanceof HTMLElement && nodoMov) {
        mas.style.left = `${movido.current.x + nodoMov.ancho}px`;
        mas.style.top = `${movido.current.y + 10}px`;
      }
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
    if (g.movido <= ARRASTRE2) onSeleccion(g.nodo && seleccion === g.nodo ? null : g.nodo);
    else if (g.arrastrandoNodo && movido.current) {
      // El guardado va al SOLTAR, no en cada píxel: un POST por `pointermove` son
      // sesenta por segundo contra la misma fila.
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
    const n = grafo.nodos.find((x) => x.id === seleccion);
    if (!n) return;
    // Las dos cuentas viven en `lib/lienzo-grafo.ts`, sin `server-only`, para que
    // tengan test: adentro de este efecto no las puede importar nadie.
    // El panel abre a `PANEL_MARGEN + insetIzq`, así que el borde contra el que se
    // corre el lienzo para no taparlo es ése, no el del contenedor.
    const prox = vistaConPanel(vista.current, n.x, panelAncho, PANEL_MARGEN + insetIzq);
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
            {grafo.aristas.map((a, i) => {
              const d = grafo.nodos.find((n) => n.id === a.desde);
              const h = grafo.nodos.find((n) => n.id === a.hasta);
              if (!d || !h) return null;
              return (
                <path key={i} d={curvaEntre(d, h)} fill="none" stroke={COLOR_TONO[a.tono]}
                  strokeWidth={1.6} strokeDasharray={a.tono === 'condicional' ? '5 4' : undefined}
                  markerEnd={`url(#punta-${a.tono})`} opacity={0.85} />
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
            obligó a darle al ＋ de la tarjeta un puente de 8 px de padding.
          */}
          {onAgregarTras && opcionesAgregar && grafo.aristas.map((a, i) => {
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h || a.sinMas) return null;
            const m = medioDeCurva(d, h);
            const abierta = enFlecha === i;
            return (
              <div key={`mas-${i}`} data-no-pan
                onPointerEnter={() => setEnFlecha(i)}
                onPointerLeave={() => { if (document.querySelector('[role="listbox"]')) return; setEnFlecha((p) => (p === i ? null : p)); }}
                style={{
                  position: 'absolute', left: m.x, top: m.y,
                  // ⚠️ LA ZONA SE MIDE EN PÍXELES DE PANTALLA, NO DEL GRAFO. Vive adentro
                  // de la capa transformada, así que sus 28 px son 28 × k: medido en el
                  // navegador el 04/10/2026, con el lienzo al 22% la zona daba **6 px** y
                  // el ＋ adentro 5 — o sea inalcanzable, que es el mismo problema que
                  // obligó a no colgarla del `<path>` de 1,6 px. El `scale` inverso la
                  // deja del mismo tamaño a cualquier zoom, y al ＋ también.
                  transform: `translate(-50%, -50%) scale(${100 / zoomTxt})`,
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {abierta && (
                  <Dropdown
                    value="" ariaLabel="Agregar algo en el medio"
                    sinFlecha botonLabel="＋" disabled={agregarOcupado}
                    buttonStyle={{ width: 22, height: 22, padding: 0, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1 }}
                    // En el MEDIO de una flecha no se ofrece un mensaje: un canal se
                    // prende para el mensaje entero, no entre dos pasos.
                    options={opcionesAgregar.filter((o) => o.value === 'delay' || o.value === 'condicional' || o.value === 'accion')}
                    onChange={(v) => v && onAgregarTras(a.desde, v)}
                  />
                )}
              </div>
            );
          })}

          {grafo.aristas.map((a, i) => {
            if (!a.etiqueta) return null;
            const d = grafo.nodos.find((n) => n.id === a.desde);
            const h = grafo.nodos.find((n) => n.id === a.hasta);
            if (!d || !h) return null;
            const m = medioDeCurva(d, h);
            return (
              <div key={`et-${i}`} style={{
                position: 'absolute', left: m.x, top: m.y, transform: 'translate(-50%, -50%)',
                padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                background: 'var(--surface)', border: `1px solid ${COLOR_TONO[a.tono]}`,
                fontSize: 10.5, color: 'var(--dim)', fontFamily: SANS, pointerEvents: 'none',
              }}>{a.etiqueta}</div>
            );
          })}

          {grafo.nodos.map((n) => (
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
            <div key={n.id}
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
              {renderNodo(n, seleccion === n.id)}
              {onAgregarTras && encima === n.id && (puedeAgregarTras?.(n.id) ?? true) && (
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
          <div data-no-pan style={{ position: 'absolute', left: insetIzq, right: 0, top: 0, padding: 14, pointerEvents: 'none' }}>
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

        {/* `data-esquina-ocupada`: la esquina de los avisos sube para no taparlo (EsquinaAvisos). */}
        {accion && <div data-no-pan data-esquina-ocupada style={{ position: 'absolute', right: 12, bottom: 12 }}>{accion}</div>}

        {/* EL EDITOR. Va acá adentro y en coordenadas de PANTALLA: si viviera en la
            capa transformada, el zoom le cambiaría el tamaño a los inputs. */}
        {nodoSel && (
          <div
            data-no-pan
            style={{
              // Las TRES cosas que flotan llevan el inset, no dos: el chrome, la fila
              // del zoom y ESTE panel, que abre justo abajo a la izquierda — o sea exactamente
              // donde se apoya la lista de secuencias de /chatbot. Medido con el arnés: la
              // flecha del selector de disparo no se podía apretar («aside … intercepts
              // pointer events»), con el panel dibujado y a la vista.
              position: 'absolute', left: PANEL_MARGEN + insetIzq, bottom: PANEL_MARGEN + ZOOM_ALTO, width: panelAncho,
              maxHeight: `calc(100% - ${24 + ZOOM_ALTO}px)`, overflowY: 'auto', padding: 14, borderRadius: 14,
              background: 'var(--surface)', border: '1px solid var(--border-strong)',
              boxShadow: '0 12px 32px rgba(0,0,0,.14)', cursor: 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {tituloEditor ? tituloEditor(nodoSel) : (
                <>
                  <IconoNodo icono={nodoSel.icono} tam={17} />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: 1, minWidth: 0 }}>{nodoSel.titulo}</div>
                </>
              )}
              {/* ⚠️ NO dice «Cerrar el editor»: ése es el de la pantalla, y con los dos
                  con el mismo rótulo había dos ✕ que cierran cosas distintas — el de
                  arriba se va del mensaje (y pregunta si publicar), éste sólo repliega
                  el panel de un nodo. Medido con Playwright: `getByLabel('Cerrar el
                  editor')` resolvía a DOS. */}
              <button onClick={() => onSeleccion(null)} aria-label="Cerrar este paso" title="Cerrar este paso"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 15, cursor: 'pointer', padding: 0 }}>✕</button>
            </div>
            {renderEditor(nodoSel)}
          </div>
        )}
      </div>
    </div>
  );
}

/** La tarjeta de un nodo. La forma es del lienzo; el CONTENIDO lo pone quien lo usa. */
export function TarjetaNodo({ nodo, activo, roto, children }: {
  nodo: NodoFlujo; activo: boolean; roto?: boolean; children: ReactNode;
}) {
  const borde = activo ? 'var(--primary)' : roto ? 'var(--bad)' : 'var(--border)';
  return (
    <div
      data-nodo={nodo.id}
      role="button" tabIndex={0} aria-pressed={activo}
      style={{
        position: 'absolute', left: nodo.x, top: nodo.y, width: nodo.ancho, minHeight: nodo.alto,
        borderRadius: 13, background: 'var(--surface)', border: `1.5px solid ${borde}`,
        boxShadow: activo ? '0 0 0 3px var(--primary-bg)' : '0 1px 2px rgba(0,0,0,.05)',
        padding: 11, boxSizing: 'border-box', cursor: 'pointer', fontFamily: SANS,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <IconoNodo icono={nodo.icono} tam={15} />
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)' }}>
          {nodo.titulo}
        </span>
        {nodo.advertencia && (
          <span title={nodo.advertencia} style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--warn)' }}>⚠</span>
        )}
      </div>
      {children}
    </div>
  );
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
function IconoNodo({ icono, tam }: { icono: string; tam: number }) {
  if (ICON[icono]) return <SvcIcon k={icono} size={Math.round(tam * 0.74)} box={tam + 7} radius={6} />;
  return <span style={{ fontSize: tam - 2 }}>{icono}</span>;
}
