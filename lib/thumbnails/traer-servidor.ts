// =============================================================================
// «Traer tu outlier» de YouTube: la miniatura de un video que el negocio suma por su LINK (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: traer un outlier propio pegando el link (Instagram, YouTube o la biblioteca de anuncios de Meta) para
// sumarlo a los outliers del negocio. Es lib/carruseles/traer-servidor.ts para la tab «Thumbnails», con dos diferencias:
//   · se lee con la YouTube Data API OFICIAL, con la clave de la plataforma (`claveDeLaPlataforma`, la misma del cron). Es
//     GRATIS: `videos.list` y `channels.list` cuestan 1 unidad de la cuota diaria cada uno (10.000 por día). Nada de Apify;
//   · la imagen NO se guarda: se dibuja la de `i.ytimg.com`, como toda la biblioteca (lib/thumbnails/explorar.ts).
//
// El camino:
//   1. el link tiene que ser de un video (`videoDeYoutube`); un Short no (su miniatura no se diseña);
//   2. si ya está en la biblioteca y sigue vigente, se devuelve sin leer nada. Si lo trajo OTRO negocio, es público: pasa a la
//      plataforma (mig 0414: `video_id` es único);
//   3. si no (o venció: la regla de los 30 días), se lee: el video y, si su canal no está, el canal;
//   4. el canal nuevo entra con `workspace_id` = el negocio, así el cron no lo relee (lib/thumbnails/renovar.ts), y con el
//      rubro VACÍO: no se sabe y no se inventa (el idioma, si YouTube lo dice);
//   5. el video se guarda con `workspace_id` = el negocio: lo ve sólo él (`seVeThumbnail`).
// Vence a los 30 días como todo lo que se guarda de la API (`podarVencidos`): traerlo otra vez lo vuelve a leer.
// Nunca tira: contesta un error para la pantalla.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { runWithWorkspace } from '../workspace';
import { reservarDelDia } from '../spy-todo';
import { canalesDeVideos, leerCanal, leerVideos } from '../spy-youtube';
import { traidaPor } from '../traida-por';
import { esCorto, videoDeYoutube, vigente, type Thumbnail } from './explorar';
import { claveDeLaPlataforma } from './renovar';
import { T_CANALES, T_VIDEOS, hayColumnaWsThumbnails, thumbnailPorId } from './servidor';

/** Cuántos videos puede traer un negocio por día. No es plata (la API es gratis): es la cuota de la plataforma, que es una sola. */
export const TRAIDAS_POR_DIA = 30;
const CLAVE_DIA = 'thumbnails.traidas.dia';
const API = 'https://www.googleapis.com/youtube/v3';
const ESPERA_MS = 15_000;

export type TraidaThumbnail = { ok: true; thumbnail: Thumbnail; nuevo: boolean } | { ok: false; error: string };

/** El idioma del canal, si YouTube lo dice (`defaultAudioLanguage` del video): es, en o pt. Si no, null (no se inventa). */
export function idiomaDeYoutube(cuerpo: unknown): 'es' | 'en' | 'pt' | null {
  const it = (cuerpo as { items?: Array<{ snippet?: { defaultAudioLanguage?: unknown; defaultLanguage?: unknown } }> } | null)?.items?.[0]?.snippet;
  const l = String(it?.defaultAudioLanguage ?? it?.defaultLanguage ?? '').toLowerCase().slice(0, 2);
  return l === 'es' || l === 'en' || l === 'pt' ? l : null;
}

