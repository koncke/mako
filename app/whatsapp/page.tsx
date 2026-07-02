// =============================================================================
// /whatsapp — server wrapper: guard de onboarding + monta el inbox (client)
// =============================================================================
// El inbox completo vive en WhatsAppApp.tsx ('use client'). Este wrapper solo
// aplica el gate server-side del onboarding bloqueante (guardOnboarding), igual
// que el patrón de /email (EmailApp).

import { guardOnboarding } from '@/lib/tab-access';
import { WhatsAppApp } from './WhatsAppApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WhatsAppPage() {
  await guardOnboarding();
  return <WhatsAppApp />;
}
