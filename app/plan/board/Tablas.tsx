'use client';

// =============================================================================
// Tablas — la MISMA información, en filas
// =============================================================================
// El pedido, textual (22/09/2026): «no puedo ver todos los proyectos de una página, las
// tarjetas ocupan muchísimo espacio», y con el zoom «se abudea el diseño». Y sobre el
// deadline: «no me dice cuándo es el deadline, cuánto me falta, nada de eso tengo claridad
// en la vista principal».
//
// ⚠️ ES OTRA OPCIÓN DE VERLO, NO UN REEMPLAZO. Su corrección, textual: «NO reemplaces lo
// que hay ahora, es otra opción de verlo». El default sigue siendo las tarjetas y el
// Kanban; esto se prende en la barra de arriba y se recuerda por navegador.
//
// Tres cosas que la tabla hace y las tarjetas no:
//  1. El DEADLINE, teñido por lo que falta (ver `CeldaFecha`).
//  2. Se ordena por deadline (click en el encabezado), no solo por prioridad.
//  3. Lo COMPLETADO se va al fondo, plegado: «un proyecto marcado completo tiene que
//     desaparecer o bajar — me queda acá».
//
// ⚠️ ES LA VISTA QUE MÁS USA. «A mí me gusta mucho más esta vista, yo la entiendo mucho
// más… esto me da mucha claridad de qué es lo que tengo que priorizar» (25/09/2026). Por
// eso la pasada de ese día fue sacar, no agregar: el mismo dato dicho una sola vez, un
// ícono en vez de una palabra, y la columna del ID afuera.
//
// ⚠️ ES TAMBIÉN LA LISTA DE TAREAS DE UN PROYECTO, y por eso `TablaTareas` es UNA sola
// para las dos pantallas: «dos pantallas que muestran lo mismo se ven igual». Lo que
// cambia entre las dos son dos props, y las dos existen para no reimplementar nada:
//   · `ocultarProyecto` — adentro de un proyecto esa columna repite el mismo nombre en
//     todas las filas, así que no se dibuja y el `minWidth` baja con ella. Sin eso, la
//     tabla declaraba 720px en una columna de ~500 y era scroll horizontal SIEMPRE.
//   · `onEliminar` — el tacho de la fila. Abre la pregunta de dos botones de quien llama;
//     sin la prop, la fila no lo dibuja (un control que no se puede cumplir no se pinta).
//   · `onSoltar` — arrastrar una fila para cambiarle la prioridad. Misma regla: sin la
//     prop la fila no se puede agarrar, porque el pop-up del 1 al 100 lo abre quien llama.
// Quien la USA no reimplementa nada de lo que la tabla hace: ni el desplegable de las
// completadas (`FilaPlegada`, que pide que le pasen TODAS las tareas juntas), ni el tinte
// del deadline, ni el orden. Dos copias de esto divergen a la primera corrección.
//
// ⚠️ EL ANCHO QUE DECLARA LA TABLA ES LO QUE LAS COLUMNAS PIDEN, NO LO QUE HAY. Hasta el
// 25/09/2026 el `minWidth` de adentro de un proyecto ERA el ancho disponible
// (`ANCHO_TABLA_EN_PROYECTO`): pedir exactamente lo que hay deja cero margen, así que
// cualquier cosa que corra el número un píxel —el zoom, que achica el modal; una palabra
// más larga que la medida; un borde nuevo— devuelve la barra de abajo. Ahora se declara la
// SUMA DE LO QUE CADA COLUMNA NECESITA (`ANCHO_MINIMO`), topeada contra lo disponible: pedir
// menos que lo que hay es lo único que hace que la barra no aparezca. Ver `ANCHO_MINIMO`.
// =============================================================================

// ⚠️ `DragEvent` de React se importa con OTRO nombre a propósito: el del arrastre en
// `document` es el DragEvent del DOM, y con el de React importado a secas el global queda
// tapado y el listener nativo deja de tipar.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent as DragReact, type ReactNode } from 'react';
import { type BoardTask, type Label, PCOLOR, PLABEL, prioFromScore } from './types';
import type { Board } from './useBoard';
import { fechaConDia, diasHasta, plazoTexto, IconoTacho, ANCHO_TABLA_EN_PROYECTO } from './piezas';
import { usePref, esUnoDe } from './prefs';
import { AccionesLote } from './AccionesLote';
import { ScoreIcon } from './guardian-form';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OrdenProy = 'deadline' | 'score' | 'nombre' | 'avance';
type OrdenTarea = 'deadline' | 'score' | 'proyecto' | 'num';

