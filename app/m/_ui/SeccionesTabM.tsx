'use client';

// =============================================================================
// SeccionesTabM — la barra de secciones de una tab con secciones (Video, Image, Copywriting, AI Avatar)
// =============================================================================
// La destilación de la barra de escritorio (app/_components/SeccionesTab.tsx): las mismas secciones, en su orden y
// con su nombre, y la que todavía no está lleva su «pronto». Se ve como el segmentado de la casa (<SegmentadoM>, el
// de Clients · Community · Classroom), pero NO recorta: cuando no entran (Image tiene cuatro, Copywriting cinco para
// el super admin) la tira se desliza de costado, como las pestañas de arriba de Instagram o de CapCut. Con una sola
// sección no se dibuja (una barra con un botón no le sirve a nadie, la regla de escritorio).
//
// ⚠️ LA SECCIÓN QUE SE MIRA QUEDA A LA VISTA: en Image › Carousels o Copywriting › Stories (la cuarta) la tira abría
// en su comienzo y la elegida quedaba afuera, sin nada que dijera dónde se estaba (medido a 390 px, 17/10/2026). Al
// montar, la tira se corre lo justo para centrarla.
//
// Las secciones las calcula el server (app/m/_creacion/secciones.ts → `seccionesTabM`): este componente no decide
// quién ve qué. Se importa por su ruta, no por el índice de app/m/_ui (lleva su .module.css).
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import Link from '@/app/_ui/Link';
import styles from './SeccionesTabM.module.css';

/** Una sección: la key de nav.ts, su nombre de la barra de escritorio y su pantalla del teléfono (/m/…). */
export type SeccionTabM = { key: string; label: string; href: string; pronto: boolean };

export function SeccionesTabM({ etiqueta, secciones, activa }: {
  /** El nombre de la tab («Video»): para el lector de pantalla. */
  etiqueta: string;
  secciones: readonly SeccionTabM[];
  /** La key de la sección que se está mirando. */
  activa: string;
}) {
  const barra = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const b = barra.current;
    const a = b?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!b || !a || b.scrollWidth <= b.clientWidth) return;
    b.scrollLeft = Math.max(0, a.offsetLeft - (b.clientWidth - a.offsetWidth) / 2);
  }, [activa, secciones.length]);

  if (secciones.length < 2) return null;
  return (
    <nav ref={barra} aria-label={etiqueta} className={styles.barra} data-m-sin-pull>
      {secciones.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          className={styles.op}
          aria-current={s.key === activa ? 'page' : undefined}
        >
          <span>{s.label}</span>
          {s.pronto && <span className={styles.pronto}>pronto</span>}
        </Link>
      ))}
    </nav>
  );
}
