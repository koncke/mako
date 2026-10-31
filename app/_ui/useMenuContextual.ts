'use client';

// =============================================================================
// useMenuContextual — el CLIC DERECHO (y el MANTENER PRESIONADO) de una fila de una lista
// =============================================================================
// Pedido de Leandro (cliente, ws10; llamada del 24/10/2026, f26), textual: «Tengo que implementar el click derecho en toda
// la app, o sea, el click derecho casi que en toda la app se tiene que poder usar». El CRM y el Classroom ya lo tenían, cada
// uno con su `onContextMenu` escrito a mano; las listas de Chats, Customers, Offer, Integraciones, Partners, Automations y
// Web Generator (27/10/2026) lo toman de acá, para que las guardas sean UNA y no siete copias.
//
// QUÉ sale lo decide cada lista con una función pura (las de `app/<tab>/menu-contextual-*.ts`, o `opcionesDeFila` en
// Automations); CÓMO se dibuja, la pieza de la casa (`MenuContextual`); acá vive sólo CUÁNDO se abre y dónde:
//   · el CLIC DERECHO, en el punto del cursor; con el teclado (la tecla de menú, Mayús+F10) llega sin punto y va al borde
//     de la fila;
//   · MANTENER PRESIONADO con el dedo (`MANTENER_MS`), que es el clic derecho de una pantalla táctil (un iPad recibe la
//     vista de computadora). Un dedo que se mueve más de `TOLERANCIA_PX` está scrolleando, no manteniendo.
//
// ⚠️ ANDROID DISPARA SU PROPIO `contextmenu` AL MANTENER PRESIONADO (medido en el Ops Center, docs/hallazgos-ui.md), antes o
//    después de nuestro reloj según cómo tenga configurado el teléfono. Si llega ANTES, abre él (con el punto del dedo) y el
//    reloj se corta; si llega DESPUÉS, es el eco del que ya abrimos: se frena y no hace nada. Y el menú, abierto «por dedo»,
//    no se cierra con ese eco ni elige el renglón que quedó debajo del dedo al levantarlo (`porDedo` en MenuContextual).
// ⚠️ EL CLIC QUE SIGUE AL MANTENER SE TRAGA (`onClickCapture`): sin eso, levantar el dedo abría la fila además del menú.
// ⚠️ UN EVENTO DE REACT SUBE POR LOS PORTALES (docs/hallazgos-ui.md, «El clic derecho de la casa»): el clic derecho en un menú
//    o un modal que la fila abrió llega acá aunque se dibuje en el <body>. Sólo cuenta lo que está ADENTRO de la fila en el
//    DOM (`contains`). Escribiendo (un campo, el nombre que se está editando) el menú es el del navegador: copiar, pegar, el
//    corrector. Y con un modal abierto, ninguno.
// =============================================================================

