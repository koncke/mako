'use client';

// =============================================================================
// arrastre-campos — arrastrar los CAMPOS del formulario de una tarea para cambiarlos de lugar
// =============================================================================
// Pedido de Martín (08/10/2026, item 6), textual: «Una pregunta debería tener un contenedor y ese
// contenedor se debe poder arrastrar de la misma manera que se arrastran las clases o los cursos, para
// cambiar de posición las preguntas a voluntad».
//
// «DE LA MISMA MANERA» SE CUMPLE IMPORTANDO, NO COPIANDO (la regla de app/_cursos/arrastre-curso.ts): la
// foto vacía del sistema operativo y la copia que sigue al cursor son `fotoVaciaDeArrastre` y
// `useArrastreCopia` de app/plan/board/arrastre-copia.ts; dónde cae y cómo queda la lista, `indiceEnLista`
// y `ordenAlSoltar` de app/_cursos/orden.ts; el empuje del scroll, `empujeDeColumna`. Lo propio de acá es
// UNA zona (la lista de campos) y qué se hace al soltar.
//
// ⚠️ NO ES `useArrastreCurso` CON UNA ZONA MÁS: ése sabe de módulos y clases (qué zona recibe qué, una
//    clase que cae sobre un módulo de la barra), y meterle los campos de una tarea le sumaba un tercer
//    tipo de mano a un hook que ya decide por dos. Las piezas que deciden son las MISMAS (arriba).
//
// Las reglas medidas de la casa, las mismas que el curso (AGENTS.md, las secciones del arrastre):
//   ⚠️ LO QUE VA EN LA MANO VIVE EN UN REF: el primer `dragover` puede llegar antes del render.
//   ⚠️ SE MIDE UNA VEZ POR GESTO, adentro del `dragover`, en coordenadas del contenido que scrollea.
//   ⚠️ EL `setState` DEL HUECO SALE SÓLO SI CAMBIÓ.
//   ⚠️ EL AUTO-SCROLL VA EN UN `dragover` DE `document` EN CAPTURA (rAF y los timers se congelan).
//   ⚠️ UN GESTO QUE NACE EN UN CAMPO DE TEXTO O UN CONTROL NO ARRASTRA (`NO_ARRASTRA`): adentro de la
//      tarjeta se escribe la pregunta, y seleccionar con el mouse se llevaba la tarjeta entera.
//   ⚠️ AL ORIGEN NO SE LE TOCA LA CAJA: se marca con un borde, y lo que dice dónde cae es el hueco.

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { fotoVaciaDeArrastre, scrollerDe, useArrastreCopia } from '@/app/plan/board/arrastre-copia';
import { empujeDeColumna } from '@/app/crm/arrastre-columna';
import { indiceEnLista, ordenAlSoltar } from '@/app/_cursos/orden';

/** Lo que, si el gesto nace ahí adentro, NO arrastra la tarjeta: se escribe, se elige o se toca. */
export const NO_ARRASTRA = 'input, textarea, select, button, a, [contenteditable="true"], [role="listbox"], [data-nodrag]';

type Medida = { medios: number[]; sc: HTMLElement | null };
const desplazamiento = (sc: HTMLElement | null) => (sc ? sc.scrollTop : window.scrollY);

