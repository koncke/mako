// El tutorial de Settings › Notificaciones (/perfil/notificaciones: app/perfil/NotificacionesPanel.tsx). Los canales y «Pausar los
// avisos al celular» llevan su marca (la fila: el grupo «No molestar» lo fija tests/agencia-grupos.test.ts). Sin video todavía: el `sub`
// es una propuesta para su guion. En el teléfono es la hoja «Notificaciones» de «Tu cuenta», todavía sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_NOTIFICACIONES: TutorialPestana = {
  pestana: 'notificaciones',
  nombre: 'Notificaciones',
  ruta: '/perfil/notificaciones',
  intro: 'Tú decides qué te avisa MaKo y por dónde.',
  pasos: [
    {
      sel: conMarca(MARCA.notifCanales),
      titulo: 'Por dónde te avisa',
      texto: 'En la app, en el celular, por WhatsApp o por email. Tocas uno y eliges qué te llega por ahí.',
      sub: 'Cada aviso, por el canal que elijas: la app, el celular, WhatsApp o el email.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.notifNoMolestar),
      titulo: 'No molestar',
      texto: 'Pausa los avisos al celular en un horario, con la hora de tu zona.',
      sub: 'Y con No molestar, MaKo no te escribe al celular de noche.',
      lado: 'arriba',
    },
  ],
};
