// =============================================================================
// condiciones-catalogo-datos — la LECTURA de los catálogos de las condiciones (server-only)
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.3): se mudó de app/api/chat-agent/condiciones/route.ts
// para que la usen DOS lectores con el mismo resultado: la ruta (el editor de la condición la pide por GET) y
// `armarContexto` (lib/flujo-ia-crear.ts: lo que ve «Crear con IA»). Con dos lecturas, la IA ofrecería otra cosa
// que el desplegable.
//
// Lo que las condiciones del catálogo (lib/condiciones-catalogo.ts) necesitan para elegir un valor y que ninguna otra
// lectura da junto: los cursos (productos con clases) con sus módulos y sus clases, los posts de la comunidad, las
// campañas de Meta de las que vinieron leads y las etapas de REUNIÓN de cada embudo. Las etapas, los productos y las
// etiquetas ya los tiene quien llama.
//
// `reuniones` (cuarta tanda, punto 5) va APARTE del resto: si los embudos no se pueden leer, `null` («no se pudo
// leer», no «no hay») y el editor igual ofrece la condición para cualquier reunión; los cursos y los posts no se caen
// por eso.
//
// ⚠️ LO MISMO QUE LEE EL MOTOR, CON LAS MISMAS EXCLUSIONES: sin las clases de la papelera (`borrada_at`), sin los
// módulos borrados (`modulosDelCurso`) y sin los hilos de una clase en la comunidad (`clase_id`): ofrecer «Comentó el
// post X» sobre el hilo de una clase sería elegir algo que el motor cuenta distinto.
//
// ⚠️ LEE EL WORKSPACE DEL CONTEXTO (`getTenantDb`): quien llama sin cookies (la API de MaKo) va dentro de
// `runWithWorkspace`. Tira si algo de lo que no es la reunión falla: quien llama decide (la ruta contesta 500, la IA
// sigue sin lo remoto, como el editor).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { listProductos } from '@/lib/productos';
import { COLUMNAS_CLASE, aClase } from '@/lib/curso-datos';
import { modulosDelCurso } from '@/lib/curso-modulos-datos';
import { tieneTarea } from '@/lib/curso';
import { armarCursos, reunionesParaEditor, type ReunionesDeEmbudo } from '@/lib/condiciones-catalogo';
import { leerFunnels, getFunnelDe, getFunnelDefault } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import type { CatalogosRemotos } from '@/lib/condiciones-catalogos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Cuántos posts se ofrecen: los más recientes. Una lista de 500 títulos no se elige, se busca. */
const TOPE_POSTS = 200;

/**
 * Las etapas de reunión de cada embudo activo, con el MISMO camino que las opciones de una acción
 * (app/api/flujos/opciones/route.ts): el default por `getFunnelDefault` y el resto por id. Una lectura
 * fallida devuelve el pipeline de FÁBRICA, y ofrecer sus reuniones sería ofrecer etapas que este
 * negocio quizás no tiene: `null`.
 */
async function reunionesPorEmbudo(): Promise<ReunionesDeEmbudo[] | null> {
  const funnels = await leerFunnels();
  if (!funnels) return null;
  const embudos: Array<{ funnelId: number; nombre: string; stages: Array<{ key: string; label?: string; kind?: string }> }> = [];
  for (const f of funnels) {
    const cfg = f.esDefault ? await getFunnelDefault() : await getFunnelDe(f.id);
    if (cfg.origen === 'error') return null;
    embudos.push({ funnelId: f.id, nombre: nombreVisible(f), stages: cfg.stages });
  }
  return reunionesParaEditor(embudos);
}

/** Los catálogos remotos del editor de la condición, del workspace del contexto. */
export async function catalogosRemotos(): Promise<CatalogosRemotos> {
  const db = await getTenantDb();
  const [productos, filasClase, postsRes, campanasFilas, reuniones] = await Promise.all([
    listProductos(),
    leerTodo<Parameters<typeof aClase>[0] & { id: number }>(db, 'curso_clases', COLUMNAS_CLASE, {
      orden: 'id', filtros: (q) => q.is('borrada_at', null),
    }),
    db.from('comunidad_posts').select('id, titulo, cuerpo').is('clase_id', null)
      .order('created_at', { ascending: false }).limit(TOPE_POSTS),
    leerTodo<{ id: number; meta_campaign_name: string | null }>(db, 'leads', 'id, meta_campaign_name', {
      orden: 'id', filtros: (q) => q.not('meta_campaign_name', 'is', null),
    }),
    reunionesPorEmbudo().catch((e: unknown) => { console.error(`[condiciones-catalogo-datos] reuniones: ${msg(e)}`); return null; }),
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
  return { cursos, posts, campanas, reuniones };
}
