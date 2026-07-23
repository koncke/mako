// =============================================================================
// /api/plan-propuesta — aplicar o descartar un borrador de tareas de MaKo (mig 0094)
// =============================================================================
// POST { action: 'aplicar'|'descartar', id, tareas? }
//   aplicar  → crea las tareas (con el Perro) y marca la propuesta 'aplicada'.
//   descartar→ marca 'descartada'.
// Guardado a SUPER-ADMIN: el board del /plan es de la agencia (OWNER_WS lo fuerza la capa).

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { aplicarPropuesta, descartarPropuesta, profundizarPropuesta, type PropuestaTarea } from '@/lib/plan-propuesta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120; // aplicar corre el Perro (varias pasadas)

export async function POST(req: NextRequest) {
  // Sesión válida alcanza: NO alcanza con ser admin de la PLATAFORMA. Todo lo que hace
  // esta ruta (getPropuesta/aplicar/profundizar) está scopeado al workspace del request,
  // así que nadie toca borradores de otro. Con getSesionAdmin() un admin-cliente entraba
  // al wizard, contestaba todas las preguntas y comía 403 justo al apretar "Crear" —
  // el cliente literalmente no podía terminar el flujo.
  if (!(await getUsuarioActual())) return NextResponse.json({ ok: false, error: 'sin sesión' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const action = String(body.action ?? '');
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });

  try {
    if (action === 'aplicar') {
      const tareas = Array.isArray(body.tareas) ? (body.tareas as PropuestaTarea[]) : undefined;
      const eliminarIds = Array.isArray(body.eliminarIds) ? (body.eliminarIds as unknown[]).map(String) : undefined;
      const contexto = typeof body.contexto === 'string' ? body.contexto : undefined;
      const r = await aplicarPropuesta(id, tareas, eliminarIds, contexto);
      if (!r) return NextResponse.json({ ok: false, error: 'No existe la propuesta.' }, { status: 404 });
      return NextResponse.json(r);
    }
    if (action === 'profundizar') {
      // Formularios DINÁMICOS: con las respuestas dadas, MaKo genera 0-3 repreguntas de
      // contexto (nunca prioridad). El wizard las inserta antes de aplicar.
      const respuestas = Array.isArray(body.respuestas)
        ? (body.respuestas as unknown[]).map((r) => { const o = (r ?? {}) as Record<string, unknown>; return { pregunta: String(o.pregunta ?? ''), respuesta: String(o.respuesta ?? '') }; })
        : [];
      const preguntas = await profundizarPropuesta(id, respuestas);
      return NextResponse.json({ ok: true, preguntas });
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
