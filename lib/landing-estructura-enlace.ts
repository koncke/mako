// =============================================================================
// landing-estructura-enlace — del mapa de calor del Dashboard al diagnóstico de estructura del Web Generator (#886)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:29:51): «que lo que recién vimos en dashboard del template de landing se combine
// con esta funcionalidad del feedback de la estructura que te da Web Generator, que vivan ambos lugares». En la hoja
// Landing se ve QUÉ HACE la gente en una página (dónde toca, hasta dónde baja); el Web Generator dice QUÉ LE FALTA a esa
// página (sus comentarios por sección, con «Aplicar»). El mapa de calor lleva a ese diagnóstico, de la MISMA página.
//
// El destino es la ruta que el Web Generator ya entiende (`?analizar=<url>`, app/web-generator/page.tsx): no se inventa
// un contrato nuevo con otra tab. Sin `server-only` ni 'use client' (lo usa el mapa y el test).
// =============================================================================

import { RUTA_WEB_GENERATOR } from './ruta-web-generator';

/** El link al diagnóstico de estructura de una página, o null si no es una URL http(s) que se pueda analizar. */
export function hrefAnalizarEstructura(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${RUTA_WEB_GENERATOR}?analizar=${encodeURIComponent(u.toString())}`;
  } catch {
    return null;
  }
}

/**
 * La otra dirección (#886, 17/10/2026): del diagnóstico del Web Generator a la hoja «Landing» del Dashboard, donde está
 * el mapa de calor y el pulso de la página. `?hoja=landing` es como el Dashboard abre una hoja (app/dashboard/EditorInforme.tsx).
 */
export const HREF_TRAFICO_LANDING = '/dashboard?hoja=landing';
