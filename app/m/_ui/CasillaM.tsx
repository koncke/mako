'use client';

// =============================================================================
// CasillaM — la casilla redonda para completar una tarea (Plan y «Para hoy» de Today)
// =============================================================================
// Dibujo de 26 dentro de un toque de 44 (el margen negativo devuelve los 18 de más: la fila
// mide lo mismo con o sin casilla). Borde 2 --border-strong; al marcar se llena de --primary
// con el ✓ en 160 ms, como el prototipo (`.chk`). El háptico y lo que pasa después (la fila se
// tacha y se va, el toast con Deshacer) son de quien la monta: este botón sólo dice si está
// marcada.
//
// Hasta el 11/10/2026 había DOS: CheckTarea (app/m/plan) y la `.m-hoy-casilla` de Today, con
// dos CSS que ya empezaban a diferir (160 ms contra .18 s, el foco). Una pieza, un lugar.
//
// ⚠️ VA POR ENCIMA DE LA CAPA QUE ABRE LA FILA (z-index 2). En Plan la fila entera abre el
// detalle con un botón estirado (z-index 1): tocar el círculo completa y tocar cualquier otro
// lado abre. Sin eso, un dedo en el círculo abriría el detalle y la tarea no se completaría.
// =============================================================================

import { Icon } from '@/app/_components/icons';

export function CasillaM({ marcada, onMarcar, titulo, deshabilitado, motivo, className }: {
  marcada: boolean;
  onMarcar: () => void;
  /** Para el nombre accesible: «Completar: <título>». */
  titulo: string;
  deshabilitado?: boolean;
  /** Por qué está apagada (sin conexión): va al aria-label, no se dibuja. */
  motivo?: string;
  /** Sólo para el margen de una pantalla (el contexto de la fila cambia el ajuste óptico). */
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={deshabilitado && motivo ? `${motivo}: ${titulo}` : `Completar: ${titulo}`}
      className={className ? `m-casilla ${className}` : 'm-casilla'}
      disabled={deshabilitado || marcada}
      onClick={(e) => { e.stopPropagation(); onMarcar(); }}
    >
      <span className="m-casilla__c" aria-hidden>
        <Icon name="check" size={16} />
      </span>
    </button>
  );
}
