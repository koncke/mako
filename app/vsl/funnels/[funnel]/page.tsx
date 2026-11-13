// =============================================================================
// /vsl/funnels/<funnel> — la mini landing de un funnel: cómo se arma en MaKo (13/11/2026)
// =============================================================================
// La llamada de Martín con Leila (13/11/2026): «mini landings por funnel: cómo se hace en MaKo un VSL, un WhatsApp, Instagram con
// lead magnet y YouTube». El contenido vive en app/vsl/_sitio/funnels-datos.ts; el molde es el del sitio (barra, pie y estilos de
// app/vsl/_sitio), como la portada nueva. Fuera de los buscadores mientras el sitio sea vista previa, como /vsl/sitio.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BrandDefs } from '@/app/_components/ServicioVisual';
import { Barra } from '../../_sitio/Barra';
import { Pie } from '../../_sitio/Pie';
import { CSS_BARRA, CSS_BASE, CSS_PIE, CSS_PORTADA } from '../../_sitio/estilos';
import { CSS_FUNNELS, PaginaFunnel } from '../../_sitio/Funnels';
import { FUNNELS_SITIO, funnelPorId } from '../../_sitio/funnels-datos';

type Props = { params: Promise<{ funnel: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return FUNNELS_SITIO.map((f) => ({ funnel: f.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const f = funnelPorId((await params).funnel);
  if (!f) return {};
  return { title: `MaKo · ${f.titulo.replace(/\.$/, '')}`, description: f.bajada, robots: { index: false, follow: false } };
}

export default async function FunnelPage({ params }: Props) {
  const f = funnelPorId((await params).funnel);
  if (!f) notFound();
  return (
    <div className="s-sitio">
      <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_BARRA + CSS_PIE + CSS_PORTADA + CSS_FUNNELS }} />
      <BrandDefs />
      <Barra />
      <main><PaginaFunnel f={f} /></main>
      <Pie />
    </div>
  );
}
