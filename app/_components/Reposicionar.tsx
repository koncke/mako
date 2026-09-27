'use client';

// =============================================================================
// Reposicionar — acomodar una imagen dentro de su caja, arrastrando
// =============================================================================
// «Que al apretar reposicionar se pueda ajustar la imagen arrastrando, claro»
// (27/09/2026), con la captura de Notion: la banda se vuelve agarrable, dice
// «Drag image to reposition» y arriba a la derecha aparecen «Save position» y
// «Cancel».
//
// ⚠️ NO ES HTML5 DRAG-AND-DROP, y es a propósito. Ese mecanismo sirve para LLEVAR
// una cosa a otro lado —tiene `dataTransfer`, un destino y un `drop`— y acá no se
// suelta nada en ningún lugar: se está moviendo un valor continuo con el mouse.
// Usarlo traería las cuatro trampas que este repo ya tiene medidas (la foto que
// toma el SO, el `dragover` que no cubre los huecos, los timers congelados) para
// resolver algo que con punteros son veinte líneas.
//
// Van POINTER EVENTS y no `mousedown`/`mousemove`: el mismo código anda con dedo y
// con lápiz, y `setPointerCapture` hace que el gesto siga siendo nuestro aunque el
// cursor se vaya de la caja — que es exactamente lo que pasa al arrastrar hasta el
// borde de una banda de 140 px.
//
// ⚠️ EL VALOR SE ESCRIBE SOBRE UN REF Y SE PINTA CON `style`, NUNCA CON setState
// POR EVENTO. Es la misma regla que el arrastre del Kanban: un `setState` por
// `pointermove` redibuja el árbol 60 veces por segundo y el gesto se siente
// pegajoso. Acá el estado sólo cambia al SOLTAR.

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cuánto se puede mover, en puntos de `background-position` por píxel arrastrado.
 *
 * ⚠️ NO ES 1:1 CON EL PÍXEL, y el número sale de la geometría: el recorrido útil
 * de `background-position-y` es el alto SOBRANTE de la imagen, no el alto de la
 * caja. Una foto de 1600×420 dentro de una banda de 1560×140 sobra ~270 px, así
 * que arrastrar 140 tiene que recorrer los 100 puntos. Sobreestimar hace que la
 * imagen se escape; subestimar, que el gesto se sienta trabado. 0,6 sale de medir
 * las dos cajas reales (banda 140, círculo 62) contra sus imágenes.
 */
const SENSIBILIDAD = 0.6;

export function useReposicionar(
  yInicial: number | null | undefined,
  alGuardar: (y: number) => void,
) {
  const [activo, setActivo] = useState(false);
  /** Lo que se está viendo AHORA. Sólo se lee al empezar y al soltar. */
  const y = useRef<number>(yInicial ?? 50);
  const arrastre = useRef<{ desdeY: number; base: number } | null>(null);
  const caja = useRef<HTMLElement | null>(null);

  // Si la imagen cambia por fuera, el valor de arranque también.
  useEffect(() => { if (!activo) y.current = yInicial ?? 50; }, [yInicial, activo]);

  const pintar = useCallback((v: number) => {
    const el = caja.current;
    if (!el) return;
    // `backgroundPositionY` y no reescribir el `background` entero: el shorthand se
    // arma en `fondoPortada` y pisarlo acá sería la segunda copia de esa regla.
    el.style.backgroundPositionY = `${v}%`;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!activo) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastre.current = { desdeY: e.clientY, base: y.current };
  }, [activo]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    if (!a) return;
    // Arrastrar HACIA ABAJO tiene que mostrar lo de ARRIBA de la imagen, así que el
    // signo va invertido: es cómo se siente mover una foto debajo de una ventana,
    // no cómo se siente mover una ventana sobre una foto.
    const v = Math.max(0, Math.min(100, a.base - (e.clientY - a.desdeY) * SENSIBILIDAD));
    y.current = v;
    pintar(v);
  }, [pintar]);

  const onPointerUp = useCallback(() => { arrastre.current = null; }, []);

  const empezar = useCallback(() => { setActivo(true); }, []);
  const cancelar = useCallback(() => {
    setActivo(false);
    arrastre.current = null;
    y.current = yInicial ?? 50;
    // ⚠️ SE REESCRIBE EL VALOR, NO SE BORRA EL LONGHAND. La primera versión hacía
    // `style.backgroundPositionY = ''` para «devolverlo al CSS», y medido en Chrome
    // la imagen quedaba en `50% 0%`: en cuanto se toca el longhand, el navegador
    // EXPANDE el shorthand `background` que React había puesto inline, así que
    // vaciar la Y no la devuelve a su valor — la deja sin valor, y sin valor es 0%.
    // Cancelar te dejaba la portada peor de como la habías encontrado.
    pintar(yInicial ?? 50);
  }, [yInicial, pintar]);
  const guardar = useCallback(() => {
    setActivo(false);
    arrastre.current = null;
    alGuardar(Math.round(y.current));
  }, [alGuardar]);

  return {
    activo, empezar, cancelar, guardar,
    /** Va en el nodo que tiene la imagen de fondo. */
    props: {
      ref: (el: HTMLElement | null) => { caja.current = el; },
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      // `none` mientras se arrastra o el navegador se lleva el gesto como scroll.
      style: activo ? { cursor: 'grab', touchAction: 'none' as const } : undefined,
    },
  };
}

/** La barra de «Guardar» / «Cancelar» + el cartel, mientras se está reposicionando. */
export function BarraReposicion({ onGuardar, onCancelar }: { onGuardar: () => void; onCancelar: () => void }) {
  return (
    <>
      {/* El cartel dice QUÉ hacer, en cuatro palabras, y está al medio porque es
          donde el ojo ya está mirando cuando agarra la imagen. */}
      <span className="rp-cartel" aria-hidden>Arrastra para acomodarla</span>
      <span className="rp-barra">
        <button type="button" className="rp-btn on" onClick={onGuardar}>Guardar</button>
        <button type="button" className="rp-btn" onClick={onCancelar}>Cancelar</button>
      </span>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

const CSS = `
.rp-cartel{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:3;
  background:rgba(20,22,26,.62); color:#fff; border-radius:999px; padding:7px 15px;
  font-size:12.5px; font-weight:500; pointer-events:none; backdrop-filter:blur(3px); }
.rp-barra{ position:absolute; top:12px; right:52px; z-index:4; display:flex; gap:6px; }
.rp-btn{ background:rgba(20,22,26,.52); border:0; border-radius:999px; padding:6px 13px;
  font:inherit; font-size:12.5px; font-weight:500; color:#fff; cursor:pointer;
  white-space:nowrap; backdrop-filter:blur(3px); }
.rp-btn:hover{ background:rgba(20,22,26,.72); }
.rp-btn.on{ background:#fff; color:#16181d; font-weight:600; }
.rp-btn.on:hover{ background:#f0f1f3; }
`;
