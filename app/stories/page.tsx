// =============================================================================
// /stories — server wrapper: guards + onboarding de la tab + monta la app
// =============================================================================
// La page es el wrapper server que aplica el guard (requireRolWs con la capa) y
// decide si la tab abre en su onboarding o en la vista normal. El trabajo pesado
// vive en StoriesApp.tsx ('use client').

import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { getSchema, getAnswers } from '@/lib/onboarding';
import { OnboardingStories } from './OnboardingStories';
import { StoriesApp } from './StoriesApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StoriesPage() {
  await requireRolWs([], { nav: 'stories' });

  // El contexto que ya existe: grupos del perfil con al menos una respuesta y
  // los que faltan — para decir QUÉ falta y DÓNDE se completa, no un genérico.
  const gruposListos: string[] = [];
  const gruposFaltan: string[] = [];
  try {
    const [schema, answers] = await Promise.all([getSchema(), getAnswers()]);
    for (const g of schema) {
      const tiene = g.fields.some((f) => (answers[f.key] ?? '').trim());
      (tiene ? gruposListos : gruposFaltan).push(g.label);
    }
  } catch { /* sin perfil legible: el wizard muestra el camino al onboarding */ }

  // La tab abre en su onboarding mientras no esté hecho, pero NO reemplaza la
  // app para siempre: el wizard tiene su salida («Lo configuro después»).
  if (await onboardingTabPendiente('stories')) {
    return <OnboardingStories gruposListos={gruposListos} gruposFaltan={gruposFaltan} />;
  }
  return <StoriesApp />;
}
