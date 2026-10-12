'use client';

// =============================================================================
// ZonaDelNegocio — detecta la zona del negocio por el navegador de quien entra (no dibuja nada)
// =============================================================================
// Decisión 4 de la décima (11/10/2026): la zona del negocio sale de la ubicación de SUS admins. Esto sólo manda la
// zona del navegador; quién cuenta y quién pisa a quién lo decide el server (app/_components/zona-actions.ts).
// Lo monta app/layout.tsx para toda sesión que no sea la vieja compartida.
//
// UNA vez por pestaña (marca en sessionStorage): la detección gana la primera vez y no hace falta repetirla en cada
// navegación. Sin storage (modo privado estricto) se intenta igual, una vez por montaje.

import { useEffect } from 'react';
import { zonaDelNavegador } from '@/app/_comunidad/tiempo';
import { detectarZonaAction } from './zona-actions';

const MARCA = 'mako.zona.detectada';

export function ZonaDelNegocio(): null {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(MARCA)) return;
      window.sessionStorage.setItem(MARCA, '1');
    } catch { /* sin storage: se intenta igual */ }
    try {
      void detectarZonaAction(zonaDelNavegador()).catch(() => {});
    } catch { /* nunca rompe la pantalla */ }
  }, []);
  return null;
}
