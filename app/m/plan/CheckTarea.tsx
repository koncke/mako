'use client';

// =============================================================================
// CheckTarea — el círculo para completar una tarea (Plan y Today)
// =============================================================================
// Dibujo de 24 dentro de un toque de 44 (el margen negativo devuelve los 20 de
// más: la fila mide lo mismo con o sin check). Borde 2 --border-strong; al
// marcar se llena de --good con el ✓ en 160 ms. El háptico y lo que pasa después
// (la fila sale, el toast con Deshacer) son de quien lo monta: este botón sólo
// dice si está marcado.
//
// ⚠️ VA POR ENCIMA DE LA CAPA QUE ABRE LA FILA. En /m/plan la fila entera abre el
// detalle con un botón estirado (z-index 1); el check vive en z-index 2, así que
// tocar el círculo completa y tocar cualquier otro lado abre. Sin eso, un dedo en
// el círculo abriría el detalle y la tarea no se completaría nunca.
// =============================================================================

import { Icon } from '@/app/_components/icons';

export function CheckTarea({ marcada, onMarcar, titulo, deshabilitado, motivo }: {
  marcada: boolean;
  onMarcar: () => void;
  /** Para el nombre accesible: «Completar: <título>». */
  titulo: string;
  deshabilitado?: boolean;
  /** Por qué está apagado (sin conexión): va al aria-label, no se dibuja. */
  motivo?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={deshabilitado && motivo ? `${motivo}: ${titulo}` : `Completar: ${titulo}`}
      className="m-check"
      disabled={deshabilitado || marcada}
      onClick={(e) => { e.stopPropagation(); onMarcar(); }}
    >
      <span className="m-check__c" aria-hidden>
        <Icon name="check" size={14} />
      </span>
    </button>
  );
}
