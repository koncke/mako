'use client';

// =============================================================================
// CabeceraM — una página de /m pisa lo que dice el encabezado (no dibuja nada)
// =============================================================================
// El encabezado vive en el layout; sin esto, una página no puede poner el nombre de un lead,
// su acción a la derecha ni declararse pantalla de trabajo. Por defecto el encabezado ya sabe
// qué mostrar en cada ruta (app/m/_ui/cabecera.ts), así que esto se usa sólo cuando hace falta
// otra cosa:
//
//   <CabeceraM titulo={lead.nombre} />                               // título grande propio
//   <CabeceraM titulo={lead.nombre} grande={false} />                // la página dibuja su encabezado
//   <CabeceraM titulo={video.nombre} trabajo />                      // editor: sin título grande ni barra
//   <CabeceraM accion={<Link href="…" className="m-cabecera__accion" aria-label="…">…</Link>} />
//   <CabeceraM padre={{ href: '/m/crm/12', label: 'Ficha' }} />      // volver fijo distinto
//
// Reglas del documento que esto no puede hacer cumplir solo:
//   · como mucho UNA acción a la derecha, de 44×44, con `aria-label` (clase m-cabecera__accion);
//   · el destino de «volver» es FIJO (nunca `router.back()`);
//   · sin subtítulo ni kicker; nada flotando al lado del título.
// =============================================================================

import { useLayoutEffect, type ReactNode } from 'react';
import { useShellM } from './contexto';
import type { PadreM } from './cabecera';

export function CabeceraM({ titulo, padre, accion, trabajo, grande }: {
  titulo?: string;
  /** `null` = sin «volver»; sin pasar = el de siempre para esta ruta. */
  padre?: PadreM | null;
  /** `null` = sin acción; sin pasar = la de siempre (el avatar en Today). */
  accion?: ReactNode;
  /** Pantalla de trabajo: sin título grande, el nombre en la barra desde el principio y sin barra de abajo. */
  trabajo?: boolean;
  /**
   * `false` = la página dibuja su propio encabezado (con su h1). Si lo marca con
   * `data-m-titulo-grande`, el nombre chico aparece en la barra cuando se va al hacer scroll.
   */
  grande?: boolean;
}) {
  const { setCabecera } = useShellM();
  const padreHref = padre === undefined ? undefined : padre?.href ?? null;
  const padreLabel = padre === undefined ? undefined : padre?.label ?? null;

  useLayoutEffect(() => {
    setCabecera({
      titulo,
      padre: padreHref === undefined ? undefined : padreHref === null ? null : { href: padreHref, label: padreLabel ?? '' },
      accion,
      trabajo,
      grande,
    });
  }, [setCabecera, titulo, padreHref, padreLabel, accion, trabajo, grande]);

  // Al irse la página, el encabezado vuelve a lo de siempre para la ruta nueva.
  useLayoutEffect(() => () => setCabecera(null), [setCabecera]);

  return null;
}
