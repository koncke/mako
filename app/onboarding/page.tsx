// =============================================================================
// /onboarding — wizard de alta del cliente (bloqueante) o perfil del negocio
// =============================================================================
// Cliente con onboarding pendiente/salteado → el WIZARD completo (overlay:
// integraciones → extracción → datos de tabs → negocio → Retro histórica).
// Onboarding terminado (o el dueño / super admin sin impersonar) → el form
// clásico del perfil del negocio, editable como siempre.

import { OnboardingForm } from './OnboardingForm';
import { OnboardingWizard } from './OnboardingWizard';
import { requireRolWs } from '@/lib/tab-access';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage() {
  // gateOnboarding:false — esta ES la página del wizard, no puede redirigirse sola.
  await requireRolWs([], { gateOnboarding: false });

  const ws = await getWorkspaceActual();
  if (ws == null || ws === OWNER_WS) return <OnboardingForm />;

  const estado = await getEstadoOnboarding();
  if (estado.status === 'done') return <OnboardingForm />;
  return <OnboardingWizard />;
}
