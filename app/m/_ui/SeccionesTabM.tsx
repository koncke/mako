// =============================================================================
// SeccionesTabM — la barra de SECCIONES de una tab unificada, en el teléfono (17/10/2026)
// =============================================================================
// En escritorio, una tab con `secciones` (nav.ts: Offer › Strategy, Video › Editor · Create
// with AI · Reels, Image, Copywriting, AI Avatar…) dibuja arriba de la pantalla la barra de secciones
// (app/_components/SeccionesTab.tsx), con la regla de la sidebar (`seccionesVisibles`). El teléfono destila eso mismo:
// las secciones que esta persona ve Y que tienen pantalla en el teléfono (`rutaMovil`), cada una como link, en el orden y
// con el nombre de escritorio, y la que todavía no está con su «pronto». Con una sola no dibuja nada, porque no hay entre
// qué elegir.
//
// UNA primitiva para las dos que nacieron el mismo día (Mobile 2, Automations; Mobile 1, las tabs de creación): la API y
// el cálculo son éstos; el dibujo es <BarraSeccionesM> (la tira que se desliza cuando no entran y centra la elegida).
// Sin 'use client' y sin CSS propio: la arma el server de cada página, y tests de node importan `seccionesDeTabM`.
// =============================================================================

import { FAMILIAS, type NavItem } from '@/app/_components/nav';
import { seccionesVisibles, type VistaNav } from '@/lib/nav-visibilidad';
import { rutaMovil } from '@/lib/movil-rutas';
import { BarraSeccionesM, type OpcionSeccionM } from './BarraSeccionesM';

/** La tab de escritorio con secciones, por su key (`video`, `image`, `copywriting`, `ai-avatar`, `automatizaciones`…). */
function tabDe(tab: string): NavItem | undefined {
  return FAMILIAS.flatMap((f) => f.bloques.flat()).find((x) => x.key === tab);
}

/** Las secciones que el teléfono ofrece de la tab `tab` para esta persona, con la ruta del teléfono de cada una. */
export function seccionesDeTabM(tab: string, vista: VistaNav): OpcionSeccionM[] {
  const t = tabDe(tab);
  if (!t) return [];
  return seccionesVisibles(t, vista).flatMap((s): OpcionSeccionM[] => {
    const href = rutaMovil(s.href);
    return href ? [{ id: s.key, label: s.seccion ?? s.label, href: href.split('?')[0], pronto: !!s.comingSoon }] : [];
  });
}

export function SeccionesTabM({ tab, activa, vista }: { tab: string; activa: string; vista: VistaNav }) {
  const opciones = seccionesDeTabM(tab, vista);
  if (opciones.length < 2) return null;
  return (
    <div className="m-secciones-tab">
      <BarraSeccionesM etiqueta={tabDe(tab)?.label ?? 'Sección'} valor={activa} opciones={opciones} />
    </div>
  );
}
