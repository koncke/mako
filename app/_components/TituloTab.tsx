'use client';

// =============================================================================
// TituloTab — escribe "MaKo - CRM" en la pestaña, según dónde estés parado
// =============================================================================
// El nombre lo resuelve lib/titulo-tab (lógica pura, con tests). Acá solo queda
// el cuándo: en qué rutas se pisa el título y en cuáles no.
//
// Se hace en el cliente y no con `metadata` por página porque son ~45 rutas y la
// mitad son client components (no pueden exportar metadata). El title del layout
// sigue siendo "MaKo": es lo que se ve mientras carga y lo que queda en el HTML
// para quien no ejecuta JS.
//
// Dos lugares donde NO toca nada: la landing pública y las páginas compartidas,
// que traen su propio título pensado para afuera (SEO, lo que se ve al mandar el
// link). Pisarlo con el nombre de una sección interna sería peor que no hacer nada.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isPublicLandingPath } from './PublicRouteGate';
import { tituloDe } from '@/lib/titulo-tab';

export function TituloTab() {
  const pathname = usePathname() || '';

  useEffect(() => {
    if (pathname === '/' || isPublicLandingPath(pathname) || pathname.startsWith('/compartido')) return;
    const titulo = tituloDe(pathname);
    document.title = titulo;
    // Al navegar, Next escribe el <title> del layout ("MaKo") con el commit de la
    // página nueva. Este efecto corre después, pero el orden no está garantizado
    // en todos los casos, así que se reafirma en el frame siguiente: si nadie lo
    // pisó no cambia nada, y si lo pisaron queda el bueno.
    const id = requestAnimationFrame(() => { if (document.title !== titulo) document.title = titulo; });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
