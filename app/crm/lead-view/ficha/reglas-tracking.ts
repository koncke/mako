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

import type { PartesComportamiento } from '../ComportamientoCard';
import type { CtxFicha, ReglasDeTab } from './tipos';

/** ¿No hay NADA del comportamiento de este lead? Sin visitas, sin video, sin eventos y sin identificador. */
export function sinComportamiento(ctx: Pick<CtxFicha, 'data' | 'lead'>): boolean {
  const d = ctx.data;
  const maxPct = d.vslEng?.sin_datos ? null : d.vslEng?.max_pct ?? null;
  return !d.visitas?.total_visitas && !d.vslEng?.plays && maxPct == null && !(d.tracking?.length) && !ctx.lead.visitor_id;
}

// ── PARTIDA EN BLOQUES (20/10/2026, docs/pedidos-crm.md D2) ────────────────────────────────────────────────────────
// El video, la actividad en la página y la grabación son bloques propios. `visitas` dibuja la sección «Comportamiento»
// con las visitas y, además, lo que SU HOJA no puso aparte (`partesDeVisitas`): una ficha guardada sólo con `visitas` se
// ve como siempre, y una partida no repite nada. Sin migrar nada (el mismo molde que Reuniones).

/** Lo que dibuja `visitas` según lo que su hoja ya puso aparte. */
export function partesDeVisitas(hermanos: readonly string[] | undefined): PartesComportamiento {
  const h = new Set(hermanos ?? []);
  return { visitas: true, video: !h.has('video-visto'), actividad: !h.has('actividad-en-pagina'), grabacion: !h.has('grabacion-de-visita') };
}
/** ¿Hay algo del video? Reproducciones o un avance medido. */
export const sinVideo = (ctx: Pick<CtxFicha, 'data'>): boolean => {
  const e = ctx.data.vslEng;
  return !e?.plays && (e?.sin_datos || e?.max_pct == null);
};

/** Sin visitas ni video: lo que la tarjeta llama `sinDatos`. Ahí las visitas dicen POR QUÉ, si se sabe (`sinTracking`). */
const sinVisitasNiVideo = (ctx: Pick<CtxFicha, 'data'>): boolean => {
  const d = ctx.data;
  return !d.visitas?.total_visitas && !d.vslEng?.plays && (d.vslEng?.sin_datos || d.vslEng?.max_pct == null);
};

export const REGLAS_TRACKING = {
  visitas: {
    // ⚠️ «Nunca vacío sin explicar» (14/11/2026, la llamada con Julio): sin nada, se calla SÓLO si no se sabe por qué. La
    // página por la que entró sin el Pixel, o que no entró por una página, SÍ es un dato (lib/pixel-por-pagina-reglas.ts).
    estaVacio: (ctx) => sinComportamiento(ctx) && !ctx.data.sinTracking,
    incluye: ['video-visto', 'actividad-en-pagina', 'grabacion-de-visita'],
  },
  'video-visto': { estaVacio: (ctx) => sinVideo(ctx) },
  // Sin eventos y con el Pixel puesto no hay nada que contar; sin el Pixel, el aviso de ponerlo SÍ es un dato. Con el porqué
  // de este lead (`sinTracking`), también, salvo que ya lo diga el bloque de las visitas de la misma hoja: una vez.
  'actividad-en-pagina': {
    estaVacio: (ctx, _p, hermanos) => !(ctx.data.tracking?.length) && (ctx.data.sinTracking
      ? !!hermanos?.includes('visitas') && sinVisitasNiVideo(ctx)
      : ctx.data.pixelPuesto !== false),
  },
  'grabacion-de-visita': { estaVacio: (ctx) => !ctx.data.replay },
} satisfies ReglasDeTab;
