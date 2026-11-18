// El tutorial de Settings › Perfil (/perfil; en el teléfono «Tu cuenta», /m/cuenta): día 2 del reto. Cuadra con el guion de su video
// (public/tutoriales/manifiesto.json, key `settings`): un paso por cosa nombrada, en su orden, y el `sub` es la frase del guion. La foto
// de la barra (abre Configuración) sólo existe en la computadora. Las secciones del índice llevan `tour-settings-<clave>`
// (app/_ui/Ajustes.tsx y las filas de app/m/cuenta/CuentaM.tsx). Nombre, Nombre del negocio y Zona horaria van, en el teléfono,
// adentro de la hoja «Perfil».
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SETTINGS: TutorialPestana = {
  pestana: 'settings',
  nombre: 'Configuración',
  ruta: '/perfil',
  rutaMovil: '/m/cuenta',
  intro: 'Escribe una vez cómo se llama tu negocio, y se actualiza en toda la app.',
  pasos: [
    {
      sel: 'input[aria-label="Nombre del negocio"]',
      titulo: 'Nombre del negocio',
      texto: 'Aparece en toda la app, también en tus plantillas de Image.',
      sub: 'Mira aquí, Nombre del negocio: escribe el tuyo.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'button[aria-label="Zona horaria"]',
      titulo: 'Zona horaria',
      texto: 'Con ella se mide el «No molestar» de tus notificaciones.',
      sub: 'Toca aquí, en Zona horaria: con ella, MaKo sabe en qué horario no molestarte.',
      lado: 'arriba',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="tour-settings-integraciones"]',
      titulo: 'Integraciones',
      texto: 'Tu agenda, tus anuncios y tu IA. Es lo primero de tu Plan.',
      sub: 'Toca aquí, en Integraciones, y conecta tus cuentas: así MaKo trabaja con tus datos reales.',
      lado: 'derecha',
      haz: 'Haz clic en Integraciones',
      clic: true,
    },
  ],
};
