// =============================================================================
// /onboarding — perfil del negocio del cliente (alimenta el contexto de MaKo)
// =============================================================================

import { OnboardingForm } from './OnboardingForm';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage() {
  await requireRolWs([]);
  return <OnboardingForm />;
}
