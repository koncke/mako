// =============================================================================
// El criterio de edición de cada reel de Spy: la clasificación, reel por reel, con su juez (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «Revisá uno por uno todos los reels… y eso nos va a permitir seleccionar los mejores y hacer de esos un
// patrón». Los datos (./video-outliers-criterio.json) salen de la clasificación del 11/11/2026: los 854 reels distintos que Spy
// había leído (7 cuentas), mirados por su PORTADA y su texto por un clasificador y revisados uno por uno por un juez
// independiente con un criterio más estricto (docs/hallazgos-video-outliers.md cuenta cómo, qué se descartó y por qué).
// La segunda pasada, con el VIDEO (cortes, zooms, B-roll que no se ven en la portada), cambia `base` a 'video'.
//
// La llave es el código del reel en Instagram (`/reel/<código>/`): el mismo reel en dos negocios es uno solo.
// Un reel que Spy lea DESPUÉS de esta clasificación no está acá: la portada lo cuenta como «falta mirar» y no lo muestra.
// =============================================================================

import datos from './video-outliers-criterio.json';
import type { CriterioReel } from './video-outliers';

type Fila = { v: string; fa: string | null; p: string | null; m: string; fo: string; s: string[]; b?: string; r?: string | null };

const VEREDICTOS = new Set(['patron', 'descartar', 'dudoso']);

/** Las filas del archivo, validadas: una que no cumple la forma se ignora (no se inventa un veredicto). */
export function leerCriterio(reels: Record<string, unknown>): ReadonlyMap<string, CriterioReel> {
  const m = new Map<string, CriterioReel>();
  for (const [codigo, x] of Object.entries(reels)) {
    const f = x as Partial<Fila> | null;
    if (!f || typeof f !== 'object' || !VEREDICTOS.has(String(f.v)) || typeof f.m !== 'string') continue;
    m.set(codigo, {
      veredicto: f.v as CriterioReel['veredicto'],
      familia: typeof f.fa === 'string' ? f.fa : null,
      patron: typeof f.p === 'string' && f.p.trim() ? f.p : null,
      motivo: f.m,
      formato: typeof f.fo === 'string' ? f.fo : 'otro',
      senales: Array.isArray(f.s) ? f.s.filter((s): s is string => typeof s === 'string') : [],
      base: f.b === 'video' ? 'video' : 'portada',
      receta: typeof f.r === 'string' ? f.r : null,
    });
  }
  return m;
}

const CRITERIO = leerCriterio((datos as { reels: Record<string, unknown> }).reels);

/** Lo que dice la clasificación del reel con ese código; null si nadie lo miró todavía. */
export const criterioDeReel = (codigo: string): CriterioReel | null => CRITERIO.get(codigo) ?? null;
