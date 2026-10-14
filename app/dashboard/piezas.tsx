'use client';

// =============================================================================
// piezas — lo suelto que comparten las piezas de la pantalla del Dashboard: la capa sobre el <body>,
// la clase de «no arrastrar» y los colores con significado
// =============================================================================
// Nació como lo común de los BLOQUES de Comercial y de Analysts (la carpeta `bloques/` de acá, hasta el
// 13/10/2026). Los bloques se fueron en v5 (lib/graficos-migrar-v5.ts los convierte en gráficos en el
// saneo) y su código se borró; acá quedó lo que todavía usa alguien: `Capa` (los pop-ups de una tarjeta,
// el detalle de una fila, el AI Analyst), `NO_ARRASTRAR` (la ficha de una llamada) y los dos colores de la
// ficha de una llamada (./entidades/llamada.tsx), siempre con los TOKENS de la app para que se den vuelta
// en el tema oscuro.

import type { ReactNode, SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';

/**
 * La clase que le dice a la grilla «acá no se arrastra» (el `cancel` de react-grid-layout en
 * app/dashboard/EditorInforme.tsx). Va en todo lo que se aprieta: sin ella, en modo edición, un clic en
 * un botón de la tarjeta empieza a moverla.
 */
export const NO_ARRASTRAR = 'lk-no-arrastrar';

/** Un tono con su fondo suave: el fondo sale de mezclar el tono con la superficie (se oscurece solo). */
export const suave = (color: string, p = 12) => `color-mix(in srgb, ${color} ${p}%, var(--surface))`;

/** El color de un puntaje de 0 a 10, con los cortes de la tab de Closing (≥7,5 bien, ≥5 regular). */
export const colorPuntaje = (s: number | null) => (s == null ? 'var(--faint)' : s >= 7.5 ? 'var(--good)' : s >= 5 ? 'var(--warn)' : 'var(--bad)');

const parar = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Monta algo en el `body`. Hace falta por DOS cosas de la tarjeta, y ninguna da error:
 * react-grid-layout la ubica con `transform` —con eso un `position: fixed` de adentro deja de ser
 * relativo a la ventana y queda pegado a la tarjeta— y la tarjeta lleva `overflow: hidden`, que lo
 * recorta. El pop-up de desglose y el toast se verían cortados adentro de la caja.
 *
 * ⚠️ Un portal de React sigue BURBUJEANDO por el árbol de React: un clic adentro del pop-up llegaría al
 *    `onClick` de la tarjeta (que la selecciona en modo edición) y un mousedown, a la grilla (que
 *    empezaría a arrastrarla). Por eso la envoltura frena los eventos y lleva la clase de no arrastrar.
 */
export function Capa({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={NO_ARRASTRAR} onClick={parar} onMouseDown={parar} onPointerDown={parar} onTouchStart={parar}>{children}</div>,
    document.body,
  );
}
