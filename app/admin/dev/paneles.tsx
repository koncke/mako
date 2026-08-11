'use client';

// =============================================================================
// Las sub-tabs propias de un área, además de Roadmap
// =============================================================================
// Todos los registros arrancan igual —«Roadmap» primero, y abajo el Change
// History— y algunos tienen ADEMÁS una herramienta que solo tiene sentido en esa
// área: las bibliotecas de Ads Writer, el catálogo del semáforo. Eso va acá.
//
// Por qué un archivo aparte y no dentro de `areas.ts`: aquél lo importa un
// server component y es datos puros; esto son componentes de cliente. Mezclarlos
// arrastraría todo el árbol de cliente al server.
//
// ⚠️ `panelDe` devuelve el nodo A PARTIR de la tab activa, en vez de tener el
// nodo guardado en la lista. Es a propósito: así las dos tabs de Ads Writer son
// el MISMO `<GuionesAdminView>` con otra prop, React conserva la instancia y no
// se pierde lo que estabas editando al cambiar de tab. Con un nodo por tab,
// cada cambio remontaba el componente y volvía a pedir los dos endpoints.

import type { ReactNode } from 'react';
import { GuionesAdminView } from '@/app/admin/guiones/GuionesAdminView';
import { ElSemaforo } from './semaforo/ElSemaforo';
import { Pricing } from './pricing/Pricing';
import { RoadmapCS } from './customer-success/RoadmapCS';
import type { TareaRoadmap } from './roadmap';

export type SubTab = { id: string; label: string };

/** Las sub-tabs EXTRA de cada área. «Roadmap» lo pone la pantalla, siempre primero. */
export const SUBTABS: Record<string, SubTab[]> = {
  'ads-writer': [
    { id: 'angulos', label: 'Ángulos' },
    { id: 'estructuras', label: 'Estructuras' },
  ],
  semaforo: [
    { id: 'catalogo', label: 'El semáforo' },
  ],
  // El análisis va PRIMERO en la lista, pero «Roadmap» lo antepone la pantalla:
  // acá el orden es el de las sub-tabs extra, no el de toda la barra.
  pricing: [
    { id: 'analisis', label: 'Análisis de costos' },
  ],
};

export const subTabsDe = (slug: string): SubTab[] => SUBTABS[slug] ?? [];

/** El panel de una sub-tab. `null` = no es una sub-tab extra (es el Roadmap). */
export function panelDe(slug: string, tab: string): ReactNode {
  if (slug === 'ads-writer' && (tab === 'angulos' || tab === 'estructuras')) {
    return <GuionesAdminView tabExterna={tab} />;
  }
  if (slug === 'semaforo' && tab === 'catalogo') return <ElSemaforo />;
  if (slug === 'pricing' && tab === 'analisis') return <Pricing />;
  return null;
}

/**
 * El Roadmap PROPIO de un área: REEMPLAZA al genérico (las `partes` de la
 * bitácora + `RoadmapDelPlan`), no se suma como otra tab.
 *
 * ⚠️ Que sea reemplazo y no sub-tab es el pedido textual del dueño: «No entiendo
 * porque hay 2 tabs de roadmap». Eran TRES listas parecidas apiladas y ninguna
 * contestaba «¿qué hacemos primero?», que era lo único que se le pedía a la
 * pantalla. La regla que queda: **un área tiene UN roadmap.** Si un área necesita
 * uno escrito a mano, ese pasa a ser EL roadmap y se hace cargo de mostrar las
 * tareas del plan adentro — no al lado.
 */
export function roadmapPropioDe(slug: string, tareas: TareaRoadmap[]): ReactNode {
  if (slug === 'customer-success') return <RoadmapCS tareas={tareas} />;
  return null;
}

/** ¿Este área trae su propio Roadmap? Lo mira la pantalla para no pintar el genérico. */
export const tieneRoadmapPropio = (slug: string): boolean => slug === 'customer-success';
