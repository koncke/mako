// =============================================================================
// /conocimientos — Portal interno de formación (SuperAdmin). Curso AVATARHYPE.
// =============================================================================
// Solo admin (mismo patrón que /modelos-ia). Se ve como una pestaña del shell de
// admin (ADMIN_NAV en app/_components/nav.ts) y renderiza un portal oscuro
// autocontenido tipo "área de alumnos". noindex: material de formación interno.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import Conocimientos from './Conocimientos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Conocimientos — Curso AVATARHYPE',
  description: 'Formación interna: generación de imagen y video con IA (curso AVATARHYPE).',
  robots: { index: false, follow: false },
};

export default async function ConocimientosPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/');
  return <Conocimientos />;
}
