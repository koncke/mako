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

import type { ReglasDeTab } from './tipos';

export const REGLAS_REUNIONES = {
  'reunion-1': {
    incluye: ['reunion-2', 'agendar-reunion', 'lo-que-salio-de-la-llamada', 'setter-y-closer', 'confirmacion-de-pago'],
  },
} satisfies ReglasDeTab;
