// =============================================================================
// landing-analyst/destino — a dónde va un link viejo de la tab retirada
// =============================================================================
// Decisión de Martín (11/10/2026): «Lo de Landing Analyst se muda a Landing Generator y
// Landing Analyst se ELIMINA (la ruta redirige)». La tab tenía tres vistas en `?tab=` y
// cada una se fue a un lugar distinto, así que el redirect TRADUCE la pestaña:
//
//   · `?tab=pulso` (lo que mide el Pixel) y `?tab=mapa` (el mapa de calor) son ANÁLISIS:
//     viven en la hoja «Landing» del Dashboard (lib/graficos-plantillas-analysts.ts, que
//     monta los mismos componentes de esta carpeta).
//   · Todo lo demás —sin `tab`, `?tab=copy` o una pestaña que no existe— es el DIAGNÓSTICO,
//     que es una TAREA (analizar, pegar el texto, reintentar, quitar): se mudó a
//     /landing-generator/analizar, con la query entera menos `tab`.
//
// ⚠️ SE REDIRIGE, NO SE BORRA (AGENTS.md, «Retirar una RUTA…»): el link viejo vive en avisos
// ya mandados, marcadores y tareas del plan. Y LA QUERY ES EL DESTINO: se conserva todo lo que
// no sea `tab` (con el `?ws=` de la cuenta adentro, si venía), con el mismo helper que usa
// /chatbot → /automations. `rutaConWs` lo envuelve en el page.tsx: si el link ya trae su
// `?ws=`, `conWs` lo respeta tal cual.
//
// Pura, sin `server-only` y sin 'use client': la llama el page.tsx (server) y la ejecuta
// tests/landing-generator-analizar.test.ts.

import { destinoConQuery } from '@/lib/ruta-automations';

/** La pantalla del diagnóstico, dentro de Landing Generator. */
export const RUTA_DIAGNOSTICO = '/landing-generator/analizar';

/** La hoja del Dashboard que se quedó con lo que era ANÁLISIS (el pulso y el mapa de calor). */
export const RUTA_HOJA_LANDING = '/dashboard?hoja=landing';

/** Las pestañas viejas que eran análisis. Comparación exacta: la tab vieja tampoco normalizaba. */
const PESTANAS_DE_ANALISIS: readonly string[] = ['pulso', 'mapa'];

type Query = Record<string, string | string[] | undefined>;

/** El primer valor de un parámetro (`?tab=a&tab=b` → `a`), o null. */
function primero(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

/**
 * El destino de un link viejo de Landing Analyst. El `?ws=` que traiga el link viaja en los dos
 * casos; el de la pestaña (el que valida el proxy) lo pone `rutaConWs` en el page.tsx.
 *
 * A la hoja del Dashboard no viaja nada más que el `?ws=`: el pulso y el mapa no leían ningún
 * otro parámetro, y un `?url=` ahí no significa nada.
 */
export function destinoLandingAnalyst(sp: Query): string {
  const tab = primero(sp.tab);
  if (tab !== null && PESTANAS_DE_ANALISIS.includes(tab)) {
    const ws = primero(sp.ws);
    return ws ? `${RUTA_HOJA_LANDING}&${new URLSearchParams({ ws }).toString()}` : RUTA_HOJA_LANDING;
  }
  const resto = Object.fromEntries(Object.entries(sp).filter(([k]) => k !== 'tab'));
  return destinoConQuery(RUTA_DIAGNOSTICO, resto);
}
