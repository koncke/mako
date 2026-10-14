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
import { useRutaInterna, useVistaMovil } from './VistaMovil';
import { tituloDe } from '@/lib/titulo-tab';

export function TituloTab() {
  const pathname = usePathname() || '';
  // En el teléfono, /general ES Today y /mako/pendientes ES Inbox (LAS MISMAS RUTAS, 13/10/2026):
  // la pestaña lleva el nombre de lo que se ve, que es la ruta interna de /m.
  const movil = useVistaMovil();
  const interna = useRutaInterna();
  const ruta = movil ? interna : pathname;

  useEffect(() => {
    if (pathname === '/' || isPublicLandingPath(pathname) || pathname.startsWith('/compartido')) return;
    const titulo = tituloDe(ruta);
    const reafirmar = () => { if (document.title !== titulo) document.title = titulo; };
    document.title = titulo;
    // Al navegar, Next escribe el <title> del layout ("MaKo") con el commit de la
    // página nueva. Este efecto corre después, pero el orden no está garantizado
    // en todos los casos, así que se reafirma en el frame siguiente: si nadie lo
    // pisó no cambia nada, y si lo pisaron queda el bueno.
    const id = requestAnimationFrame(reafirmar);
    // ⚠️ Y EL FRAME SIGUIENTE NO ALCANZA EN UNA RUTA CON `loading.tsx` (12/10/2026). Martín:
    // «Todos las tabs tienen su nombre al lado de "MaKo", también debe tenerlo la de CRM» — y
    // /crm es justo la ÚNICA pantalla con `loading.tsx` (app/crm/loading.tsx). Ahí el router
    // cambia la ruta con el ESQUELETO (este efecto corre y escribe «MaKo - CRM») y la página
    // de verdad llega segundos después, con su <title> del layout («MaKo») por delante: el
    // metadata viaja en streaming y lo pisa cuando ya no queda ningún frame que lo reafirme.
    // (Es la diferencia entre /crm y las demás; NO se midió en un navegador: la corrida que lo
    // escribió no podía levantar la app.) Así que se mira el <head> mientras se está en la
    // ruta y se devuelve el título cada vez que alguien lo pisa, venga de donde venga. Sólo
    // mira el <head> (no el tablero), y `reafirmar` no escribe si el título ya es el bueno:
    // la mutación que causa su propia escritura vuelve, compara igual y no hace nada.
    const obs = new MutationObserver(reafirmar);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => { cancelAnimationFrame(id); obs.disconnect(); };
  }, [pathname, ruta]);

  return null;
}
