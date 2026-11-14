// =============================================================================
// /vsl/comparaciones/<app> — «MaKo vs X», como las subpáginas de https://www.beehiiv.com/comparisons (14/11/2026)
// =============================================================================
// Martín (14/11/2026): las tarjetas «MaKo vs tal cosa» abajo de la comparación. Cada una lleva acá: el hero con los dos logos,
// «Elige X si / Elige MaKo si», el comentario, la tabla de las dos y las demás tarjetas. Los datos (con su fuente):
// app/vsl/_sitio/competencia.ts. Fuera de los buscadores mientras es vista previa, como /vsl/comparaciones.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ComparacionVs } from '../../_sitio/Comparaciones';
import { COMPETIDORES, competidorDeSlug } from '../../_sitio/competencia';

export function generateStaticParams() {
  return COMPETIDORES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = competidorDeSlug((await params).slug);
  return {
    title: c ? `MaKo vs ${c.nombre}` : 'MaKo · Comparaciones',
    description: c ? `MaKo y ${c.nombre}, función por función: qué tiene cada una y para quién es cada una.` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ComparacionVsPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = competidorDeSlug((await params).slug);
  if (!c) notFound();
  return <ComparacionVs c={c} />;
}
