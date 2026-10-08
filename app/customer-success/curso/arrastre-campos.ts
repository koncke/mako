'use client';

// =============================================================================
// arrastre-campos — arrastrar los CAMPOS de una tarea, adentro de su tarea y a OTRA tarea
// =============================================================================
// Pedido de Martín (08/10/2026, item 6 de los 20 ajustes), textual: «Una pregunta debería tener un
// contenedor y ese contenedor se debe poder arrastrar de la misma manera que se arrastran las clases o los
// cursos, para cambiar de posición las preguntas a voluntad».
//
// Y el feedback de la tarde (docs/feedback-curso-08oct.md, item 12, 21:30): «sería bueno que se pueda
// agregar más de una tarea». Con varias tareas en una clase, un campo se arrastra DENTRO de su tarea y
// ENTRE tareas, con la misma animación: por eso el gesto ya no es de UNA lista sino de la tarea entera
// (la zona, `[data-zona-campos]`) con una lista por tarea (`[data-grupo-campos]`).
//
// «DE LA MISMA MANERA» SE CUMPLE IMPORTANDO, NO COPIANDO (la regla de app/_cursos/arrastre-curso.ts): la
// foto vacía del sistema operativo y la copia que sigue al cursor son `fotoVaciaDeArrastre` y
// `useArrastreCopia` de app/plan/board/arrastre-copia.ts; el empuje del scroll, `empujeDeColumna`; y lo
// que DECIDE —en qué tarea cae, en qué lugar, si cambia algo— vive puro en ./tarea-editor-reglas.ts
// (`dondeCae`, `cambiaAlSoltar`), con test.
//
// Las reglas medidas de la casa, las mismas que el curso (AGENTS.md, las secciones del arrastre):
//   ⚠️ LO QUE VA EN LA MANO VIVE EN UN REF: el primer `dragover` puede llegar antes del render.
//   ⚠️ SE MIDE UNA VEZ POR GESTO, al primer `dragover`, en coordenadas del contenido que scrollea: con el
//      hueco abierto las tarjetas de abajo se corren, y medir en cada evento hace oscilar el lugar.
//   ⚠️ EL `setState` DEL HUECO SALE SÓLO SI CAMBIÓ.
//   ⚠️ EL AUTO-SCROLL VA EN UN `dragover` DE `document` EN CAPTURA (rAF y los timers se congelan).
//   ⚠️ UN GESTO QUE NACE EN UN CAMPO DE TEXTO O UN CONTROL NO ARRASTRA (`NO_ARRASTRA`).
//   ⚠️ AL ORIGEN NO SE LE TOCA LA CAJA: se marca con un borde, y lo que dice dónde cae es el hueco. Y el
//      hueco no se abre donde soltar no cambia nada (al lado de sí mismo).
//   ⚠️ EL DATO DEL ARRASTRE NO ES `text/plain` (`MIME_CAMPO`): adentro de la zona ahora vive el editor rico
//      de cada tarea (TipTap), y ProseMirror, al soltarle encima algo con texto plano, lo INSERTA en la
//      descripción. Medido en el banco de la pista TAREA: soltar el campo «c2» encima de la descripción de
//      la tarea 2 la dejaba en «<p>c2</p><p>Con el link de abajo.</p>» (y el campo se movía igual, así que
//      nadie lo nota hasta leer la consigna). Con un tipo propio no hay
//      texto que insertar; y mientras dura el gesto el editor rico no recibe el puntero (`is-arrastrando`,
//      la hoja de ./TareaEditor.tsx), así tampoco dibuja su cursor de soltar.

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { fotoVaciaDeArrastre, scrollerDe, useArrastreCopia } from '@/app/plan/board/arrastre-copia';
import { empujeDeColumna } from '@/app/crm/arrastre-columna';
import { cambiaAlSoltar, dondeCae, type TareaMedida } from './tarea-editor-reglas';

/** Lo que, si el gesto nace ahí adentro, NO arrastra la tarjeta: se escribe, se elige o se toca. */
export const NO_ARRASTRA = 'input, textarea, select, button, a, [contenteditable="true"], [role="listbox"], [data-nodrag]';

/** El tipo del dato que viaja en el arrastre (ver la cabecera: no puede ser `text/plain`). */
export const MIME_CAMPO = 'application/x-mako-campo';

