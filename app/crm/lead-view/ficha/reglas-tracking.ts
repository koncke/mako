// =============================================================================
// ficha/reglas-tracking — las reglas PURAS de los bloques de la tab Tracking
// =============================================================================
// Los componentes van en ./registro-tracking.tsx. Son del frente de Tracking (ver ./tipos.ts).
//
// HOY (14/10/2026) `visitas` es ComportamientoCard ENTERA: las visitas, el video, la actividad en la página
// y la grabación van en un solo bloque. «Sin visitas registradas, cada bloque se calla» (§3): sin ningún
// dato y sin identificador, la tarjeta sólo decía «No hay forma de reconstruirlo», y eso ya no se dibuja.
// Con identificador sí: explica por qué no cruzó con ningún evento, y eso le sirve al equipo.
// =============================================================================

import type { CtxFicha, ReglasDeTab } from './tipos';

/** ¿No hay NADA del comportamiento de este lead? Sin visitas, sin video, sin eventos y sin identificador. */
export function sinComportamiento(ctx: Pick<CtxFicha, 'data' | 'lead'>): boolean {
  const d = ctx.data;
  const maxPct = d.vslEng?.sin_datos ? null : d.vslEng?.max_pct ?? null;
  return !d.visitas?.total_visitas && !d.vslEng?.plays && maxPct == null && !(d.tracking?.length) && !ctx.lead.visitor_id;
}

export const REGLAS_TRACKING = {
  visitas: {
    estaVacio: (ctx) => sinComportamiento(ctx),
    incluye: ['video-visto', 'actividad-en-pagina', 'grabacion-de-visita'],
  },
} satisfies ReglasDeTab;
