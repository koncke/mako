// =============================================================================
// /api/plan/inbox — la BANDEJA de tareas del board de la agencia (localStorage)
// =============================================================================
// GET: devuelve las tareas que MaKo dejó por WhatsApp para el board del dueño. NO la
// vacía: cada browser del dueño (celu, desktop) la mergea UNA vez con su propio
// 'seen' guardado en localStorage — así la tarea llega a TODOS sus dispositivos y no
// se pierde si un browser la lee y no persiste. Los items viejos caducan por TTL.
// Solo el super-admin SIN impersonar (mismo gate que /plan/agencia).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { leerBandeja } from '@/lib/plan-inbox';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  // Mismo gate que /plan/agencia: dueño (admin) y sin estar entrando como un cliente.
  if (!sesion || sesion.rol !== 'admin' || (await estaImpersonando())) {
    return Response.json({ ok: false, tareas: [] }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, tareas: await leerBandeja() });
  } catch (e) {
    console.error('[api:plan/inbox]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, tareas: [] }, { status: 500 });
  }
}
