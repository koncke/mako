'use client';

// =============================================================================
// VistaNuestra — una landing NUESTRA dibujada en el panel del diagnóstico (DOM directo)
// =============================================================================
// Tanda 2, T5 (docs/diseno-editor-landing.md): «la nuestra, con el render». El HTML lo arma quien la
// monta con `htmlDePagina` (lib/editor-landing/render.ts, la única fábrica de HTML: lo que se ve es lo
// que se publica) en modo 'exportar' (los desplegables abiertos: una cita adentro de uno se tiene que
// poder señalar). La hoja del contenido (`CSS_CONTENIDO`) y las fuentes las pone el panel.
//
// Cada comentario se ubica buscando su cita en el DOM (`buscarEnTextos` sobre los nodos de texto) y
// subiendo hasta su bloque; si la cita ya no está (la sección se editó), se señala la SECCIÓN guardada
// (`seccionId`, `#t-<id>`); si tampoco, la vista entera.
//
// ⚠️ LA ESCALA VA POR `--gm-base`, NUNCA POR `transform: scale()` (la misma regla que la miniatura del
//    Panel, MiniaturaLanding.tsx): las cajas que se leen con getBoundingClientRect son las que se ven, y
//    el recorte del recorrido cae justo sobre el bloque.
// ⚠️ `inert`: es una vista, no la landing. Un botón o un formulario de la página no se aprietan acá (un
//    `<form>` real mandaría la persona a otro lado). La rueda del mouse igual scrollea: el contenedor de
//    afuera no es inerte.
// =============================================================================

