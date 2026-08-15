// =============================================================================
// /stories — server wrapper: guards + onboarding de la tab + monta la app
// =============================================================================
// Mismo patrón que /instagram: la page es el wrapper server que aplica el guard
// (requireRolWs con la capa) y decide si la tab abre en su onboarding o en la
// vista normal. El trabajo pesado vive en StoriesApp.tsx ('use client').

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { getSchema, getAnswers } from '@/lib/onboarding';
import { estadoConexionIg } from '@/app/instagram/ig-datos';
import { OnboardingStories } from './OnboardingStories';
import { StoriesApp } from './StoriesApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StoriesPage() {
  await requireRolWs([], { nav: 'stories' });

  const ws = await getWorkspaceActual();

  // Aviso suave (nunca bloquea): ¿hay cuenta de Instagram conectada? Estado
  // VIVO vía estadoConexionIg — que NO toca Zernio si la decisión de Zernio no
  // está tomada, así abrir esta tab jamás materializa nada (el gotcha que la
  // tab Instagram ya pagó). Best-effort: si la consulta falla se asume
  // desconectada — escribir guiones no requiere la cuenta.
  let igConectada = false;
  if (ws != null) {
    try { igConectada = Boolean((await estadoConexionIg(ws)).cuenta); } catch { igConectada = false; }
  }

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
    return <OnboardingStories igConectada={igConectada} gruposListos={gruposListos} gruposFaltan={gruposFaltan} />;
  }
  return <StoriesApp igConectada={igConectada} />;
}
