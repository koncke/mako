// =============================================================================
// onboarding-guard — quién puede hacer el onboarding, y sobre qué workspace
// =============================================================================
// La comparten las dos rutas del arranque (/api/onboarding y /api/onboarding/arranque): con una copia por
// ruta, la segunda se queda vieja (AGENTS.md, «Una cosa, un lugar»).
//
// Sólo el ADMIN del negocio (o el super admin mirándolo). El super admin SIN mirar a nadie opera sobre
// OWNER_WS, como el resto del onboarding (Mauricio usa MaKo para su negocio). El workspace sale de
// `getWorkspaceActual()`, nunca de la URL.

import 'server-only';
import { getSesionAdmin } from './auth';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS } from './workspace';

export async function wsDelOnboarding(): Promise<{ ws: number } | { error: string; status: number }> {
  const [wsActual, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (rol !== 'admin') return { error: 'Solo el admin puede hacer el onboarding.', status: 403 };
  const ws = wsActual ?? ((await getSesionAdmin()) ? OWNER_WS : null);
  if (ws == null) return { error: 'Solo el admin del cliente puede hacer el onboarding.', status: 403 };
  return { ws };
}
