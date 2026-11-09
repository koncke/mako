// =============================================================================
// La guía: el índice de los catálogos de cada tab (PURO; 29/10/2026)
// =============================================================================
// Cada catálogo vive al lado de su pantalla (app/<tab>/guia-<tab>.ts): cada dueño toca su carpeta, y acá sólo se juntan. Una tab
// nueva suma su línea en `CATALOGOS` (tests/guia-catalogo.test.ts falla con una tab que ve un cliente sin catálogo, salvo las de
// `SIN_GUIA_TODAVIA`, que se van achicando tab por tab: guia.md §6, G3 a G6).
// =============================================================================

import { GUIA_OPS_CENTER } from '@/app/second-brain/guia-ops-center';
import { GUIA_CRM } from '@/app/crm/guia-crm';
import { GUIA_CALENDARIO } from '@/app/calendario/guia-calendario';
import { GUIA_IMAGE } from '@/app/image-editor/guia-image';
import type { Ancla, GuiaDeTab } from './tipos';

export const CATALOGOS = [GUIA_OPS_CENTER, GUIA_CRM, GUIA_CALENDARIO, GUIA_IMAGE] as const satisfies readonly GuiaDeTab[];

/** El id de un ancla que existe en algún catálogo: `ancla('sb-nuevo')` compila; un id mal escrito, no. */
export type IdAncla = (typeof CATALOGOS)[number]['anclas'][number]['id'];

export const guiaDe = (key: string): GuiaDeTab | null => (CATALOGOS as readonly GuiaDeTab[]).find((g) => g.key === key) ?? null;

/** Un ancla por su id, en cualquier catálogo (lo usa el server cuando la IA señala: guia.md §2.6). */
export function anclaDelCatalogo(id: string): { guia: GuiaDeTab; ancla: Ancla } | null {
  for (const g of CATALOGOS as readonly GuiaDeTab[]) {
    const a = g.anclas.find((x) => x.id === id);
    if (a) return { guia: g, ancla: a };
  }
  return null;
}

/** Las anclas que son de TODO chat (`mk-`, y las del panel de siempre): cualquier catálogo las puede nombrar. */
export const PREFIJOS_COMUNES = ['mk-'] as const;
