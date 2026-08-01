// =============================================================================
// /whatsapp — server wrapper: guard de onboarding + monta el inbox (client)
// =============================================================================
// El inbox completo vive en WhatsAppApp.tsx ('use client'). Este wrapper solo
// aplica el gate server-side del onboarding bloqueante (guardOnboarding), igual
// que el patrón de /email (EmailApp).

import { redirect } from 'next/navigation';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { onboardingRequeridoPara } from '@/lib/tab-onboarding-state';
import { integracionConectada } from '@/lib/credenciales';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';
import { WhatsAppApp } from './WhatsAppApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WhatsAppPage() {
  await requireCapa('whatsapp');

  // Sin Chatwoot el inbox se renderiza entero y dice 'Sin conversaciones' — un
  // error de config disfrazado de dato vacío, que le echa la culpa al dato.
  const tabWa = tabActivacion('whatsapp');
  if (tabWa && !(await integracionConectada('whatsapp'))) return <PanelActivacion tab={tabWa} />;
  await guardOnboarding();
  // Esta tab depende del onboarding de /setting (regla: toda tab tiene
  // onboarding, y el de WhatsApp está cubierto por Setting — ver
  // lib/tab-onboarding-state.ts). Sin eso hecho, el inbox no tiene qué mostrar.
  const destino = await onboardingRequeridoPara('whatsapp');
  if (destino) redirect(destino);
  return <WhatsAppApp />;
}
