'use client';

// =============================================================================
// arrastre-curso — arrastrar MÓDULOS y CLASES en el dibujo de un curso (CursoUgc)
// =============================================================================
// Pedido de Martín (07/10/2026, item 7), textual: «Debería poder agarrar una tarjeta y arrastrarla
// para cambiar la posición... Tanto de módulos como clases. Y eso también debería cambiar las
// etapas. Copia la animación de arrastre de tarjetas que tenemos en varios lugares, como el PLAN,
// copia esa animación tal cual, con todo».
//
// «TAL CUAL» SE CUMPLE IMPORTANDO, NO COPIANDO: la foto vacía del sistema operativo y la copia que
// sigue al cursor (girada 1,5°, opaca, con su sombra) son `fotoVaciaDeArrastre` y `useArrastreCopia`
// de app/plan/board/arrastre-copia.ts, el mismo módulo que usan el Plan y el kanban de la entrega.
// Replicar escribiendo el segundo es cómo se queda viejo uno de los dos (tests/curso-editor.test.ts
// lo fija). Lo que hay acá es lo propio del curso: tres ZONAS donde se suelta y qué significa soltar
// en cada una.
//
//   · `rail`   la grilla de módulos del índice       → reordena los módulos (y con eso, las etapas)
//   · `barra`  la lista de módulos de la barra       → reordena los módulos; con una CLASE en la mano,
//                                                       el módulo a la altura del cursor la RECIBE (la
//                                                       clase se muda ahí: nunca nace un módulo) y la
//                                                       tarjeta se vuelve una pastilla (item 16)
//   · `grilla` las clases de un módulo abierto       → reordena las clases del módulo
//
// Lo que se decide (en qué lugar cae, cómo queda la lista) es puro y vive en ./orden.ts.
//
// Las reglas medidas de la casa, todas acá (AGENTS.md, las secciones del arrastre):
//   ⚠️ LO QUE VA EN LA MANO VIVE EN UN REF (`manoRef`): el primer `dragover` puede llegar antes del
//      render que trae el estado, y sin `preventDefault()` en ese primero el navegador decide que ahí
//      no se puede soltar y el gesto arranca muerto.
//   ⚠️ SE MIDE UNA VEZ POR GESTO Y POR ZONA, adentro del `dragover` (nunca en un rAF del `dragstart`:
//      durante el arrastre nativo el navegador congela rAF y los timers). En coordenadas del
//      CONTENIDO que scrollea, para que sobrevivan al auto-scroll.
//   ⚠️ EL `setState` DEL HUECO SALE SÓLO SI CAMBIÓ: uno por `dragover` redibuja el curso sesenta veces
//      por segundo.
//   ⚠️ EL `dragenter` SE ACEPTA en cada zona: el hueco aparece debajo del cursor, el elemento bajo el
//      cursor cambia sin que el mouse se mueva, y en esa vuelta Chromium manda `dragenter` y NO
//      `dragover` — sin aceptarlo, soltar encima del hueco se pierde (medido en el kanban de la entrega).
//   ⚠️ EL AUTO-SCROLL VA EN UN `dragover` DE `document` EN CAPTURA, sobre el que scrollea BAJO EL
//      CURSOR (el contenido o la barra), y no con `empujarScroll` del hook: ése decide su scroller UNA
//      vez, con la tarjeta de ORIGEN, y un módulo que se lleva de la barra al índice empujaría la barra
//      mientras se mira el índice (la misma razón por la que el CRM y el kanban no lo usan).
//   ⚠️ UN GESTO QUE NACE EN UN CONTROL O EN UN TEXTO QUE SE EDITA (`[data-nodrag]`) NO ARRASTRA: sin
//      esto, seleccionar el nombre de un módulo con el mouse se llevaba la tarjeta entera.
//   ⚠️ AL ORIGEN NO SE LE TOCA NADA: lo que se mueve es la copia y lo que dice dónde cae es el hueco.

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { fotoVaciaDeArrastre, scrollerDe, useArrastreCopia } from '@/app/plan/board/arrastre-copia';
import { empujeDeColumna } from '@/app/crm/arrastre-columna';
import { antesDeEn, filaEnBarra, indiceEnGrilla, indiceEnLista, ordenAlSoltar, type FilaBarra, type RectTarjeta } from './orden';

