'use client';

// =============================================================================
// BarraSeccionesM — el dibujo de la barra de secciones (la arma <SeccionesTabM>, ./SeccionesTabM.tsx)
// =============================================================================
// Se ve como el segmentado de la casa (<SegmentadoM>: los mismos valores de `.m-seg`), pero NO recorta: cuando no entran
// (Image tiene cuatro, Copywriting cinco para el super admin) la tira se desliza de costado, como las pestañas de arriba
// de Instagram o de CapCut, y la sección «pronto» lleva su chip, como la barra de escritorio.
//
// ⚠️ LA SECCIÓN QUE SE MIRA QUEDA A LA VISTA: en Image › Carousels o Copywriting › Stories (la cuarta) la tira abría en su
// comienzo y la elegida quedaba afuera, sin nada que dijera dónde se estaba (medido a 390 px, 17/10/2026). Al montar, la
// tira se corre lo justo para centrarla.
// Las clases viven en app/m/m.css (`.m-secciones-tab*`): un .module.css acá tumbaría los tests de node que importan
// SeccionesTabM (docs/hallazgos-mobile.md, «Las tabs de CREACIÓN»).
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import Link from '@/app/_ui/Link';

/** Una sección: la key de nav.ts, su nombre de la barra de escritorio y su pantalla del teléfono (/m/…). */
export type OpcionSeccionM = { id: string; label: string; href: string; pronto?: boolean };

export function BarraSeccionesM({ etiqueta, valor, opciones }: {
  /** El nombre de la tab («Video»): para el lector de pantalla. */
  etiqueta: string;
  /** La key de la sección que se está mirando. */
  valor: string;
  opciones: readonly OpcionSeccionM[];
}) {
  const barra = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const b = barra.current;
    const a = b?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!b || !a || b.scrollWidth <= b.clientWidth) return;
    b.scrollLeft = Math.max(0, a.offsetLeft - (b.clientWidth - a.offsetWidth) / 2);
  }, [valor, opciones.length]);

  return (
    <nav ref={barra} aria-label={etiqueta} className="m-secciones-tab__barra" data-m-sin-pull>
      {opciones.map((o) => (
        <Link key={o.id} href={o.href} className="m-secciones-tab__op" aria-current={o.id === valor ? 'page' : undefined}>
          <span>{o.label}</span>
          {o.pronto && <span className="m-secciones-tab__pronto">pronto</span>}
        </Link>
      ))}
    </nav>
  );
}
