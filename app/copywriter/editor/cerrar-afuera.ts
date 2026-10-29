'use client';

// Un menú flotante del Copywriter se cierra al tocar afuera o con Escape (como en Notion).

import { useEffect, type RefObject } from 'react';

export function useCerrarAfuera(ref: RefObject<HTMLElement | null>, abierto: boolean, cerrar: () => void): void {
  useEffect(() => {
    if (!abierto) return;
    const tocar = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cerrar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('pointerdown', tocar, true);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', tocar, true);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar, ref]);
}
