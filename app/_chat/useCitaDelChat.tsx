'use client';

// =============================================================================
// useCitaDelChat — «Responder» del clic derecho en un chat con MaKo: la cita arriba de la caja, y sale con lo escrito
// =============================================================================
// `HiloMako` ya abre el menú (Copiar siempre; Responder si la pantalla pasa `onCitar`). Lo que cada chat tenía que escribir era
// lo mismo: guardar la cita, dibujarla en la caja y pegarla al texto al mandar (Martín, 24/10/2026: «si le doy click derecho, no
// hace nada»; pendiente P5). El estado vive en ./useCita.ts.
//
// El Web Generator y el Copywriter lo tienen escrito aparte desde antes, con su propia lógica de mandar.
// =============================================================================

import type { ReactNode } from 'react';
import { CitaCaja } from '@/app/admin/operaciones/MensajeWA';
import { useCita } from './useCita';

export function useCitaDelChat(clave: string | number | null = null): ReturnType<typeof useCita> & {
  /** Para `arriba` de `CajaChat`. */
  arriba: ReactNode;
} {
  const c = useCita(clave);
  return { ...c, arriba: c.cita ? <CitaCaja cita={c.cita} onQuitar={c.soltar} /> : null };
}
