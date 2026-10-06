'use client';

// =============================================================================
// PuertaCopyGen — decide si se ve el onboarding o la tab, del lado del cliente
// =============================================================================
//
// ⚠️ EL «SALIR» DEL WIZARD ES ESTADO DE CLIENTE, NO UN `router.refresh()`.
//
// Refrescar vuelve a correr el guard del server —que sigue diciendo «pendiente»
// hasta que el último paso se anota— y devuelve el mismo wizard. Es el modo de
// falla que ya está documentado en `PuertaVideoGen` y `OnboardingCarousels`; acá
// se copia la salida que funciona en vez de descubrirlo una cuarta vez.
//
// La tab entera llega como `children` YA RENDERIZADA por el server: así el wizard
// no la monta hasta que hace falta, y salir no dispara ni una consulta.

import { useState, type ReactNode } from 'react';
import { OnboardingCopyGen } from './OnboardingCopyGen';

export function PuertaCopyGen({ children }: { children: ReactNode }) {
  const [salio, setSalio] = useState(false);
  if (salio) return <>{children}</>;
  return <OnboardingCopyGen alSalir={() => setSalio(true)} />;
}
