// =============================================================================
// /m — sólo REPARTE: la home de MaKo Mobile es /m/hoy
// =============================================================================
// ⚠️ NO ES LA HOME, a propósito: Next redirige /m/ → /m (trailingSlash false), así
// que la URL pelada no queda dentro de un scope que termine en barra, y un
// `start_url` o un link de push a /m rebotaría. /inicio manda acá a los teléfonos
// y esto decide: onboarding sin terminar → /m/configurar (lo hace el guard); el
// resto → Today.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function MovilReparte() {
  await requireMovil();
  redirect(await rutaConWs(HOME_MOVIL));
}
