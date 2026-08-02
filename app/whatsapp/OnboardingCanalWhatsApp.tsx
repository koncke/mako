'use client';

// =============================================================================
// OnboardingCanalWhatsApp — el tramo de WhatsApp, en su propia tab
// =============================================================================
// Es el MISMO wizard del Chat Agent, con la lista de pasos de la tab whatsapp
// (conectar el número de empresa, probar que llega, y el oficial si lo quiere).
// No es una copia: el componente está parametrizado por tab y los pasos se
// comparten, así que escanear el QR acá lo da por hecho también allá.

import { useState } from 'react';
import { OnboardingChatAgent } from '../chat-agent/OnboardingChatAgent';
import { WhatsAppApp } from './WhatsAppApp';

export function OnboardingCanalWhatsApp() {
  // Estado de CLIENTE y no router.refresh(): refrescar re-corre el guard del
  // server y devuelve el mismo wizard, así que "Lo configuro después" y la ✕ no
  // llevaban a ninguna parte. Con esto, cerrar cierra.
  const [enOnboarding, setEnOnboarding] = useState(true);
  if (!enOnboarding) return <WhatsAppApp />;
  return <OnboardingChatAgent tab="whatsapp" onListo={() => setEnOnboarding(false)} />;
}
