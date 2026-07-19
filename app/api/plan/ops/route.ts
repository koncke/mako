// =============================================================================
// /api/plan/ops — cola de operaciones para el board de la agencia (localStorage)
// =============================================================================
// GET: operaciones (completar/editar/reasignar/repriorizar/borrar) que Claude Code o
// MaKo dejaron para el board del dueño. NO la vacía: cada browser la aplica una vez con
// su propio 'seen'. Solo super-admin SIN impersonar (mismo gate que /plan/agencia).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { leerOps } from '@/lib/plan-ops';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin' || (await estaImpersonando())) {
    return Response.json({ ok: false, ops: [] }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, ops: await leerOps() });
  } catch (e) {
    console.error('[api:plan/ops]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, ops: [] }, { status: 500 });
  }
}