async function pedir(ruta: string, params: Record<string, string>, clave: string): Promise<{ status: number; cuerpo: unknown }> {
  const u = new URL(`${API}/${ruta}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', clave);
  const r = await fetch(u.toString(), { signal: AbortSignal.timeout(ESPERA_MS), cache: 'no-store' });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

export async function traerThumbnail(ws: number, texto: string): Promise<TraidaThumbnail> {
  const link = videoDeYoutube(texto);
  if (!link) return { ok: false, error: 'Pega el link de un video de YouTube (el que dice watch?v= o youtu.be).' };
  if (link.corto) return { ok: false, error: 'Ese link es de un Short: aquí se traen videos largos, que son los que tienen una miniatura diseñada.' };
  try {
    if (!(await hayColumnaWsThumbnails())) return { ok: false, error: 'Todavía no puedo traer miniaturas por su link: falta aplicar la migración 0414.' };
    const db = getSupabaseServer();

    // 2. ¿Ya está? Vigente, se devuelve sin leer nada.
    const ya = await db.from(T_VIDEOS).select('id, workspace_id, oculto, leido_en').eq('video_id', link.video).maybeSingle();
    if (ya.error) throw new Error(ya.error.message);
    const fila = ya.data as { id: number; workspace_id: number | string | null; oculto: boolean | null; leido_en: string } | null;
    if (fila?.oculto) return { ok: false, error: 'Esa miniatura salió de los ejemplos: no la puedo sumar.' };
    const de = fila ? traidaPor(fila) : null;
    if (fila && de != null && de !== ws) {
      // La trajo otro negocio: es pública y ya le sirvió a dos. Pasa a la plataforma.
      const u = await db.from(T_VIDEOS).update({ workspace_id: null }).eq('id', fila.id);
      if (u.error) throw new Error(u.error.message);
    }
    if (fila && vigente(fila.leido_en)) {
      const t = await runWithWorkspace(ws, () => thumbnailPorId(fila.id, ws));
      if (t) return { ok: true, thumbnail: t, nuevo: false };
    }

    // 3. Leerlo, con la clave de la plataforma y dentro del tope del día del negocio.
    const clave = await claveDeLaPlataforma();
    if (!clave) return { ok: false, error: 'No tengo con qué leer YouTube ahora. Ya nos avisó el sistema; vuelve a intentar más tarde.' };
    if (!(await runWithWorkspace(ws, () => reservarDelDia(CLAVE_DIA, TRAIDAS_POR_DIA)))) {
      return { ok: false, error: `Hoy ya trajiste ${TRAIDAS_POR_DIA} miniaturas. Mañana puedes traer más.` };
    }
    const v = await pedir('videos', { part: 'snippet,statistics,contentDetails', id: link.video }, clave);
    if (v.status !== 200) {
      const l = leerCanal(v.status, v.cuerpo);
      console.error(`[thumbnails-traer] YouTube no leyó ${link.video}: HTTP ${v.status} ${l.ok ? '' : l.detalle} (ws=${ws})`);
      return { ok: false, error: !l.ok && l.motivo === 'cuota' ? 'YouTube no deja leer más por hoy. Vuelve a intentar mañana.' : 'No pude leer ese video ahora. Vuelve a intentar en un rato.' };
    }
    const [video] = leerVideos(v.cuerpo);
    const [delCanal] = canalesDeVideos(v.cuerpo);
    if (!video || !delCanal) return { ok: false, error: 'YouTube no me dio ese video: puede ser privado o estar borrado.' };
    if (esCorto(video.duracion)) return { ok: false, error: 'Ese video es un Short: aquí se traen videos largos, que son los que tienen una miniatura diseñada.' };
    const ahora = new Date().toISOString();

    // 4. Su canal: el de la biblioteca si ya está; si no, se lee y entra como traído (el cron no lo relee).
    let canal = await db.from(T_CANALES).select('id').eq('canal_id', delCanal.id).maybeSingle();
    if (canal.error) throw new Error(canal.error.message);
    if (!canal.data) {
      const c = await pedir('channels', { part: 'snippet,statistics,contentDetails', id: delCanal.id }, clave);
      const l = leerCanal(c.status, c.cuerpo);
      const nombre = (l.ok ? l.canal.nombre : '') || delCanal.nombre || delCanal.id;
      const nueva = await db.from(T_CANALES).upsert([{
        canal_id: delCanal.id, nombre: nombre.slice(0, 120),
        handle: l.ok && l.canal.handle ? l.canal.handle.replace(/^@?/, '@').slice(0, 60) : null,
        foto: l.ok && l.canal.foto && /^https:\/\//.test(l.canal.foto) ? l.canal.foto : null,
        nicho: null, idioma: idiomaDeYoutube(v.cuerpo), fuente: 'lista', estado: 'activo', leido_en: ahora, updated_at: ahora, workspace_id: ws,
      }], { onConflict: 'canal_id', ignoreDuplicates: true });
      if (nueva.error) throw new Error(nueva.error.message);
      canal = await db.from(T_CANALES).select('id').eq('canal_id', delCanal.id).maybeSingle();
      if (canal.error || !canal.data) throw new Error(canal.error?.message ?? 'sin el canal');
    }

    // 5. El video, del negocio (o de la plataforma, si ya era de ella o lo trajo otro: no se lo apropia).
    const filaNueva = {
      video_id: video.id, canal_id: (canal.data as { id: number }).id, titulo: video.titulo ? video.titulo.slice(0, 300) : null,
      publicado_en: Number.isFinite(Date.parse(video.publicadoEn)) ? new Date(video.publicadoEn).toISOString() : null,
      duracion: video.duracion, vistas: video.vistas, megusta: video.megusta, comentarios: video.comentarios, leido_en: ahora,
      ...(fila ? {} : { workspace_id: ws }),
    };
    const g = await db.from(T_VIDEOS).upsert([filaNueva], { onConflict: 'video_id' }).select('id').single();
    if (g.error || !g.data) throw new Error(g.error?.message ?? 'no se guardó');
    const t = await runWithWorkspace(ws, () => thumbnailPorId((g.data as { id: number }).id, ws));
    return t ? { ok: true, thumbnail: t, nuevo: !fila } : { ok: false, error: 'La guardé, pero no la pude mostrar. Recarga la página.' };
  } catch (e) {
    console.error(`[thumbnails-traer] ${link.video} (ws=${ws}):`, e instanceof Error ? e.message : e);
    return { ok: false, error: 'No pude traer esa miniatura. Vuelve a intentar.' };
  }
}