import { useLayoutEffect, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { buscarEnTextos } from '@/lib/editor-landing/diagnostico';
import { altoDeMensaje, documentoHtmlLibre } from '@/lib/editor-landing/html-libre';
import {
  EVENTO_MOVIO, bloqueDeCoincidencia, cajaDeRect, recortarA, selectorDeSeccion, textosDelDom,
  type ControlVista, type ObjetivoVista, type Ubicacion,
} from './vista';

type Hallado = { el: Element; por: Exclude<Ubicacion, null> };

export function VistaNuestra({ html, objetivos, controlRef, senal, onUbicar }: {
  html: string;
  objetivos: ObjetivoVista[];
  controlRef: MutableRefObject<ControlVista | null>;
  /** Donde avisa que se movió (`EVENTO_MOVIO`): el recorrido vuelve a medir. */
  senal: EventTarget;
  /** Volvió a ubicar los comentarios (la lista vuelve a pintar «Sin ubicar»). */
  onUbicar: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const hallados = useRef(new Map<number, Hallado>());
  const objetivosRef = useRef(objetivos);
  const onUbicarRef = useRef(onUbicar);
  useLayoutEffect(() => { objetivosRef.current = objetivos; onUbicarRef.current = onUbicar; });
  const firma = objetivos.map((o) => `${o.id}\u0001${o.seccionId ?? ''}\u0001${o.cita}`).join('\u0002');
  // ⚠️ EL OBJETO `{ __html }` VA MEMOIZADO. React 19 compara la IDENTIDAD de la prop, no el string: con
  //    un literal nuevo en cada render reescribe el innerHTML entero en CADA render del panel (un filtro,
  //    un paso del recorrido), y los bloques que se ubicaron quedan desconectados. Medido en el navegador
  //    (12/10/2026): el recorrido señalaba la vista ENTERA en vez del título, porque `hallados` guardaba un
  //    <h1> con `isConnected === false`.
  const contenido = useMemo(() => ({ __html: html }), [html]);

  // Ubicar cada comentario en el DOM recién pintado (antes de que el navegador pinte: el recorrido
  // mide en el cuadro siguiente).
  useLayoutEffect(() => {
    const raiz = lienzoRef.current;
    if (!raiz) return;
    const { nodos, textos } = textosDelDom(raiz);
    const m = new Map<number, Hallado>();
    for (const o of objetivosRef.current) {
      const c = buscarEnTextos(textos, o.cita);
      const porCita = c ? bloqueDeCoincidencia(nodos, c, raiz) : null;
      if (porCita) { m.set(o.id, { el: porCita, por: 'cita' }); continue; }
      const sec = o.seccionId ? raiz.querySelector(selectorDeSeccion(o.seccionId)) : null;
      if (sec) m.set(o.id, { el: sec, por: 'seccion' });
    }
    hallados.current = m;
    onUbicarRef.current();
    senal.dispatchEvent(new Event(EVENTO_MOVIO));
  }, [html, firma, senal]);

  // Las cajas cambian solas cuando cargan las fuentes y las imágenes, o cuando cambia el ancho.
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo || typeof ResizeObserver === 'undefined') return;
    let cuadro = 0;
    const avisar = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; senal.dispatchEvent(new Event(EVENTO_MOVIO)); }); };
    const ro = new ResizeObserver(avisar);
    ro.observe(lienzo);
    return () => { ro.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); };
  }, [senal]);

  // El alto de cada «HTML personalizado»: su iframe lo manda por `postMessage` (html-libre.ts), igual
  // que en el editor (HtmlLibreVista) y en la publicada (pagina-publica.ts). Sin esto quedaba en el
  // `alto` guardado (300 px por defecto) con el contenido en 87: un hueco que la publicada no tiene
  // (medido en el navegador, 12/10/2026), y en una «Copia fiel» —todas las secciones son HTML— la
  // vista entera salía cortada en tajadas de 300. `htmlDePagina` en modo 'exportar' pone el HTML
  // CRUDO en el `srcdoc` (sin el script que mide), así que acá se envuelve con `documentoHtmlLibre`,
  // el mismo documento que sirve /l/html, una sola vez por pintada (la marca evita envolver dos veces).
  // Sólo se acepta lo que viene de UN iframe de esta vista; el cambio de alto lo ve el ResizeObserver
  // de arriba y el recorrido vuelve a medir.
  useLayoutEffect(() => {
    for (const fr of lienzoRef.current?.querySelectorAll('iframe[srcdoc]') ?? []) {
      if (!(fr instanceof HTMLIFrameElement) || fr.dataset.gmMide) continue;
      fr.dataset.gmMide = '1';
      fr.srcdoc = documentoHtmlLibre(fr.getAttribute('srcdoc') ?? '');
    }
  }, [contenido]);
  useEffect(() => {
    const oir = (ev: MessageEvent) => {
      const h = altoDeMensaje(ev.data);
      if (h === null) return;
      for (const fr of lienzoRef.current?.querySelectorAll('iframe') ?? []) {
        if (fr.contentWindow === ev.source) { fr.style.height = `${h}px`; return; }
      }
    };
    window.addEventListener('message', oir);
    return () => window.removeEventListener('message', oir);
  }, []);

  useLayoutEffect(() => {
    const vista = (): DOMRect | null => scrollRef.current?.getBoundingClientRect() ?? null;
    const control: ControlVista = {
      caja(id) {
        const v = vista();
        if (!v) return null;
        const h = hallados.current.get(id);
        if (!h || !h.el.isConnected) return cajaDeRect(v);
        return recortarA(cajaDeRect(h.el.getBoundingClientRect()), cajaDeRect(v));
      },
      async ir(id) {
        const s = scrollRef.current;
        const h = hallados.current.get(id);
        if (s && h && h.el.isConnected) {
          const sr = s.getBoundingClientRect();
          const r = h.el.getBoundingClientRect();
          const margen = 24;
          // Centrado; si es más alto que la vista, su principio arriba (ahí suele estar lo señalado).
          const delta = r.height > sr.height - margen * 2 ? r.top - sr.top - margen : r.top + r.height / 2 - (sr.top + sr.height / 2);
          if (Math.abs(delta) > 1) s.scrollTop += delta;
        }
        return control.caja(id);
      },
      posicion(id) {
        const h = hallados.current.get(id);
        const l = lienzoRef.current;
        return h && l && h.el.isConnected ? h.el.getBoundingClientRect().top - l.getBoundingClientRect().top : null;
      },
      ubicacion: (id) => hallados.current.get(id)?.por ?? null,
    };
    controlRef.current = control;
    return () => { if (controlRef.current === control) controlRef.current = null; };
  }, [controlRef]);

  return (
    <div ref={scrollRef} className="gdg-vista gdg-vista--nuestra">
      <div ref={lienzoRef} className="gdg-lienzo" inert dangerouslySetInnerHTML={contenido} />
    </div>
  );
}
