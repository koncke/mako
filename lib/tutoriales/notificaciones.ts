// El tutorial de Settings › Notificaciones (/perfil/notificaciones: app/perfil/NotificacionesPanel.tsx). Cuadra con el guion de su video
// (key `settings-notificaciones`, C:/dev/tutoriales-video: v3 para la entrada, y las frases de acción del manifiesto v4 con su `sel`).
// «Avisos al celular» vive en el detalle del canal Celular (`?canal=celular`): su paso toca antes la fila «Celular». En el teléfono es la
// hoja «Notificaciones» de «Tu cuenta», todavía sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

const CELULAR = 'a[href="/perfil/notificaciones?canal=celular"]';

export const TUTORIAL_NOTIFICACIONES: TutorialPestana = {
  pestana: 'settings-notificaciones',
  nombre: 'Notificaciones',
  ruta: '/perfil/notificaciones',
  intro: 'Un mensaje sin responder no puede esperar a que abras MaKo.',
  pasos: [
    {
      sel: 'a[href="/perfil/notificaciones"]',
      titulo: 'Notificaciones',
      texto: 'Por dónde te avisa MaKo: en la app, al celular, por WhatsApp o por email.',
      sub: 'En Notificaciones, dentro de Configuración, eliges por dónde te avisa: En la app, Celular, WhatsApp o Email.',
      lado: 'derecha',
    },
    {
      sel: CELULAR,
      titulo: 'Celular',
      texto: 'Los avisos que te llegan al teléfono, aunque MaKo esté cerrado.',
      sub: 'Toca aquí, en Celular, para que los avisos te lleguen al teléfono.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.notifAvisosCelular),
      antes: CELULAR,
      titulo: 'Avisos al celular',
      texto: 'Préndelos y te llegan al teléfono.',
      sub: 'Mira aquí, Avisos al celular: préndelos y te llegan al teléfono.',
      lado: 'izquierda',
    },
  ],
};
