// =============================================================================
// /api/plan/snapshot — PlanBoard empuja su foto (proyectos + tareas abiertas)
// =============================================================================
// El board del super-admin vive en localStorage; el servidor no lo ve. PlanBoard
// POSTea acá una foto liviana para que MaKo (por WhatsApp) pueda auto-asignar
// proyecto y deduplicar. Solo el dueño SIN impersonar (mismo gate que /plan/agencia).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { guardarSnapshot, type SnapProyecto, type SnapTarea } from '@/lib/plan-snapshot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion || sesion.rol !== 'admin' || (await estaImpersonando())) {
    return Response.json({ ok: false }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { proyectos?: SnapProyecto[]; tareas?: SnapTarea[] };
    await guardarSnapshot({ proyectos: Array.isArray(body.proyectos) ? body.proyectos : [], tareas: Array.isArray(body.tareas) ? body.tareas : [] });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[api:plan/snapshot]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false }, { status: 500 });
  }
}
