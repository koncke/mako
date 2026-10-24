'use client';

// =============================================================================
// Un aviso se cierra: con su ✕, deslizándolo, y no se va solo mientras se lo mira (24/10/2026)
// =============================================================================
// Martín: «Las notificaciones de MaKo cuando pasa algo, deberían tener un botón X para cerrarlas o si las desplazo se van, porque
// estoy editando algo y aparecen y tengo que esperar a que se vayan para apretar el botón de atrás». Las dos salidas, no una: la ✕
// (cada aviso la dibuja) y ARRASTRARLO DE COSTADO (esto), que en el teléfono es lo natural (Martín usa Android). Y mientras el mouse
// está encima, o el dedo lo sostiene, el temporizador espera.
// La usan los tres avisos de la app: el de la computadora (Toast.tsx), el del teléfono (ShellM) y los de NotificationsProvider (un
// mensaje de WhatsApp, una plantilla).
//
// ⚠️ LA PAUSA VA POR EL DOM (`data-pausa` en el aviso) Y NO POR UN ESTADO COMPARTIDO: el temporizador vive en el hook de cada pantalla
//    (useToast lo usan decenas) y el aviso, en otro componente. `esperarPausa` mira si hay un aviso en pausa antes de cerrar; si lo
//    hay, vuelve a mirar en un rato. Así ninguna pantalla tiene que cambiar para que su aviso se quede mientras se lo mira.
// ⚠️ UN ARRASTRE NO ES UN TOQUE: el aviso de WhatsApp abre el chat al tocarlo, y soltarlo después de arrastrar lo abría.

import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

/** Cuánto hay que arrastrarlo de costado para que se vaya. */
export const UMBRAL_DESLIZAR = 64;
/** Desde cuánto movimiento es un arrastre y no un toque (el temblor de un dedo). */
const ES_ARRASTRE = 8;

/** ¿Se descarta con este arrastre horizontal? Pura (test). */
export function seDescarta(dx: number): boolean {
  return Math.abs(dx) >= UMBRAL_DESLIZAR;
}

/** ¿Hay un aviso que se está mirando (el mouse encima o el dedo encima)? */
export function avisoEnPausa(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[data-mk-aviso][data-pausa]') != null;
}

/** Para el `setTimeout` del aviso: cierra, salvo que se lo esté mirando; en ese caso vuelve a mirar en `reintento` ms. */
export function esperarPausa(cerrar: () => void, reintento = 800): () => void {
  const intento = () => { if (avisoEnPausa()) setTimeout(intento, reintento); else cerrar(); };
  return intento;
}

/** Lo que el aviso tiene que esparcir en su caja, y su corrimiento mientras se lo arrastra. */
export function useDeslizarParaCerrar(onCerrar: () => void) {
  const inicio = useRef<{ x: number; id: number } | null>(null);
  const movido = useRef(false);
  const [dx, setDx] = useState(0);
  const [pausa, setPausa] = useState(false);
  const soltar = () => { inicio.current = null; setDx(0); setPausa(false); };
  const props = {
    'data-mk-aviso': '',
    'data-pausa': pausa ? '' : undefined,
    onMouseEnter: () => setPausa(true),
    onMouseLeave: () => { if (!inicio.current) setPausa(false); },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      // Un gesto nuevo: lo arrastrado antes ya no cuenta. ANTES del corte de los botones: un arrastre con el dedo que vuelve a su
      // lugar no termina en click, y sin esto el primer toque en la ✕ se lo comía `onClickCapture`.
      movido.current = false;
      // Sus botones (✕, Deshacer, Reportar) se tocan como siempre: no arrancan un arrastre.
      if ((e.target as HTMLElement).closest('button:not([data-mk-aviso]), a')) return;
      inicio.current = { x: e.clientX, id: e.pointerId };
      setPausa(true);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const i = inicio.current;
      if (!i || i.id !== e.pointerId) return;
      const d = e.clientX - i.x;
      if (!movido.current && Math.abs(d) < ES_ARRASTRE) return;
      if (!movido.current) { movido.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya no está */ } }
      setDx(d);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      const i = inicio.current;
      if (!i || i.id !== e.pointerId) return;
      const d = e.clientX - i.x;
      if (movido.current && seDescarta(d)) { inicio.current = null; onCerrar(); return; }
      soltar();
      // Con el mouse todavía encima, sigue en pausa.
      if (e.pointerType === 'mouse') setPausa(true);
    },
    onPointerCancel: soltar,
    onClickCapture: (e: MouseEvent<HTMLElement>) => { if (movido.current) { e.preventDefault(); e.stopPropagation(); movido.current = false; } },
  };
  // Mientras se arrastra, se corre con el dedo y se va apagando; suelto sin llegar, vuelve a su lugar.
  const estilo: CSSProperties = dx
    ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.25, 1 - Math.abs(dx) / (UMBRAL_DESLIZAR * 3)), transition: 'none', touchAction: 'pan-y' }
    : { touchAction: 'pan-y' };
  return { props, estilo, dx };
}
