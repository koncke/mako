// =============================================================================
// /carousels — server wrapper: guard + onboarding de la tab + monta la app
// =============================================================================
// Mismo patrón que /instagram: la page aplica el guard (requireRolWs con la key
// EXACTA del nav) y decide si la tab abre en su onboarding o en la vista normal.
// El trabajo pesado vive en CarouselsApp.tsx ('use client'); el motor de
// escritura es lib/ig-writer.ts vía las server actions propias (./actions.ts).

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { estadoConexionIg } from '../instagram/ig-datos';
import { OnboardingCarousels } from './OnboardingCarousels';
import { CarouselsApp } from './CarouselsApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarouselsPage() {
  await requireRolWs([], { nav: 'carousels' });

  const ws = await getWorkspaceActual();

  // ¿Hay cuenta de Instagram conectada? Solo alimenta el AVISO SUAVE (escribir
  // no la necesita; publicar sí). Tolerante a fallos: un error de Zernio no
  // puede tirar la tab de escritura. Con la decisión de Zernio sin resolver,
  // estadoConexionIg devuelve cuenta:null SIN tocar la API (no materializa nada).
  let igConectada = false;
  if (ws != null) {
    try { igConectada = Boolean((await estadoConexionIg(ws)).cuenta); } catch { igConectada = false; }
  }

  // ¿El brief del negocio tiene algo cargado? Decide qué dice el paso Contexto
  // (y el aviso de la app): con el perfil vacío las piezas salen genéricas.
  let perfilCargado = false;
  try { perfilCargado = (await perfilNegocioTexto()).trim().length > 0; } catch { /* sin perfil legible */ }

  // La tab abre en su onboarding mientras no esté hecho, pero NO lo reemplaza
  // para siempre: el wizard tiene su salida («Lo configuro después»).
  if (await onboardingTabPendiente('carousels')) {
    return <OnboardingCarousels igConectada={igConectada} perfilCargado={perfilCargado} />;
  }
  return <CarouselsApp igConectada={igConectada} perfilCargado={perfilCargado} />;
}
