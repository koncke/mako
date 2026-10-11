// =============================================================================
// Las vistas de /ads-writer — un módulo de DATOS, sin 'use client'
// =============================================================================
// Lo leen los dos lados de la frontera: la page (server), que con `tabDeUrl` decide si arma «Analizar
// guion» —que lee la base y no pasa por la puerta del onboarding— y AdsWriterApp (client), que escribe
// la vista de vuelta en la URL con `hrefDeVista`.
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO EN AdsWriterApp.tsx: un valor exportado desde un módulo 'use client' NO es
// ese valor para quien lo importa desde el server, es una referencia de cliente que falla al USARLA.
// Así se cayó /onboarding entero el 29/09/2026 (AGENTS.md, «'use client' es una frontera de DATOS»).
// Mismo molde que app/experimentos/tabs.ts.
//
// ⚠️ `?tab=` NO ES UN LUJO: «Analizar guion» es destino de links de afuera (la capacidad `guion-valorar`
// de MaKo manda a /ads-writer?tab=analizar, y /ads-analyst la traía antes de mudarse). Un link que
// siempre aterriza en Anuncios no es un link (AGENTS.md, «Retirar una RUTA…»: el link lleva la tab).
// =============================================================================

/** Las tres vistas, en el orden en que se dibujan. «analizar» entró el 11/10/2026 con la mudanza de Ads Analyst. */
export type VistaAdsWriter = 'anuncios' | 'guiones' | 'analizar';

export const VISTAS_ADS_WRITER: readonly VistaAdsWriter[] = ['anuncios', 'guiones', 'analizar'];

/** La que abre sin `?tab=`: la matriz, que es el corazón de la tab. */
export const VISTA_POR_DEFECTO: VistaAdsWriter = 'anuncios';

/**
 * El `?tab=` de la URL → la vista que se abre. Lo que no es una vista conocida (vacío, basura, un link
 * viejo, o el parámetro repetido `?tab=a&tab=b`, que llega como lista) abre Anuncios: un link roto
 * aterriza en la vista de siempre, no en una pantalla en blanco.
 */
export function tabDeUrl(v: string | string[] | undefined): VistaAdsWriter {
  return typeof v === 'string' && (VISTAS_ADS_WRITER as readonly string[]).includes(v) ? (v as VistaAdsWriter) : VISTA_POR_DEFECTO;
}

/**
 * La dirección de una vista, armada desde la URL ACTUAL: cambia sólo `tab` y deja el resto como estaba
 * (el `?ws=` del cliente que se está mirando, o lo que traiga el link). La vista por defecto SACA el
 * parámetro, así la dirección de siempre sigue siendo /ads-writer a secas.
 */
export function hrefDeVista(actual: string, vista: VistaAdsWriter): string {
  const u = new URL(actual, 'https://mako.invalid');
  if (vista === VISTA_POR_DEFECTO) u.searchParams.delete('tab');
  else u.searchParams.set('tab', vista);
  const qs = u.searchParams.toString();
  return `${u.pathname}${qs ? `?${qs}` : ''}`;
}
