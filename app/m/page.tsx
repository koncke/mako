// =============================================================================
// /m — sólo REPARTE: la home de MaKo Mobile es el Ops Center desde el 20/10/2026 (antes /m/hoy)
// =============================================================================
// ⚠️ NO ES LA HOME, a propósito: Next redirige /m/ → /m (trailingSlash false), así
// que la URL pelada no queda dentro de un scope que termine en barra, y un
// `start_url` o un link de push a /m rebotaría. /inicio manda acá a los teléfonos
// y esto decide: onboarding sin terminar → /m/configurar (lo hace el guard); el
// resto → el Ops Center.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_OPS_CENTER_M, puedeVerKey } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function MovilReparte() {
  const ctx = await requireMovil();
  // El Ops Center es la tab principal (20/10/2026); quien no lo ve (no debería pasar: lo ven los tres roles) va al Dashboard.
  redirect(await rutaConWs(puedeVerKey('mako', ctx.rol, ctx.capa) ? RUTA_OPS_CENTER_M : HOME_MOVIL));
}
