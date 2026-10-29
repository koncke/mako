// =============================================================================
// copywriter/puerta-api — la puerta del Copywriter para la API de MaKo (lib/api-mako/areas/copywriter.run.ts)
// =============================================================================
// La pantalla se cierra con `veCopywriter` (app/copywriter/acceso.ts: sólo el super admin). En la API no hay una sesión
// que preguntar (un token, el grupo de WhatsApp) y su gating mira la CAPA del negocio, que en `completo` ve todas las
// tabs: sin esto, cualquier negocio usaba por WhatsApp o por /api/v1 lo que su pantalla todavía no tiene. Mientras la tab
// sea sólo del super admin, la API anda sólo en el negocio de la plataforma (el de MaKo). El día que Martín la abra, se
// abren las DOS (ésta y acceso.ts). Aparte de acceso.ts para que los runners no carguen next/navigation.
// =============================================================================

import 'server-only';
import { wsSuperAdmin } from '../workspace';

export async function veCopywriterEnApi(ws: number): Promise<boolean> {
  return ws === (await wsSuperAdmin().catch(() => null));
}
