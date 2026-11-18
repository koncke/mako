// El tutorial de Integraciones (/integraciones; en el teléfono /m/configuraciones/integraciones): día 2 del reto. Cuadra con el guion
// de su video (public/tutoriales/manifiesto.json, key `settings-integraciones`: la pestaña se llama igual para que el motor encuentre
// el video). Un paso por cosa nombrada, en su orden: la foto (abre Configuración), Integraciones en el índice, tus cuentas de IA y las
// tarjetas que nombra (WhatsApp, Zernio, cobros y agenda). Cada integración lleva `tour-int-<key>` (su key del catálogo): la tarjeta de
// app/integraciones/IntegracionesBoard.tsx y la fila de app/m/configuraciones/integraciones/IntegracionesM.tsx; el onboarding puede ir
// directo a la que le toca con `marcaIntegracion(key)`. La computadora muestra doce «Sin conectar» y «Mostrar más integraciones»:
// Stripe y Calendly quedan detrás, y su paso toca ese botón antes (`antes`). La foto y el índice no existen en el teléfono.
import { MARCA, conMarca, marcaIntegracion, marcaSettings } from './marcas';
import type { TutorialPestana } from './tipos';

const MAS = conMarca(MARCA.integracionesMas);

export const TUTORIAL_INTEGRACIONES: TutorialPestana = {
  pestana: 'settings-integraciones',
  nombre: 'Integraciones',
  ruta: '/integraciones',
  rutaMovil: '/m/configuraciones/integraciones',
  intro: 'Sin tus cuentas conectadas, MaKo trabaja a ciegas. En Integraciones le das acceso a tu negocio.',
  pasos: [
    {
      sel: conMarca(MARCA.barraFoto),
      titulo: 'Tu foto',
      texto: 'Abre el menú de tu cuenta: Configuración está ahí.',
      sub: 'Está en Configuración: toca tu foto, abajo a la izquierda,',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: conMarca(marcaSettings('integraciones')),
      titulo: 'Integraciones',
      texto: 'La sección de Configuración donde conectas tus cuentas.',
      sub: 'y entra en Integraciones.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: 'button.tci-destacada, a[href="/perfil/ia"]',
      titulo: 'Tus cuentas de IA',
      texto: 'El Claude, el GPT o el Gemini con el que trabaja MaKo.',
      sub: 'Arriba están tus cuentas de IA: el Claude, el GPT o el Gemini con el que trabaja MaKo.',
      lado: 'abajo',
    },
    {
      sel: conMarca(marcaIntegracion('whatsapp')),
      titulo: 'WhatsApp',
      texto: 'Tus números, cada uno con su QR. Puedes sumar uno por setter.',
      sub: 'Después, cada servicio en su tarjeta: tu WhatsApp con su QR,',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('zernio')),
      titulo: 'Instagram y Facebook',
      texto: 'Con Zernio conectas tu Instagram, tu Facebook y tus anuncios de Meta.',
      sub: 'Instagram y Facebook por Zernio,',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('stripe')),
      antes: MAS,
      titulo: 'Tus cobros',
      texto: 'Cobra con un link de pago y cada pago entra solo a tu CRM. Mercado Pago, igual, en tu moneda.',
      sub: 'tus cobros',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('calendly')),
      antes: MAS,
      titulo: 'Tu agenda',
      texto: 'Tus reuniones R1 y R2 y quién asistió.',
      sub: 'y tu agenda. Conecta sólo lo que usas: cada tarjeta te lleva paso a paso.',
      lado: 'derecha',
    },
  ],
};
