// =============================================================================
// La metadata de la portada de hola-mako.com (era de app/page.tsx)
// =============================================================================
// En su propio módulo desde el 23/10/2026: app/page.tsx ahora lee la landing de Web Generator con un módulo
// server-only (lib/editor-landing/landing-mako.ts), y tests/portada-vista-previa.test.ts importa la metadata
// sin poder cargar eso. La página la reexporta tal cual.
// =============================================================================

import type { Metadata } from 'next';

// 29/10/2026 (Martín): la portada apunta a la venta High Ticket (antes, al embudo con VSL): la misma frase que la landing
// principal de Web Generator (scripts/landing-principal-high-ticket.mts).
const TITULO = 'MaKo — El mejor software para vender High Ticket';
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
export const metadataPortada: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    url: '/',
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/og-landing.jpg', width: 1200, height: 630, alt: 'MaKo — El mejor software para vender High Ticket' }],
  },
  twitter: { card: 'summary_large_image', title: TITULO, description: DESCRIPCION, images: ['/og-landing.jpg'] },
};
