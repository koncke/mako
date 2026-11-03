// =============================================================================
// copywriter/puerta — quién pasa la puerta del Copywriter: desde el 29/10/2026, todos los negocios
// =============================================================================
// La tab nació el 28/10/2026 sólo para el super admin «hasta que Martín la valide». El 29/10 Martín pidió que Copywriting
// SEA esto («quiero que Copywriter sea una réplica de Notion… y NO quiero otras tabs internas que hoy aparecen en la
// topbar»): la tab Copywriting de todos los negocios abre el Copywriter, así que la puerta se abre. Quién entra lo decide
// la pregunta de toda tab, en la página y en las rutas (`requireRolWs` / `soloAdminDeTab`: rol y capa).
// La regla sigue en UN lugar, en lib, porque la usan las pantallas (app/copywriter/acceso.ts la re-exporta) Y las rutas
// del chat que guardan o listan las charlas de una página (/api/hilo-de-tab, /api/chart-insights, el Ops Center, el doer):
// si hubiera que volver a cerrarla, se cambia ESTA función y la de la API de MaKo (lib/copywriter/puerta-api.ts).
// =============================================================================

import 'server-only';
import { getUsuarioActual } from '../auth';

/** ¿Quien pide puede usar el Copywriter (y ver sus charlas)? Toda persona con sesión; el rol y la capa los mira la tab. */
export async function veCopywriter(): Promise<boolean> {
  return !!(await getUsuarioActual().catch(() => null));
}
