import type { Metadata } from 'next';
import { Portada } from './vsl/Portada';
import { disenoDeLanding, landingMako } from '@/lib/editor-landing/landing-mako';

// La raíz es la landing de venta (antes vivía en /vsl). La ve CUALQUIERA, con
// sesión o sin ella: es la cara pública del dominio y tener que desloguearse
// para mirar el VSL no tiene sentido. El repartidor por rol —lo que antes vivía
// acá— se mudó a /inicio, que es a donde va el login y el "Entrar" del header.
const TITULO = 'MaKo — El mejor software para vender High Ticket con VSL Funnel';
const DESCRIPCION =
  'Una sola plataforma para todo tu negocio: del primer clic en tu anuncio al cliente que paga. Menos herramientas, menos adivinanza, más cierres. Agenda tu llamada.';

// ⚠️ LA TARJETA DE LA PORTADA ES SUYA, no la del layout. Hasta el 08/10/2026 caía en la
// de app/layout.tsx (/og-mako.jpg), que es la imagen de los links de MATERIAL COMPARTIDO
// y lo dice escrito: la landing de venta se previsualizaba como «Material compartido»
// al pegarla en un chat o al pautarla. /og-landing.jpg es la misma marca con el mensaje
// de esta página (se generó desde HTML con Geist, 1200x630 a 1x, ~52 KB: WhatsApp
// descarta las previews pesadas).
//
// Y va COMPLETA: el `openGraph` de una página REEMPLAZA al del layout, no se mezcla, así
// que un `images` suelto acá dejaría la tarjeta sin `type`, `siteName` ni `url`.
export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    url: '/',
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/og-landing.jpg', width: 1200, height: 630, alt: 'MaKo — El mejor software para vender High Ticket con VSL Funnel' }],
  },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION, images: ['/og-landing.jpg'] },
};


// La portada se arma con la landing de Web Generator PUBLICADA (lib/editor-landing/landing-mako.ts), con
// caché de 5 minutos que «Publicar» vence al momento. Sin documento publicado, la de siempre.
export const revalidate = 300;

export default async function Home() {
  const diseno = disenoDeLanding(await landingMako(null));
  return <Portada diseno={diseno} />;
}
