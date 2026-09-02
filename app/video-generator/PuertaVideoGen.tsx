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
  fotos, acentoInicial, muletillasIniciales, puente, linea, creditos, anunciosPosibles,
  descripcionPersona, acentoOrigen, acentoZona, children,
}: {
  fotos: { id: string; url: string }[];
  acentoInicial: string;
  muletillasIniciales: string[];
  puente: Puente | null;
  /** Una línea real de su guion, para el subtítulo del anuncio del aside. */
  linea: string;
  /** Créditos de Flow de su cuenta. `null` = todavía no se midieron. */
  creditos: number | null;
  /** Guiones × formatos: cuántos anuncios distintos salen de lo que ya cargó. */
  anunciosPosibles: number;
  /** Lo que MaKo escribió mirando sus fotos. '' = todavía no hay. */
  descripcionPersona: string;
  /** De dónde salió el acento. Decirlo mal es afirmar una deducción que no ocurrió. */
  acentoOrigen: 'declarado' | 'zona-horaria' | 'default';
  acentoZona: string;
  children: ReactNode;
}) {
  const [salio, setSalio] = useState(false);
  if (salio) return <>{children}</>;
  return (
    <OnboardingVideoGen
      fotos={fotos}
      acentoInicial={acentoInicial}
      muletillasIniciales={muletillasIniciales}
      puente={puente}
      linea={linea}
      creditos={creditos}
      anunciosPosibles={anunciosPosibles}
      descripcionPersona={descripcionPersona}
      acentoOrigen={acentoOrigen}
      acentoZona={acentoZona}
      alSalir={() => setSalio(true)}
    />
  );
}
