'use client';

// =============================================================================
// extensiones/piezas — las piezas de interfaz que comparten los NodeViews del documento
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1, D3).
//
//   · `Flotante`: el panel anclado a un botón (un menú, las notas, el enlace de una imagen).
//     Es el `Flotante` del editor rico (app/_ui/EditorRico.tsx, privado allá) con sus trampas ya
//     pagadas: portaleado al `body` (adentro de la sección lo recortaría su `overflow` y lo
//     taparía la sección de abajo), registrado en la pila de modales como capa ANIDADA (no
//     esconde al editor), Escape con `stopImmediatePropagation` (si no, cerraba también el
//     diálogo de abajo), y ubicado con OPACIDAD y no `visibility` (un campo con visibility
//     hidden no recibe el foco que se le da en ese mismo instante).
//   · `Ico`: un ícono del set de la landing (lib/editor-landing/iconos.ts, Phosphor) dibujado
//     en React, sin `dangerouslySetInnerHTML`.
//   · `FilaMenu`: un renglón de menú con su ícono (AGENTS.md: cada opción de un desplegable
//     lleva ícono) que no le roba el foco al texto (`onMouseDown` + `preventDefault`).
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ICONOS, ICONO_NEUTRO } from '@/lib/editor-landing/iconos';

/** Que un clic en un control no le saque el foco (ni la selección) al texto del editor. */
export const sinRobarFoco = (e: { preventDefault: () => void }) => e.preventDefault();

/** Un ícono del set de la landing. Un nombre que no existe dibuja el neutro (se ve y se corrige). */
export function Ico({ n, tam = 16 }: { n: string; tam?: number }) {
  const ic = ICONOS[n] ?? ICONOS[ICONO_NEUTRO];
  return (
    <svg viewBox="0 0 256 256" width={tam} height={tam} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={ic.d} />
    </svg>
  );
}

/**
 * Un panel flotante anclado a `ancla`. `lado: 'abajo'` (default) lo pone debajo y lo da vuelta
 * si no entra; `'derecha'` lo pone al costado (los menús de la columna de la sección, que vive a
 * la izquierda del módulo).
 */
export function Flotante({ ancla, onCerrar, children, etiqueta, ancho = 240, lado = 'abajo', rol = 'dialog' }: {
  ancla: HTMLElement;
  onCerrar: () => void;
  children: ReactNode;
  etiqueta: string;
  ancho?: number;
  lado?: 'abajo' | 'derecha';
  rol?: 'dialog' | 'menu';
}) {
  const capa = useCapaModal(true, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  // Sin el `montado` de otros portales, a propósito: este panel sólo existe después de un clic
  // (nunca en el render del server), así que el portal se monta en el PRIMER render y el efecto
  // que lo mide lo encuentra (AGENTS.md: un efecto que mide un nodo de un portal).
  useLayoutEffect(() => {
    const ubicar = () => {
      const el = ref.current;
      if (!el) return;
      const r = ancla.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      let top: number;
      let left: number;
      if (lado === 'derecha') {
        left = r.right + 8;
        if (left + w > window.innerWidth - 8) left = r.left - w - 8;
        top = r.top;
      } else {
        top = r.bottom + 6;
        if (top + h > window.innerHeight - 8 && r.top - h - 6 >= 8) top = r.top - h - 6;
        left = r.left;
      }
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ubicar) : null;
    if (ref.current) ro?.observe(ref.current);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); ro?.disconnect(); };
  }, [ancla, lado]);

  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (ref.current?.contains(t) || ancla.contains(t))) return;
      // Un clic adentro de OTRO panel anidado encima (un submenú) no cierra este.
      if (t instanceof Element && t.closest('.gmc-flota') && !ref.current?.contains(t)) return;
      cerrarRef.current();
    };
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('pointerdown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, esElDeArriba]);

  // Flechas, Inicio y Fin entre los renglones de un menú.
  const navegar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (rol !== 'menu' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const sig = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[sig]?.focus();
  };

  return createPortal(
    <div
      ref={ref}
      role={rol}
      aria-label={etiqueta}
      className="gma gmc gmc-flota"
      onKeyDown={navegar}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: ancho, zIndex: capa.z, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Un renglón de menú con su ícono. `peligro` = rojo (Eliminar). `icono` puede ser un nombre del set o un nodo (el tacho de la casa). */
export function FilaMenu({ icono, texto, onClick, apagado, peligro, titulo }: {
  icono: string | ReactNode;
  texto: string;
  onClick: () => void;
  apagado?: boolean;
  peligro?: boolean;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="gmc-fila"
      data-peligro={peligro ? '' : undefined}
      disabled={apagado}
      title={titulo}
      onMouseDown={sinRobarFoco}
      onClick={onClick}
    >
      {typeof icono === 'string' ? <Ico n={icono} /> : icono}
      <span className="gmc-fila-txt">{texto}</span>
    </button>
  );
}

export const SepMenu = () => <div className="gmc-sep" role="separator" />;
