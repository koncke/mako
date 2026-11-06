// =============================================================================
// lead-magnets/pieza — dónde vive la pieza de un lead magnet (PURO)
// =============================================================================
// Un lead magnet (lib/entregable.ts, `mako.entregable`: la lista que leen las secuencias y las variables
// `{{negocio_lead_magnet}}`) desde el 5/11/2026 recuerda DÓNDE se armó cuando nace del Lead Magnet Generator: la página del
// Copywriter o la landing del Web Generator (`pieza`), su plantilla y la landing que lo capta (`pagina`). El saneo vive acá
// y no en lib/entregable.ts (server-only) para que lo prueben los tests: `normalizarEntregable` borra lo que no nombra.
// =============================================================================

import { esIdPagina } from '../copywriter/tipos';
import type { HerramientaLM } from './plantillas';

export type PiezaLM = { herramienta: HerramientaLM; id: string };

/** El id de una landing (entero), como texto. El de una página del Copywriter lo dice `esIdPagina` (lib/copywriter/tipos.ts). */
const ID_LANDING = /^[1-9]\d{0,12}$/;

/** La pieza guardada, saneada; null si no hay o no se reconoce. */
export function piezaDe(raw: unknown): PiezaLM | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'number' ? String(o.id) : typeof o.id === 'string' ? o.id.trim() : '';
  if (o.herramienta === 'copywriter' && esIdPagina(id)) return { herramienta: 'copywriter', id };
  if (o.herramienta === 'web' && ID_LANDING.test(id)) return { herramienta: 'web', id };
  return null;
}

/** El id de la landing que capta (un entero positivo), o null. */
export function paginaDe(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 1e13 ? n : null;
}

/** El id de plantilla guardado (sólo minúsculas, números y guiones), o null. */
export function plantillaGuardada(raw: unknown): string | null {
  return typeof raw === 'string' && /^[a-z0-9-]{2,40}$/.test(raw) ? raw : null;
}

/** La ruta de la app donde se edita la pieza (el `?ws=` lo pone el Link o `linkApp`). */
export function rutaDePieza(p: PiezaLM): string {
  return p.herramienta === 'copywriter' ? `/copywriter/${p.id}` : `/web-generator/${p.id}`;
}

/** La ruta de la landing que capta. */
export const rutaDePagina = (id: number): string => `/web-generator/${id}`;
