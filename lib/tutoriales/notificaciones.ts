// El tutorial de Settings › Notificaciones (/perfil/notificaciones: app/perfil/NotificacionesPanel.tsx). Cuadra con el guion de su video
// (key `settings-notificaciones`, C:/dev/tutoriales-video: v3 para la entrada, y las frases de acción del manifiesto v4 con su `sel`).
// «Avisos al celular» vive en el detalle del canal Celular (`?canal=celular`): su paso toca antes la fila «Celular». En el teléfono es la
// hoja «Notificaciones» de «Tu cuenta», todavía sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_NOTIFICACIONES: TutorialPestana = {
  pestana: 'settings-notificaciones',
  nombre: 'Notificaciones',
  ruta: '/perfil/notificaciones',
  intro: 'Un mensaje sin responder no puede esperar a que abras MaKo.',
  pasos: [
    {
      sel: 'a[href="/perfil/notificaciones?canal=celular"]',
      titulo: 'Celular',
      texto: 'Los avisos que te llegan al teléfono, aunque MaKo esté cerrado.',
      sub: 'Toca aquí, en Celular, para que los avisos te lleguen al teléfono.',
      lado: 'izquierda',
    },
    {
      sel: '[data-recorrido="tour-settings-notificaciones-avisos-celular"]',
      titulo: 'Avisos al celular',
      texto: 'Préndelos y te llegan al teléfono.',
      sub: 'Mira aquí, Avisos al celular: préndelos y te llegan al teléfono.',
      lado: 'izquierda',
      antes: 'a[href="/perfil/notificaciones?canal=celular"]',
    },
  ],
};
