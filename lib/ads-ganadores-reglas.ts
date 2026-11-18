// =============================================================================
// Lo que YA le funcionó a un negocio en sus anuncios, para quien escribe un guion nuevo (18/11/2026, O22) — la parte PURA
// =============================================================================
// El pendiente (docs/pendientes-verificados-17-11.md, O22): que el escritor de guiones del Ads Writer (`generarGuion`,
// lib/razones.ts) y el Copywriter (lib/copywriter/ia.ts) lean los ganadores de Ads Analyst (`script_analyses` con sus métricas
// vivas, lib/ads-analyst.ts). Hasta acá, los guiones nuevos se escribían sin mirar qué guion de ese mismo negocio había traído
// agendas: se repetía el ángulo que no anduvo o se olvidaba el que sí.
//
// CON UN PISO, y sin piso no entra nada: con UNA sola agenda, «este ángulo gana» es falso (un caso no es una tendencia, la misma
// regla que `nMinimo` en lib/recomendaciones-senales.ts). Un anuncio entra si:
//   · trajo al menos `agendas` agendas (Meta), y
//   · se mostró al menos `impresiones` veces: el piso «confiable» que ya usa `buildAccountProfile` (lib/ads-analyst.ts).
// LOS UMBRALES SON DEFAULTS RAZONADOS, NO MEDIDOS contra producción: están juntos acá para medirlos en un solo lugar.
//
// Lo que entra es lo que se SABE del guion (su ángulo, su tipo de gancho, el gancho dicho, cuántas agendas y a cuánto): nunca una
// conclusión («este es el ángulo ganador»). Sin `server-only`: lo prueba tests/ads-ganadores.test.ts.
// =============================================================================

import type { ScriptView } from './ads-analyst';

/** El piso de un anuncio para contar como «le funcionó» a quien escribe. */
export const PISO_GANADOR = { agendas: 3, impresiones: 8_000, cuantos: 3 } as const;

/** Lo que se mira de cada guion analizado (una `ScriptView` de lib/ads-analyst.ts). */
export type GuionConSenal = Pick<ScriptView, 'short' | 'angle' | 'hookType' | 'agendas' | 'spend' | 'impressions' | 'beats'>;

/** Los anuncios que pasan el piso, los que más agendaron primero (y a igual agendas, el que las trajo más barato). */
export function ganadoresConPiso<T extends GuionConSenal>(guiones: readonly T[], piso: { agendas: number; impresiones: number; cuantos: number } = PISO_GANADOR): T[] {
  const costo = (g: GuionConSenal) => (g.agendas > 0 ? g.spend / g.agendas : Number.POSITIVE_INFINITY);
  return guiones
    .filter((g) => Number.isFinite(g.agendas) && g.agendas >= piso.agendas && Number.isFinite(g.impressions) && g.impressions >= piso.impresiones)
    .sort((a, b) => b.agendas - a.agendas || costo(a) - costo(b))
    .slice(0, piso.cuantos);
}

const recortar = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** El gancho dicho de un guion: su bloque «gancho», o su resumen corto si no lo tiene. */
export function ganchoDe(g: GuionConSenal): string {
  const gancho = g.beats.find((b) => b.kind === 'gancho')?.text?.trim();
  return recortar(gancho || g.short || '', 160);
}

/**
 * El renglón por anuncio, en el idioma del prompt (lo lee un modelo, no la persona). Vacío si no pasa ninguno: sin piso no entra
 * nada. `nombreDeAngulo` traduce la clave del ángulo a su nombre (lib/script-angles.ts).
 */
export function lineasDeGanadores(ganadores: readonly GuionConSenal[], nombreDeAngulo: (clave: string) => string = (c) => c): string[] {
  return ganadores.map((g) => {
    const gancho = ganchoDe(g);
    const porAgenda = g.agendas > 0 && g.spend > 0 ? `, US$ ${Math.round(g.spend / g.agendas)} por agenda` : '';
    return `- ${gancho ? `«${gancho}» · ` : ''}ángulo ${nombreDeAngulo(g.angle)} · gancho de tipo ${g.hookType} · ${g.agendas} agendas${porAgenda}`;
  });
}

/** El encabezado del bloque: qué es y cómo se usa (lo que el modelo tiene que hacer con eso). */
export function encabezadoDeGanadores(piso: { agendas: number } = PISO_GANADOR): string {
  return `LO QUE YA LE FUNCIONÓ A ESTE NEGOCIO EN SUS ANUNCIOS (de Ads Analyst; cada uno trajo al menos ${piso.agendas} agendas). Úsalo como referencia de qué ángulo y qué gancho le funcionan; no lo copies palabra por palabra:`;
}
