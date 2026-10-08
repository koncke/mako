'use client';

// =============================================================================
// OnboardingCanalWhatsApp — el tramo de WhatsApp, en su propia tab
// =============================================================================
// Es el MISMO wizard del Chatbot, con la lista de pasos de la tab whatsapp
// (conectar el número de empresa, probar que llega, y el oficial si lo quiere).
// No es una copia: el componente está parametrizado por tab y los pasos se
// comparten, así que escanear el QR acá lo da por hecho también allá.

import { useState } from 'react';
import { OnboardingChatAgent } from '../chatbot/OnboardingChatAgent';
import { WhatsAppApp } from './WhatsAppApp';
import type { ProductoParaAlta } from '@/lib/lead-funnel-reglas';

/**
 * ⚠️ `productos` LLEGA ACÁ TAMBIÉN, y es obligatorio a propósito. Al cerrar el wizard se
 * monta la bandeja en el acto, sin volver al server: sin esto, el cliente que acaba de
 * conectar su línea y sigue en la misma sesión subía sus contactos al CRM con el botón de un
 * clic, en el principal, aunque tuviera tres productos (lo vio la refutación del 08/10/2026).
 */
export function OnboardingCanalWhatsApp({ productos }: { productos: ProductoParaAlta[] | null }) {
  // Estado de CLIENTE y no router.refresh(): refrescar re-corre el guard del
  // server y devuelve el mismo wizard, así que "Lo configuro después" y la ✕ no
  // llevaban a ninguna parte. Con esto, cerrar cierra.
  const [enOnboarding, setEnOnboarding] = useState(true);
  if (!enOnboarding) return <WhatsAppApp productos={productos} />;
  return <OnboardingChatAgent tab="whatsapp" onListo={() => setEnOnboarding(false)} />;
}
