'use client';

// =============================================================================
// ficha/resumen/lectura — leer lo de un bloque al montarse (los de la charla y el de automatizaciones)
// =============================================================================
// Salió de ./charla.tsx el 23/10/2026, cuando el bloque «Automatizaciones» se mudó a ./automatizaciones.tsx: los dos
// leen igual, y una copia del hook en cada archivo es la clase de duplicado que se separa con el primer arreglo.
// =============================================================================

import { useEffect, useState } from 'react';

/**
 * Lee al montarse (y cuando cambia el lead): `'cargando'`, `null` (no se pudo) o lo leído. `ahora` es la hora de la
 * lectura: lo que dice «hace 3 h» se calcula contra ella, no al dibujar (un render tiene que ser puro).
 */
export function useLectura<T>(leadId: number, leer: (id: number) => Promise<T | null>): { dato: T | null | 'cargando'; ahora: number } {
  const [v, setV] = useState<{ id: number; dato: T | null; ahora: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    void leer(leadId).then(
      (d) => { if (vivo) setV({ id: leadId, dato: d, ahora: Date.now() }); },
      () => { if (vivo) setV({ id: leadId, dato: null, ahora: Date.now() }); },
    );
    return () => { vivo = false; };
  }, [leadId, leer]);
  return v && v.id === leadId ? { dato: v.dato, ahora: v.ahora } : { dato: 'cargando', ahora: 0 };
}