export function useArrastreCampos(p: {
  /** Los ids de los campos, en el orden en que se dibujan. */
  ids: readonly string[];
  /** La lista ENTERA de ids en el orden nuevo. Sólo si soltar cambió algo. */
  onOrden: (ids: string[]) => void;
  /** Mientras se guarda algo que no se puede pisar (quitar la tarea): no se arrastra. */
  deshabilitado?: boolean;
}) {
  const { pararScroll, montarCopia, soltarCopia } = useArrastreCopia();
  const [mano, setMano] = useState<string | null>(null);
  const [hueco, setHueco] = useState<number | null>(null);
  const [alto, setAlto] = useState(0);
  const manoRef = useRef<string | null>(null);
  const huecoRef = useRef<number | null>(null);
  const medida = useRef<Medida | null>(null);
  const origen = useRef<Element | null>(null);
  const quitarEmpuje = useRef<(() => void) | null>(null);
  // Los datos viajan por un ref: los handlers se arman en cada render y el gesto dura muchos.
  const datos = useRef(p);
  useEffect(() => { datos.current = p; });

  const ponerHueco = (i: number | null) => {
    if (huecoRef.current === i) return;
    huecoRef.current = i;
    setHueco(i);
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
   * El auto-scroll y el hueco que se cierra afuera de la lista, en `document` y en captura. Empuja al
   * que scrollea la lista (el papel de la lección o el contenido del curso), medido en el `dragstart`:
   * acá hay una sola zona, así que «el que está bajo el cursor» y «el de la lista» son el mismo.
   */
  const montarEmpuje = (nodo: HTMLElement) => {
    quitarEmpuje.current?.();
    const sc = scrollerDe(nodo);
    const empuje = (e: DragEvent) => {
      if (!manoRef.current) return;
      const t = e.target as Element | null;
      // El hueco dice dónde CAE: afuera de la lista soltar no hace nada, así que no hay hueco.
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
    e.dataTransfer.setData('text/plain', id);
    fotoVaciaDeArrastre(e.dataTransfer);
    const r = nodo.getBoundingClientRect();
    manoRef.current = id;
    huecoRef.current = null;
    medida.current = null;
    setMano(id);
    setHueco(null);
    setAlto(Math.round(r.height));
    // ⚠️ COLGADA DE LA LISTA (`[data-zona-campos]`), no del `.ugc` como las clases: la hoja del formulario
    //    va acotada a la lista (`.ec .ec-…`, para ganarle al reset del curso), y colgada afuera la copia salía
    //    con los campos sin vestir (medido en el banco: inputs pelados flotando). Es `position: fixed` igual,
    //    así que no ocupa lugar en la lista; y `medir` la saltea (lleva el mismo `data-arr-campo`).
    montarCopia(nodo, e.clientX - r.left, e.clientY - r.top, nodo.closest<HTMLElement>('[data-zona-campos]') ?? nodo.closest<HTMLElement>('.ugc'));
    montarEmpuje(nodo);
  };

  /** Los centros de las tarjetas (`[data-arr-campo]`), medidos UNA vez por gesto. */
  const medir = (el: HTMLElement): Medida => {
    // Sin la copia que sigue al cursor (vive adentro de la lista, ver `agarrar`).
    const nodos = [...el.querySelectorAll<HTMLElement>('[data-arr-campo]')].filter((n) => n.style.position !== 'fixed');
    const ya = medida.current;
    if (ya && ya.medios.length === nodos.length) return ya;
    const sc = scrollerDe(el);
    const off = desplazamiento(sc);
    const m = { medios: nodos.map((n) => { const r = n.getBoundingClientRect(); return (r.top + r.bottom) / 2 + off; }), sc };
    medida.current = m;
    return m;
  };

  /** Los handlers de la lista: dónde caería, y qué pasa al soltar. */
  const zona = {
    'data-zona-campos': '',
    onDragEnter: (e: ReactDragEvent<HTMLElement>) => { if (manoRef.current) e.preventDefault(); },
    onDragOver: (e: ReactDragEvent<HTMLElement>) => {
      if (!manoRef.current) return;
      // `preventDefault` es lo que HABILITA soltar.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const m = medir(e.currentTarget);
      ponerHueco(indiceEnLista(m.medios, e.clientY + desplazamiento(m.sc)));
    },
    onDrop: (e: ReactDragEvent<HTMLElement>) => {
      const id = manoRef.current;
      if (!id) return;
      e.preventDefault();
      // ⚠️ El hueco se lee ANTES de `terminar()`, que lo borra.
      const h = huecoRef.current;
      const { ids, onOrden } = datos.current;
      terminar();
      if (h == null) return;
      const nueva = ordenAlSoltar(ids, id, h);
      if (nueva) onOrden(nueva);
    },
  };

  return {
    /** El id del campo que va en la mano (para marcarlo con el borde). */
    mano,
    /** El alto de la tarjeta agarrada: el hueco mide eso. */
    alto,
    /** ¿Va el hueco antes del campo `i` (o al final, con `i` = cuántos hay)? */
    huecoEn: (i: number) => mano != null && hueco === i,
    marcarOrigen,
    agarrar,
    terminar,
    zona,
  };
}
