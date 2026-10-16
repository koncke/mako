// =============================================================================
// ficha/plantillas-pagos — LAS PLANTILLAS DE LA TAB PAGOS (las escribe el chat Pagos)
// =============================================================================
// ⚠️ ESTE ARCHIVO ES DEL CHAT PAGOS (acordado el 16/10/2026 con el frente del marco). El marco lo dejó VACÍO para que
//    la galería de Pagos (./plantillas-tab.ts) ya lo importe: mientras esté vacío, la galería usa las listas de hoy
//    partidas por tab. Al mergear la rama de Pagos, gana SU versión entera (un conflicto add/add aquí se resuelve con
//    la de Pagos).
//
// El contrato (`PlantillaTab`, ./plantillas-tab.ts): `{ id, tab: 'pagos', nombre, bajada, bloques, epico?, sugeridaPara? }`.
// `sugeridaPara` son los tipos de funnel (ids de ./plantillas.ts) para los que la plantilla sale primero con
// «Sugerido» y va DE ENTRADA en un funnel que nadie tocó. Un tipo que ninguna nombra usa la lista de hoy.
// =============================================================================

import type { PlantillaTab } from './plantillas-tab';

export const PLANTILLAS_TAB_PAGOS: PlantillaTab[] = [];
