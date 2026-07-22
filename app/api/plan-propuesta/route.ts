// =============================================================================
// /api/plan-propuesta — aplicar o descartar un borrador de tareas de MaKo (mig 0094)
// =============================================================================
// POST { action: 'aplicar'|'descartar', id, tareas? }
//   aplicar  → crea las tareas (con el Perro) y marca la propuesta 'aplicada'.
//   descartar→ marca 'descartada'.
// Guardado a SUPER-ADMIN: el board del /plan es de la agencia (OWNER_WS lo fuerza la capa).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { aplicarPropuesta, descartarPropuesta, type PropuestaTarea } from '@/lib/plan-propuesta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120; // aplicar corre el Perro (varias pasadas)

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  try {
    if (action === 'aplicar') {
      const tareas = Array.isArray(body.tareas) ? (body.tareas as PropuestaTarea[]) : undefined;
      const r = await aplicarPropuesta(id, tareas);
      if (!r) return NextResponse.json({ ok: false, error: 'No existe la propuesta.' }, { status: 404 });
      return NextResponse.json(r);
    }
    if (action === 'descartar') {
      const ok = await descartarPropuesta(id);
      return NextResponse.json({ ok });
    }
    return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
