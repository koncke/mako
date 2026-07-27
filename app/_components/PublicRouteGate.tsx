'use client';

// =============================================================================
// PublicRouteGate — oculta el "chrome" de la app en la landing pública /vsl
// =============================================================================
// /vsl (y /vsl/<slug>) es una landing de venta PÚBLICA que se renderiza como una
// capa fija a pantalla completa. El chrome de la app (toast de gasto de IA,
// notificaciones de WhatsApp, banner de impersonación) NO debe aparecer ahí bajo
// ningún concepto: son avisos internos del dueño/admin. Este gate desmonta esos
// componentes en rutas públicas para que ni se rendericen ni polleen.

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** ¿La ruta es una landing pública de /vsl? (no debe mostrar chrome de la app). */
export function isPublicLandingPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  // '/compartido' es material que se le pasa a alguien de afuera: sin sesión no
  // debe ver el sidebar (con los nombres de las tabs internas) ni disparar los
  // pollers de la app, que además le devolverían 401 en bucle.
  return p === '/vsl' || p.startsWith('/vsl/') || p === '/compartido' || p.startsWith('/compartido/');
}

/** Renderiza a sus hijos SOLO fuera de la landing pública. */
export function HideOnPublicLanding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicLandingPath(pathname)) return null;
  return <>{children}</>;
}
