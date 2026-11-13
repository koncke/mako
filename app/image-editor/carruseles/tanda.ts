// =============================================================================
// La portada de Image por tandas (13/11/2026)
// =============================================================================
// Medido en producción el 13/11: /image-editor mandaba con la página los 1.301 carruseles y anuncios (2,1 MB) y las miniaturas de
// YouTube (1,1 MB): 3,4 MB, 374 KB comprimidos. Los filtros de Image (cuentas, formatos, «parecidos», guardados) se calculan en el
// navegador sobre TODOS, así que la lista entera sigue llegando, pero DESPUÉS de dibujar: la página trae lo que se ve primero
// (`primeraTandaExplorador`) y la pantalla pide el resto apenas se dibuja (POST /api/image-editor/explorador). Las miniaturas de
// YouTube, sólo al abrir «Thumbnails». Sin `pendiente` (el banco, la API de MaKo), está todo, como antes.
// Sin 'use client': lo usan las páginas (el server) y los tests.
// =============================================================================

import { filtrarCarruseles, type FiltrosCarrusel } from '@/lib/carruseles/explorar';
import type { DatosExplorador } from './ExplorarCarruseles';

/** Lo que se ve al abrir: la primera tanda de la grilla (`DE_A` de ./ExplorarCarruseles.tsx). */
export const PRIMERA_TANDA_IMAGE = 40;

/**
 * Lo que viaja con la página: los primeros que se ven con los filtros de entrada y los totales que la pantalla muestra antes de
 * tener el resto. Con «Thumbnails» de entrada, todo (se mira otra lista).
 */
export function primeraTandaExplorador(d: DatosExplorador, f: FiltrosCarrusel, ahora = Date.now()): DatosExplorador {
  if (d.pendiente || f.que === 'thumbnails') return d;
  const vistos = filtrarCarruseles(d.carruseles, f, new Set(d.guardados), ahora);
  const propios = d.carruseles.filter((c) => c.origen === 'cuentas' && c.clase !== 'anuncio').length;
  const t = d.thumbnails;
  return {
    ...d,
    carruseles: vistos.slice(0, PRIMERA_TANDA_IMAGE),
    thumbnails: t && t.ok ? { ...t, lista: [] } : t,
    pendiente: { carruseles: d.carruseles.length, vistos: vistos.length, propios, thumbnails: t && t.ok ? t.lista.length : 0 },
  };
}
