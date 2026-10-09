// =============================================================================
// API: los CATÁLOGOS del editor de la condición (app/chatbot/EditorCondicion.tsx)
// =============================================================================
// GET → { ok, cursos: CursoCondicion[], posts: [{ id, titulo }], campanas: string[] }
//
// Lo que las condiciones del catálogo (lib/condiciones-catalogo.ts) necesitan para elegir un valor
// y que ninguna otra ruta da junto: los cursos (productos con clases) con sus módulos y sus clases,
// los posts de la comunidad y las campañas de Meta de las que vinieron leads. Las etapas, los
// productos y las etiquetas ya los tiene el lienzo (los pasa por props).
//
// ⚠️ LO MISMO QUE LEE EL MOTOR, CON LAS MISMAS EXCLUSIONES: sin las clases de la papelera
// (`borrada_at`), sin los módulos borrados (`modulosDelCurso`) y sin los hilos de una clase en la
// comunidad (`clase_id`): ofrecer «Comentó el post X» sobre el hilo de una clase sería elegir algo
// que el motor cuenta distinto.
//
// Guard: admin del workspace, como el resto de /api/chat-agent: es lo que arma las automatizaciones.
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { listProductos } from '@/lib/productos';
import { COLUMNAS_CLASE, aClase } from '@/lib/curso-datos';
import { modulosDelCurso } from '@/lib/curso-modulos-datos';
import { tieneTarea } from '@/lib/curso';
import { armarCursos } from '@/lib/condiciones-catalogo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Cuántos posts se ofrecen: los más recientes. Una lista de 500 títulos no se elige, se busca. */
const TOPE_POSTS = 200;

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace arma las automatizaciones.' }, { status: 403 });
  }
  try {
    const db = await getTenantDb();
    const [productos, filasClase, postsRes, campanasFilas] = await Promise.all([
      listProductos(),
      leerTodo<Parameters<typeof aClase>[0] & { id: number }>(db, 'curso_clases', COLUMNAS_CLASE, {
        orden: 'id', filtros: (q) => q.is('borrada_at', null),
      }),
      db.from('comunidad_posts').select('id, titulo, cuerpo').is('clase_id', null)
        .order('created_at', { ascending: false }).limit(TOPE_POSTS),
      leerTodo<{ id: number; meta_campaign_name: string | null }>(db, 'leads', 'id, meta_campaign_name', {
        orden: 'id', filtros: (q) => q.not('meta_campaign_name', 'is', null),
      }),
    ]);
    if (postsRes.error) throw new Error(`comunidad_posts: ${postsRes.error.message}`);
    const clases = filasClase.map(aClase);
    const conClases = [...new Set(clases.map((c) => c.productoId))];
    const modulos = new Map<number, Array<{ clave: string; nombre: string }>>();
    await Promise.all(conClases.map(async (id) => {
      const m = await modulosDelCurso(id);
      modulos.set(id, m.modulos.map((x) => ({ clave: x.clave, nombre: x.nombre })));
    }));
    const cursos = armarCursos(
      productos.map((p) => ({ id: Number(p.id), nombre: String(p.nombre ?? '') })),
      clases.map((c) => ({ id: c.id, productoId: c.productoId, etapa: c.etapa, orden: c.orden, titulo: c.titulo, tieneTarea: tieneTarea(c) })),
      modulos,
    );
    const posts = ((postsRes.data ?? []) as Array<{ id: number; titulo: string | null; cuerpo: string | null }>).map((p) => ({
      id: Number(p.id),
      titulo: (p.titulo?.trim() || p.cuerpo?.trim().slice(0, 60) || `Post ${p.id}`),
    }));
    const campanas = [...new Set(campanasFilas.map((f) => f.meta_campaign_name?.trim() ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    return Response.json({ ok: true, cursos, posts, campanas });
  } catch (e) {
    console.error(`[api:chat-agent/condiciones GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
