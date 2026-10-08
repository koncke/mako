// =============================================================================
// /conocimientos — Portal interno de formación (SuperAdmin). Curso AVATARHYPE.
// =============================================================================
// Solo admin (mismo patrón que /modelos-ia). Se ve como una pestaña del shell de
// admin (ADMIN_NAV en app/_components/nav.ts) y renderiza un portal oscuro
// autocontenido tipo "área de alumnos". noindex: material de formación interno.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { leerAjustesConError } from '@/lib/conocimiento-ajustes-datos';
import Conocimientos from './Conocimientos';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Conocimientos — Curso AVATARHYPE',
  description: 'Formación interna: generación de imagen y video con IA (curso AVATARHYPE).',
  robots: { index: false, follow: false },
};

export default async function ConocimientosPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect(await rutaConWs('/inicio'));
  // Lo que el super admin le cambió a los cursos (mig 0221), de TODOS: el catálogo viaja entero al
  // navegador, así que las filas viajan con él y se aplican allá. Si la lectura falla se dice, y la
  // pantalla no ofrece editar encima de algo que no se ve.
  const { filas, error } = await leerAjustesConError();
  // useSearchParams (routing por URL en el client) necesita un Suspense boundary.
  return (
    <Suspense fallback={null}>
      {/* ⚠️ QUIÉN EDITA SE DECIDE ACÁ, en el server: la pantalla no lo vuelve a preguntar (y cada
          acción de escritura sí, adentro: ./ajustes-actions.ts). */}
      <Conocimientos ajustes={filas} errorAjustes={error} puedeEditar={!!admin} />
    </Suspense>
  );
}
