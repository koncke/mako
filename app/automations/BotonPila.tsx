// =============================================================================
// BotonPila — un botón de la pila de deshacer (↶ ↷) de un lienzo, pegado al zoom
// =============================================================================
// Estaba copiado en SecuenciaPerfil (una automatización) y en FlujoAviso (un mensaje de MaKo), carácter por
// carácter, y el recordatorio no lo tenía porque no se exportaba (restos de versiones anteriores,
// 10/10/2026). Una copia no recibe los arreglos del original: vive acá y los tres lo importan.
//
// Apagado cuando no hay nada que deshacer o rehacer, que es lo que lo vuelve honesto: ofrecer un «Deshacer»
// que no deshace nada es peor que no ofrecerlo — la misma regla que ya está escrita en `app/_ui/Toast.tsx`
// para su `onUndo` opcional.
//
// ⚠️ `data-no-pan` lo pone el envoltorio y no cada botón: un `pointerdown` en los píxeles de separación no
// encuentra el botón, y el lienzo lo tomaría como un paneo.

import type { ReactNode } from 'react';

export function BotonPila({ titulo, onClick, activo, children }: {
  titulo: string; onClick: () => void; activo: boolean; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!activo} title={titulo} aria-label={titulo}
      style={{
        width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
        color: activo ? 'var(--dim)' : 'var(--faint)', fontSize: 15, fontFamily: 'inherit',
        cursor: activo ? 'pointer' : 'default', opacity: activo ? 1 : 0.45,
      }}>
      {children}
    </button>
  );
}
