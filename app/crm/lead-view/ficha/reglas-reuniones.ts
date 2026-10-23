// =============================================================================
// ficha/reglas-reuniones — las reglas PURAS de los bloques de la tab Reuniones
// =============================================================================
// Los componentes van en ./registro-reuniones.tsx. Son del frente de Reuniones (ver ./tipos.ts).
//
// HOY (14/10/2026) `reunion-1` es ReunionesCard ENTERA: la R1, la R2, la agenda de la R2, lo que salió de
// la llamada, el setter y el closer y «Dijo que sí». Por eso esos bloques van en su `incluye` y todavía no
// tienen componente propio (no se ofrecen en «Agregar bloque»). La tab sale sólo si el funnel tiene una
// etapa de reunión (`tieneEtapaDeReunion`), como siempre.
// =============================================================================

import type { FathomLink, Lead } from '@/lib/leads';
import { etiquetaEsR2 } from '@/lib/insights-llamada-reparto';
import type { PartesReuniones } from '../ReunionesCard';
import type { ReglasDeTab } from './tipos';

// ── PARTIDA EN BLOQUES (20/10/2026, docs/pedidos-crm.md D2) ────────────────────────────────────────────────────────
// La R2, «Agendar» y lo que salió de la llamada son bloques propios. `reunion-1` dibuja la R1 y las cajas (agenda,
// closer, setter, confirmación) y, además, las partes que SU HOJA no puso aparte (`partesDeReunion1`): una ficha
// guardada sólo con `reunion-1` se ve como siempre, y una con los bloques sueltos no repite nada. Sin migrar nada.

/** ¿Tuvo R2? Una grabación de la R2 alcanza (el webhook de Fathom no escribe la fecha): ReunionesCard dice el porqué. */
export const tuvoR2 = (l: Lead): boolean =>
  !!l.fecha_junta_2 || l.asistio_j2 != null || ((l.fathom_links ?? []) as FathomLink[]).some((f) => f.url && etiquetaEsR2(f.label));
/** ¿Agendó alguna reunión? (lo mismo que ReunionesCard: sin esto dice «todavía no agendó»). */
export const agendo = (l: Lead): boolean => !!l.fecha_junta_1 || !!l.fecha_junta_2 || !!l.fecha_agenda || l.asistio_j1 != null;
const conGrabacion = (l: Lead): boolean => ((l.fathom_links ?? []) as FathomLink[]).some((f) => !!f.url);

/** Lo que dibuja `reunion-1` según lo que su hoja ya puso aparte. */
export function partesDeReunion1(hermanos: readonly string[] | undefined): PartesReuniones {
  const h = new Set(hermanos ?? []);
  // El setter y el closer (23/10/2026): con «Setter y closer» en la misma hoja, sus cajas no se repiten acá. Hasta ahí la R1
  // los dibujaba siempre y su «Obligatorio» los movía junto con las fechas (Martín: «nada es obligatorio porque viene con otro»).
  return { r1: true, cajas: true, equipo: !h.has('setter-y-closer'), r2: !h.has('reunion-2'), agendar: !h.has('agendar-reunion'), llamada: !h.has('lo-que-salio-de-la-llamada') };
}

export const REGLAS_REUNIONES = {
  'reunion-1': {
    // Lo que su hoja pone aparte deja de contar (`cubreDe` con `hermanos`), igual que deja de dibujarse (`partesDeReunion1`).
    incluye: ['reunion-2', 'agendar-reunion', 'lo-que-salio-de-la-llamada', 'setter-y-closer', 'confirmacion-de-pago'],
    // La R1 edita «¿Era calificado?» (ReunionesCard): su «Obligatorio» lo ofrece por su cuenta.
    cubreTambien: ['calificado'],
  },
  // «Sólo si hubo R2» (catálogo: se calla sin datos).
  'reunion-2': { estaVacio: (ctx) => !tuvoR2(ctx.lead) },
  // Sólo después de una reunión y si la R2 todavía no está (ni se cerró sin R2): lo mismo que la tarjeta.
  'agendar-reunion': { estaVacio: (ctx) => !agendo(ctx.lead) || tuvoR2(ctx.lead) || !!ctx.lead.sin_r2 },
  // Sin grabación no salió nada que contar.
  'lo-que-salio-de-la-llamada': { estaVacio: (ctx) => !conGrabacion(ctx.lead) },
} satisfies ReglasDeTab;
