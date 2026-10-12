'use client';

// =============================================================================
// CabeceraM — una página de /m pisa lo que dice el header (no dibuja nada)
// =============================================================================
// El header vive en el layout; sin esto, una página no puede decir «‹ Leads» ni
// poner su acción a la derecha. Por defecto el header ya sabe qué mostrar en cada
// ruta (app/m/_ui/cabecera.ts), así que esto se usa sólo cuando hace falta otra
// cosa:
//
//   <CabeceraM padre={{ href: '/m/crm', label: 'CRM' }} />          // volver fijo
//   <CabeceraM accion={<Link href="/m/crm/nuevo" …>…</Link>} />      // UNA acción
//   <CabeceraM titulo="Agenda" padre={null} />                         // título propio
//
// Reglas del documento que esto no puede hacer cumplir solo:
//   · como mucho UNA acción a la derecha, de 44×44, con `aria-label`;
//   · el destino de «volver» es FIJO (nunca `router.back()`);
//   · sin subtítulo ni kicker.
// =============================================================================

import { useLayoutEffect, type ReactNode } from 'react';
import { useShellM } from './contexto';
import type { PadreM } from './cabecera';

export function CabeceraM({ titulo, padre, accion }: {
  titulo?: string;
  /** `null` = sin «volver»; sin pasar = el de siempre para esta ruta. */
  padre?: PadreM | null;
  /** `null` = sin acción; sin pasar = la de siempre (el avatar en Today). */
  accion?: ReactNode;
}) {
  const { setCabecera } = useShellM();
  const padreHref = padre === undefined ? undefined : padre?.href ?? null;
  const padreLabel = padre === undefined ? undefined : padre?.label ?? null;

  useLayoutEffect(() => {
    setCabecera({
      titulo,
      padre: padreHref === undefined ? undefined : padreHref === null ? null : { href: padreHref, label: padreLabel ?? '' },
      accion,
    });
  }, [setCabecera, titulo, padreHref, padreLabel, accion]);

  // Al irse la página, el header vuelve a lo de siempre para la ruta nueva.
  useLayoutEffect(() => () => setCabecera(null), [setCabecera]);

  return null;
}