import { useCallback, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { haptico } from '@/lib/haptico';

/** Cuánto hay que mantener el dedo para abrir el menú. El del Ops Center (MensajeWA) es 450; éste un poco más, para que el
 *  `contextmenu` de Android (que llega a los ~450-500 ms) gane la carrera las más de las veces y abra él. */
export const MANTENER_MS = 550;
/** Lo que se puede correr el dedo sin dejar de «mantener»: más que esto es scrollear. */
export const TOLERANCIA_PX = 8;
/** Dónde el clic derecho es el del NAVEGADOR (copiar, pegar, el corrector): lo que se escribe. Una casilla no. */
export const NO_ABRE_EN = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"], [contenteditable=""]';

/** ¿El dedo se corrió de más? Pura, para el test. */
export const seCorrio = (x0: number, y0: number, x: number, y: number): boolean =>
  Math.abs(x - x0) > TOLERANCIA_PX || Math.abs(y - y0) > TOLERANCIA_PX;

/**
 * Dónde abre un `contextmenu` (pura, para el test): en ningún lado si es el ECO del dedo que ya abrió el menú (`tragado`);
 * donde está el dedo si el de Android le ganó la carrera al reloj (`dedo`); y si no, en el cursor, o con el teclado (llega
 * sin punto, en 0,0) al borde de la fila.
 */
export function dondeAbre(o: {
  tragado: boolean;
  dedo: { x: number; y: number } | null;
  cursor: { x: number; y: number };
  borde: { left: number; top: number };
}): { x: number; y: number; porDedo: boolean } | null {
  if (o.tragado) return null;
  if (o.dedo) return { x: o.dedo.x, y: o.dedo.y, porDedo: true };
  const conPunto = o.cursor.x !== 0 || o.cursor.y !== 0;
  return { x: conPunto ? o.cursor.x : o.borde.left + 12, y: conPunto ? o.cursor.y : o.borde.top + 12, porDedo: false };
}

/** El menú abierto: sobre qué (`de`), dónde, y si lo abrió un dedo. `n` remonta la pieza en cada apertura (su `key`). */
export type MenuAbiertoEn<T> = { n: number; x: number; y: number; de: T; porDedo: boolean };

/** Lo que `propsDe` le pone a la fila (vacío sin menú). */
export type PropsMenuFila = {
  'data-con-menu'?: '';
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  onClickCapture?: (e: MouseEvent<HTMLElement>) => void;
};

/** ¿Este clic derecho (o este dedo) le toca a la fila? Ver la cabecera. */
function leToca(e: { target: EventTarget | null; currentTarget: Element; defaultPrevented: boolean }): boolean {
  const t = e.target;
  if (e.defaultPrevented || !(t instanceof Element)) return false;
  if (!e.currentTarget.contains(t)) return false;
  if (t.closest(NO_ABRE_EN)) return false;
  return !document.querySelector('[aria-modal="true"]');
}

export function useMenuContextual<T>() {
  const [abierto, setAbierto] = useState<MenuAbiertoEn<T> | null>(null);
  const aperturas = useRef(0);
  const gesto = useRef<{ id: number; x: number; y: number; reloj: ReturnType<typeof setTimeout> } | null>(null);
  /** El dedo ya abrió el menú: el `contextmenu` (eco de Android) y el clic que siguen no son de nadie. */
  const tragar = useRef(false);

  const abrir = useCallback((de: T, x: number, y: number, porDedo = false) => {
    aperturas.current += 1;
    setAbierto({ n: aperturas.current, x, y, de, porDedo });
  }, []);
  const cerrar = useCallback(() => setAbierto(null), []);
  const cortar = () => { if (gesto.current) { clearTimeout(gesto.current.reloj); gesto.current = null; } };

  /**
   * Lo que se le pone a la fila: `{...propsDe(item)}`. Sin opciones (`conMenu` en false: quien no es admin, lo que se está
   * creando) no se pone nada y el clic derecho es el del navegador, como sin «⋯».
   */
  const propsDe = (de: T, conMenu = true): PropsMenuFila => {
    if (!conMenu) return {};
    return {
      'data-con-menu': '',
      onContextMenu: (e: MouseEvent<HTMLElement>) => {
        if (!leToca(e)) return;
        e.preventDefault();
        const d = dondeAbre({ tragado: tragar.current, dedo: gesto.current, cursor: { x: e.clientX, y: e.clientY }, borde: e.currentTarget.getBoundingClientRect() });
        cortar();
        if (!d) return;
        if (d.porDedo) { tragar.current = true; haptico('medium'); }
        abrir(de, d.x, d.y, d.porDedo);
      },
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        tragar.current = false;
        cortar();
        if (e.pointerType === 'mouse' || !leToca(e)) return;
        const { clientX: x, clientY: y, pointerId: id } = e;
        gesto.current = {
          id, x, y,
          reloj: setTimeout(() => { gesto.current = null; tragar.current = true; haptico('medium'); abrir(de, x, y, true); }, MANTENER_MS),
        };
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        const g = gesto.current;
        if (g && g.id === e.pointerId && seCorrio(g.x, g.y, e.clientX, e.clientY)) cortar();
      },
      onPointerUp: cortar,
      onPointerCancel: cortar,
      onClickCapture: (e: MouseEvent<HTMLElement>) => {
        if (!tragar.current) return;
        tragar.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    };
  };

  return { abierto, abrir, cerrar, propsDe };
}
