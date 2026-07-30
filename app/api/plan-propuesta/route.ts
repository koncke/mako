// =============================================================================
// /api/plan-propuesta — aplicar o descartar un borrador de tareas de MaKo (mig 0094)
// =============================================================================
// POST { action: 'aplicar'|'descartar', id, tareas? }
//   aplicar  → crea las tareas (con el Perro) y marca la propuesta 'aplicada'.
//   descartar→ marca 'descartada'.
// Guardado a SUPER-ADMIN: el board del /plan es de la agencia (OWNER_WS lo fuerza la capa).

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { aplicarPropuesta, aplicarPropuestas, descartarPropuesta, profundizarPropuesta, listPropuestasPendientes, type PropuestaTarea } from '@/lib/plan-propuesta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// 300s: aplicar un borrador grande crea N tareas y después corre el Perro POR TANDAS.
// Con 120 y 69 tareas la función moría a mitad de camino: las tareas quedaban creadas,
// el borrador seguía "pendiente" (o sea, listo para duplicarlas) y el navegador recibía
// una página de error de Vercel en vez de JSON ("SyntaxError: Unexpected token 'A'").
export const maxDuration = 300;

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

  // Los borradores PENDIENTES del workspace del request. Lo pide el board al entrar
  // para saltarle el modal de confirmación (tareas que MaKo sacó de tu reunión, o que
  // te mandó otra persona). No lleva id: es un listado.
  if (action === 'pendientes') {
    try {
      const propuestas = await listPropuestasPendientes();
      return NextResponse.json({ ok: true, propuestas });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  // Confirmar VARIOS borradores de una (el modal del plan, cuando MaKo dejó más de una
  // reunión esperando). El Perro corre una sola vez sobre todo el lote.
  if (action === 'aplicar-lote') {
    try {
      const lotes = (Array.isArray(body.lotes) ? body.lotes : [])
        .map((l) => {
          const o = (l ?? {}) as Record<string, unknown>;
          return {
            id: String(o.id ?? ''),
            tareas: Array.isArray(o.tareas) ? (o.tareas as PropuestaTarea[]) : undefined,
            // Las de otras personas: NO se cargan, pero el borrador tiene que seguir
            // abierto con ellas adentro para poder repartirlas después.
            restantes: Array.isArray(o.restantes) ? (o.restantes as PropuestaTarea[]) : undefined,
            contexto: typeof o.contexto === 'string' ? o.contexto : undefined,
          };
        })
        .filter((l) => l.id);
      if (!lotes.length) return NextResponse.json({ ok: false, error: 'lotes requerido' }, { status: 400 });
      const r = await aplicarPropuestas(lotes);
      if (r.noExiste) return NextResponse.json({ ok: false, error: 'No existe la propuesta.' }, { status: 404 });
      return NextResponse.json(r);
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

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
