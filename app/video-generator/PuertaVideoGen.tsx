'use client';

// =============================================================================
// PuertaVideoGen — decide si se ve el onboarding o la tab, del lado del cliente
// =============================================================================
//
// ⚠️ EL «SALIR» DEL WIZARD ES ESTADO DE CLIENTE, NO UN `router.refresh()`.
//
// Refrescar vuelve a correr el guard del server —que sigue diciendo «pendiente»,
// porque el ensayo lo cierra aprobar un escenario— y devuelve el mismo wizard.
// O sea: «Lo configuro después» no llevaría a ningún lado, que es el modo de
// falla que ya está documentado en `OnboardingCarousels` y en
// `OnboardingInstagram`.
//
// La tab entera llega como `children` YA RENDERIZADA por el server: así el
// wizard no la monta hasta que hace falta, y salir no dispara ni una consulta.

import { useState, type ReactNode } from 'react';
import type { Puente } from '@/lib/flow-cola';
import { OnboardingVideoGen } from './OnboardingVideoGen';

export function PuertaVideoGen({
  fotos, acentoInicial, acentoSeguro, muletillasIniciales, puente, children,
}: {
  fotos: { id: string; url: string }[];
  acentoInicial: string;
  acentoSeguro: boolean;
  muletillasIniciales: string[];
  puente: Puente | null;
  children: ReactNode;
}) {
  const [salio, setSalio] = useState(false);
  if (salio) return <>{children}</>;
  return (
    <OnboardingVideoGen
      fotos={fotos}
      acentoInicial={acentoInicial}
      acentoSeguro={acentoSeguro}
      muletillasIniciales={muletillasIniciales}
      puente={puente}
      alSalir={() => setSalio(true)}
    />
  );
}
