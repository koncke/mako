// =============================================================================
// /vsl/<slug> — una landing de MaKo hecha en Web Generator (una por funcionalidad o por avatar)
// =============================================================================
// Pedido de Martín (23/10/2026, de sus audios): para el 25/10, «todas las landings de cada funcionalidad o cada
// avatar para vender MaKo», hechas en Web Generator desde la principal. Se editan y se publican ahí (documentos
// del workspace de la plataforma) y esta ruta dibuja su foto publicada en hola-mako.com, con la misma capa que la
// portada (app/vsl/Landing.tsx): el Píxel de Meta de MaKo, el «volver a la card» y el script del diseño.
//
// Las 24 páginas de funcionalidad que ya viven en /vsl/<slug> son rutas FIJAS y les ganan a ésta (Next resuelve
// primero la fija): un documento con el slug de una de ellas no se ve acá (sí en hola-mako.site).
// Un slug que no es una landing de MaKo publicada es un 404.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Portada } from '../Portada';
import { disenoDeLanding, landingMako } from '@/lib/editor-landing/landing-mako';
import { planesParaLanding } from '@/lib/compra-plan';
import { BarraGlobal } from '../_sitio/Barra';

/**
 * LA BARRA DEL SITIO TAMBIÉN AQUÍ (12/11/2026, Martín: «cuando me voy a industrias como inmobiliarias, infoproductos, coaches,
 * desaparece la top bar de arriba. La top bar jamás debe desaparecer en ningún momento»). Estas páginas son documentos de Web
 * Generator: se dibujan en `.vsl-root`, una caja FIJA a pantalla completa con su propio scroll (app/vsl/Portada.tsx), y traen
 * su barra (el `<header>` del documento). La del sitio va arriba, la del documento se oculta, y la caja empieza debajo de la
 * barra: 76 px + su borde en la computadora, 56 px + su borde desde 1023 px (app/vsl/_sitio/estilos.ts, `.s-barra-in`).
 */
const CSS_BAJO_LA_BARRA = '.vsl-root{top:77px!important}@media (max-width:1023px){.vsl-root{top:57px!important}}';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await landingMako(slug);
  if (!l) return { title: 'MaKo' };
  const titulo = l.seoTitulo || l.titulo || 'MaKo';
  return {
    title: titulo,
    description: l.seoDescripcion || undefined,
    alternates: { canonical: `/vsl/${slug}` },
    openGraph: {
      type: 'website', siteName: 'MaKo', url: `/vsl/${slug}`, title: titulo, description: l.seoDescripcion || undefined,
      images: [{ url: '/og-landing.jpg', width: 1200, height: 630, alt: titulo }],
    },
    twitter: { card: 'summary_large_image', title: titulo, description: l.seoDescripcion || undefined, images: ['/og-landing.jpg'] },
  };
}

export default async function LandingDeMako({ params }: Props) {
  const { slug } = await params;
  const [diseno, planes] = await Promise.all([landingMako(slug).then(disenoDeLanding), planesParaLanding()]);
  if (!diseno) notFound();
  return (
    <>
      <BarraGlobal claro barraPropia=".vsl-root header" />
      <style dangerouslySetInnerHTML={{ __html: CSS_BAJO_LA_BARRA }} />
      <Portada diseno={diseno} conSuspense={false} planes={planes} landing={slug} />
    </>
  );
}
