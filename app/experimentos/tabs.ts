// =============================================================================
// Las tabs de /experimentos — un módulo de DATOS, sin 'use client'
// =============================================================================
// Lo leen dos lados de la frontera: la page (server), que decide con `tabDeUrl` si
// tiene que correr el análisis —que es lento— antes de dibujar, y ExperimentosApp
// (client), que usa el tipo.
//
// ⚠️ POR QUÉ VIVE ACÁ Y NO EN ExperimentosApp.tsx: un valor exportado desde un
// módulo 'use client' NO es ese valor para quien lo importa desde el server, es
// una referencia de cliente. El 29/09/2026 un `tabDeUrl` de tres líneas exportado
// desde OnboardingTabs.tsx dejó /onboarding en «Esta pantalla se rompió al
// dibujarse» en producción con el build en verde, porque se usaba en cada request
// y no al armar la ruta (AGENTS.md, «'use client' es una frontera de DATOS»).
// Por eso este archivo es puro y la page lo importa a él, nunca al componente.
// =============================================================================

/**
 * Las cuatro tabs, en el orden en que se dibujan. «analisis» entró el 11/10/2026,
 * cuando Análisis dejó de ser una tab de la barra y se mudó adentro de Experiments.
 */
export type TabExperimentos = 'retro' | 'experiments' | 'conclusions' | 'analisis';

const TABS: readonly TabExperimentos[] = ['retro', 'experiments', 'conclusions', 'analisis'];

/**
 * El `?tab=` de la URL → la tab que se abre. Lo que no es una tab conocida (vacío,
 * basura, un link viejo) abre Retro, que es el corazón de la pantalla: un link
 * roto aterriza en la tab de siempre, no en una pantalla en blanco.
 */
export function tabDeUrl(v: string | undefined): TabExperimentos {
  return (TABS as readonly string[]).includes(v ?? '') ? (v as TabExperimentos) : 'retro';
}
