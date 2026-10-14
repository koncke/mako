'use client';

// =============================================================================
// VistaMovil — ¿lo que se ve es la versión del TELÉFONO? (con LAS MISMAS RUTAS)
// =============================================================================
// Desde el 13/10/2026 un teléfono abre /crm, /general, /plan… y el proxy le sirve la página de
// /m en esa misma URL (lib/movil-desvio.ts → `pedidoMovil`). El navegador dice /crm, no /m/crm, así
// que todo lo del layout raíz que se apagaba con `esRutaMovil(pathname)` —el Sidebar, los banners,
// la esquina de avisos, los pollers de WhatsApp— necesita saber además si ESTO es un teléfono.
//
// Eso lo decide el SERVER una vez (el layout: UA + la cookie de «Versión completa», la misma
// pregunta que hace el proxy) y baja por este contexto. El dispositivo no cambia sin recargar: la
// cookie se escribe siempre con una navegación dura.
//
// Sin provider vale false y todo se comporta como antes (sólo `esRutaMovil`).
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { esVistaMovil } from '@/lib/movil-desvio';
import { rutaInterna } from '@/lib/movil-rutas';

const TelefonoCtx = createContext(false);

export function TelefonoProvider({ telefono, children }: { telefono: boolean; children: ReactNode }) {
  return <TelefonoCtx.Provider value={telefono}>{children}</TelefonoCtx.Provider>;
}

/** ¿El server dijo que esto es un teléfono (y que MaKo Mobile está prendida)? */
export function useTelefono(): boolean {
  return useContext(TelefonoCtx);
}

/** ¿La pantalla de ESTA URL es la de MaKo Mobile? (el shell de /m dibuja su propio cromo). */
export function useVistaMovil(): boolean {
  const telefono = useTelefono();
  const pathname = usePathname();
  const sp = useSearchParams();
  return esVistaMovil(pathname, sp?.toString() ?? '', telefono);
}

/**
 * La ruta INTERNA de /m que se está viendo (`/m/crm/12` para la URL /crm/12), sin query. La lee el
 * shell de /m: la cabecera, la barra y la animación hablan en rutas /m. Si la URL no es de /m,
 * devuelve el pathname tal cual.
 */
export function useRutaInterna(): string {
  const pathname = usePathname() || '';
  const sp = useSearchParams();
  return rutaInterna(pathname, sp?.toString() ?? '') ?? pathname;
}
