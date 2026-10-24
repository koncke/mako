'use client';

// =============================================================================
// OnboardingCanalWhatsApp — el tramo de WhatsApp, en su propia ruta
// =============================================================================
// Es el MISMO wizard del Chatbot, con la lista de pasos de la tab whatsapp
// (conectar el número de empresa, probar que llega, y el oficial si lo quiere).
// No es una copia: el componente está parametrizado por tab y los pasos se
// comparten, así que escanear el QR acá lo da por hecho también allá.
//
// ⚠️ AL TERMINAR VA A CHATS (24/10/2026): la bandeja vieja de /whatsapp ya no se dibuja (docs/diseno-chats.md §8.4).
//    Antes se montaba acá mismo, sin volver al server, y por eso este componente recibía los productos del «+ Agregar al
//    CRM»; ahora los lee la página de Chats. Con `push` y no `refresh`: refrescar re-corre el guard del server y devolvía
//    el mismo wizard, así que «Lo configuro después» y la ✕ no llevaban a ninguna parte.

import { useRouter } from '@/app/_ui/Link';
import { OnboardingChatAgent } from '../automations/OnboardingChatAgent';

export function OnboardingCanalWhatsApp() {
  const router = useRouter();
  return <OnboardingChatAgent tab="whatsapp" onListo={() => router.push('/chats')} />;
}
