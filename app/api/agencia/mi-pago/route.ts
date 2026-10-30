// =============================================================================
// /api/agencia/mi-pago — el cartel de pago de un cliente de agencia que paga su propia cuenta (25/10/2026)
// =============================================================================
// Agency Dashboard (docs/feedback-25-10-tarde.md punto 9): la agencia abre la cuenta y elige que la pague su cliente;
// «al finalizar el onboarding de ese cliente debe saltar el cartel de pago». GET: lo que el cartel dibuja, o null. Lo
// arma `cartelDelCliente` (lib/agency.ts), con las reglas de lib/agency-reglas.ts.
//
// ⚠️ EL NEGOCIO ES EL PROPIO DE LA SESIÓN (`sesion.ws`), como /api/plan/pagar: el que paga es el admin de ESA cuenta. Ni
// el super admin (no es su plata) ni una agencia mirando la cuenta (su sesión es la de la agencia, no la del cliente).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { cartelDelCliente } from '@/lib/agency';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getUsuarioActual();
  if (!s || s.legacy || s.rol === 'admin' || s.ws == null || (s.rolWs ?? 'admin') !== 'admin') return Response.json({ cartel: null });
  return Response.json({ cartel: await cartelDelCliente(Number(s.ws)) });
}
