// =============================================================================
// editor-video/espejo-server — la copia de lectura de los proyectos del Video Editor (`video_editor_proyectos`, 0299)
// =============================================================================
// Las reglas viven en ./espejo.ts (puro, con test); acá sólo la base. La usan /api/video-editor/proyectos (el editor
// sube su copia y la borra al borrar el proyecto) y las lecturas de la API de MaKo (`listar_proyectos_video`,
// `ver_proyecto_video`), que corren con el workspace de su contexto.
//   · Guardar UNE las refs con las que ya había (`unirRefs`): el server no le cree al navegador, y una pestaña que no
//     llegó a leer las suyas no las borra.
//   · SIN TABLA (la migración todavía no se aplicó): `sinTabla`, y quien llama sigue sin la copia. Sólo la TABLA que
//     falta se tolera; una columna que falta es un error de verdad.
// =============================================================================

import 'server-only';
import { getTenantDb } from '../workspace';
import { unirRefs, type EspejoSubido, type FilaEspejo } from './espejo';

const TABLA = 'video_editor_proyectos';
const COLUMNAS_LISTA = 'proyecto_id, nombre, duracion, demasiado_grande, updated_at, editado_por';

/** La tabla no existe (PGRST205 de PostgREST, 42P01 de Postgres). */
const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

export type Falla = { ok: false; error: string; sinTabla?: true };
const falla = (e: { code?: string | null; message: string }): Falla =>
  faltaLaTabla(e) ? { ok: false, error: 'sin tabla', sinTabla: true } : { ok: false, error: e.message };

/** Las refs que ya tiene la copia de un proyecto (para que el editor no reuse ninguna). */
export async function refsDelEspejo(ws: number, proyecto: string): Promise<{ ok: true; refs: Array<[string, string]> } | Falla> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select('refs').eq('workspace_id', ws).eq('proyecto_id', proyecto).maybeSingle();
  if (error) return falla(error);
  return { ok: true, refs: unirRefs((data as { refs?: unknown } | null)?.refs ?? [], []) };
}

/** Sube la copia (alta o reemplazo), con las refs de antes unidas a las de ahora. Vuelve a la lista si estaba borrada. */
export async function guardarEspejo(ws: number, persona: string, e: EspejoSubido): Promise<{ ok: true } | Falla> {
  const previas = await refsDelEspejo(ws, e.proyecto);
  if (!previas.ok) return previas;
  const db = await getTenantDb();
  const { error } = await db.from(TABLA).upsert(
    {
      proyecto_id: e.proyecto,
      nombre: e.nombre,
      escena_id: e.escenaId,
      duracion: e.duracion,
      vista: e.vista,
      refs: unirRefs(previas.refs, e.refs),
      demasiado_grande: e.demasiadoGrande,
      editado_por: persona,
      updated_at: new Date().toISOString(),
      borrado_at: null,
    },
    { onConflict: 'workspace_id,proyecto_id' },
  );
  return error ? falla(error) : { ok: true };
}

/** Los proyectos del workspace con copia, del más reciente al más viejo (sin la línea de tiempo). */
export async function listarEspejos(ws: number): Promise<{ ok: true; filas: FilaEspejo[] } | Falla> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(COLUMNAS_LISTA)
    .eq('workspace_id', ws).is('borrado_at', null).order('updated_at', { ascending: false }).limit(100);
  if (error) return falla(error);
  return { ok: true, filas: (data ?? []) as FilaEspejo[] };
}

/** Un proyecto con su línea de tiempo. null = no hay copia (o se borró). */
export async function leerEspejo(ws: number, proyecto: string): Promise<{ ok: true; fila: (FilaEspejo & { escena_id: string; refs: unknown }) | null } | Falla> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).select(`${COLUMNAS_LISTA}, escena_id, vista, refs`)
    .eq('workspace_id', ws).eq('proyecto_id', proyecto).is('borrado_at', null).maybeSingle();
  if (error) return falla(error);
  return { ok: true, fila: (data ?? null) as (FilaEspejo & { escena_id: string; refs: unknown }) | null };
}

/** Lo saca de las lecturas (`borrado_at`). La fila queda: cerrar no es borrar. */
export async function borrarEspejo(ws: number, proyecto: string): Promise<{ ok: true } | Falla> {
  const db = await getTenantDb();
  const { error } = await db.from(TABLA).update({ borrado_at: new Date().toISOString() })
    .eq('workspace_id', ws).eq('proyecto_id', proyecto).is('borrado_at', null);
  return error ? falla(error) : { ok: true };
}
