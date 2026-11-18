// El tutorial de Chats (/chats, la bandeja unificada: app/chats/ChatsApp.tsx). Sus filtros y su lista llevan `aria-label` propios
// (app/chats/FiltrosChats.tsx); cada chat es un `.rio-fila-boton` (clase global de app/chats/chats.css) y el paso toma el primero.
// En el teléfono (/m/chats) es otra pantalla, todavía sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CHATS: TutorialPestana = {
  pestana: 'chats',
  nombre: 'Chats',
  ruta: '/chats',
  intro: 'Todo lo que te escriben llega aquí, venga de donde venga.',
  pasos: [
    {
      sel: 'section[aria-label="Chats"]',
      titulo: 'Todos tus chats',
      texto: 'WhatsApp, Instagram y Messenger en una sola lista. El ícono de la foto dice por dónde te escribió.',
      sub: 'WhatsApp, Instagram y Messenger, en una sola lista. Ya no saltas de una app a otra.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Bandeja, mostrar y orden"]',
      titulo: 'Qué ver',
      texto: 'Los abiertos, los pospuestos o los cerrados, y en qué orden.',
      sub: 'Aquí eliges qué ver: lo abierto, lo que pospusiste o lo que ya cerraste.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Canal"]',
      titulo: 'Por canal',
      texto: 'Sólo WhatsApp, sólo Instagram, o todos juntos.',
      sub: 'Si un día quieres contestar sólo Instagram, filtras por canal.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Etapa"]',
      titulo: 'Por etapa',
      texto: 'Los chats de los leads de una etapa de tu CRM.',
      sub: 'Y por etapa: primero los que están por comprar.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Buscar"]',
      titulo: 'Buscar',
      texto: 'Por nombre o por lo que dijeron.',
      sub: '¿Buscas una conversación? Escribe su nombre aquí.',
      lado: 'abajo',
    },
    {
      sel: '.rio-fila-boton',
      titulo: 'Abre un chat',
      texto: 'Contestas desde aquí, y a la derecha ves su ficha del CRM.',
      sub: 'Toca un chat: le contestas desde aquí y ves en qué etapa está.',
      lado: 'derecha',
      haz: 'Haz clic en un chat',
      clic: true,
    },
  ],
};
