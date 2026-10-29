'use client';

// =============================================================================
// /m/ai-avatar — los chips de las categorías
// =============================================================================
// Las categorías de presets de escritorio (app/ai-avatar/Estudio.tsx, el selector de Higgsfield) en tamaño de teléfono:
// chips de 44 px en una tira que se desliza. La portada y el reproductor de voces se fueron con las secciones de HeyGen
// (29/10/2026).
// =============================================================================

import type { ReactNode } from 'react';

/** La tira de chips de filtro (se desliza de costado si no entra). */
export function ChipsM({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return <div className="m-ai-avatar-chips" role="group" aria-label={etiqueta} data-m-sin-pull>{children}</div>;
}

export function ChipM({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="m-ai-avatar-chip" aria-pressed={activo} onClick={onClick}>{children}</button>
  );
}
