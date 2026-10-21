// =============================================================================
// El tutorial del Ops Center al terminar el onboarding (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 13): al entrar, «debería estar posicionado en el chat de "Onboarding"... Y luego debería
// iniciar el tutorial de la app, como lo tenemos en varios lugares». Es un recorrido de la casa (app/_ui/Recorrido.tsx):
// marca vista por persona, se salta lo que no está en pantalla. Arranca con `?recorrido=sb-inicio`, que pone el final del
// onboarding (lib/onboarding-arranque.ts → rutaDelHilo). Sin texto largo: una o dos frases por paso.
// =============================================================================

import type { PasoRecorrido } from '@/lib/recorridos';

export const PASOS_INICIO: PasoRecorrido[] = [
  { objetivo: 'sb-hilo', titulo: 'Tu onboarding quedó aquí', texto: 'Esta es la conversación que acabas de tener con MaKo. Queda guardada para retomarla cuando quieras.' },
  { objetivo: 'sb-chats', titulo: 'Tus chats con MaKo', texto: 'Cada conversación queda en esta lista. Abre una nueva para empezar otro tema.' },
  { objetivo: 'sb-escribir', titulo: 'Pídele lo que necesites', texto: 'Escríbele, adjunta un archivo o dicta con el micrófono. MaKo ya conoce tu negocio.' },
];