type Medida = { tareas: TareaMedida[]; sc: HTMLElement | null };
type Hueco = { g: number; i: number };
const desplazamiento = (sc: HTMLElement | null) => (sc ? sc.scrollTop : window.scrollY);

export type ArrastreCampos = ReturnType<typeof useArrastreCampos>;

export function useArrastreCampos(p: {
  /** Los ids de los campos de CADA tarea, en el orden en que se dibujan (una lista por tarea). */
  grupos: readonly (readonly string[])[];
  /** Soltar el campo `id` en el lugar `i` de la tarea `g`. Sólo si soltar cambia algo (`cambiaAlSoltar`). */
  onSoltar: (id: string, g: number, i: number) => void;
  /** Mientras no se puede tocar nada: no se arrastra. */
  deshabilitado?: boolean;
}) {
  const { pararScroll, montarCopia, soltarCopia } = useArrastreCopia();
  const [mano, setMano] = useState<string | null>(null);
  const [hueco, setHueco] = useState<Hueco | null>(null);
  const [alto, setAlto] = useState(0);
  const manoRef = useRef<string | null>(null);
  const huecoRef = useRef<Hueco | null>(null);
  const medida = useRef<Medida | null>(null);
  const origen = useRef<Element | null>(null);
  const quitarEmpuje = useRef<(() => void) | null>(null);
  // Los datos viajan por un ref: los handlers se arman en cada render y el gesto dura muchos.
  const datos = useRef(p);
  useEffect(() => { datos.current = p; });

  const ponerHueco = (h: Hueco | null) => {
    const a = huecoRef.current;
    if (a === h || (a && h && a.g === h.g && a.i === h.i)) return;
    huecoRef.current = h;
    setHueco(h);
  };

  const terminar = useCallback(() => {
    manoRef.current = null;
    huecoRef.current = null;
    medida.current = null;
    setMano(null);
    setHueco(null);
    pararScroll();
    soltarCopia();
    quitarEmpuje.current?.();
  }, [pararScroll, soltarCopia]);
  useEffect(() => () => { quitarEmpuje.current?.(); }, []);

  /**
   * El auto-scroll y el hueco que se cierra afuera de la zona, en `document` y en captura. Empuja al que
   * scrollea la zona (el papel de la lección o el contenido del curso), medido en el `dragstart`.
   */
  const montarEmpuje = (nodo: HTMLElement) => {
    quitarEmpuje.current?.();
    const sc = scrollerDe(nodo);
    const empuje = (e: DragEvent) => {
      if (!manoRef.current) return;
      const t = e.target as Element | null;
      // El hueco dice dónde CAE: afuera de la zona soltar no hace nada, así que no hay hueco.
      if (!(typeof t?.closest === 'function' && t.closest('[data-zona-campos]'))) ponerHueco(null);
      const caja = sc ? sc.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const d = empujeDeColumna(caja, e.clientY);
      if (!d) return;
      if (sc) sc.scrollTop += d; else window.scrollBy(0, d);
    };
    const fin = () => {
      document.removeEventListener('dragover', empuje, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      if (quitarEmpuje.current === fin) quitarEmpuje.current = null;
    };
    document.addEventListener('dragover', empuje, true);
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    quitarEmpuje.current = fin;
  };

  /** `onPointerDownCapture` de la tarjeta: dónde nació el gesto. Adentro de un campo, no arrastra. */
  const marcarOrigen = (e: ReactPointerEvent<HTMLElement>) => {
    const t = e.target as Element;
    origen.current = t;
    // ⚠️ El `draggable` se apaga ANTES de que arranque el gesto: cancelar el `dragstart` no alcanza para
    //    seleccionar texto (el navegador ya lo tomó como un arrastre).
    e.currentTarget.draggable = !datos.current.deshabilitado && !(typeof t.closest === 'function' && t.closest(NO_ARRASTRA));
  };

  /** `onDragStart` de la tarjeta. La copia es la tarjeta entera. */
  const agarrar = (e: ReactDragEvent<HTMLElement>, id: string) => {
    if (!e.currentTarget.contains(e.target as Node)) return;
    const o = origen.current;
    if (datos.current.deshabilitado || (o && e.currentTarget.contains(o) && o.closest(NO_ARRASTRA))) { e.preventDefault(); return; }
    const nodo = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(MIME_CAMPO, id);
    fotoVaciaDeArrastre(e.dataTransfer);
    const r = nodo.getBoundingClientRect();
    manoRef.current = id;
    huecoRef.current = null;
    medida.current = null;
    setMano(id);
    setHueco(null);
    setAlto(Math.round(r.height));
    // ⚠️ COLGADA DE LA ZONA (`[data-zona-campos]`), no del `.ugc` como las clases: la hoja del formulario va
    //    acotada a la tarea (`.ec .ec-…`, para ganarle al reset del curso), y colgada afuera la copia salía
    //    con los campos sin vestir (medido en el banco: inputs pelados flotando). Es `position: fixed`, así
    //    que no ocupa lugar; y `medir` la saltea (lleva el mismo `data-arr-campo`).
    montarCopia(nodo, e.clientX - r.left, e.clientY - r.top, nodo.closest<HTMLElement>('[data-zona-campos]') ?? nodo.closest<HTMLElement>('.ugc'));
    montarEmpuje(nodo);
  };

  /** Cada tarea (`[data-grupo-campos]`) y los centros de sus campos, medidos UNA vez por gesto. */
  const medir = (zona: HTMLElement): Medida => {
    if (medida.current) return medida.current;
    const sc = scrollerDe(zona);
    const off = desplazamiento(sc);
    const tareas: TareaMedida[] = [];
    for (const n of zona.querySelectorAll<HTMLElement>('[data-grupo-campos]')) {
      const g = Number(n.dataset.grupoCampos);
      if (!Number.isInteger(g) || g < 0) continue;
      const r = n.getBoundingClientRect();
      // Sin la copia que sigue al cursor (vive adentro de la zona, ver `agarrar`).
      const medios = [...n.querySelectorAll<HTMLElement>('[data-arr-campo]')].filter((c) => c.style.position !== 'fixed')
        .map((c) => { const b = c.getBoundingClientRect(); return (b.top + b.bottom) / 2 + off; });
      tareas[g] = { y1: r.top + off, y2: r.bottom + off, medios };
    }
    // Una tarea que no se dibujó (no debería pasar) no puede recibir: un rango vacío lejos de todo.
    for (let g = 0; g < tareas.length; g++) tareas[g] ??= { y1: -1e9, y2: -1e9, medios: [] };
    const m = { tareas, sc };
    medida.current = m;
    return m;
  };

  /** Los handlers de la zona (la tarea entera): dónde caería, y qué pasa al soltar. */
  const zona = {
    'data-zona-campos': '',
    // ⚠️ Aceptar el `dragenter` (AGENTS.md / hallazgos de CS): un hueco que se abre debajo del cursor quieto
    //    dispara `dragenter` y no `dragover`, y sin aceptarlo el drop sobre el hueco recién abierto se pierde.
    onDragEnter: (e: ReactDragEvent<HTMLElement>) => { if (manoRef.current) e.preventDefault(); },
    onDragOver: (e: ReactDragEvent<HTMLElement>) => {
      const id = manoRef.current;
      if (!id) return;
      // `preventDefault` es lo que HABILITA soltar.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const m = medir(e.currentTarget);
      const d = dondeCae(m.tareas, e.clientY + desplazamiento(m.sc));
      ponerHueco(d && cambiaAlSoltar(datos.current.grupos, id, d.g, d.i) ? d : null);
    },
    onDrop: (e: ReactDragEvent<HTMLElement>) => {
      const id = manoRef.current;
      if (!id) return;
      e.preventDefault();
      // ⚠️ El hueco se lee ANTES de `terminar()`, que lo borra.
      const h = huecoRef.current;
      const { onSoltar } = datos.current;
      terminar();
      if (h == null) return;
      onSoltar(id, h.g, h.i);
    },
  };

  return {
    /** El id del campo que va en la mano (para marcarlo con el borde). */
    mano,
    /** El alto de la tarjeta agarrada: el hueco mide eso. */
    alto,
    /** ¿Va el hueco antes del campo `i` de la tarea `g` (o al final, con `i` = cuántos hay)? */
    huecoEn: (g: number, i: number) => mano != null && hueco != null && hueco.g === g && hueco.i === i,
    marcarOrigen,
    agarrar,
    terminar,
    zona,
    /** Lo que marca a la tarea `g` como una lista que recibe campos (lo que mide `medir`). */
    grupo: (g: number) => ({ 'data-grupo-campos': String(g) }),
  };
}
