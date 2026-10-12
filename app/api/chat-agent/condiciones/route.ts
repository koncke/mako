// =============================================================================
// API: los CATÁLOGOS del editor de la condición (app/automations/EditorCondicion.tsx)
// =============================================================================
// GET → { ok, cursos: CursoCondicion[], posts: [{ id, titulo }], campanas: string[], reuniones: ReunionesDeEmbudo[] | null }
//
// La LECTURA vive en lib/condiciones-catalogo-datos.ts (`catalogosRemotos`, duodécima tanda, 12/10/2026): la usa
// también «Crear con IA» (`armarContexto`, lib/flujo-ia-crear.ts), para que el modelo vea el MISMO catálogo que este
// editor. Acá quedan el guard y la respuesta.
//
// `reuniones` (cuarta tanda, punto 5): las etapas de REUNIÓN de cada embudo, en su orden. `null` = no se pudo leer
// (no «no hay»): el editor igual ofrece la condición para cualquier reunión.
//
// Guard: admin del workspace, como el resto de /api/chat-agent: es lo que arma las automatizaciones.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { catalogosRemotos } from '@/lib/condiciones-catalogo-datos';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace arma las automatizaciones.' }, { status: 403 });
  }
  try {
    const { cursos, posts, campanas, reuniones } = await catalogosRemotos();
    return Response.json({ ok: true, cursos, posts, campanas, reuniones });
  } catch (e) {
    console.error(`[api:chat-agent/condiciones GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