/** Lo que viaja en la mano. Una clase lleva su módulo: es el único al que se la puede reordenar. */
export type ManoCurso = { tipo: 'modulo'; key: string } | { tipo: 'clase'; id: number; moduloKey: string };
export type ZonaCurso = 'rail' | 'barra' | 'grilla';
/** Dónde caería si soltaras ahora: un hueco en una zona, o (una clase sobre la barra) un módulo entero. */
export type DestinoCurso = { zona: ZonaCurso; indice: number } | { zona: 'barra-clase'; key: string };

type Medida = { rects: RectTarjeta[]; sc: HTMLElement | null };

/** Cuánto scrolleó el que scrollea (la ventana si no hay contenedor): es lo que suma la coordenada. */
const desplazamiento = (sc: HTMLElement | null) => (sc ? sc.scrollTop : window.scrollY);

const mismoDestino = (a: DestinoCurso | null, b: DestinoCurso | null): boolean => {
  if (a === b) return true;
  if (!a || !b || a.zona !== b.zona) return false;
  return 'indice' in a ? 'indice' in b && a.indice === b.indice : 'key' in b && a.key === b.key;
};

export function useArrastreCurso(p: {
  /** Las keys de los módulos que se pueden mover, EN EL ORDEN EN QUE SE DIBUJAN. */
  modulos: readonly string[];
  /** Las clases de un módulo, en el orden en que se dibujan (los ids). */
  clasesDe: (moduloKey: string) => readonly number[];
  /** ¿Este módulo recibe clases? Uno que armó la pantalla («Sin módulo») no. */
  recibeClases: (moduloKey: string) => boolean;
  /** Sin esto, los módulos no se arrastran. Recibe la lista ENTERA en el orden nuevo. */
  onOrdenarModulos?: (keys: string[]) => void;
  /** Sin esto, las clases no se arrastran. `antesDe` null = al final del módulo. */
  onLlevarClase?: (claseId: number, moduloKey: string, antesDe: number | null) => void;
}) {
  const { pararScroll, montarCopia, soltarCopia } = useArrastreCopia();
  const [mano, setMano] = useState<ManoCurso | null>(null);
  const [destino, setDestino] = useState<DestinoCurso | null>(null);
  /** El alto de lo que se agarró: el hueco de una grilla mide eso (el «hueco del tamaño de una tarjeta»). */
  const [alto, setAlto] = useState(0);
  const manoRef = useRef<ManoCurso | null>(null);
  const destinoRef = useRef<DestinoCurso | null>(null);
  const medidas = useRef<Partial<Record<ZonaCurso, Medida>>>({});
  const origen = useRef<Element | null>(null);
  const quitarEmpuje = useRef<(() => void) | null>(null);
  /** Los renglones de la barra que reciben una clase, medidos UNA vez por gesto (como `medidas`). */
  const filasBarra = useRef<{ filas: FilaBarra[]; sc: HTMLElement | null } | null>(null);
  /**
   * UNA CLASE SOBRE LA BARRA SE VE COMO UN RENGLÓN, NO COMO UNA TARJETA (08/10/2026, item 16). La
   * copia de la tarjeta de una clase es igual a la de un módulo (la misma `.ugc-modcard`, con su chip
   * de número) y mide 260×260: sobre la barra tapaba la lista entera y el renglón que la iba a recibir,
   * y se leía como un MÓDULO NUEVO que se metía en la lista (medido en el banco con Chrome: la tarjeta
   * encima de «Diagnóstico» y «Bonus», con «Bonus» marcado abajo, invisible). Sobre la barra la tarjeta
   * se esconde y sigue al cursor una pastilla con el título, del alto de un renglón, al costado del
   * cursor: el renglón marcado se ve y la clase se lee como lo que es.
   */
  const copiaGrande = useRef<HTMLElement | null>(null);
  const pildora = useRef<HTMLElement | null>(null);
  const quitarPildora = () => {
    pildora.current?.remove();
    pildora.current = null;
    copiaGrande.current = null;
  };
  // Los datos viajan por un ref: los handlers se arman en cada render y el gesto dura muchos.
  const datos = useRef(p);
  useEffect(() => { datos.current = p; });

  const ponerDestino = (d: DestinoCurso | null) => {
    if (mismoDestino(destinoRef.current, d)) return;
    destinoRef.current = d;
    setDestino(d);
  };

  const terminar = useCallback(() => {
    manoRef.current = null;
    destinoRef.current = null;
    medidas.current = {};
    filasBarra.current = null;
    setMano(null);
    setDestino(null);
    pararScroll();
    soltarCopia();
    quitarPildora();
    quitarEmpuje.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `quitarPildora` sólo toca refs
  }, [pararScroll, soltarCopia]);
  useEffect(() => () => { quitarEmpuje.current?.(); quitarPildora(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** ¿Esta zona recibe lo que va en la mano? */
  const acepta = (z: ZonaCurso, m: ManoCurso): boolean => {
    const d = datos.current;
    if (m.tipo === 'modulo') return (z === 'rail' || z === 'barra') && !!d.onOrdenarModulos;
    if (!d.onLlevarClase) return false;
    return z === 'barra' || (z === 'grilla' && d.recibeClases(m.moduloKey));
  };

  /** Las tarjetas de una zona (`[data-arr]`), medidas UNA vez por gesto. */
  const medir = (z: ZonaCurso, el: HTMLElement): Medida => {
    const nodos = el.querySelectorAll<HTMLElement>('[data-arr]');
    const ya = medidas.current[z];
    if (ya && ya.rects.length === nodos.length) return ya;
    const sc = scrollerDe(el);
    const off = desplazamiento(sc);
    const rects = [...nodos].map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.dataset.arr ?? '', x: r.left + r.width / 2, y1: r.top + off, y2: r.bottom + off };
    });
    const m = { rects, sc };
    medidas.current[z] = m;
    return m;
  };

  /**
   * El auto-scroll, en `document` y en captura (ver la cabecera): empuja el que scrollea BAJO EL
   * CURSOR, el contenido o la barra. Se monta al agarrar y se suelta en `dragend` Y en `drop`.
   *
   * ⚠️ Y AFUERA DE UNA ZONA QUE RECIBA LO QUE VA EN LA MANO, EL HUECO SE CIERRA. Sin esto quedaba
   *    abierto donde estuvo por última vez: llevando un módulo hacia arriba (para que el contenido
   *    scrollee) el cursor pasaba por la portada del curso, el hueco seguía dibujado en la grilla, y
   *    soltar ahí no hacía nada — medido en el arnés, 3 de 4 soltadas caían donde decía el hueco y la
   *    cuarta no movía nada. El hueco dice dónde CAE: si soltar no cae, no hay hueco.
   */
  const montarEmpuje = (raiz: HTMLElement) => {
    quitarEmpuje.current?.();
    const scrollers = [...raiz.querySelectorAll<HTMLElement>('.ugc-content, .ugc-side')];
    const empuje = (e: DragEvent) => {
      const m = manoRef.current;
      if (!m) return;
      const t = e.target as Element | null;
      const z = typeof t?.closest === 'function' ? t.closest<HTMLElement>('[data-zona]')?.dataset.zona : undefined;
      if (!z || !acepta(z as ZonaCurso, m)) ponerDestino(null);
      // Una clase sobre la barra: la pastilla en lugar de la tarjeta (ver `pildora`). Se escribe sobre
      // los nodos, nunca con `setState` (uno por `dragover` redibuja el curso sesenta veces por segundo).
      const p = pildora.current;
      if (p) {
        const enBarra = z === 'barra';
        p.style.display = enBarra ? 'block' : 'none';
        p.style.transform = `translate3d(${e.clientX + 14}px, ${e.clientY - 18}px, 0)`;
        // `opacity` y no `visibility`: un hijo con su propio `visibility` se seguía viendo (el chip «Sin video»).
        if (copiaGrande.current) copiaGrande.current.style.opacity = enBarra ? '0' : '1';
      }
      for (const sc of scrollers) {
        if (sc.scrollHeight <= sc.clientHeight + 1) continue;
        const r = sc.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right) continue;
        const d = empujeDeColumna(r, e.clientY);
        if (d) sc.scrollTop += d;
      }
    };
    const fin = () => {
      document.removeEventListener('dragover', empuje, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      // La pastilla también, acá: si el origen se desmontó en el medio, su `dragend` no llega.
      quitarPildora();
      if (quitarEmpuje.current === fin) quitarEmpuje.current = null;
    };
    document.addEventListener('dragover', empuje, true);
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    quitarEmpuje.current = fin;
  };

  /** `onPointerDownCapture` de lo que se arrastra: dónde nació el gesto (ver `[data-nodrag]`). */
  const marcarOrigen = (e: ReactPointerEvent<HTMLElement>) => {
    const t = e.target as Element;
    origen.current = t;
    // ⚠️ SE APAGA EL `draggable` ANTES de que arranque el gesto: cancelar el `dragstart` no alcanza
    //    para seleccionar texto (el navegador ya lo tomó como un arrastre y no selecciona nada). El
    //    próximo gesto que nazca afuera de un `[data-nodrag]` lo vuelve a prender.
    e.currentTarget.draggable = !(typeof t.closest === 'function' && t.closest('[data-nodrag]'));
  };

  /** `onDragStart` de lo que se arrastra. La copia sale de `[data-arr-copia]` si lo hay (la tarjeta, no su envoltorio). */
  const agarrar = (e: ReactDragEvent<HTMLElement>, m: ManoCurso) => {
    // Sólo si el gesto nació ADENTRO de este nodo en el DOM: un portal saca el nodo del DOM pero no
    // del árbol de React, y los eventos sintéticos suben por el árbol (lo midió el kanban de la entrega).
    if (!e.currentTarget.contains(e.target as Node)) return;
    const o = origen.current;
    if (o && e.currentTarget.contains(o) && o.closest('[data-nodrag]')) { e.preventDefault(); return; }
    const nodo = e.currentTarget.querySelector<HTMLElement>('[data-arr-copia]') ?? e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', m.tipo === 'modulo' ? m.key : String(m.id));
    fotoVaciaDeArrastre(e.dataTransfer);
    const r = nodo.getBoundingClientRect();
    manoRef.current = m;
    destinoRef.current = null;
    medidas.current = {};
    setMano(m);
    setDestino(null);
    setAlto(Math.round(r.height));
    // La copia se cuelga del `.ugc`: la hoja del origen viste todo bajo `.ahdoc .ugc`, y colgada del
    // `body` salía como texto suelto (ver `montarCopia`).
    const raiz = nodo.closest<HTMLElement>('.ugc');
    montarCopia(nodo, e.clientX - r.left, e.clientY - r.top, raiz);
    quitarPildora();
    if (m.tipo === 'clase' && raiz) {
      // La copia que acaba de colgar `montarCopia` es la última hija del `.ugc`. La pastilla va al lado,
      // escondida hasta que la clase entre a la barra. Viste sola (estilos en línea): no depende de la
      // hoja del curso, y no le cambia nada al hook de la copia que comparten el Plan y los kanban.
      copiaGrande.current = raiz.lastElementChild as HTMLElement | null;
      const p = document.createElement('div');
      p.setAttribute('aria-hidden', 'true');
      p.textContent = nodo.querySelector('.ugc-modcard-t')?.textContent?.trim() || 'Clase';
      Object.assign(p.style, {
        position: 'fixed', top: '0', left: '0', zIndex: '3001', display: 'none', pointerEvents: 'none',
        maxWidth: '230px', padding: '8px 12px', borderRadius: '10px', whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', background: 'var(--u-lime, #d4f26a)', color: 'var(--u-ink, #16150f)',
        border: '1.5px solid var(--u-ink, #16150f)', boxShadow: '0 10px 24px rgba(22, 21, 15, .35)',
        font: '700 13px/1.2 var(--font-archivo), system-ui, sans-serif', transition: 'none',
      });
      raiz.appendChild(p);
      pildora.current = p;
    }
    if (raiz) montarEmpuje(raiz);
  };

  /** Los handlers de una zona: dónde caería, y qué pasa al soltar. */
  const zona = (z: ZonaCurso) => ({
    // Con esto la ve el `dragover` de `document` (ver `montarEmpuje`): afuera de toda zona, sin hueco.
    'data-zona': z,
    onDragEnter: (e: ReactDragEvent<HTMLElement>) => {
      const m = manoRef.current;
      if (m && acepta(z, m)) e.preventDefault();
    },
    onDragOver: (e: ReactDragEvent<HTMLElement>) => {
      const m = manoRef.current;
      if (!m || !acepta(z, m)) return;
      // `preventDefault` es lo que HABILITA soltar: sin él el navegador lo rechaza y no pasa nada.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (z === 'barra' && m.tipo === 'clase') {
        // Una clase sobre la barra no abre hueco: el módulo a la altura del cursor la recibe entera
        // (`filaEnBarra`: también en el aire entre dos renglones, que antes no recibía nada).
        if (!filasBarra.current) {
          const sc = scrollerDe(e.currentTarget);
          const off = desplazamiento(sc);
          const filas = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-arr-modulo]')]
            .filter((n) => datos.current.recibeClases(n.dataset.arrModulo ?? ''))
            .map((n) => { const r = n.getBoundingClientRect(); return { key: n.dataset.arrModulo ?? '', y1: r.top + off, y2: r.bottom + off }; });
          filasBarra.current = { filas, sc };
        }
        const { filas, sc } = filasBarra.current;
        const k = filaEnBarra(filas, e.clientY + desplazamiento(sc));
        ponerDestino(k && k !== m.moduloKey ? { zona: 'barra-clase', key: k } : null);
        return;
      }
      const med = medir(z, e.currentTarget);
      const py = e.clientY + desplazamiento(med.sc);
      const indice = z === 'barra'
        ? indiceEnLista(med.rects.map((r) => (r.y1 + r.y2) / 2), py)
        : indiceEnGrilla(med.rects, e.clientX, py);
      ponerDestino({ zona: z, indice });
    },
    onDrop: (e: ReactDragEvent<HTMLElement>) => {
      const m = manoRef.current;
      if (!m || !acepta(z, m)) return;
      e.preventDefault();
      // ⚠️ EL DESTINO SE LEE ANTES DE `terminar()`, que lo borra.
      const d = destinoRef.current;
      const { modulos, clasesDe, onOrdenarModulos, onLlevarClase } = datos.current;
      terminar();
      if (m.tipo === 'clase' && z === 'barra') {
        if (d && d.zona === 'barra-clase') onLlevarClase?.(m.id, d.key, null);
        return;
      }
      if (!d || d.zona !== z || !('indice' in d)) return;
      if (m.tipo === 'modulo') {
        const nueva = ordenAlSoltar(modulos, m.key, d.indice);
        if (nueva) onOrdenarModulos?.(nueva);
        return;
      }
      const nueva = ordenAlSoltar(clasesDe(m.moduloKey), m.id, d.indice);
      if (nueva) onLlevarClase?.(m.id, m.moduloKey, antesDeEn(nueva, m.id));
    },
  });

  return {
    /** Lo que va en la mano (para dibujar). */
    mano,
    /** El alto de lo que se agarró. */
    alto,
    /** ¿Va el hueco en esta zona, antes de la tarjeta `i` (o al final con `i` = cuántas hay)? */
    huecoEn: (z: ZonaCurso, i: number) => !!mano && !!destino && destino.zona === z && 'indice' in destino && destino.indice === i,
    /** ¿Este módulo de la barra recibe la clase que va en la mano? */
    esDestino: (key: string) => !!mano && destino?.zona === 'barra-clase' && destino.key === key,
    marcarOrigen,
    agarrar,
    terminar,
    zona,
  };
}

export type ArrastreCurso = ReturnType<typeof useArrastreCurso>;
