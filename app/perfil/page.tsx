// =============================================================================
// /perfil — perfil del usuario + preferencias de notificaciones
// =============================================================================

import { Suspense } from 'react';
import { PerfilTabs } from './PerfilTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PerfilPage() {
  // PerfilTabs usa useSearchParams (?tab=…) → Suspense evita el error de prerender.
  return (
    <Suspense fallback={null}>
      <PerfilTabs />
    </Suspense>
  );
}
