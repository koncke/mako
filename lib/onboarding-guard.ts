// =============================================================================
// onboarding-guard — quién puede hacer el onboarding, y sobre qué workspace
// =============================================================================
// La comparten las dos rutas del arranque (/api/onboarding y /api/onboarding/arranque): con una copia por
// ruta, la segunda se queda vieja (AGENTS.md, «Una cosa, un lugar»).
//
// Sólo el ADMIN del negocio (o el super admin mirándolo). El workspace sale de `getWorkspaceActual()`,
// nunca de la URL. Hasta el 17/10/2026 el super admin SIN mirar a nadie operaba sobre OWNER_WS, que es
// el ws1 de Mauricio, un cliente: ahora, sin workspace, nadie (el único admin de plataforma tiene uno).

import 'server-only';
import { getRolWsEfectivo, getWorkspaceActual } from './workspace';

export async function wsDelOnboarding(): Promise<{ ws: number } | { error: string; status: number }> {
  const [wsActual, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (rol !== 'admin') return { error: 'Solo el admin puede hacer el onboarding.', status: 403 };
  const ws = wsActual;
  if (ws == null) return { error: 'Solo el admin del cliente puede hacer el onboarding.', status: 403 };
  return { ws };
}
