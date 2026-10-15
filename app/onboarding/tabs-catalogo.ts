// =============================================================================
// Las pestañas del hub de Onboarding que ya NO existe, y a dónde lleva cada una
// =============================================================================
// El hub (diez pastillas debajo del wizard, en el menú de la foto) se RETIRÓ el 15/10/2026: las diez
// secciones ya se editaban en /second-brain con los mismos componentes (docs/hallazgos-onboarding.md →
// «¿Se puede sacar el hub de /onboarding?»). La ruta /onboarding sigue: ahí vive el wizard del primer
// ingreso, al que mandan lib/tab-access.ts y app/inicio mientras esté pendiente.
//
// Lo que queda de este archivo es la TRADUCCIÓN de los links viejos: un `/onboarding?tab=persona`
// guardado en un marcador, un aviso ya mandado o una pantalla que no se actualizó llega a la MISMA
// sección donde se edita hoy (lib/secciones-negocio.ts), no a una portada donde buscarla.
//
// ⚠️ ERAN ONCE: la undécima era «El funnel», retirada el 29/09/2026 (el embudo se configura en el pop-up
// del CRM). Un `?tab=funnel` cae a la portada de Second Brain, igual que un valor inventado.
//
// ⚠️ VIVE EN UN `.ts` SIN `'use client'` a propósito (AGENTS.md, «`'use client'` es una frontera de
// DATOS»): la llama el page.tsx del server. El 29/09/2026 una función de acá exportada desde un
// `'use client'` dejó /onboarding entero en «Esta pantalla se rompió al dibujarse».

import { rutaSeccion, type SeccionNegocio } from '@/lib/secciones-negocio';

/** Las pastillas que tenía el hub, con la sección donde se editan hoy. */
export const TAB_VIEJA_A_SECCION = {
  matriz: 'matriz',
  diagnostico: 'diagnostico',
  archivero: 'archivero',
  oferta: 'oferta',
  entregable: 'entregable',
  persona: 'persona',
  personalidad: 'personalidad',
  avatares: 'avatares',
  razones: 'razones',
  angulos: 'angulos',
} as const satisfies Record<string, SeccionNegocio>;

export type TabVieja = keyof typeof TAB_VIEJA_A_SECCION;

/** La portada: «todo lo que MaKo sabe de tu negocio». A dónde va un `/onboarding` sin `?tab=`. */
export const DESTINO_SIN_TAB = '/second-brain';

/** A dónde va un link viejo al hub: la sección que nombra su `?tab=`, o la portada. */
export function destinoDeTabVieja(v?: string | null): string {
  return v && Object.hasOwn(TAB_VIEJA_A_SECCION, v) ? rutaSeccion(TAB_VIEJA_A_SECCION[v as TabVieja]) : DESTINO_SIN_TAB;
}
