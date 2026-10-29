// =============================================================================
// Quién puede abrir el Copywriter — hoy, sólo el super admin (el molde de app/ai-avatar/acceso.ts)
// =============================================================================
// La tab nace el 28/10/2026 y la ve sólo el super admin hasta que Martín la valide (el encargo: «Al principio, sólo la
// ve el super admin (adminOnly) hasta que Martín la valide»). El día que se abra, cambia ESTA función (y el `adminOnly`
// de nav.ts): la usan las páginas de escritorio, las del teléfono y las rutas /api, así el acceso se decide en un lugar.
//
// ⚠️ NO alcanza con `requireRolWs([], { nav })`: esa puerta deja pasar al admin de CADA workspace, y `adminOnly` sólo
// esconde la fila de la barra (AGENTS.md, «Un flag de visibilidad protege la PANTALLA; la API hay que cerrarla
// aparte»). El guard de «sólo la agencia» es `getSesionAdmin()`.

import 'server-only';
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
// La regla vive en lib (`getSesionAdmin()`), para que también la usen las rutas del chat que guardan y listan las charlas
// de un guion (verificación del Cerebro del 28/10/2026). Acá se re-exporta: las pantallas y las rutas /api la importan de acá.
import { veCopywriter } from '@/lib/copywriter/puerta';

/** ¿Quien mira puede usar el Copywriter? Para las rutas (no redirige). */
export { veCopywriter };

// La puerta de la API de MaKo (donde no hay sesión que preguntar) vive en lib/copywriter/puerta-api.ts: el día que se
// abra la tab, se abren las DOS.

/** El guard de las pantallas de escritorio. */
export async function requireCopywriter(): Promise<void> {
  if (!(await veCopywriter())) redirect(await rutaConWs('/inicio'));
}
