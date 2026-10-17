// =============================================================================
// meta-rango — desde cuándo se le puede pedir un período a Meta (módulo puro)
// =============================================================================
// Meta guarda 37 meses de insights y un `since` más viejo NO se recorta: es un ERROR (#3018, «The start date of the
// time range cannot be beyond 37 months from the current date»). Medido el 11/10/2026 (desde 2023-09-12 contestó) y otra
// vez el 17/10/2026 con un anuncio del ws1: desde 2023-09-18 contesta, desde 2023-09-16 y desde 2020-01-01, #3018.
//
// El período «Todo» de una hoja arranca el 2020-01-01 (`rangoDe`, lib/graficos-catalogo.ts): el pop-up de un anuncio de
// Ads Analyst se lo pasaba tal cual a /api/ad-insights y se quedaba sin números, sin diario y sin audiencia (lo vio Martín
// en la llamada con Mauricio del 16/10: algunos datos los traía y otros no, #876). El creativo y el guion
// sí cargaban: salen de nuestra base.
//
// ⚠️ TODA lectura de Meta con un período libre pasa por acá (tests/meta-rango.test.ts barre los `time_range`).
// =============================================================================

/**
 * El `since` que Meta acepta: el pedido, o el más viejo que guarda, con dos días de margen por la zona de la cuenta. Más
 * atrás no hay nada que traer, así que el total es el de todo lo que Meta tiene.
 */
export function desdeQueGuardaMeta(desde: string, hoy: string): string {
  const [y, m, d] = hoy.split('-').map(Number);
  const tope = new Date(Date.UTC(y, m - 1 - 37, d + 2)).toISOString().slice(0, 10);
  return desde < tope ? tope : desde;
}

/** El `time_range` de Meta para un período, con el `since` que Meta acepta (hoy = la fecha UTC del servidor). */
export function timeRangeMeta(desde: string, hasta: string, hoy = new Date().toISOString().slice(0, 10)): string {
  return JSON.stringify({ since: desdeQueGuardaMeta(desde, hoy), until: hasta });
}
