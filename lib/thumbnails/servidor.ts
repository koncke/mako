// =============================================================================
// thumbnails/servidor — leer la biblioteca de miniaturas de YouTube y los guardados del negocio (6/11/2026)
// =============================================================================
// La biblioteca es GLOBAL (de la plataforma, como la de carruseles: mig 0409, sin `workspace_id`, RLS sin políticas y sin
// permisos para la clave pública), así que se lee con el cliente del servidor y no con el proxy del inquilino. La llena la PC
// (scripts/thumbnails-biblioteca.mts); la pantalla y la API de MaKo sólo leen. Lo puro: ./explorar.ts.
//
// Lo que escribe: los guardados del NEGOCIO (`thumbnails.guardados`), con lectura estricta y compare-and-set, como los de
// carruseles (lib/carruseles/explorar-servidor.ts). Su propio setting: los ids de esta tabla chocarían con los de Spy.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { leerPorPaginas } from '../supabase-paginado';
import { cambiarSettingSi, getSetting, getSettingEstricto } from '../settings';
import { conGuardado, sanearGuardados, type Guardado } from '../carruseles/explorar';
import { CLAVE_GUARDADOS_THUMBNAIL, thumbnailsDe, type FilaCanal, type FilaVideo, type Thumbnail } from './explorar';

export const T_CANALES = 'thumbnails_canales';
export const T_VIDEOS = 'thumbnails_videos';
/** Cuántos videos se leen como mucho (todos los canales juntos). */
export const VIDEOS_A_LEER = 8000;

export type BibliotecaThumbnails = { ok: true; thumbnails: Thumbnail[]; guardados: number[]; sinTablas: boolean } | { ok: false; error: string };

/** ¿Es «la tabla no existe»? (la 0409 sin aplicar: no es un error, es una biblioteca vacía). */
const sinTabla = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /could not find the table|does not exist/i.test(e.message ?? ''));

/** Los canales activos de la biblioteca. Tira si no pudo leer. */
async function canales(): Promise<FilaCanal[] | null> {
  const r = await getSupabaseServer().from(T_CANALES).select('id, canal_id, nombre, handle, foto, nicho, idioma, estado').eq('estado', 'activo').limit(2000);
  if (r.error) { if (sinTabla(r.error)) return null; throw new Error(r.error.message); }
  return (r.data ?? []) as FilaCanal[];
}

/** Todas las miniaturas, sin los guardados. `null` = la 0409 todavía no está aplicada. Tira si no pudo leer. */
export async function thumbnailsDeLaBiblioteca(ahora = Date.now()): Promise<Thumbnail[] | null> {
  const cs = await canales();
  if (cs == null) return null;
  if (!cs.length) return [];
  const videos: FilaVideo[] = [];
  // Sólo lo leído en los últimos 30 días (la regla de YouTube: ./explorar.ts, `vigente`). Paginado por `id` (único).
  const desde = new Date(ahora - 30 * 86_400_000).toISOString();
  try {
    await leerPorPaginas<FilaVideo>(getSupabaseServer(), T_VIDEOS, 'id, video_id, canal_id, titulo, publicado_en, duracion, vistas, megusta, comentarios, leido_en, oculto', (pagina) => {
      videos.push(...pagina);
      return videos.length < VIDEOS_A_LEER;
    }, { orden: 'id', filtros: (q) => q.gte('leido_en', desde).eq('oculto', false) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (sinTabla({ message: m })) return null;
    throw e;
  }
  return thumbnailsDe(videos, cs, ahora);
}

/** Una, por su id (para «Editar» y para guardar). null = no está o no se ve. Tira si no pudo leer. */
export async function thumbnailPorId(id: number): Promise<Thumbnail | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const v = await getSupabaseServer().from(T_VIDEOS).select('id, video_id, canal_id, titulo, publicado_en, duracion, vistas, megusta, comentarios, leido_en, oculto').eq('id', id).maybeSingle();
  if (v.error) { if (sinTabla(v.error)) return null; throw new Error(v.error.message); }
  const fila = v.data as FilaVideo | null;
  if (!fila || fila.oculto) return null;
  const c = await getSupabaseServer().from(T_CANALES).select('id, canal_id, nombre, handle, foto, nicho, idioma, estado').eq('id', fila.canal_id).maybeSingle();
  if (c.error) throw new Error(c.error.message);
  if (!c.data) return null;
  // El múltiplo necesita a sus vecinos del canal: para «Editar» no hace falta, sale sin él.
  return thumbnailsDe([fila], [c.data as FilaCanal])[0] ?? null;
}

/** Lo que ve la pantalla: las miniaturas y los guardados del negocio. «No pude leer» es `{ ok: false }`, nunca una lista vacía. */
export async function leerThumbnails(): Promise<BibliotecaThumbnails> {
  try {
    const [xs, guardados] = await Promise.all([thumbnailsDeLaBiblioteca(), getSetting(CLAVE_GUARDADOS_THUMBNAIL)]);
    return { ok: true, thumbnails: xs ?? [], guardados: sanearGuardados(guardados).map((g) => g.id), sinTablas: xs == null };
  } catch (e) {
    console.warn('[thumbnails] no pude leer la biblioteca:', e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude leer las miniaturas de ejemplo.' };
  }
}

/** Guarda o saca una miniatura de los guardados del negocio (lectura estricta + compare-and-set, hasta 3 vueltas). */
export async function guardarThumbnail(id: number, guardar: boolean): Promise<{ ok: true; valor: Guardado[]; ya?: boolean } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Esa miniatura no existe.' };
  if (guardar) {
    let t: Thumbnail | null;
    try { t = await thumbnailPorId(id); } catch { return { ok: false, error: 'No pude comprobar esa miniatura. Vuelve a intentar.' }; }
    if (!t) return { ok: false, error: 'Esa miniatura no existe.' };
  }
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    let actual: string | null;
    try { actual = await getSettingEstricto(CLAVE_GUARDADOS_THUMBNAIL); } catch { return { ok: false, error: 'No pude leer tus guardados. Vuelve a intentar.' }; }
    const r = conGuardado(sanearGuardados(actual), id, guardar, new Date().toISOString());
    if (r.ya) return { ok: true, valor: r.lista, ya: true };
    if (await cambiarSettingSi(CLAVE_GUARDADOS_THUMBNAIL, actual, JSON.stringify(r.lista))) return { ok: true, valor: r.lista };
  }
  return { ok: false, error: 'Alguien más estaba guardando a la vez. Vuelve a intentar.' };
}
