// El tutorial de Integraciones (/integraciones; en el teléfono /m/configuraciones/integraciones): día 2 del reto. Cuadra con el guion
// de su video (public/tutoriales/manifiesto.json, key `settings-integraciones`: la pestaña se llama igual para que el motor encuentre
// el video). Un paso por cosa nombrada, en su orden: la foto (abre Configuración), Integraciones en el índice, tus cuentas de IA y las
// tarjetas que nombra (WhatsApp, Zernio, cobros y agenda). Cada integración lleva `tour-int-<key>` (su key del catálogo): la tarjeta de
// app/integraciones/IntegracionesBoard.tsx y la fila de app/m/configuraciones/integraciones/IntegracionesM.tsx; el onboarding puede ir
// directo a la que le toca con `marcaIntegracion(key)`. La computadora muestra doce «Sin conectar» y «Mostrar más integraciones»:
// Stripe y Calendly quedan detrás, y su paso toca ese botón antes (`antes`). La foto y el índice no existen en el teléfono.
import { marcaIntegracion } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_INTEGRACIONES: TutorialPestana = {
  pestana: 'settings-integraciones',
  nombre: 'Integraciones',
  ruta: '/integraciones',
  rutaMovil: '/m/configuraciones/integraciones',
  intro: 'MaKo se conecta con más de 25 aplicaciones, desde WhatsApp hasta tus cobros.',
  pasos: [
    {
      sel: 'button.tci-destacada, a[href="/perfil/ia"]',
      titulo: 'Tus cuentas de IA',
      texto: 'El Claude, el GPT o el Gemini con el que trabaja MaKo.',
      sub: 'Toca aquí, en tus cuentas de IA, y elige con cuál trabaja MaKo: Claude, GPT o Gemini.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-int-whatsapp"]',
      titulo: 'WhatsApp',
      texto: 'Tus números, cada uno con su QR. Puedes sumar uno por setter.',
      sub: 'Toca aquí, en WhatsApp, y conecta tu número con su QR.',
      lado: 'derecha',
    },
    {
      sel: '[data-recorrido="tour-int-zernio"]',
      titulo: 'Instagram y Facebook',
      texto: 'Con Zernio conectas tu Instagram, tu Facebook y tus anuncios de Meta.',
      sub: 'Toca aquí, en Zernio, para sumar tu Instagram y tu Facebook.',
      lado: 'derecha',
    },
  ],
};
