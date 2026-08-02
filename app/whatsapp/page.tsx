// =============================================================================
// /whatsapp — server wrapper: guard de onboarding + monta el inbox (client)
// =============================================================================
// El inbox completo vive en WhatsAppApp.tsx ('use client'). Este wrapper solo
// aplica el gate server-side del onboarding bloqueante (guardOnboarding), igual
// que el patrón de /email (EmailApp).

import { redirect } from 'next/navigation';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';
import { OnboardingCanalWhatsApp } from './OnboardingCanalWhatsApp';
import { integracionConectada } from '@/lib/credenciales';
import { getInstanciaRow } from '@/lib/evolution';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';
import { WhatsAppApp } from './WhatsAppApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WhatsAppPage() {
  await requireCapa('whatsapp');

  // El gate mira los DOS canales, no solo Chatwoot. El inbox tiene una pestaña
  // por método, y el no oficial (Evolution, por QR) funciona sin ninguna
  // credencial: pedir Chatwoot para entrar dejaba fuera de la tab a un cliente
  // que acababa de vincular su número y ya tenía sus conversaciones adentro.
  const tabWa = tabActivacion('whatsapp');
  const [oficial, noOficial] = await Promise.all([
    integracionConectada('whatsapp'),
    getInstanciaRow().then((r) => r?.estado === 'conectado').catch(() => false),
  ]);
  if (tabWa && !oficial && !noOficial) return <PanelActivacion tab={tabWa} />;
  await guardOnboarding();
  // WhatsApp tiene onboarding PROPIO (conectar y probar los dos métodos). Se
  // renderiza acá mismo en vez de mandar a otra tab: los pasos se comparten con
  // el Chat Agent, así que lo que se haga acá ya no se vuelve a pedir allá.
  if (await onboardingTabPendiente('whatsapp')) return <OnboardingCanalWhatsApp />;
  return <WhatsAppApp />;
}
