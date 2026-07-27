// =============================================================================
// Branding MaKo — catálogo del material de marca (gráficos, animaciones, íconos,
// videos) que vive en el bucket privado `branding` de Supabase Storage.
// =============================================================================
// Los bytes NO están en el repo: 93 MB inflarían el bundle y cada push a Vercel
// se factura. Suben una sola vez con scripts/subir-branding.mjs y el catálogo
// (mig 0098) guarda la ficha de cada pieza.
//
// El bucket es PRIVADO: nada se sirve directo. Toda descarga pasa por un route
// handler que autoriza primero y recién ahí firma una URL de vida corta.

import { getSupabaseServer } from './supabase';
import { getTenantDb } from './workspace';

const BUCKET = 'branding';

export type BrandingSeccion = 'graficos' | 'animaciones' | 'iconos' | 'videos';

export type BrandingAsset = {
  id: string;
  seccion: BrandingSeccion;
  grupo: string;
  archivo: string;
  titulo: string;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  storage_path: string;
  thumb_path: string | null;
  panda_embed: string | null;
  orden: number;
};

const COLS = 'id,seccion,grupo,archivo,titulo,mime,bytes,ancho,alto,storage_path,thumb_path,panda_embed,orden';

/** Catálogo completo del workspace activo, ya ordenado para la grilla. */
export async function listarAssets(): Promise<BrandingAsset[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('branding_assets').select(COLS)
    .order('seccion', { ascending: true }).order('grupo', { ascending: true }).order('orden', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandingAsset[];
}

/** Una pieza puntual. Devuelve null si no existe EN ESTE workspace (cierra el IDOR). */
export async function getAsset(id: string): Promise<BrandingAsset | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('branding_assets').select(COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BrandingAsset) ?? null;
}

/** Igual que getAsset pero para un workspace explícito: lo usa la vista pública,
 *  que resuelve el ws desde el link compartido y no desde la cookie. */
export async function getAssetDeWorkspace(ws: number, id: string): Promise<BrandingAsset | null> {
  const { data, error } = await getSupabaseServer().from('branding_assets').select(COLS)
    .eq('workspace_id', ws).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BrandingAsset) ?? null;
}

export async function listarAssetsDeWorkspace(ws: number): Promise<BrandingAsset[]> {
  const { data, error } = await getSupabaseServer().from('branding_assets').select(COLS)
    .eq('workspace_id', ws)
    .order('seccion', { ascending: true }).order('grupo', { ascending: true }).order('orden', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandingAsset[];
}

// ── Binarios ────────────────────────────────────────────────────────────────
/** URL firmada que fuerza la descarga con el nombre real del archivo. Vida corta
 *  a propósito: una URL firmada es un bearer suelto, así que dura lo justo. */
export async function urlDescarga(path: string, nombre: string): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, 120, { download: nombre });
  return data?.signedUrl ?? null;
}

/** URL firmada para VER (miniatura o preview), sin forzar descarga. */
export async function urlPreview(path: string, segundos = 300): Promise<string | null> {
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrl(path, segundos);
  return data?.signedUrl ?? null;
}

/** Firma muchas miniaturas de UNA sola vez: en batch y no en loop. El loop
 *  secuencial de firmas ya colgó una vista en este repo. */
export async function urlsPreview(paths: string[], segundos = 600): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await getSupabaseServer().storage.from(BUCKET).createSignedUrls(paths, segundos);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

/** Descarga el binario a memoria: lo usa el proxy de la vista pública, que no
 *  puede entregar una URL firmada (sería un bearer que sobrevive a la revocación). */
export async function leerBinario(path: string): Promise<{ buf: Buffer; mime: string } | null> {
  const { data, error } = await getSupabaseServer().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { buf: Buffer.from(await data.arrayBuffer()), mime: data.type || 'application/octet-stream' };
}
