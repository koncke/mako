'use client';

// =============================================================================
// OnboardingCanalWhatsApp — el tramo de WhatsApp, en su propia tab
// =============================================================================
// Es el MISMO wizard del Chat Agent, con la lista de pasos de la tab whatsapp
// (conectar el número de empresa, probar que llega, y el oficial si lo quiere).
// No es una copia: el componente está parametrizado por tab y los pasos se
// comparten, así que escanear el QR acá lo da por hecho también allá.

import { useRouter } from 'next/navigation';
import { OnboardingChatAgent } from '../chat-agent/OnboardingChatAgent';

export function OnboardingCanalWhatsApp() {
  const router = useRouter();
  // Al terminar (o al saltearlo) se recarga la ruta: el guard del server vuelve
  // a preguntar y, si ya está, sirve el inbox de verdad.
  return <OnboardingChatAgent tab="whatsapp" onListo={() => router.refresh()} />;
}
