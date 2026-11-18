// El tutorial de Chats (/chats, la bandeja unificada: app/chats/ChatsApp.tsx). Cuadra con el guion de su video (key `chats`: v3 para la
// entrada y las frases de acción del manifiesto v4). El link de la barra (`a[href="/chats"]`), el filtro «Bandeja, mostrar y orden» (donde
// están Míos, Sin asignar y Atiende MaKo) y el botón «WhatsApp» de conectar un canal (su marca; aparece sólo si falta conectarlo: con
// WhatsApp ya conectado, el motor saltea el paso). «El botón MaKo de la caja» vive adentro de una conversación de WhatsApp abierta: queda
// sin paso hasta que el manifiesto le dé su `sel`. En el teléfono (/m/chats) todavía no está medido: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CHATS: TutorialPestana = {
  pestana: 'chats',
  nombre: 'Chats',
  ruta: '/chats',
  intro: 'WhatsApp, Instagram, Messenger y email, en una sola bandeja.',
  pasos: [
    {
      sel: 'a[href="/chats"]',
      titulo: 'Chats',
      texto: 'Los mensajes de tus clientes, escriban por donde escriban.',
      sub: 'Chats junta los mensajes de tus clientes, escriban por donde escriban. Lo abres en tu panel, a la izquierda.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: 'button[aria-label="Bandeja, mostrar y orden"]',
      titulo: 'Qué ver',
      texto: 'Míos, Sin asignar o Atiende MaKo, y en qué orden.',
      sub: 'Arriba filtras por Míos, Sin asignar o Atiende MaKo.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.chatsWhatsapp),
      titulo: 'Conecta WhatsApp',
      texto: 'Escaneas el QR desde tu celular y listo: tus chats entran aquí.',
      sub: 'Para empezar, toca aquí, en WhatsApp, y conéctalo con el QR desde tu celular.',
      lado: 'abajo',
    },
  ],
};
