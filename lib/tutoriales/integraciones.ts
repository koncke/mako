// El tutorial de Integraciones (/integraciones; en el teléfono /m/configuraciones/integraciones): día 2 del reto, después de
// Settings. Cada integración lleva `tour-int-<key>` (su key de lib/integraciones-catalogo.ts): la tarjeta de
// app/integraciones/IntegracionesBoard.tsx y la fila de app/m/configuraciones/integraciones/IntegracionesM.tsx. El onboarding puede
// ir directo a la que le toca a cada negocio con `marcaIntegracion(key)`. Los textos salen de lo que hace cada una (su `descripcion`
// del catálogo); Google Calendar no es una tarjeta (`oculto`), así que no tiene paso. La computadora muestra doce «Sin conectar»
// y «Mostrar más integraciones»: Calendly, Stripe y Panda quedan detrás, y su paso toca ese botón antes (`antes`).
import { MARCA, conMarca, marcaIntegracion } from './marcas';
import type { TutorialPestana } from './tipos';

const MAS = conMarca(MARCA.integracionesMas);

export const TUTORIAL_INTEGRACIONES: TutorialPestana = {
  pestana: 'integraciones',
  nombre: 'Integraciones',
  ruta: '/integraciones',
  rutaMovil: '/m/configuraciones/integraciones',
  intro: 'Aquí conectas lo que Máko necesita ver de tu negocio. Sin esto, trabaja a ciegas.',
  pasos: [
    {
      sel: conMarca(marcaIntegracion('whatsapp')),
      titulo: 'WhatsApp',
      texto: 'Tus números, cada uno con su QR. Puedes sumar uno por setter.',
      sub: 'WhatsApp ya está conectado: por ahí te escriben tus leads.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('meta')),
      titulo: 'Tus anuncios',
      texto: 'Meta Ads: tus campañas, sus números y el estado de la cuenta.',
      sub: 'Si haces anuncios, conecta Meta y Máko lee cada campaña.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('zernio')),
      titulo: 'Instagram y Facebook',
      texto: 'Con Zernio conectas tu Instagram, tu Facebook y tus anuncios de Meta.',
      sub: 'Instagram y Facebook entran con Zernio.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('calendly')),
      antes: MAS,
      titulo: 'Tu agenda',
      texto: 'Tus reuniones R1 y R2 y quién asistió.',
      sub: 'Con Calendly, cada reunión que te reservan llega sola a Máko.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('stripe')),
      antes: MAS,
      titulo: 'Tus cobros',
      texto: 'Cobra con un link de pago y cada pago entra solo a tu CRM. Mercado Pago, igual, en tu moneda.',
      sub: 'Si cobras con Stripe o Mercado Pago, cada pago entra solo a tu CRM.',
      lado: 'derecha',
    },
    {
      sel: conMarca(marcaIntegracion('panda')),
      antes: MAS,
      titulo: 'Tu video de ventas',
      texto: 'Cuánto miran tu VSL. Si está en YouTube, Vimeo o Wistia, conecta ese.',
      sub: 'Y si tu video de ventas está en Panda o en YouTube, conéctalo: Máko ve hasta dónde lo miran.',
      lado: 'derecha',
    },
  ],
};
