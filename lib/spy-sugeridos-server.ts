import 'server-only';

// =============================================================================
// spy-sugeridos-server — el catálogo «Sugeridos» contra la base (4/11/2026)
// =============================================================================
// La lógica, con su porqué, está en lib/spy-sugeridos.ts. Acá se enchufa la base: los competidores y las piezas de la
// PLATAFORMA se leen con la clave de servicio pero filtrados por SU negocio (`wsSuperAdmin`, resuelto por capa); lo del
// negocio que pregunta, con `getTenantDb` y las funciones de siempre de lib/spy.ts.
//
// Lo usan la pantalla (app/competitor-spy/actions.ts) y la API de MaKo (ver_sugeridos, sumar_sugerido): un solo camino.
// =============================================================================

import { CLAVE_CARICATURAS, caricaturasListas, leerRegistro } from './spy-caricatura-reglas';
import { encolarAlLeer } from './spy-caricatura-servidor';
import { agregarCompetidor, guardarVistas, leerCompetidor, listarCompetidores, type PiezaVista } from './spy';
import {
  agregarSugerido, listarSugeridos, type DepsAgregar, type FilaCompetidor, type FilaPieza, type Sugerido,
} from './spy-sugeridos';
import { marcarTraidaHoy } from './spy-todo';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { getTenantDb, getWorkspaceActual, wsSuperAdmin } from './workspace';

export type { Sugerido };

const COLS_COMPETIDOR = 'id, workspace_id, nombre, instagram, youtube_id, tiktok, landing_url, avatar, instagram_seguidores, youtube_suscriptores';
const COLS_PIEZA = 'id, canal, tipo, ref, fuente, url, titulo, texto, etiquetas, vistas, megusta, comentarios, duracion, publicada_en, miniatura, dejo_de_verse_en, medio, laminas';
/** Los de la plataforma son pocos (su propio tope es el de cualquier negocio): esto es un techo de seguridad. */
const MAXIMO_SUGERIDOS = 100;

const deps: DepsAgregar = {
  plataforma: () => wsSuperAdmin(),
  actual: () => getWorkspaceActual(),
  competidoresDe: async (ws) => {
    const { data, error } = await getSupabaseServer().from('spy_competidores').select(COLS_COMPETIDOR)
      .eq('workspace_id', ws).order('id').limit(MAXIMO_SUGERIDOS);
    if (error) throw new Error(`No pude leer los sugeridos: ${error.message}`);
    return (data ?? []) as FilaCompetidor[];
  },
  caricaturasDe: async (ws) => {
    const { data } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_CARICATURAS).maybeSingle();
    return caricaturasListas(leerRegistro((data?.value as string | undefined) ?? null));
  },
  propios: async () => {
    const r = await listarCompetidores();
    if (!r.ok) throw new Error(r.error);
    return r.competidores;
  },
  piezasDe: async (ws, id) => leerTodo<FilaPieza>(getSupabaseServer(), 'spy_piezas', COLS_PIEZA, { orden: 'id', eq: { workspace_id: ws, competidor_id: id }, maxPaginas: 3 }),
  agregar: async (pegado, nombre) => {
    const r = await agregarCompetidor(pegado, nombre);
    return r.ok ? { ok: true, id: r.competidor.id } : r;
  },
  completar: async (id, desde) => {
    const c = await leerCompetidor(id);
    if (!c) return;
    // Sólo lo que le falta: lo que el negocio ya tenía cargado es suyo y no se pisa.
    const patch: Record<string, unknown> = { mirado_en: new Date().toISOString(), updated_at: new Date().toISOString() };
    for (const k of ['youtube_id', 'tiktok', 'landing_url', 'avatar', 'instagram_seguidores', 'youtube_suscriptores'] as const) {
      if (c[k] == null && desde[k] != null) patch[k] = desde[k];
    }
    const db = await getTenantDb();
    await db.from('spy_competidores').update(patch).eq('id', id);
  },
  guardar: (id, piezas) => guardarVistas(id, piezas as unknown as PiezaVista[]),
  marcarTraido: (id) => marcarTraidaHoy(id),
};

/** El catálogo «Sugeridos» del negocio que pregunta. */
export function sugeridosDelNegocio(): Promise<Sugerido[]> {
  return listarSugeridos(deps);
}

/** Suma un sugerido al negocio que pregunta, sin gastarle nada. Su caricatura, si la plataforma ya la tiene, viene sola. */
export async function sumarSugeridoAlNegocio(id: number): Promise<{ ok: true; id: number; piezas: number } | { ok: false; error: string; pasarAPro?: string }> {
  const r = await agregarSugerido(deps, id);
  if (!r.ok) return r;
  const [ws, c] = await Promise.all([getWorkspaceActual(), leerCompetidor(r.id)]);
  if (ws != null && c) await encolarAlLeer(ws, c, c.avatar);
  return r;
}
