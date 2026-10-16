// =============================================================================
// GET /api/flujos/anticipacion — con cuánta anticipación se puede agendar hoy (16/10/2026)
// =============================================================================
// Lo pide el lienzo de Automations para avisar en la tarjeta de una espera «antes de la reunión» que no llega a salir
// (Martín: «si MaKo sabe por la API que el evento permite agendar con poca anticipación (por ejemplo 3 h), el delay
// "1 día antes" lo advierte»). Lo mismo que `anticipacion_agenda` de la API de MaKo (lib/agenda-anticipacion.ts).
// Sólo el admin del workspace, como el catálogo de acciones (app/api/flujos/acciones/route.ts).
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { anticipacionDeLaAgenda } from '@/lib/agenda-anticipacion';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return Response.json({ ok: false, error: 'Entra al workspace de un cliente.' }, { status: 400 });
  if (rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const r = await anticipacionDeLaAgenda(ws);
  if (!r.ok) console.error('[api/flujos/anticipacion]', r.error);
  return Response.json(r);
}
