// =============================================================================
// /accelerator/aplicar — la aplicación a MaKo Accelerator (16/11/2026)
// =============================================================================
// Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
// justamente un formulario… muy similar [al de Mastery Haus]». Adonde lleva el «Aplica ahora» de /accelerator (`RUTA_APLICAR`).
// El formulario es ./FormularioAplicacion.tsx (las preguntas y quién califica: lib/aplicacion-accelerator.ts) y postea a
// /api/accelerator/aplicar. Arriba, la barra del programa (app/accelerator/Barra.tsx) con la vuelta a la landing; abajo, el pie
// del sitio (`PieGlobal`, oscuro como la página).
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts, por el prefijo /accelerator): sólo GET, no lee cookies, sin <Suspense>. La campaña que trajo
//    la URL (landing, utm_*, fbclid) viaja en el cuerpo del POST (./origen.ts). No se indexa: es un paso, no una página.
// =============================================================================

import type { Metadata } from 'next';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import { CSS_ACELERADOR, FUENTES_ACELERADOR } from '../estilo';
import { BarraAccelerator, CSS_BARRA_ACCELERATOR, RUTA_VER_PLANES } from '../Barra';
import { PieGlobal } from '../../vsl/_sitio/Barra';
import { CSS_APLICAR } from './estilo';
import { CLAVES_ORIGEN, origenDeLaUrl } from './origen';
import { FormularioAplicacion } from './FormularioAplicacion';

const TITULO = `Aplica a ${PROGRAMA_ACELERADOR.nombre}`;
const DESCRIPCION = 'Cuéntame de tu negocio en unos 5 minutos. Leo cada aplicación personalmente.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  robots: { index: false, follow: false },
  // Completa, porque el `openGraph` de una página REEMPLAZA al del layout (como en /accelerator).
  openGraph: {
    type: 'website',
    siteName: 'MaKo',
    title: TITULO,
    description: DESCRIPCION,
    images: [{ url: '/og-mako.jpg', width: 1200, height: 630, alt: 'MaKo' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-mako.jpg'] },
};
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AplicarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const origen = origenDeLaUrl(await searchParams);
  return (
    <>
      <div className="acl-root apl-root">
        <style dangerouslySetInnerHTML={{ __html: CSS_ACELERADOR + CSS_BARRA_ACCELERATOR + CSS_APLICAR }} />
        <link rel="stylesheet" href={FUENTES_ACELERADOR} precedence="default" />
        {/* «El programa» y no «Ver el programa»: con el nombre del programa al lado, de 320 a 430 px no entraba en un renglón
            (medido el 16/11/2026). Vuelve a la landing; con borde, para que no compita con el formulario (./estilo.ts). */}
        <BarraAccelerator boton={{ href: '/accelerator', texto: 'El programa' }} />
        <main className="apl-main">
          <noscript><p className="apl-sinjs">Para enviar tu aplicación, activa JavaScript en tu navegador.</p></noscript>
          <FormularioAplicacion origen={origen} clavesOrigen={CLAVES_ORIGEN} rutaPlanes={RUTA_VER_PLANES} />
        </main>
      </div>
      <PieGlobal />
    </>
  );
}