// ── la caja de la tabla ──────────────────────────────────────────────────────────────
// El scroll horizontal vive ACÁ, en el contenido, que es donde la regla de la casa lo
// permite (una BARRA DE NAVEGACIÓN no scrollea; una tabla sí). Sin esto, con el zoom al
// 150% la tabla empuja el ancho del documento entero y se lleva puesto el header.
const cajaStyle: CSSProperties = { width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' };
// ⚠️ EL `minWidth` NO ES UNA CONSTANTE: lo pasa cada tabla, porque lo que necesita depende
// de las columnas que DIBUJA y de DÓNDE se dibuja. Los 720 de antes eran los de la tabla
// completa a lo ancho de la pantalla, y adentro del detalle de un proyecto —una columna de
// ~500px— eso era scroll horizontal SIEMPRE, con «Proyecto» cortada al medio. «Intenta
// evitar al MÁXIMO el scroll» (25/09/2026). La barra NO se esconde (`scrollbar-width: none`
// está prohibido en los dos ejes): el objetivo es que no haga falta, no taparla.
// El número de adentro de un proyecto es `ANCHO_TABLA_EN_PROYECTO` (./piezas) y NO se
// escribe acá: depende del ancho de la columna derecha del modal, que vive en otro archivo.
const tablaStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13.5 };
// ── LO QUE CADA COLUMNA PIDE DE VERDAD ───────────────────────────────────────────────
// Son los números con los que se calcula `ANCHO_MINIMO`, y por eso están acá arriba y no
// tipeados adentro de cada `<Th>`: un ancho declarado en un lado y sumado en otro se
// desincroniza al primer ajuste, y lo que se rompe es justo la barra horizontal que esto
// viene a matar.
//
// Cada uno es CONTENIDO + los 20px de padding horizontal de la celda (10+10):
//   · 28  la casilla de selección: 16 de casilla + 12 de padding izquierdo (la celda no
//         lleva padding derecho, ver la fila).
//   · 76  la prioridad: el chip `Score` mide ~51 con tres dígitos (borde 2 + padding 13 +
//         ícono 11 + gap 3 + «100» a 12px mono ≈ 22). Eran 124 porque al lado iba la
//         PALABRA; ver `Score`, que ahora la dice en su `title`.
//   · 138 el deadline: el `input type=date` (118) + 20.
//   · 72  las dos acciones: check 22 + gap 4 + tacho 24 + 20. Sin `onEliminar` son 48, y
//         esos 24 se los queda el título.
//   · 190 el proyecto: el chip topea en 170 + 20. No se dibuja adentro de un proyecto.
//   · 130 el avance de un proyecto: la barra (56) + «12/30» + 20.
//   · 130 el título de una tarea y 200 el nombre de un proyecto: el PISO, no lo que les
//         toca. Son las únicas columnas elásticas, así que se quedan con todo lo que
//         sobre; el piso es lo mínimo para que el recorte con «…» siga diciendo algo. El
//         que cede es el título, a propósito.
const C_SEL = 28, C_PRIO = 76, C_FECHA = 138, C_ACC = 72, C_ACC_SOLA = 48, C_PROY = 190, C_TITULO = 130, C_AVANCE = 130, C_NOMBRE = 200;
const thBase: CSSProperties = { textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 700, padding: '9px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
// 5px y no 9 de padding vertical: es lo que PAGA la segunda línea del título. «Pon las
// tareas en doble línea como máximo… pero que no haya tanto scroll, mejor que no haya casi
// nada o nada» (25/09/2026) son dos pedidos que se cruzan, y la cuenta cierra sólo si la
// fila se aprieta en la misma pasada. Lo que gobierna el alto de una fila es lo más alto
// que tenga adentro:
//   · el título a DOS líneas: 13.5px × 1.2 × 2 = 32
//   · el `input` de la fecha: 25 (era 27)
//   · los dos íconos de acción: 24
// Con 18 de padding, TODA fila medía 45. Con 10, una de dos líneas mide 42 y una de UNA
// mide 35. O sea que ninguna fila queda más alta que antes, ni siquiera la que ahora ocupa
// el doble de líneas — y la mayoría baja un 22%.
const tdBase: CSSProperties = { padding: '5px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
// 118 y no 126: un `input type=date` a 12.5px dibuja «dd/mm/aaaa» (~62px) más el ícono del
// calendario (~18px) más su padding y su borde (~16); lo demás era hueco, y ese hueco se
// pagaba en scroll. No se baja más: por debajo de ~110 Chrome recorta «aaaa» y el dato se
// deja de leer, que es peor que la barra.
const fechaInput: CSSProperties = { width: 118, padding: '4px 7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12.5, fontFamily: SANS };
/** El botón de una acción de fila: un ícono, sin rótulo, con el nombre en `title`. */
const accionBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flex: 'none', padding: 0, border: 'none', background: 'transparent', borderRadius: 7, cursor: 'pointer' };

// ── ARRASTRAR UNA FILA PARA CAMBIARLE LA PRIORIDAD ───────────────────────────────────
/**
 * «Que en el formato tabla también pueda arrastrar y cambiar la prioridad» (25/09/2026).
 *
 * Es el MISMO gesto que en el Kanban y termina en el MISMO pop-up: soltar dice DÓNDE, la
 * persona dice CUÁNTO. Lo que cambia es qué significa «dónde»: en el Kanban es una columna
 * (la banda) más la posición; en una tabla no hay columnas, así que el número sale
 * enteramente de ENTRE QUÉ DOS FILAS cae.
 *
 * ⚠️ SÓLO SE PUEDE AGARRAR CUANDO LA TABLA ESTÁ ORDENADA POR PRIORIDAD, y no es una
 * limitación técnica: es la regla de la casa de no pintar un control que no se puede
 * cumplir. Con la tabla ordenada por deadline, la posición entre dos filas no dice ningún
 * número —los scores de las vecinas están en cualquier orden— y peor: la fila soltada no se
 * movería de lugar, porque el orden lo decide la fecha. Un gesto que hace su trabajo y
 * después te muestra la pantalla igual es indistinguible de uno roto. La pista de cómo
 * habilitarlo va en el `title` del encabezado «Prioridad», que es el que hay que tocar.
 *
 * El molde del arrastre es el de `CardTile` + `Kanban` (BoardShell), medido a lo largo de
 * siete rondas, y acá se repite con las mismas cuatro piezas:
 *   · imagen de arrastre VACÍA (la que pinta el sistema operativo no la gobierna el CSS),
 *   · una copia NUESTRA que sigue al cursor, movida por `transform` desde un `dragover` en
 *     `document` y EN CAPTURA (el de la tabla no cubre los huecos ni el fondo),
 *   · el nodo ORIGEN no se toca (colapsarlo deja el gesto sin salida),
 *   · auto-scroll adentro del propio `dragover` (durante un arrastre nativo el navegador
 *     congela `requestAnimationFrame` Y los timers).
 *
 * ⚠️ Y UNA DIFERENCIA QUE NO ES CAPRICHO: acá el auto-scroll empuja la CAJA QUE SCROLLEA,
 * no la ventana. Adentro del detalle de un proyecto esta tabla vive en la columna principal
 * del modal, que es la que tiene el `overflow-y`; un `window.scrollBy` ahí mueve 0px y el
 * arrastre vuelve a servir para lo que ya se ve, que es el mismo bug que el Kanban pagó el
 * 23/09/2026 con la página.
 *
 * ⚠️ Está escrito acá y no importado porque el molde del Kanban vive DENTRO del componente
 * `Kanban` (`agarrar`, `empujarScroll`, `soltarCopia` son sus `useCallback`) y no se exporta.
 * O sea que hoy el molde está en dos archivos. Lo que corresponde es sacarlo a un
 * `arrastre-copia.ts` que importen los dos; queda anotado, no hecho, porque BoardShell no es
 * de esta pasada.
 */
const MARCA_ARRIBA: CSSProperties = { boxShadow: 'inset 0 2px 0 var(--primary)' };
const MARCA_ABAJO: CSSProperties = { boxShadow: 'inset 0 -2px 0 var(--primary)' };

/**
 * La caja que de verdad scrollea arriba de esta fila: la columna del modal, o nada (y
 * entonces scrollea la ventana). Se pregunta UNA vez, al agarrar.
 */
function cajaQueScrollea(n: HTMLElement | null): HTMLElement | null {
  for (let e = n?.parentElement ?? null; e && e !== document.body; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

/**
 * El número que le corresponde a una fila soltada ENTRE otras dos: el punto medio.
 *
 * Los bordes dependen de la DIRECCIÓN del orden, que es lo que no tiene el Kanban (allá una
 * columna siempre va de mayor a menor). Con la tabla en `desc`, arriba de todo es +2 sobre
 * la primera; en `asc` es −2, porque ahí «arriba» es el número más chico.
 *
 * Sale una SUGERENCIA, no el número final: el pop-up siempre pregunta del 1 al 100.
 */
/**
 * El número que SUGIERE la posición donde soltaste. Sale de los scores de las dos filas
 * vecinas, no del orden de la tabla: soltar entre un 93 y un 43 propone 68 esté la tabla
 * ordenada por prioridad, por deadline o por nombre.
 *
 * ⚠️ ESO ES LO QUE HACE QUE EL ARRASTRE NO NECESITE UN CANDADO. Estuvo atado a
 * `orden === 'score'` unas horas del 25/09/2026, con el argumento de que «entre dos filas
 * que no están ordenadas por prioridad, la posición no dice ningún número». El argumento
 * era falso: las dos vecinas TIENEN su score igual, y el promedio de los dos es tan
 * significativo como en cualquier otro orden. Lo único que no significaba nada era el
 * `paso` de los bordes — ver abajo.
 *
 * Y el costo del candado fue el de siempre: la tabla de tareas se dibuja ordenada por
 * DEADLINE (la preferencia por navegador de Martín), así que las filas ni siquiera nacían
 * `draggable` y el gesto no hacía absolutamente nada. Se reportó como «aún no funciona lo
 * de agarrar una fila y arrastrarla». Un control que se ofrece y no responde no se lee como
 * «acá no aplica»: se lee como que la app está rota.
 *
 * @param porPrioridad si la lista está ordenada por score. Sólo cambia los BORDES: soltar
 *   arriba de todo en una lista por prioridad significa «más que el primero» (de ahí el
 *   ±2), y en una lista por deadline no significa nada, así que se propone el score del
 *   único vecino y la persona decide en el pop-up.
 */
function scoreEntreFilas(resto: Array<{ score: number }>, pos: number, dir: 'asc' | 'desc', actual: number, porPrioridad: boolean): number {
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
  const paso = porPrioridad ? (dir === 'asc' ? -2 : 2) : 0;
  const arriba = resto[pos - 1];
  const abajo = resto[pos];
  if (arriba && abajo) return clamp((arriba.score + abajo.score) / 2);
  if (abajo) return clamp(abajo.score + paso);
  if (arriba) return clamp(arriba.score - paso);
  return clamp(actual);
}

function useArrastreFilas(
  /** las filas EN JUEGO, en el orden en que se dibujan (las terminadas no entran) */
  filas: Array<{ id: string; score: number }>,
  dir: 'asc' | 'desc',
  /** si la lista está ordenada por score. NO habilita ni deshabilita el gesto: sólo cambia
   *  qué se sugiere al soltar en un borde (ver `scoreEntreFilas`). */
  porPrioridad: boolean,
  onSoltar?: (id: string, sugerido: number) => void,
) {
  // La ÚNICA condición es que quien monta la tabla haya pasado la capacidad. El orden de la
  // tabla no entra: ver el porqué, medido, en `scoreEntreFilas`.
  const activo = !!onSoltar;
  // QUE HAY UNA FILA EN LA MANO ES UN REF, NO ESTADO: no se dibuja con eso (el nodo origen
  // no se toca) y un `setState` en el `dragstart` es un re-render de la tabla entera justo
  // en el frame en que arranca el gesto. Además evita la carrera: los eventos de arrastre
  // son de prioridad CONTINUA en React, así que un estado escrito en `dragstart` puede no
  // estar commiteado cuando llega el primer `dragover` — y ahí el guard de abajo rebota el
  // primer evento y el destino arranca tarde.
  const agarrada = useRef<string | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  /** el punto medio de cada fila, en coordenadas de la CAJA QUE SCROLLEA. Se mide una sola
   *  vez, al agarrar: leer layout en cada movimiento es lo que hace que un arrastre se
   *  sienta pegajoso (ya medido en el Kanban y en `arrastre-tactil.ts`). */
  const medios = useRef<number[]>([]);
  const caja = useRef<HTMLElement | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  useEffect(() => () => { copia.current?.remove(); copia.current = null; }, []);

  /**
   * De `clientY` (la ventana) a la coordenada de la CAJA QUE SCROLLEA, que es la única que
   * no se mueve durante el gesto: por eso los puntos medios se guardan así y no hace falta
   * volver a medir las filas cuando la caja se corre sola.
   *
   * El borde de la caja se relee en cada llamada en vez de cachearse al agarrar: es UNA
   * lectura de layout por evento (lo que costaba caro eran las 55 del Kanban) y a cambio no
   * hay ningún caso en que el número quede viejo —una caja que no es `fixed` se mueve
   * cuando scrollea la página, y ahí un `top` cacheado corre el destino sin avisar—.
   */
  const posDe = (clientY: number) => {
    const el = caja.current;
    return el ? clientY - el.getBoundingClientRect().top + el.scrollTop : clientY + window.scrollY;
  };
  const limpiar = () => {
    setIns(null);
    medios.current = [];
    agarrada.current = null;
    caja.current = null;
    copia.current?.remove();
    copia.current = null;
  };
  const empujar = (clientY: number) => {
    const el = caja.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const d = clientY < r.top + 70 ? -1 : clientY > r.bottom - 70 ? 1 : 0;
      if (d) el.scrollTop += d * 14;
      return;
    }
    const d = clientY < 110 ? -1 : clientY > window.innerHeight - 110 ? 1 : 0;
    if (d) window.scrollBy(0, d * 18);
  };

  const agarrar = (e: DragReact<HTMLTableRowElement>, id: string) => {
    // ⚠️ DONDE SE ESCRIBE TEXTO NO ARRANCA EL ARRASTRE. La fila entera es agarrable —igual
    // que la tarjeta del Kanban, que tiene adentro su casilla y su tacho y no se pelean con
    // nada: un click sin movimiento no es un arrastre—. Lo que SÍ se pelea es un `<input>`,
    // donde arrastrar significa seleccionar texto: ahí el `draggable` de arriba se come el
    // gesto que la pieza ya tenía. Por eso la única celda marcada con `data-nodrag` es la
    // del deadline, y no la casilla ni los botones.
    if ((e.target as HTMLElement | null)?.closest?.('[data-nodrag]')) { e.preventDefault(); return; }
    const tr = e.currentTarget;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador y se ve translúcida como antes */ }

    caja.current = cajaQueScrollea(tr);
    const cuerpo = tr.parentElement;
    medios.current = [...(cuerpo?.querySelectorAll<HTMLElement>('[data-fila]') ?? [])].map((f) => {
      const r = f.getBoundingClientRect();
      return posDe(r.top + r.height / 2);
    });

    // LA COPIA. Un `<tr>` suelto no se puede posicionar (`position` no aplica a
    // `display: table-row`), así que la copia es un `<div>` fijo con su propia tablita
    // adentro y los anchos de celda clavados en lo medido — si no, el `table-layout` los
    // reparte de nuevo y la copia no se parece a lo que agarraste.
    const r = tr.getBoundingClientRect();
    const fondo = getComputedStyle(tr).backgroundColor;
    const cont = document.createElement('div');
    Object.assign(cont.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`,
      background: fondo && fondo !== 'rgba(0, 0, 0, 0)' ? fondo : 'var(--surface)',
      border: '1px solid var(--border-strong)', borderRadius: '10px', overflow: 'hidden',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none',
    });
    const tabla = document.createElement('table');
    Object.assign(tabla.style, { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: SANS, fontSize: '13.5px' });
    const cpo = document.createElement('tbody');
    const clon = tr.cloneNode(true) as HTMLElement;
    [...tr.children].forEach((celda, i) => {
      const h = clon.children[i] as HTMLElement | undefined;
      if (!h) return;
      h.style.width = `${(celda as HTMLElement).getBoundingClientRect().width}px`;
      h.style.borderBottom = 'none';
      h.style.boxShadow = 'none';
    });
    // `cloneNode` copia el ATRIBUTO, y React escribe los `input` por PROPIEDAD: sin esto la
    // copia viaja con la fecha vacía y la casilla desmarcada.
    const origen = tr.querySelectorAll('input');
    clon.querySelectorAll('input').forEach((inp, i) => {
      const o = origen[i];
      if (!o) return;
      inp.value = o.value;
      inp.checked = o.checked;
    });
    cpo.appendChild(clon);
    tabla.appendChild(cpo);
    cont.appendChild(tabla);
    document.body.appendChild(cont);
    copia.current = cont;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mover = (ev: globalThis.DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', mover, true); return; }
      copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', mover, true);
    const fin = () => {
      document.removeEventListener('dragover', mover, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copia.current?.remove();
      copia.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    agarrada.current = id;
  };

  return {
    activo,
    /** lo que va en cada `<tr>` que se puede agarrar */
    fila: (id: string) => (activo
      ? { draggable: true, 'data-fila': '', onDragStart: (e: DragReact<HTMLTableRowElement>) => agarrar(e, id), onDragEnd: limpiar }
      : {}),
    /** lo que va en el `<tbody>`: sin `preventDefault` el navegador RECHAZA el drop y no
     *  pasa nada, que se lee como que el arrastre no anda. */
    cuerpo: (activo
      ? {
        onDragOver: (e: DragReact<HTMLTableSectionElement>) => {
          if (!agarrada.current) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          empujar(e.clientY);
          const y = posDe(e.clientY);
          const m = medios.current;
          let idx = m.length;
          for (let i = 0; i < m.length; i++) { if (y < m[i]) { idx = i; break; } }
          // Sólo se re-renderiza cuando el destino CAMBIA de verdad: un `setState` por
          // cada `dragover` redibuja la tabla 60 veces por segundo y el gesto se siente roto.
          setIns((p) => (p === idx ? p : idx));
        },
        onDrop: (e: DragReact<HTMLTableSectionElement>) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain') || agarrada.current;
          const idx = ins ?? filas.length;
          limpiar();
          if (!id || !onSoltar) return;
          const j = filas.findIndex((f) => f.id === id);
          // La lista SIN la que se está moviendo: si se la deja adentro, el punto medio se
          // calcula contra su propio número y la fila «no se mueve». Y el índice se corre
          // uno cuando venía de más arriba, o soltar hacia abajo cae un lugar antes.
          const resto = filas.filter((f) => f.id !== id);
          const pos = j >= 0 && j < idx ? idx - 1 : idx;
          onSoltar(id, scoreEntreFilas(resto, pos, dir, filas[j]?.score ?? 50, porPrioridad));
        },
        onDragLeave: (e: DragReact<HTMLTableSectionElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns(null);
        },
      }
      : {}),
    /** la línea de 2px que dice dónde va a caer. Es una línea y no un hueco como en el
     *  Kanban: un hueco del alto de una fila en una tabla que se está apretando para que no
     *  scrollee es exactamente lo que no puede pasar. */
    marca: (i: number, ultima: boolean): CSSProperties | null => {
      if (ins == null) return null;
      if (ins === i) return MARCA_ARRIBA;
      if (ultima && ins === i + 1) return MARCA_ABAJO;
      return null;
    },
  };
}

function Th({ children, orden, activo, dir, onSort, ancho, ayuda }: { children: ReactNode; orden?: string; activo?: boolean; dir?: 'asc' | 'desc'; onSort?: () => void; ancho?: number;
  /** lo que dice el `title` cuando ordenar por esta columna HABILITA algo más (hoy:
   *  arrastrar las filas, que sólo tiene sentido con la tabla ordenada por prioridad). */
  ayuda?: string }) {
  if (!onSort) return <th style={{ ...thBase, width: ancho }}>{children}</th>;
  return (
    <th style={{ ...thBase, width: ancho }} aria-sort={activo ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={onSort} title={ayuda ?? `Ordenar por ${orden}`}
        style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: activo ? 'var(--primary)' : 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}{activo && <span aria-hidden>{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

/**
 * La celda del deadline: UN solo dato —la fecha, editable— teñido por lo que falta.
 *
 * Antes decía lo mismo TRES veces: el `input`, «mié 30 sep» al lado y «faltan 5 días»
 * al final. Textual (25/09/2026): «acá dice deadline y acá dice 30 del 9, acá miércoles
 * 30 de septiembre, o sea esto es tres veces el mismo dato nada más que representado de
 * forma diferente, no me interesa verlo de forma diferente». Queda la fecha; los días que
 * faltan «lo pondría en base a un código de COLORES».
 *
 * ⚠️ El color NUNCA es el único portador: el `title` y el `aria-label` dicen el plazo en
 * palabras («mié 30 sep · faltan 5 días»), que además es lo único que lee un lector de
 * pantalla y lo único que sobrevive a un daltonismo.
 *
 * ⚠️ Y SIN FECHA VA UN GUIÓN, no un cartel ni un triángulo: «un guion que justamente
 * muestre que el campo no está completado». Reemplaza al `WarnMark` **sólo en la tabla**:
 * una columna entera de triangulitos rojos parpadeando es exactamente el ruido que esta
 * vista vino a sacar. En las tarjetas, donde el aviso va solo y es la única señal, el
 * triangulito sigue.
 */
function CeldaFecha({ iso, hoy, onSet, nombre }: { iso: string; hoy: string; onSet: (v: string) => void; nombre: string }) {
  // El guión es un BOTÓN: al tocarlo aparece el `input`. Un `input type=date` vacío dibuja
  // «dd/mm/aaaa», que es justo el texto de más que el guión vino a reemplazar.
  const [editando, setEditando] = useState(false);
  const pickerAbierto = useRef(false);
  const dias = iso ? diasHasta(iso, hoy) : null;
  const plazo = dias == null ? null : plazoTexto(dias);
  // La escala sale de `plazoTexto`, la misma que usan las tarjetas: vencido y hoy en rojo,
  // esta semana en ámbar, más lejos neutro. Lo único que se cambia es ese último tramo:
  // `--faint` sobre el dato principal de una celda lo vuelve ilegible, y «falta mucho» no
  // necesita un color propio — necesita no gritar.
  const tinta = dias == null || plazo == null ? 'var(--ink)' : dias > 7 ? 'var(--dim)' : plazo.color;
  const enPalabras = plazo ? `${fechaConDia(iso)} · ${plazo.texto}` : 'sin deadline';

  if (!iso && !editando) {
    return (
      <button type="button" onClick={() => { pickerAbierto.current = false; setEditando(true); }}
        title={`${nombre}: sin deadline`} aria-label={`${nombre}: sin deadline. Ponerle una fecha`}
        style={{ border: 'none', background: 'transparent', padding: '5px 10px', cursor: 'pointer', fontFamily: MONO, fontSize: 15, lineHeight: 1, color: 'var(--faint)' }}>—</button>
    );
  }
  return (
    <input type="date" value={iso} onChange={(e) => onSet(e.target.value)} autoFocus={editando}
      // Viniendo del guión, el calendario se abre solo: si no, el guión costaría dos
      // clicks donde antes costaba uno. `showPicker` no existe en Safari viejo y tira si
      // la llamada no cuelga de un gesto, así que va opcional y adentro de un try.
      ref={(el) => {
        if (!el || !editando || pickerAbierto.current) return;
        pickerAbierto.current = true;
        try { el.showPicker?.(); } catch { /* sin picker nativo queda el input, que igual se edita */ }
      }}
      onBlur={() => setEditando(false)}
      title={`${nombre}: ${enPalabras}`} aria-label={`Deadline de ${nombre}: ${enPalabras}`}
      style={{ ...fechaInput, color: tinta, fontWeight: plazo?.fuerte ? 700 : 500, borderColor: plazo?.fuerte ? tinta : 'var(--border)' }} />
  );
}

/**
 * COMPLETAR. Es un CHECK, y la casilla cuadrada de la primera columna SELECCIONA.
 *
 * Son dos controles distintos en la misma fila y el reclamo principal de los dos audios
 * del 25/09/2026 es que no se puedan confundir: «acá lo que falta es una checkbox, porque
 * acá selecciono pero no es… si voy a individual me falta la checkbox de completar», más
 * la regla general —«que un mismo control signifique lo mismo en toda la app»—. Por eso la
 * forma es distinta a propósito: **cuadrado = seleccionar, redondo con tilde = completar**.
 *
 * Y es un ícono sin rótulo: «un check y un tacho», no dos botones con texto. Lo que el
 * ícono no dice lo dice el `title`, que es donde el texto no ocupa lugar.
 */
function CheckHecha({ hecha, onToggle, titulo }: { hecha: boolean; onToggle: () => void; titulo: string }) {
  const texto = hecha ? `Completada — reabrir «${titulo}»` : `Marcar «${titulo}» como completada`;
  return (
    <button type="button" onClick={onToggle} title={texto} aria-label={texto} aria-pressed={hecha}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flex: 'none', padding: 0, cursor: 'pointer', borderRadius: 999, border: `1.5px solid ${hecha ? 'var(--good)' : 'var(--border-strong)'}`, background: hecha ? 'var(--good)' : 'transparent', color: hecha ? '#fff' : 'var(--faint)', fontSize: 12, lineHeight: 1 }}>✓</button>
  );
}

/**
 * La prioridad: UN chip con el número, teñido por la banda.
 *
 * ⚠️ AL LADO IBA LA PALABRA («Alta», «Media», «A futuro») y se fue. Es el mismo dato dos
 * veces —la banda sale del número, `prioFromScore`— y es exactamente lo que se sacó de la
 * celda del deadline el mismo día: «esto es tres veces el mismo dato nada más que
 * representado de forma diferente, no me interesa verlo de forma diferente» (25/09/2026).
 * Además la tabla de PROYECTOS nunca la dibujó: dos tablas hermanas mostrando lo mismo de
 * dos formas distintas.
 *
 * Y costaba 48px de ancho en la columna más apretada del producto — con «A futuro», que es
 * el valor más largo del conjunto, la celda pedía 129px sobre los 124 declarados, así que
 * la columna se estiraba sola y devolvía la barra horizontal que el resto de la pasada
 * estaba sacando.
 *
 * ⚠️ El color NO es el único portador: `titulo` dice la banda en palabras, y va en el
 * `title` y en el `aria-label` —que es lo único que lee un lector de pantalla y lo único
 * que sobrevive a un daltonismo—.
 */
function Score({ score, color, titulo }: { score: number; color: string; titulo?: string }) {
  return <span title={titulo} aria-label={titulo} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 12, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 7px 2px 6px' }}><ScoreIcon size={11} color={color} />{score}</span>;
}

function Barra({ pct, color }: { pct: number; color: string }) {
  return <span style={{ display: 'block', width: 56, height: 5, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></span>;
}

/**
 * La fila que pliega lo terminado. Se ve el número; lo que hay adentro, a un click.
 *
 * ⚠️ ES UNA FILA MÁS DE LA MISMA TABLA, NO OTRA TABLA. «Que las "18 completadas"
 * simplemente sea otra fila más de una ÚNICA tabla, y al clickearlo ahí aparecen las otras
 * filas, no otra tabla» (25/09/2026). Por eso `TablaTareas` recibe TODAS las tareas
 * —abiertas y terminadas— y las parte ella: dos `<TablaTareas>` una arriba de la otra
 * dibujan dos encabezados, dos barras de acciones y dos anchos distintos para lo mismo.
 *
 * ⚠️ `cols` NO tiene default y se calcula en quien llama. Estuvo hardcodeado en 6, que era
 * cierto sólo mientras la tabla tuviera siempre las mismas seis columnas; con
 * `ocultarProyecto` son cinco, y un `colSpan` de más deja la fila desbordando la tabla.
 */
function FilaPlegada({ n, abierto, onToggle, cols, texto }: { n: number; abierto: boolean; onToggle: () => void; cols: number; texto: string }) {
  if (n === 0) return null;
  // Que se ENTIENDA como clickeable: el chevron, el conteo, el `title` que dice la acción
  // en palabras, `aria-expanded` para quien no ve el chevron, y el fondo que responde al
  // pasar por encima. Sin eso es un renglón gris que parece un encabezado apagado.
  const accion = `${abierto ? 'Ocultar' : 'Ver'} ${n} ${texto}`;
  return (
    <tr>
      <td colSpan={cols} style={{ ...tdBase, padding: 0 }}>
        <button type="button" onClick={onToggle} title={accion} aria-expanded={abierto}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--dim)'; }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', border: 'none', background: 'var(--surface-2)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, padding: '9px 12px', cursor: 'pointer' }}>
          <span aria-hidden style={{ flex: 'none', display: 'inline-block', width: 10, fontSize: 10, transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .12s ease' }}>▸</span>
          <span>{n} {texto}</span>
        </button>
      </td>
    </tr>
  );
}

// ── PROYECTOS ────────────────────────────────────────────────────────────────────────

export function TablaProyectos({ filas, topProjectId, hoy, onOpen, onDeadline, labelPlural, onSoltar }: {
  filas: Array<{ l: Label; prog: { pct: number; total: number; done: number } }>;
  topProjectId: string | null;
  hoy: string;
  onOpen: (id: string) => void;
  onDeadline: (id: string, iso: string) => void;
  labelPlural: string;
  /**
   * Soltaste una fila en otra posición: NO se fija sola, se abre el pop-up del 1 al 100 con
   * el número que sugiere la POSICIÓN. Es el mismo `setSoltada` que ya usan el Kanban y los
   * dos detalles (`{ entidad: 'proyecto', id, sugerido }`), no otro.
   *
   * ⚠️ Sin esta prop la fila no se puede agarrar, igual que el tacho sin `onEliminar`: la
   * prop ES la capacidad, y el tablero que no puede fijar una prioridad a mano no la pasa.
   */
  onSoltar?: (id: string, sugerido: number) => void;
}) {
  const [orden, setOrden] = usePref<OrdenProy>('proyectos.tabla.orden', 'deadline', esUnoDe('deadline', 'score', 'nombre', 'avance'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('proyectos.tabla.dir', 'asc', esUnoDe('asc', 'desc'));
  const [verHechos, setVerHechos] = useState(false);

  const sortear = (col: OrdenProy) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    // Cada columna tiene una dirección que se lee natural: la fecha más cercana primero,
    // la prioridad más alta primero. Arrancar siempre en `asc` deja la tabla al revés.
    setDir(col === 'deadline' || col === 'nombre' ? 'asc' : 'desc');
  };

  const { vivos, hechos } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: { l: Label; prog: { pct: number } }, b: { l: Label; prog: { pct: number } }) => {
      if (orden === 'nombre') return s * a.l.name.localeCompare(b.l.name, 'es');
      if (orden === 'score') return s * ((a.l.score || 0) - (b.l.score || 0));
      if (orden === 'avance') return s * (a.prog.pct - b.prog.pct);
      // Por deadline: los que NO tienen van al final SIEMPRE, en las dos direcciones —
      // invertir el orden no puede hacer que lo que no tiene fecha encabece la tabla.
      const fa = a.l.deadline || '', fb = b.l.deadline || '';
      if (!fa && !fb) return (b.l.score || 0) - (a.l.score || 0);
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = filas.slice().sort(cmp);
    return {
      vivos: orde.filter(({ prog }) => !(prog.total > 0 && prog.pct >= 100)),
      hechos: orde.filter(({ prog }) => prog.total > 0 && prog.pct >= 100),
    };
  }, [filas, orden, dir]);

  // Arrastrar una fila para cambiarle la prioridad, igual que en el Kanban. Sólo con la
  // tabla ordenada por prioridad: ver `useArrastreFilas`.
  const arr = useArrastreFilas(vivos.map(({ l }) => ({ id: l.id, score: l.score })), dir, orden === 'score', onSoltar);

  const fila = ({ l, prog }: { l: Label; prog: { pct: number; total: number; done: number } }, hecho: boolean, i = -1, ultima = false) => {
    // Lo terminado está al fondo y plegado: no se agarra ni marca posición.
    const marca = hecho ? null : arr.marca(i, ultima);
    const td = marca ? { ...tdBase, ...marca } : tdBase;
    return (
      <tr key={l.id} {...(hecho ? {} : arr.fila(l.id))}
        style={{ background: hecho ? 'var(--surface-2)' : undefined, cursor: !hecho && arr.activo ? 'grab' : undefined }}>
        <td style={{ ...td, maxWidth: 340 }}>
          <button type="button" onClick={() => onOpen(l.id)} title={`Abrir «${l.name}»`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
            <span style={{ flex: 'none' }}>{l.emoji}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: l.color, fontWeight: 700, flex: 'none' }}>{l.pid}</span>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: hecho ? 'line-through' : 'none', opacity: hecho ? .7 : 1 }}>{l.name}</span>
            {l.id === topProjectId && <span title="Objetivo Principal" style={{ flex: 'none' }}>🎯</span>}
          </button>
        </td>
        {/* El chip va teñido con el color del PROYECTO, no con el de la banda, así que acá
            el color no dice la prioridad: la dice el número y la dice el `title`. */}
        <td style={td}><Score score={l.score} color={l.color} titulo={`Prioridad ${l.score} de 100 · ${PLABEL[prioFromScore(l.score)]}`} /></td>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Barra pct={prog.pct} color={l.color} />
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{prog.done}/{prog.total}</span>
          </div>
        </td>
        {/* `data-nodrag`: acá adentro se escribe una fecha, y empezar el arrastre desde el
            `input` se come el gesto que esa pieza ya tenía. */}
        <td style={td} data-nodrag>
          <CeldaFecha iso={l.deadline || ''} hoy={hoy} nombre={`«${l.name}»`} onSet={(v) => onDeadline(l.id, v)} />
        </td>
      </tr>
    );
  };

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      {/* El piso es la SUMA de lo que las columnas piden (ver arriba), no un número
          copiado de la tabla de al lado. Bajó de 600 a 544 al irse la palabra de la
          prioridad y al apretarse el padding: lo que sobra se lo queda el nombre. */}
      <table style={{ ...tablaStyle, minWidth: C_NOMBRE + C_PRIO + C_AVANCE + C_FECHA }}>
        <thead>
          <tr>
            <Th orden="nombre" activo={orden === 'nombre'} dir={dir} onSort={() => sortear('nombre')}>{labelPlural}</Th>
            {/* ⚠️ EL `title` DE ESTE ENCABEZADO ES LA PISTA DE CÓMO SE HABILITA EL
                ARRASTRE. Ordenar por deadline o por nombre deja la posición entre filas sin
                significado, así que ahí no se puede agarrar nada — y un control que
                desaparece sin decir por qué se lee como una pantalla rota. */}
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={C_PRIO}
              ayuda="Ordenar por prioridad">Prioridad</Th>
            <Th orden="avance" activo={orden === 'avance'} dir={dir} onSort={() => sortear('avance')} ancho={C_AVANCE}>Tareas</Th>
            {/* 330 era el ancho de cuando la celda decía la fecha tres veces; 160, el de
                cuando el `input` medía 138; 150, el de cuando medía 126. */}
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={C_FECHA}>Deadline</Th>
          </tr>
        </thead>
        <tbody {...arr.cuerpo}>
          {vivos.map((f, i) => fila(f, false, i, i === vivos.length - 1))}
          {vivos.length === 0 && hechos.length === 0 && (
            <tr><td colSpan={4} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay {labelPlural.toLowerCase()} para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechos.length} abierto={verHechos} onToggle={() => setVerHechos((v) => !v)} cols={4} texto={`completado${hechos.length === 1 ? '' : 's'}`} />
          {verHechos && hechos.map((f) => fila(f, true))}
        </tbody>
      </table>
    </div>
  );
}

// ── TAREAS ───────────────────────────────────────────────────────────────────────────

export function TablaTareas({ tareas, board, hoy, onOpen, onOpenProj, ask, ocultarProyecto = false, onEliminar, onSoltar }: {
  /** TODAS: abiertas Y terminadas. La tabla las separa sola (ver `FilaPlegada`). */
  tareas: BoardTask[];
  board: Board;
  hoy: string;
  onOpen: (id: string) => void;
  onOpenProj?: (id: string) => void;
  /** confirmar lo irreversible (lo trae el board) */
  ask: (msg: string, onOk: () => void) => void;
  /** dentro de un proyecto la columna Proyecto es siempre la misma: se esconde y la
   *  tabla baja su minWidth para no scrollear de costado. */
  ocultarProyecto?: boolean;
  /** abre la pregunta de borrar. Sin esto, la fila no dibuja el tacho. */
  onEliminar?: (id: string) => void;
  /**
   * Soltaste una fila en otra posición: abre el MISMO pop-up del 1 al 100 que el Kanban
   * (`setSoltada({ entidad: 'tarea', id, sugerido })`), con el número que sugiere la
   * posición. Sin esta prop la fila no se puede agarrar.
   *
   * ⚠️ LA PROP **ES** LA CAPACIDAD, y por eso la tabla no consulta `repo.prioridadManual`
   * por su cuenta: el tablero del CLIENTE no tiene esa escritura (ni la columna
   * `score_manual`), así que no pasa la prop y la fila no dibuja el agarre. Un componente
   * compartido que decide solo qué puede escribir es cómo el slider de prioridad salió a
   * producción contestándole «solo admin» a todos los clientes.
   */
  onSoltar?: (id: string, sugerido: number) => void;
}) {
  /**
   * LO SELECCIONADO. La casilla de la primera columna SELECCIONA, no completa.
   *
   * «En la vista de tabla el botón de marcar como completada no debería salir allí, porque
   * pareciera que es un botón de seleccionar varias» (23/09/2026). Y tenía razón por partida
   * doble: en una tabla, una casilla en la primera columna ES el control de selección —lo es
   * en Gmail, en Drive y en cualquier tabla— así que la lectura no era un error de nadie.
   * Lo que faltaba era que hiciera lo que parecía que hacía.
   *
   * ⚠️ Y COMPLETAR NO SE FUE: volvió como CHECK, en la última columna (`CheckHecha`).
   * Sacarlo de acá dejó la fila sin ninguna forma de cerrar una tarea, y eso se reportó al
   * mes siguiente: «si voy a individual me falta la checkbox de completar» (25/09/2026).
   * Las dos conviven porque tienen forma distinta —cuadrado selecciona, redondo completa—,
   * que es la única manera de que un mismo control signifique lo mismo en toda la app.
   */
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [ordenPref, setOrden] = usePref<OrdenTarea>('kanban.tabla.orden', 'score', esUnoDe('deadline', 'score', 'proyecto', 'num'));
  const [dir, setDir] = usePref<'asc' | 'desc'>('kanban.tabla.dir', 'desc', esUnoDe('asc', 'desc'));
  const [verHechas, setVerHechas] = useState(false);

  // ⚠️ ORDENAR POR UNA COLUMNA QUE NO SE DIBUJA ES OFRECER UNA INCÓGNITA — es la misma
  // razón por la que el tooltip de «Tarea» dice «creación» desde que el #ID salió de la
  // fila. La preferencia se guarda por navegador y es la MISMA de la vista principal, así
  // que adentro de un proyecto puede llegar puesta en «proyecto», que ahí es una columna
  // escondida y un criterio constante. Cae al default de la tabla, sin pisar la
  // preferencia: al volver a la vista completa, su orden sigue donde lo dejó.
  const orden: OrdenTarea = ocultarProyecto && ordenPref === 'proyecto' ? 'score' : ordenPref;
  // Con «Proyecto» escondida son cinco columnas, no seis. Se calcula UNA vez y lo usan la
  // fila plegada y el cartel de «no hay tareas»: un `colSpan` hardcodeado es lo que hacía
  // desbordar la fila de las completadas.
  const cols = ocultarProyecto ? 5 : 6;

  const sortear = (col: OrdenTarea) => {
    if (col === orden) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setOrden(col);
    setDir(col === 'deadline' || col === 'proyecto' ? 'asc' : 'desc');
  };

  const nombreProy = (t: BoardTask) => board.labelById(t.labels[0])?.name ?? '';
  const { vivas, hechas } = useMemo(() => {
    const s = dir === 'asc' ? 1 : -1;
    const cmp = (a: BoardTask, b: BoardTask) => {
      if (orden === 'num') return s * (a.num - b.num);
      if (orden === 'score') return s * ((a.score || 0) - (b.score || 0));
      if (orden === 'proyecto') return s * nombreProy(a).localeCompare(nombreProy(b), 'es') || b.score - a.score;
      const fa = a.deadline || '', fb = b.deadline || '';
      if (!fa && !fb) return b.score - a.score;
      if (!fa) return 1;
      if (!fb) return -1;
      return s * fa.localeCompare(fb);
    };
    const orde = tareas.slice().sort(cmp);
    return { vivas: orde.filter((t) => t.progress < 100), hechas: orde.filter((t) => t.progress >= 100) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareas, orden, dir, board.labels]);

  // Arrastrar una fila para cambiarle la prioridad. Sólo lo ABIERTO entra en juego y sólo
  // con la tabla ordenada por prioridad: ver `useArrastreFilas`.
  const arr = useArrastreFilas(vivas.map((t) => ({ id: t.id, score: t.score })), dir, orden === 'score', onSoltar);

  // Sobre lo VISIBLE, nunca sobre el tablero entero: si hay un filtro puesto, «todas» son
  // las que se ven. Seleccionar lo que no está en pantalla es cómo se borra de más.
  const visiblesIds = (verHechas ? [...vivas, ...hechas] : vivas).map((t) => t.id);
  const todasSel = visiblesIds.length > 0 && visiblesIds.every((id) => sel.has(id));
  const alternar = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegidas = tareas.filter((t) => sel.has(t.id));
  /** La suma de lo que las columnas que se DIBUJAN necesitan. Ver el `minWidth` de abajo. */
  const ANCHO_MINIMO = C_SEL + C_TITULO + (ocultarProyecto ? 0 : C_PROY) + C_PRIO + C_FECHA + (onEliminar ? C_ACC : C_ACC_SOLA);

  const fila = (t: BoardTask, hecha: boolean, i = -1, ultima = false) => {
    const proy = board.labelById(t.labels[0]);
    const c = PCOLOR[prioFromScore(t.score)];
    // Lo terminado está al fondo y plegado: no se agarra ni marca posición.
    const marca = hecha ? null : arr.marca(i, ultima);
    const td = marca ? { ...tdBase, ...marca } : tdBase;
    return (
      <tr key={t.id} {...(hecha ? {} : arr.fila(t.id))}
        style={{ background: hecha ? 'var(--surface-2)' : undefined, cursor: !hecha && arr.activo ? 'grab' : undefined }}>
        <td style={{ ...td, width: C_SEL, paddingRight: 0 }}>
          <input type="checkbox" checked={sel.has(t.id)} onChange={() => alternar(t.id)}
            title="Seleccionar" aria-label={`Seleccionar «${t.title}»`}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
        </td>
        <td style={{ ...td, maxWidth: 420 }}>
          {/* SIN EL #ID. «El ID lo quitaría… el ID de la tabla de tareas» (25/09/2026):
              en una columna que ya cede ancho, el número se comía el principio del título
              en todas las filas para contestar una pregunta que nadie le hace a la tabla
              —el # se usa adentro del detalle, que es donde sigue estando—.
              ⚠️ DOS LÍNEAS COMO MÁXIMO, con «…» y el título entero en el `title`. Era UNA
              sola, y adentro de un proyecto —donde la columna cede ancho contra las otras
              cuatro— eso dejaba tareas cortadas a la mitad: «que no haya tanto scroll…
              pero que se siga entendiendo todo» (25/09/2026). Lo que paga la segunda línea
              es el padding de la fila, no más alto (ver `tdBase`).
              El recorte es `-webkit-line-clamp`, que es lo único que recorta POR LÍNEAS y
              pone el «…» al final de la última; con `overflow: hidden` a secas la segunda
              línea se corta al medio y sin puntos. */}
          {/* El `title` es el título ENTERO y nada más: es lo que recupera lo que el «…»
              se comió. Que la fila se puede arrastrar lo dice el cursor, igual que en el
              Kanban — ponerlo también acá son 50 tooltips repitiendo lo mismo. */}
          <button type="button" onClick={() => onOpen(t.id)} title={t.title}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--ink)', textAlign: 'left', maxWidth: '100%' }}>
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', lineHeight: 1.2, textDecoration: hecha ? 'line-through' : 'none', opacity: hecha ? .7 : 1 }}>{t.title}</span>
          </button>
        </td>
        {/* ⚠️ ADENTRO DE UN PROYECTO ESTA COLUMNA NO SE DIBUJA: son 190px repitiendo el
            nombre del proyecto que estás mirando en todas las filas, y en la columna
            principal del detalle (~538px) es la que quedaba cortada al medio. */}
        {!ocultarProyecto && (
          <td style={td}>
            {proy && (
              <button type="button" onClick={() => onOpenProj?.(proy.id)} title={`Abrir «${proy.name}»`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 170, border: `1px solid ${proy.color}33`, background: proy.color + '14', color: proy.color, borderRadius: 7, padding: '3px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ flex: 'none' }}>{proy.emoji}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proy.name}</span>
              </button>
            )}
          </td>
        )}
        {/* UN chip y nada más: la palabra al lado era el mismo dato dos veces y costaba
            48px de la columna más apretada del producto. La banda va en el color y en el
            `title` — ver `Score`. */}
        <td style={td}><Score score={t.score} color={c} titulo={`Prioridad ${t.score} de 100 · ${PLABEL[prioFromScore(t.score)]}`} /></td>
        {/* `data-nodrag`: acá adentro se escribe una fecha. */}
        <td style={td} data-nodrag>
          <CeldaFecha iso={t.deadline || ''} hoy={hoy} nombre={`«${t.title}»`} onSet={(v) => board.setDeadline(t.id, v, t.deadline)} />
        </td>
        {/* LAS DOS ACCIONES QUE CIERRAN UNA TAREA, JUNTAS: el check y el tacho.
            · El ESTADO se cambia desde acá: «otra columna para cambiar el estado»
              (25/09/2026). En este tablero el estado de una tarea es uno solo —activa o
              completada, que es lo que filtra el botón «Filtrar»—, así que la columna no
              inventa un tercer valor: es el check, que lo muestra y lo cambia en un click.
            · Y EL TACHO: «falta el botón de basura en la vista de tabla». Van en la MISMA
              celda y en el mismo orden que en la tarjeta y que al pie del detalle
              —«deberían estar juntos… un check y un ícono de tacho de basura»—, porque un
              control tiene que significar lo mismo en todos lados. Una columna propia para
              el tacho costaba un encabezado y ~34px de scroll para dibujar un solo ícono.
            Las dos van últimas y separadas de la casilla de selección, que vive en la
            primera: dos controles parecidos pegados es cómo se volvieron a confundir.
            ⚠️ El tacho NO borra: llama a `onEliminar`, que abre la pregunta de dos botones.
            Borrar de un click en una fila de una lista densa es borrar la de al lado. */}
        <td style={{ ...td, textAlign: 'right' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <CheckHecha hecha={hecha} onToggle={() => board.toggleDone(t.id)} titulo={t.title} />
            {onEliminar && (
              <button type="button" onClick={() => onEliminar(t.id)}
                title={`Eliminar «${t.title}»`} aria-label={`Eliminar «${t.title}»`}
                style={{ ...accionBtn, color: 'var(--faint)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--bad)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--faint)'; }}>
                <IconoTacho size={15} />
              </button>
            )}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div style={cajaStyle} className="mk-scroll-x">
      {/* La barra vive en `AccionesLote`: la usa también el Kanban desde el 24/09/2026, y
          dos copias de una barra de acciones divergen a la primera acción nueva. */}
      <AccionesLote elegidas={elegidas} board={board} ask={ask} onLimpiar={() => setSel(new Set())} estilo={{ marginBottom: 10 }} />
      {/* ⚠️ EL PISO ES LO QUE LAS COLUMNAS PIDEN, Y ADENTRO DE UN PROYECTO SE TOPEA CONTRA
          LO QUE HAY. Las dos mitades importan y cada una se aprendió rompiendo la otra:
          · Sumar lo que uno QUIERE no contesta si entra. El 25/09/2026 el piso fue 520
            sumando anchos deseados, y 520 no entraba: la columna derecha del detalle subió
            de 236 a 264 ese mismo día, en otro archivo.
          · Pero pedir EXACTAMENTE lo disponible (`ANCHO_TABLA_EN_PROYECTO`, la resta contra
            el modal) tampoco sirve: deja cero margen, así que cualquier cosa que mueva el
            número un píxel —el zoom, que achica el modal; «A futuro», que pedía 129 en una
            columna declarada en 124— devuelve la barra de abajo. Y la barra NO se esconde
            (`scrollbar-width: none` está prohibido): se hace que no haga falta.
          Ahora se pide la SUMA DE LO NECESARIO (444 adentro de un proyecto contra 496
          disponibles: 52px de aire) y se topea contra lo disponible, que es lo que evita
          declarar más de lo que hay si mañana la columna derecha vuelve a crecer. Lo que
          sobra se lo queda el título, que es la única columna elástica. */}
      <table style={{ ...tablaStyle, minWidth: ocultarProyecto ? Math.min(ANCHO_MINIMO, ANCHO_TABLA_EN_PROYECTO) : ANCHO_MINIMO }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: C_SEL, paddingRight: 0 }}>
              <input type="checkbox" checked={todasSel} ref={(el) => { if (el) el.indeterminate = sel.size > 0 && !todasSel; }}
                onChange={() => setSel(todasSel ? new Set() : new Set(visiblesIds))}
                title={todasSel ? 'Quitar la selección' : 'Seleccionar todas'} aria-label="Seleccionar todas"
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
            </th>
            {/* Ordena por `num`, que es el orden de CREACIÓN. El rótulo del tooltip dice
                «creación» y no «número» desde que el #ID salió de la fila: ofrecer ordenar
                por una columna que ya no se ve es ofrecer una incógnita. */}
            <Th orden="creación" activo={orden === 'num'} dir={dir} onSort={() => sortear('num')}>Tarea</Th>
            {!ocultarProyecto && <Th orden="proyecto" activo={orden === 'proyecto'} dir={dir} onSort={() => sortear('proyecto')} ancho={C_PROY}>Proyecto</Th>}
            {/* 150 y 160 eran anchos heredados; 124 era el chip MÁS la palabra. Con un solo
                chip son 76. El hueco de una tabla se paga en scroll horizontal.
                ⚠️ Y su `title` es la pista de cómo se habilita el arrastre de filas, que
                sólo se puede ofrecer con la tabla ordenada por prioridad. */}
            <Th orden="prioridad" activo={orden === 'score'} dir={dir} onSort={() => sortear('score')} ancho={C_PRIO}
              ayuda="Ordenar por prioridad">Prioridad</Th>
            <Th orden="deadline" activo={orden === 'deadline'} dir={dir} onSort={() => sortear('deadline')} ancho={C_FECHA}>Deadline</Th>
            {/* SIN RÓTULO. Decía «Estado» cuando la celda era sólo el check; ahora trae
                también el tacho, así que la palabra pasó a nombrar mal a la mitad de la
                columna — y un encabezado que miente es peor que ninguno. Las dos acciones
                se anuncian por su `title` y su `aria-label`, que es donde el texto no
                ocupa lugar; el nombre de la columna vive en el `aria-label` del `th`.
                Y mide lo que DIBUJA: sin `onEliminar` es un ícono solo, y los 24px del
                tacho se los queda el título. */}
            <th aria-label="Acciones" style={{ ...thBase, width: onEliminar ? C_ACC : C_ACC_SOLA }} />
          </tr>
        </thead>
        <tbody {...arr.cuerpo}>
          {vivas.map((t, i) => fila(t, false, i, i === vivas.length - 1))}
          {vivas.length === 0 && hechas.length === 0 && (
            <tr><td colSpan={cols} style={{ ...tdBase, textAlign: 'center', color: 'var(--faint)' }}>No hay tareas para este filtro.</td></tr>
          )}
          <FilaPlegada n={hechas.length} abierto={verHechas} onToggle={() => setVerHechas((v) => !v)} cols={cols} texto={`completada${hechas.length === 1 ? '' : 's'}`} />
          {verHechas && hechas.map((t) => fila(t, true))}
        </tbody>
      </table>
    </div>
  );
}
