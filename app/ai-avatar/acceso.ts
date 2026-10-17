// =============================================================================
// Quién puede abrir AI Avatar — hoy, sólo el super admin
// =============================================================================
// La tab nace el 17/10/2026 y la ve sólo el super admin hasta que Martín la
// valide, igual que el Video Editor hasta el 12/10. El día que se abra, cambia
// ESTA función (y el `adminOnly` de nav.ts): la usan las cuatro pantallas y las
// server actions, para que el acceso se decida en un solo lugar.
//
// ⚠️ NO es `requireRolWs([], { nav })`: esa puerta deja pasar al admin de CADA
// workspace (rol 'admin'), que es justo lo que todavía no se quiere. El guard de
// «sólo la agencia» es `getSesionAdmin()` (lib/tab-access.ts lo dice).

import 'server-only';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';

/** ¿Quien mira puede usar AI Avatar? Para las actions (no redirige). */
export async function veAiAvatar(): Promise<boolean> {
  return !!(await getSesionAdmin());
}

/** El guard de las pantallas de la tab. */
export async function requireAiAvatar(): Promise<void> {
  if (!(await veAiAvatar())) redirect(await rutaConWs('/inicio'));
}
