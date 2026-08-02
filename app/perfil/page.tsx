// =============================================================================
// /perfil — perfil del usuario + preferencias de notificaciones
// =============================================================================

import { Suspense } from 'react';
import { requireRolWs } from '@/lib/tab-access';
import { PerfilTabs } from './PerfilTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PerfilPage() {
  // Sin guard esta página se abría con la sesión sola: la veía un usuario
  // suspendido con la cookie viva, y también uno con el onboarding a medias.
  await requireRolWs([]);
  // PerfilTabs usa useSearchParams (?tab=…) → Suspense evita el error de prerender.
  return (
    <Suspense fallback={null}>
      <PerfilTabs />
    </Suspense>
  );
}
