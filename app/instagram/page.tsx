// =============================================================================
// /instagram — server wrapper: guards + onboarding de la tab + monta la app
// =============================================================================
// Mismo patrón que /whatsapp: la page es el wrapper server que aplica el guard
// (requireRolWs con la capa) y decide si la tab abre en su onboarding o en la
// vista normal. El trabajo pesado vive en InstagramApp.tsx ('use client').

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { estadoConexionIg, type EstadoConexionIg } from './ig-datos';
import { OnboardingInstagram } from './OnboardingInstagram';
import { InstagramApp } from './InstagramApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InstagramPage() {
  await requireRolWs([], { nav: 'instagram' });

  const ws = await getWorkspaceActual();
  const conexion: EstadoConexionIg = ws != null
    ? await estadoConexionIg(ws)
    // Agencia sin impersonar: no hay workspace del que leer. La vista igual se
    // sirve (las actions cortan con su propio error si intenta operar).
    : { configurado: false, cuenta: null, error: null };

  // La tab abre en su onboarding mientras no esté hecho, pero NO reemplaza la
  // app para siempre: el wizard tiene su salida («Lo configuro después»).
  const faltaOnboarding = await onboardingTabPendiente('instagram');
  if (faltaOnboarding) return <OnboardingInstagram conexionInicial={conexion} />;
  return <InstagramApp conexionInicial={conexion} />;
}
