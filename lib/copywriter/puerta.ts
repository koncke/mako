// =============================================================================
// copywriter/puerta — quién pasa la puerta del Copywriter (hoy, sólo el super admin)
// =============================================================================
// La regla en UN lugar, en lib para que la usen las pantallas (app/copywriter/acceso.ts la re-exporta) Y las rutas del
// chat que guardan o listan las charlas de un guion (/api/hilo-de-tab, /api/chart-insights, el Ops Center, el doer):
// verificación del Cerebro del 28/10/2026, «el chat de MaKo de un guion lo ve y lo escribe el admin del negocio aunque la
// tab sea sólo del super admin». El día que Martín abra la tab, cambia ESTA función (y la de la API de MaKo,
// lib/copywriter/puerta-api.ts).
// ⚠️ NO alcanza con ser admin del negocio (`requireRolWs`): el guard de «sólo la agencia» es `getSesionAdmin()`.
// =============================================================================

import 'server-only';
import { getSesionAdmin } from '../auth';

/** ¿Quien pide puede usar el Copywriter (y ver sus charlas)? */
export async function veCopywriter(): Promise<boolean> {
  return !!(await getSesionAdmin());
}
