'use client';

// =============================================================================
// TooltipsFlotantes — los tooltips del Web Generator, SIEMPRE arriba de todo (25/10/2026)
// =============================================================================
// Martín (25/10): «Los placeholder como en la captura, se siguen ocultando detrás de otras secciones y no se leen» (el
// «Editor de texto» tapado por la barra de formato) y «Mira como se superponen» (el «Volver al ch…» del panel Páginas,
// cortado a la mitad encima del lienzo). Los tooltips eran pseudo-elementos (`.gma-tip::after` en gamma.css,
// `.gmc-tip::before` en estilos-nodos.ts): un `::after` vive ADENTRO de su botón, así que lo corta cualquier ancestro con
// `overflow` y lo tapa cualquier capa con más z-index. No hay z-index que lo arregle para todos.
//
// Esto los saca a un portal en `body` con `position: fixed`: escucha a todo elemento con `data-tip` (`.gma-tip`, `.gmc-tip`)
// y dibuja UN tooltip encima de todo, del lado pedido (`data-tip-lado`; `.gmc-tip` a la derecha, el resto abajo), dado
// vuelta si no entra y corrido para que nunca se salga de la ventana. Mientras está montado, los pseudo-elementos se apagan
// (`html[data-tips-flotantes]`, gamma.css). Mismo texto, mismo atajo (`data-atajo`), mismos colores y la misma demora.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Lado = 'abajo' | 'arriba' | 'derecha' | 'izquierda';
type Tip = { el: HTMLElement; texto: string; atajo: string | null; lado: Lado; fondo: string; letra: string };

const SELECTOR = '.gma-tip[data-tip], .gmc-tip[data-tip]';
const DEMORA_MS = 350;
const SEPARACION = 6;
const MARGEN = 8;

/** El lado pedido: el atributo, o el de siempre de cada clase. */
function ladoDe(el: HTMLElement): Lado {
  const pedido = el.getAttribute('data-tip-lado');
  if (pedido === 'arriba' || pedido === 'derecha' || pedido === 'izquierda' || pedido === 'abajo') return pedido;
  return el.classList.contains('gmc-tip') ? 'derecha' : 'abajo';
}

/**
 * Dónde va un tooltip de `ancho`×`alto` junto a `r`, del lado pedido y dado vuelta si no entra; después, corrido para que
 * quede adentro de la ventana. Puro (lo prueba tests/editor-web-tooltips.test.ts).
 */
export function ubicarTooltip(r: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  ancho: number, alto: number, lado: Lado, vista: { ancho: number; alto: number }): { left: number; top: number; lado: Lado } {
  const entra: Record<Lado, boolean> = {
    abajo: r.bottom + SEPARACION + alto <= vista.alto - MARGEN,
    arriba: r.top - SEPARACION - alto >= MARGEN,
    derecha: r.right + SEPARACION + ancho <= vista.ancho - MARGEN,
    izquierda: r.left - SEPARACION - ancho >= MARGEN,
  };
  const contrario: Record<Lado, Lado> = { abajo: 'arriba', arriba: 'abajo', derecha: 'izquierda', izquierda: 'derecha' };
  const final = entra[lado] || !entra[contrario[lado]] ? lado : contrario[lado];
  let left: number;
  let top: number;
  if (final === 'abajo' || final === 'arriba') {
    left = r.left + r.width / 2 - ancho / 2;
    top = final === 'abajo' ? r.bottom + SEPARACION : r.top - SEPARACION - alto;
  } else {
    top = r.top + r.height / 2 - alto / 2;
    left = final === 'derecha' ? r.right + SEPARACION : r.left - SEPARACION - ancho;
  }
  left = Math.min(Math.max(MARGEN, left), Math.max(MARGEN, vista.ancho - MARGEN - ancho));
  top = Math.min(Math.max(MARGEN, top), Math.max(MARGEN, vista.alto - MARGEN - alto));
  return { left: Math.round(left), top: Math.round(top), lado: final };
}

export function TooltipsFlotantes() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-tips-flotantes', '');
    let actual: HTMLElement | null = null;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const ocultar = () => {
      if (reloj) { clearTimeout(reloj); reloj = null; }
      actual = null;
      setTip(null);
      setPos(null);
    };
    const mostrar = (el: HTMLElement) => {
      // Un botón con su menú abierto no muestra el tooltip (como hacía el CSS: `aria-expanded="true"`).
      if (!el.isConnected || el.getAttribute('aria-expanded') === 'true') return;
      const texto = el.getAttribute('data-tip')?.trim();
      if (!texto) return;
      const estilo = getComputedStyle(el);
      setPos(null);
      setTip({
        el, texto, atajo: el.getAttribute('data-atajo'), lado: ladoDe(el),
        fondo: estilo.getPropertyValue('--gma-tooltip').trim() || '#1f2328',
        letra: estilo.getPropertyValue('--gma-sobre-tooltip').trim() || '#ffffff',
      });
    };
    const entrar = (destino: EventTarget | null, demora: number) => {
      const el = (destino as Element | null)?.closest?.(SELECTOR) as HTMLElement | null;
      if (el === actual) return;
      ocultar();
      if (!el) return;
      actual = el;
      reloj = setTimeout(() => mostrar(el), demora);
    };
    const sobre = (e: PointerEvent) => { if (e.pointerType !== 'touch') entrar(e.target, DEMORA_MS); };
    const fuera = (e: PointerEvent) => {
      if (!actual) return;
      const hacia = e.relatedTarget as Node | null;
      if (!hacia || !actual.contains(hacia)) ocultar();
    };
    const foco = (e: FocusEvent) => {
      // Sólo el foco del teclado (`:focus-visible`), como el CSS: un clic no deja el tooltip clavado.
      const el = e.target as HTMLElement | null;
      if (el?.matches?.(':focus-visible')) entrar(el, DEMORA_MS); else ocultar();
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') ocultar(); };
    document.addEventListener('pointerover', sobre, true);
    document.addEventListener('pointerout', fuera, true);
    document.addEventListener('pointerdown', ocultar, true);
    document.addEventListener('focusin', foco, true);
    document.addEventListener('focusout', ocultar, true);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('scroll', ocultar, true);
    window.addEventListener('resize', ocultar);
    return () => {
      ocultar();
      html.removeAttribute('data-tips-flotantes');
      document.removeEventListener('pointerover', sobre, true);
      document.removeEventListener('pointerout', fuera, true);
      document.removeEventListener('pointerdown', ocultar, true);
      document.removeEventListener('focusin', foco, true);
      document.removeEventListener('focusout', ocultar, true);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('scroll', ocultar, true);
      window.removeEventListener('resize', ocultar);
    };
  }, []);

  // Se mide ya dibujado (invisible) y se ubica antes de pintar.
  useLayoutEffect(() => {
    if (!tip || !caja.current) return;
    const r = tip.el.getBoundingClientRect();
    const t = caja.current.getBoundingClientRect();
    const p = ubicarTooltip(r, t.width, t.height, tip.lado, { ancho: window.innerWidth, alto: window.innerHeight });
    setPos({ left: p.left, top: p.top });
  }, [tip]);

  if (!tip || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={caja} role="tooltip" className="gma-tip-flotante"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden', background: tip.fondo, color: tip.letra }}>
      {tip.texto}{tip.atajo ? <span className="gma-tip-flotante-atajo">{tip.atajo}</span> : null}
    </div>,
    document.body,
  );
}
