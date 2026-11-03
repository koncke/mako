// =============================================================================
// Quién puede abrir AI Avatar — el admin de cualquier negocio, en los tres planes (y la plataforma)
// =============================================================================
// Nació el 17/10/2026 sólo para el super admin (la sesión de la agencia), hasta que Martín la validara. El 29/10/2026 la
// abrió a TODOS: «haz que AI-Avatar esté disponible para todos» (Esencial, Pro y Acelerador; ya no está en TABS_SOLO_PRO).
// La puerta es la de toda tab (sesión, capa, rol y onboarding: `requireRolWs`), como el Video Editor. La usan las pantallas y
// las server actions, para que el acceso se decida en un solo lugar.
// ⚠️ Generar pide cosas que son de la persona y no de su plan (la extensión de MaKo en Chrome, su cuenta de Google Flow, sus
//    créditos y una foto de su cara): la pantalla las lista paso a paso antes de «Generar» (lib/ai-avatar/requisitos.ts).

import 'server-only';
import { requireRolWs } from '@/lib/tab-access';
import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';

/** ¿Quien mira puede usar AI Avatar? Para las actions (no redirige): el admin, con la tab en su capa. */
export async function veAiAvatar(): Promise<boolean> {
  if ((await getRolWsEfectivo()) !== 'admin') return false;
  return tabEnCapa('ai-avatar', await getCapaActual());
}

/** El guard de las pantallas: lo de toda tab (sesión, capa, rol y onboarding). */
export async function requireAiAvatar(): Promise<void> {
  await requireRolWs([], { nav: 'ai-avatar' });
}
