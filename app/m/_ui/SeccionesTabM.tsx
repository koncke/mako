// =============================================================================
// SeccionesTabM — la barra de SECCIONES de una tab unificada, en el teléfono (17/10/2026)
// =============================================================================
// En escritorio, una tab con `secciones` (nav.ts: Automations › MaKo Messages, Offer › Strategy, Video › Editor…) dibuja
// arriba de la pantalla la barra de secciones (app/_components/SeccionesTab.tsx), con la regla de la sidebar
// (`seccionesVisibles`). El teléfono destila eso mismo con el segmentado de iOS. Muestra las secciones que esta persona ve
// Y que tienen pantalla en el teléfono (`rutaMovil`), cada una como link. Con una sola no dibuja nada, porque no hay
// entre qué elegir.
//
// Sin 'use client': la arma el server de cada página y le pasa a SegmentadoM opciones con `href` (serializables).
// =============================================================================

import { FAMILIAS, type NavItem } from '@/app/_components/nav';
import { seccionesVisibles, type VistaNav } from '@/lib/nav-visibilidad';
import { rutaMovil } from '@/lib/movil-rutas';
import { SegmentadoM } from './ControlesM';

/** Las secciones que el teléfono ofrece de la tab `tab` para esta persona, con la ruta del teléfono de cada una. */
export function seccionesDeTabM(tab: string, vista: VistaNav): { id: string; label: string; href: string }[] {
  const t: NavItem | undefined = FAMILIAS.flatMap((f) => f.bloques.flat()).find((x) => x.key === tab);
  if (!t) return [];
  return seccionesVisibles(t, vista).flatMap((s) => {
    const href = rutaMovil(s.href);
    return href ? [{ id: s.key, label: s.seccion ?? s.label, href }] : [];
  });
}

export function SeccionesTabM({ tab, activa, vista }: { tab: string; activa: string; vista: VistaNav }) {
  const opciones = seccionesDeTabM(tab, vista);
  if (opciones.length < 2) return null;
  return (
    <div className="m-secciones-tab">
      <SegmentadoM etiqueta="Sección" valor={activa} opciones={opciones} />
    </div>
  );
}
