// El tutorial de Settings › Perfil (/perfil; en el teléfono «Tu cuenta», /m/cuenta): día 2 del reto. Cuadra con el guion de su video
// (public/tutoriales/manifiesto.json, key `settings`): un paso por cosa nombrada, en su orden, y el `sub` es la frase del guion. La foto
// de la barra (abre Configuración) sólo existe en la computadora. Las secciones del índice llevan `tour-settings-<clave>`
// (app/_ui/Ajustes.tsx y las filas de app/m/cuenta/CuentaM.tsx). Nombre, Nombre del negocio y Zona horaria van, en el teléfono,
// adentro de la hoja «Perfil».
import { MARCA, conMarca, marcaSettings } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SETTINGS: TutorialPestana = {
  pestana: 'settings',
  nombre: 'Configuración',
  ruta: '/perfil',
  rutaMovil: '/m/cuenta',
  intro: 'Tu perfil está en Configuración: se abre desde tu foto, abajo a la izquierda.',
  pasos: [
    {
      sel: conMarca(MARCA.barraFoto),
      titulo: 'Tu foto',
      texto: 'Abre el menú de tu cuenta: Configuración está ahí.',
      sub: 'Tu perfil está en Configuración: se abre desde tu foto, abajo a la izquierda.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: 'input[aria-label="Nombre"]',
      titulo: 'Se guarda solo',
      texto: 'Escribe y sal del campo. Con Escape vuelves a lo que estaba.',
      sub: 'Aquí no hay botón de guardar: escribes, sales del campo y queda.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'input[aria-label="Nombre del negocio"]',
      titulo: 'Nombre del negocio',
      texto: 'Aparece en toda la app, también en tus plantillas de Image.',
      sub: 'El nombre del negocio que pongas cambia en toda la app.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'button[aria-label="Zona horaria"]',
      titulo: 'Zona horaria',
      texto: 'Con ella se mide el «No molestar» de tus notificaciones.',
      sub: 'Tu zona horaria decide en qué horario MaKo no te molesta.',
      lado: 'arriba',
      soloComputadora: true,
    },
    {
      sel: conMarca(marcaSettings('equipo')),
      titulo: 'Equipo',
      texto: 'Invita a tus closers y setters: cada rol ve sólo lo suyo.',
      sub: 'En Equipo sumas a quien vende contigo, con el rol que le toca.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaSettings('instalar')),
      titulo: 'Instalar la app',
      texto: 'La app del teléfono, la de la computadora y la extensión de Chrome.',
      sub: 'MaKo en el teléfono, la computadora y el navegador se instala desde aquí.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaSettings('integraciones')),
      titulo: 'Integraciones',
      texto: 'Tu agenda, tus anuncios y tu IA. Es lo primero de tu Plan.',
      sub: 'Y lo más importante: en Integraciones conectas tus cuentas. Sin ellas, MaKo no ve tu negocio.',
      lado: 'derecha',
      haz: 'Haz clic en Integraciones',
      clic: true,
    },
  ],
};
