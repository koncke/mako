// =============================================================================
// Email Marketing — secuencias por etapa (motor de nutrición) + broadcasts.
// Data-driven: lee/escribe vía /api/email/*. Las secuencias de email viven en
// nutricion_secuencias (pasos canal='email'); el envío real sale por Resend y
// se habilita POR WORKSPACE (toggle "Envío real" → setting envio_email_enabled,
// lib/envio-flags.ts). El dominio se configura en la misma tab (DominioSetup).
// =============================================================================

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { OnboardingCanalEmail } from './OnboardingCanalEmail';
import { integracionConectada } from '@/lib/credenciales';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';
import { EmailApp } from './EmailApp';

export default async function Page() {
  await requireRolWs(['setter'], { nav: 'email' });

  const tabEmail = tabActivacion('email');
  if (tabEmail && !(await integracionConectada('email'))) return <PanelActivacion tab={tabEmail} />;
  // Email tiene onboarding PROPIO (conectar el dominio y probar que llega). Se
  // renderiza acá; sus pasos se comparten con el Chatbot.
  if (await onboardingTabPendiente('email')) return <OnboardingCanalEmail />;
  return <EmailApp />;
}
