'use client';

// =============================================================================
// PuenteNativo — engancha lo del aparato al abrir la app de iPhone (lib/nativo.ts, 3/11/2026)
// =============================================================================
// En el layout raíz y no en /m: los códigos de recuperación se bajan en /login/2fa, y un link universal abre la app en cualquier
// pantalla. No dibuja nada, y afuera de la app no hace nada: `engancharApp` pregunta primero por `window.Capacitor`.

import { useEffect } from 'react';
import { engancharApp } from '@/lib/nativo';

export function PuenteNativo() {
  useEffect(() => engancharApp(), []);
  return null;
}
