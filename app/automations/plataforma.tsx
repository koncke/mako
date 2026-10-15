'use client';
// =============================================================================
// plataforma — ¿la tab Automations se está mirando desde el ws de la PLATAFORMA (SuperAdmin)? (15/10/2026)
// =============================================================================
// Lo resuelve el server (app/automations/page.tsx, `esWsPlataforma`) y lo leen los que ofrecen algo que sólo existe
// ahí: el evento de una PERSONA en el CRON (`eventosOfrecidos`, lib/disparadores.ts) y la plantilla de SuperAdmin en la
// galería (`plantillasPara`, lib/plantillas-automatizaciones.ts). Es lo que se OFRECE: lo que se CREA lo frena el server
// (`crearDesdePlantilla`, `deps.plataforma`). Sin proveedor, no: fail-closed.
import { createContext, useContext, type ReactNode } from 'react';

const CtxPlataforma = createContext(false);

export function PlataformaProvider({ valor, children }: { valor: boolean; children: ReactNode }) {
  return <CtxPlataforma.Provider value={valor}>{children}</CtxPlataforma.Provider>;
}

export const usePlataforma = (): boolean => useContext(CtxPlataforma);
