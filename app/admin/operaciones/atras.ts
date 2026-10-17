'use client';

// =============================================================================
// El «atrás» cierra la capa de arriba, no la conversación (17/10/2026)
// =============================================================================
// Martín: «Si abro la vista de una imagen y voy para atrás, se cierra la imagen, no el chat». Como WhatsApp: el «atrás»
// (el gesto de iOS, el botón de Android, el del navegador) cierra lo último que se abrió encima —el visor de una foto, el
// menú de un mensaje— y recién el siguiente cierra la conversación.
//
// Cómo: al abrir, una entrada más en el historial con la MISMA URL (con su `?sheet=` adentro). El «atrás» vuelve a la
// entrada de la hoja: SheetM.tsx ve su `?sheet=` todavía en la URL y no se cierra; esta capa sí. Si se cierra por otro
// camino (la ✕, tocar afuera), se consume la entrada con `history.back()`, que tampoco cierra la hoja por lo mismo.
// ⚠️ `pushState(null, …)` como SheetM: Next copia su estado interno en la entrada (su `pushState` está parchado) y el
//    «atrás» es una restauración con el mismo árbol, sin ir al servidor (docs/hallazgos-operaciones.md, el «atrás» lento).

import { useEffect, useRef } from 'react';

export function useAtrasCierra(abierto: boolean, cerrar: () => void) {
  const cerrarRef = useRef(cerrar);
  useEffect(() => { cerrarRef.current = cerrar; });
  useEffect(() => {
    if (!abierto || typeof window === 'undefined') return;
    let porAtras = false;
    window.history.pushState(null, '', window.location.href);
    const alAtras = () => { porAtras = true; cerrarRef.current(); };
    window.addEventListener('popstate', alAtras);
    return () => {
      window.removeEventListener('popstate', alAtras);
      if (!porAtras) window.history.back();
    };
  }, [abierto]);
}
