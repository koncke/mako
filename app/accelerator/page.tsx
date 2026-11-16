// =============================================================================
// /accelerator — la página del MaKo Accelerator, el programa con Martín (15/11/2026)
// =============================================================================
// Es la landing que Martín tenía en Lovable para su servicio personalizado, traída a MaKo: el diseño, el texto revisado
// y los botones viven en ./LandingAcelerador.tsx (y lo que dice, en ./contenido.ts). Lo que incluye es `LISTA_DEL_ACELERADOR`
// (lib/planes-mako.ts, los mismos nombres que la columna de /planes) y el precio es el de esa columna (`PROGRAMA_ACELERADOR`), los
// dos en «La inversión», así que si Martín cambia la oferta cambia en los dos lugares. Sin «Nuestra promesa» (16/11) y sin
// agenda: todo «Aplica ahora» lleva al formulario (`RUTA_APLICAR`, /accelerator/aplicar), y la agenda de Martín ya no se abre a
// nadie (16/11, a la tarde): después de aplicar, la pantalla final es la misma para todos (Martín responde en 24 horas, y el paso
// siguiente es crear la cuenta de MaKo). Llega desde el «Más información» de la columna de /planes (`RUTA_ACCELERATOR`: la ruta en inglés,
// como los planes; Martín 15/11: «como también la ruta»). La barra lateral de la app se esconde por CSS (`body:has(.acl-root)
// aside`), como en /planes; la barra del sitio NO va: esta página tiene la suya (./Barra.tsx). EL PIE ES EL DEL SITIO
// (`PieGlobal`; 15/11/2026, Martín: «la bottom bar… debería estar en todas las landing, todas las rutas»): la landing ya no tiene
// pie propio, y los legales, Reembolsos incluida, están en la columna Legal de ése. Es oscuro, como la página.
//
// LA CAMPAÑA VIAJA AL FORMULARIO (revisión del 16/11/2026): los «Aplica ahora» llevan los `utm_*`, el `fbclid` y la landing que
// trajo esta URL (`origenDeLaUrl`, el mismo de la aplicación). Antes el formulario la leía sólo de la página anterior (el
// referrer), y se perdía si el navegador no lo mandaba.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense>; se lee entera sin JavaScript.
// =============================================================================

import type { Metadata } from 'next';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { LandingAcelerador } from './LandingAcelerador';
import { PieGlobal } from '../vsl/_sitio/Barra';
import { origenDeLaUrl } from './aplicar/origen';

// Sin «con el acompañamiento más personalizado del mercado» (16/11/2026, Martín: «eliminaría también la frase… de la landing de
// Accelerator»): se fue del héroe (./contenido.ts) y de acá.
const DESCRIPCION = 'Construye un sistema de adquisición de clientes predecible. Programa por aplicación.';

export const metadata: Metadata = {
  title: PROGRAMA_ACELERADOR.nombre,
  description: DESCRIPCION,
  robots: { index: true, follow: true },
  // Completa, porque el `openGraph` de una página REEMPLAZA al del layout (app/vsl/portada-metadata.ts).
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    title: PROGRAMA_ACELERADOR.nombre,
    description: DESCRIPCION,
    images: [{ url: '/og-mako.jpg', width: 1200, height: 630, alt: 'MaKo' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-mako.jpg'] },
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AceleradorPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const origen = origenDeLaUrl((await searchParams) ?? {});
  return (
    <>
      <LandingAcelerador origen={origen} />
      <PieGlobal />
    </>
  );
}
