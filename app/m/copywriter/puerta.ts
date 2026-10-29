import 'server-only';

// =============================================================================
// /m/copywriter — la segunda puerta de las pantallas del teléfono: hoy, sólo el super admin
// =============================================================================
// El molde de app/m/ai-avatar/puerta.ts: `requireMovil({ navKey: 'copywriter' })` en cada page (la sesión, el onboarding,
// la capa) y después ésta, con el MISMO `veCopywriter` de escritorio (app/copywriter/acceso.ts). El día que Martín abra
// la tab, cambia esa función y el teléfono la sigue solo. Se va a la casa del teléfono: un redirect de /m que sale a
// escritorio saca a la persona de la app.
// =============================================================================

import { redirect } from 'next/navigation';
import { veCopywriter } from '@/app/copywriter/acceso';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';

export async function requireCopywriterM(): Promise<void> {
  if (!(await veCopywriter())) redirect(await rutaConWs(HOME_MOVIL));
}
