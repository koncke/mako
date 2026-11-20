// El tutorial de Chats VACÍO (20/11/2026; el Cerebro: «es lo que ve TODA cuenta nueva del onboarding»). Sin ningún canal conectado,
// /chats es sólo «Conecta un canal para ver tus chats aquí.» con los botones de cada canal (app/chats/ChatsApp.tsx → `sinCanales`):
// no hay bandeja ni «Canal», y el tutorial de siempre (./chats.ts) decía «toca aquí, en Todos» sin marcar nada. Éste dice qué es
// Chats y por qué empezar por WhatsApp, con la única marca que existe en ese estado: el botón WhatsApp. Lo elige el motor cuando
// está la marca del vacío (`variante` de ./chats.ts); su video es `chats-vacio` (su guion, en guiones.json).
// Un closer o setter sin canales no ve los botones de conectar: la frase del botón se saltea sin pausar.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CHATS_VACIO: TutorialPestana = {
  pestana: 'chats-vacio',
  nombre: 'Chats',
  ruta: '/chats',
  intro: 'WhatsApp, Instagram, Messenger y email, en una sola bandeja.',
  pasos: [
    {
      sel: '[data-recorrido="tour-chats-whatsapp"]',
      titulo: 'Conecta WhatsApp',
      texto: 'Escaneas el QR desde tu celular y tus chats entran aquí.',
      sub: 'Toca aquí, en WhatsApp, y conéctalo con el QR desde tu celular.',
      lado: 'abajo',
      haz: 'Haz clic en WhatsApp',
      clic: true,
    },
  ],
};
