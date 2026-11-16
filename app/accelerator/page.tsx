// =============================================================================
// /accelerator — la página del MaKo Accelerator, el programa con Martín (15/11/2026)
// =============================================================================
// Es la landing que Martín tenía en Lovable para su servicio personalizado, traída a MaKo: el diseño, el texto revisado
// y los botones viven en ./LandingAcelerador.tsx; lo que incluye, la promesa y la agenda salen de la columna del
// Accelerator en /planes (app/planes/Tarjetas.tsx y lib/planes-mako.ts), cuyo «Más información» trae acá
// (`RUTA_ACCELERATOR`: la ruta en inglés, como los planes, Martín 15/11: «como también la ruta»). La barra lateral de la app
// se esconde por CSS (`body:has(.acl-root) aside`), como en /planes; la barra del sitio NO va: esta página tiene la suya,
// con su único botón. EL PIE DEL SITIO SÍ (15/11/2026, Martín: «la bottom bar… debería estar en todas las landing, todas las
// rutas»): `PieGlobal` oculta el suyo (`.acl-pie`, con «© Martín Koncke» y tres legales), como el de cada landing; los legales,
// Reembolsos incluida, están en la columna Legal del pie del sitio. Es oscuro, como la página.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense>; se lee entera sin JavaScript.
// =============================================================================

import type { Metadata } from 'next';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { LandingAcelerador } from './LandingAcelerador';
import { PieGlobal } from '../vsl/_sitio/Barra';

const DESCRIPCION = 'Construye un sistema de adquisición de clientes predecible, con el acompañamiento más personalizado del mercado. Programa por aplicación.';

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

export default function AceleradorPage() {
  return (
    <>
      <LandingAcelerador />
      <PieGlobal />
    </>
  );
}
