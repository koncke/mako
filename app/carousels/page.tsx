// =============================================================================
// /carousels — server wrapper: guard + onboarding de la tab + monta la app
// =============================================================================
// La page aplica el guard (requireRolWs con la key EXACTA del nav) y decide si la
// tab abre en su onboarding o en la vista normal.
// El trabajo pesado vive en CarouselsApp.tsx ('use client'); el motor de
// escritura es lib/ig-writer.ts vía las server actions propias (./actions.ts).

import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { OnboardingCarousels } from './OnboardingCarousels';
import { CarouselsApp } from './CarouselsApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarouselsPage() {
  await requireRolWs([], { nav: 'carousels' });

  // ¿El brief del negocio tiene algo cargado? Decide qué dice el paso Contexto
  // (y el aviso de la app): con el perfil vacío las piezas salen genéricas.
  let perfilCargado = false;
  try { perfilCargado = (await perfilNegocioTexto()).trim().length > 0; } catch { /* sin perfil legible */ }

  // La tab abre en su onboarding mientras no esté hecho, pero NO lo reemplaza
  // para siempre: el wizard tiene su salida («Lo configuro después»).
  if (await onboardingTabPendiente('carousels')) {
    return <OnboardingCarousels perfilCargado={perfilCargado} />;
  }
  return <CarouselsApp perfilCargado={perfilCargado} />;
}
