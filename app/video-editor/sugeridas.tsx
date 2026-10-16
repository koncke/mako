'use client';

// =============================================================================
// Las señales del negocio, para que la pestaña Plantillas ponga primero las sugeridas
// =============================================================================
// Martín, 16/10/2026: «en todos los lugares que usamos templates, que al principio se
// posicionen los sugeridos para el negocio… Y que tenga un texto sutil de "Sugerido"».
// La regla vive en lib/plantillas-sugeridas.ts; las señales las lee la page del server
// (`senalesDelNegocio`, en paralelo con lo demás) y bajan por este contexto hasta la
// pestaña (_opencut/plantillas/components/biblioteca-plantillas.tsx): así la galería abre
// ordenada y no salta, sin pasar la prop por todo el árbol del motor.
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';

const Senales = createContext<SenalesNegocio | null>(null);

export function SenalesNegocioProvider({ senales, children }: { senales: SenalesNegocio | null; children: ReactNode }) {
  return <Senales.Provider value={senales}>{children}</Senales.Provider>;
}

/** Lo que se sabe del negocio (null: no declaró nada, y la galería va en el orden de siempre). */
export const useSenalesNegocio = (): SenalesNegocio | null => useContext(Senales);
