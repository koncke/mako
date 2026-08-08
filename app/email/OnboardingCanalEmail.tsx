'use client';

// =============================================================================
// OnboardingCanalEmail — el tramo de email, en su propia tab
// =============================================================================
// Mismo wizard del Chat Agent con los pasos de la tab email (conectar el
// dominio y probar que el correo llega). Los pasos se comparten: hacerlo acá
// también lo deja hecho adentro del Chat Agent.

import { useRouter } from '@/app/_ui/Link';
import { OnboardingChatAgent } from '../chatbot/OnboardingChatAgent';

export function OnboardingCanalEmail() {
  const router = useRouter();
  return <OnboardingChatAgent tab="email" onListo={() => router.refresh()} />;
}
