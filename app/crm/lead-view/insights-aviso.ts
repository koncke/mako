// =============================================================================
// insights-aviso — qué le FALTA a «Insights» de un lead para poder generarse, y qué hacer (puro)
// =============================================================================
// Martín, 03/07/2026: «Que la sección se llame sólo "Insights", con Generar/Regenerar; si faltan datos, "No es posible
// generar hasta que…" y pedirlos con el wizard». Hasta el 18/11/2026 el rótulo decía «Insights del lead», el texto «No es
// posible generar hasta que…» no existía, y a un lead SIN llamada la sección ni se dibujaba (AnalystDelLead la escondía
// «si no hay nada»), así que nunca se enteraba de qué faltaba. Lo dibuja ./GeneratedInsightCard.tsx; esto se prueba
// ejecutándolo (tests/insights-aviso.test.ts).
//
// ⚠️ LOS DATOS NO SE ENUMERAN AQUÍ: ya están, con su «Solucionar», en el renglón que vive arriba de las tabs de la ficha.
//    Lo que este aviso agrega es que ESOS datos frenan el análisis, y el botón que los completa sin salir.
// =============================================================================

/** El nombre de la sección, tal cual lo pidió Martín. */
export const TITULO_INSIGHTS = 'Insights';

export type AvisoInsights =
  /** Faltan datos de la etapa: se completan con el wizard (el botón «Completar datos»). */
  | { tipo: 'faltan-datos'; texto: string }
  /** No hay ninguna llamada analizada: MaKo la busca y la analiza (y, sin link de Fathom, se puede cargar). */
  | { tipo: 'sin-llamada'; texto: string; detalle: string; cargarFathom: boolean };

/** Lo que frena generar (o regenerar), en el orden en que se resuelve; null = se puede. */
export function avisoDeInsights(o: { hayInsight: boolean; llamadas: number; faltantes: number; tieneFathom: boolean }): AvisoInsights | null {
  const verbo = o.hayInsight ? 'regenerar' : 'generar';
  if (o.faltantes > 0) {
    const que = o.faltantes === 1 ? 'el dato que falta' : `los ${o.faltantes} datos que faltan`;
    return { tipo: 'faltan-datos', texto: `No es posible ${verbo} hasta que completes ${que}.` };
  }
  if (o.llamadas === 0) {
    return {
      tipo: 'sin-llamada',
      texto: `No es posible ${verbo} hasta que haya una llamada analizada.`,
      detalle: o.tieneFathom
        ? 'MaKo analiza la llamada de Fathom de este lead.'
        : 'MaKo la busca en Fathom por su email o su link. Si no la encuentra, carga el link de Fathom.',
      cargarFathom: !o.tieneFathom,
    };
  }
  return null;
}
