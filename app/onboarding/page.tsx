// =============================================================================
// /onboarding — perfil del negocio del cliente (alimenta el contexto de MaKo)
// =============================================================================

import { OnboardingForm } from './OnboardingForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OnboardingPage() {
  return <OnboardingForm />;
}
