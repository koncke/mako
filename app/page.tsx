import type { Metadata } from 'next';
import { Suspense } from 'react';
import Landing from './vsl/Landing';
import { PortadaSinJs } from './vsl/PortadaSinJs';
import { EMAIL_MAKO, APP_BASE_URL } from '@/lib/app-url';
import { RAZON_SOCIAL_MAKO } from '@/lib/titular-mako';

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

/**
 * Quién está detrás del sitio, en datos estructurados (schema.org Organization).
 *
 * ⚠️ POR QUÉ: Meta rechazó DOS veces la verificación del negocio con «la razón social
 * de la empresa debe aparecer en el sitio web» (08/10/2026). La razón social ya está
 * visible en el pie (`PieLegal`, app/vsl/Landing.tsx), pero el pie cae al final de
 * ~200 KB de HTML; esto la pone al PRINCIPIO del body y en el campo que el estándar
 * define para eso (`legalName`), para cualquier lector que no llegue al final o que
 * busque el dato estructurado. No reemplaza al texto visible: lo acompaña.
 */
const NEGOCIO = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'MaKo',
  legalName: RAZON_SOCIAL_MAKO,
  url: APP_BASE_URL,
  email: EMAIL_MAKO,
};

export default function Home() {
  return (
    <>
      {/* JSON.stringify de strings propios, sin «<»: no hay HTML que escapar. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(NEGOCIO) }} />
      {/* ⚠️ LA LANDING VA EN SU PROPIO SUSPENSE, con un fallback que se ve. Nació el
          08/10/2026 para esquivar el Suspense que envolvía la app entera en el layout:
          con él, toda la portada viajaba OCULTA hasta que corre JavaScript, y el
          verificador de Meta —que no lo ejecuta— rechazaba la verificación del negocio.

          Desde el 10/10/2026 ese Suspense del layout ya no existe, así que ESTE es el
          único que esconde la landing: sin él, quien no ejecuta JS leería la landing
          entera (con la razón social en el pie) en vez de PortadaSinJs. Se dejó a
          propósito: es la vista con la que Meta aprobó el negocio, y cambiarla con una
          verificación de Meta todavía abierta es un riesgo que no compra nada. Sacarlo
          es una línea, y obliga a ajustar tests/razon-social-sitio.test.ts. */}
      <Suspense fallback={<PortadaSinJs />}>
        <Landing />
      </Suspense>
    </>
  );
}
