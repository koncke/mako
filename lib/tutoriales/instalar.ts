// El tutorial de Settings › Instalar la app (/perfil/instalar: app/perfil/instalar/InstalarApp.tsx). Cuadra con el guion de su video
// (key `settings-instalar`: v3 para la entrada y las frases de acción del manifiesto v4). El QR (`img.aj-telefono__qr`, clase global) y
// «Descargar» (su `href`) ya tienen un atributo estable; la fila de la extensión lleva su marca. En el teléfono es /m/cuenta/instalar
// (otra pantalla), sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_INSTALAR: TutorialPestana = {
  pestana: 'settings-instalar',
  nombre: 'Instalar la app',
  ruta: '/perfil/instalar',
  intro: '¿Pagas Claude o ChatGPT? En tu computadora, tus chats con MaKo usan esa suscripción.',
  pasos: [
    {
      sel: 'a[href="/perfil/instalar"]',
      titulo: 'Instalar la app',
      texto: 'MaKo en tu computadora, en tu celular y en Chrome.',
      sub: 'Instalar la app, en Configuración, lleva MaKo a tu computadora, tu celular y Chrome.',
      lado: 'derecha',
    },
    {
      sel: 'img.aj-telefono__qr',
      titulo: 'En tu celular',
      texto: 'Escanéalo con la cámara. En iPhone, Compartir y «Agregar a inicio»; en Android, «Instalar app».',
      sub: 'Mira aquí, el QR: escanéalo con tu celular. En iPhone, Compartir y Agregar a inicio; en Android, Instalar app.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.instalarExtension),
      titulo: 'Extensión para Chrome',
      texto: 'Hace tus videos con tu cuenta de Google Flow.',
      sub: 'Mira aquí, Extensión para Chrome: hace tus videos con tu cuenta de Google Flow.',
      lado: 'izquierda',
    },
    {
      sel: 'a[href^="/api/ia-pc/descargar"]',
      titulo: 'Descargar',
      texto: 'La app de MaKo para tu computadora, en Windows o en Mac.',
      sub: 'Empieza por la computadora: toca aquí, en Descargar, y tus chats con MaKo usan tu suscripción de Claude o ChatGPT.',
      lado: 'izquierda',
      haz: 'Haz clic en Descargar',
      clic: true,
    },
  ],
};
