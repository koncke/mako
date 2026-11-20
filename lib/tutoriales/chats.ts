// El tutorial de Chats (/chats, la bandeja unificada: app/chats/ChatsApp.tsx). Cuadra con el guion de su video (key `chats`: v3 para la
// entrada y las frases de acción del manifiesto v4). El link de la barra (`a[href="/chats"]`), el filtro «Bandeja, mostrar y orden» (donde
// están Míos, Sin asignar y Atiende MaKo) y el botón «WhatsApp» de conectar un canal (su marca; aparece sólo si falta conectarlo: con
// WhatsApp ya conectado, el motor saltea el paso). «El botón MaKo de la caja» vive adentro de una conversación de WhatsApp abierta: queda
// sin paso hasta que el manifiesto le dé su `sel`. En el teléfono (/m/chats) todavía no está medido: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CHATS: TutorialPestana = {
  pestana: 'chats',
  nombre: 'Chats',
  ruta: '/chats',
  intro: 'WhatsApp, Instagram, Messenger y email, en una sola bandeja.',
  pasos: [
    {
      sel: 'button[aria-label="Bandeja, mostrar y orden"]',
      titulo: 'Qué ver',
      texto: 'Míos, Sin asignar o Atiende MaKo, y en qué orden.',
      sub: 'Toca aquí, en Todos, y filtra por Míos, Sin asignar o Atiende MaKo.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Canal"]',
      titulo: 'Canal',
      texto: 'Y mira sólo lo que llega por uno de ellos.',
      sub: 'Toca aquí, en Canal, y mira sólo lo que llega por uno de ellos.',
    },
    {
      sel: '[data-recorrido="tour-chats-whatsapp"]',
      titulo: 'Conecta WhatsApp',
      texto: 'Escaneas el QR desde tu celular y listo: tus chats entran aquí.',
      sub: 'Para empezar, toca aquí, en WhatsApp, y conéctalo con el QR desde tu celular.',
      lado: 'abajo',
      // Con canales, WhatsApp vive en «Canal › Conectar un canal» (20/11): la frase de «Canal» deja el menú abierto, y el motor
      // toca la opción; si está cerrado, abre «Canal» primero.
      antes: ['button[aria-label="Canal"]', '[data-recorrido="tour-chats-conectar"]'],
    },
  ],
};
