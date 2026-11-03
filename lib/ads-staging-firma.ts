// =============================================================================
// ads-staging-firma — firmar una subida al staging de los creativos, y barrer lo que sobra (el servidor)
// =============================================================================
// Lo que hacía `creative-signurl` adentro de la ruta, en UN lugar: lo llaman la ruta (la pantalla «Subir creativos» del Media
// Buyer) y la API de MaKo (`preparar_subida_media_buyer`, 27/10/2026), que le da a un agente la misma URL firmada para que
// suba el archivo con un PUT. Dos firmas escritas por separado son dos formatos de nombre, y el barrido sólo reconoce uno
// (lib/ads-staging.ts).
// =============================================================================

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase';
import { ADS_CREATIVES_BUCKET as BUCKET } from '@/lib/meta-ads-create';
import { nombreSeguroDeStaging, pathNuevoDeStaging, STAGING_CARPETA, stagingVencido } from '@/lib/ads-staging';

export type FirmaStaging = { ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string };

/**
 * Una URL firmada para subir UN archivo al staging (bucket privado; vence a las 2 h). `crearBucket` lo pide la ruta de la
 * pantalla, que es la que corre primero en un proyecto nuevo: la API de MaKo sólo firma.
 */
export async function firmarSubidaDeStaging(nombre: string, opts: { crearBucket?: boolean } = {}): Promise<FirmaStaging> {
  const path = pathNuevoDeStaging(nombreSeguroDeStaging(nombre));
  const supabase = getSupabaseServer();
  if (opts.crearBucket) { try { await supabase.storage.createBucket(BUCKET, { public: false }); } catch { /* ya existe */ } }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'no se pudo firmar la subida' };
  // El gateway de Supabase exige la apikey pública (anon) además del token firmado.
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  if (!apikey) console.warn('[ads-staging-firma] sin NEXT_PUBLIC_SUPABASE_ANON_KEY: la subida directa al storage puede fallar (HTTP 400).');
  return { ok: true, path: data.path, signedUrl: data.signedUrl, apikey };
}

/**
 * Borra los archivos del staging que ya sobran (lib/ads-staging.ts → stagingVencido). Corre en after() de cada firma: así la
 * limpieza no depende de que una pestaña siga abierta. Con la carpeta ordenada por nombre, los primeros son los más viejos
 * (empiezan con la hora en ms): se barren de a 100, y lo que quede lo barre la próxima firma. Best-effort: nunca tira.
 */
export async function barrerStagingViejo(supabase: SupabaseClient = getSupabaseServer()): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(STAGING_CARPETA, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error || !Array.isArray(data)) return;
    const ahora = Date.now();
    const viejos = data.map((f) => f.name).filter((n) => stagingVencido(n, ahora)).map((n) => `${STAGING_CARPETA}/${n}`);
    if (viejos.length) await supabase.storage.from(BUCKET).remove(viejos);
  } catch { /* best-effort: lo barre la próxima firma */ }
}

/**
 * De estos paths del staging, los que NO están (nunca se subieron, o ya los barrió el barrido). Lo pregunta la API de MaKo al
 * PROPONER una subida: la persona confirma después, y una propuesta sobre un archivo que no existe fallaría recién ahí.
 * Tira si no pudo leer: «no pude leer» no es «no está».
 */
export async function faltanEnStaging(paths: string[]): Promise<string[]> {
  const db = getSupabaseServer();
  const faltan: string[] = [];
  // De a uno y por su nombre exacto (`search` filtra por nombre): una carpeta compartida por todos los negocios no se lista
  // entera, y un tope de filas daría por «faltante» al archivo que quedó afuera de la página.
  for (const p of paths) {
    const nombre = p.slice(STAGING_CARPETA.length + 1);
    const { data, error } = await db.storage.from(BUCKET).list(STAGING_CARPETA, { limit: 10, search: nombre });
    if (error || !Array.isArray(data)) throw new Error(`No pude leer el staging${error?.message ? `: ${error.message}` : ''}.`);
    if (!data.some((f) => f.name === nombre)) faltan.push(p);
  }
  return faltan;
}
