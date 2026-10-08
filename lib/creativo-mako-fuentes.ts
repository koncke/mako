// =============================================================================
// creativo-mako-fuentes — de dónde salen los videos de MaKo que ofrece Ads Manager
// =============================================================================
// Las dos lecturas (montados y tomas) y la resolución de UNA referencia. Las usan la
// lista (/api/ads-manager/mis-creativos) y la subida a Meta (/api/ads-manager/
// creative-upload, rama `mako`): las dos pasan por las MISMAS funciones puras de
// lib/creativo-mako.ts, así lo que se ofrece y lo que se acepta no pueden divergir.
//
// ⚠️ TODO acá corre adentro de `runWithWorkspace(wsDeAdsManager(), …)`, y no es un
// detalle: getTenantDb() con el workspace en null lee con el id imposible -1, mientras
// cred() de lib/meta-ads-create.ts cae a OWNER_WS. Sin el contexto fijado, un admin de
// agencia sin workspace veía la lista vacía y escribía en la cuenta de Meta del ws1.
//
// ⚠️ «No pude leer» TIRA, nunca devuelve []: un 5xx de la base leído como «no tienes
// videos» manda a generar otro anuncio que ya existe.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';
import { leerHistorialEstricto } from './api-mako/areas/video.helpers';
import {
  BUCKET_CLIPS_MAKO, creativosDeMontajes, creativosDeTomas, tomaPedida,
  type CreativoMako, type FilaMontajeListo, type RefCreativoMako,
} from './creativo-mako';

/**
 * La url pública de una ruta del bucket, con la MISMA función con la que la escribieron
 * el worker de montaje y guardarClip (getPublicUrl sobre NEXT_PUBLIC_SUPABASE_URL).
 */
function urlPublica(ruta: string): string {
  return getSupabaseServer().storage.from(BUCKET_CLIPS_MAKO).getPublicUrl(ruta).data.publicUrl;
}

// Columnas EXPLÍCITAS y sacadas del jsonb: nunca `pedido` entero (lleva las urls de las
// tomas y el guion) ni `resultado` entero (lleva el plan de cortes).
const COLUMNAS_MONTAJE = 'id, plan_id, listo_at, url:resultado->>url, titulo:pedido->>titulo';

/** Los anuncios montados del workspace en curso, uno por anuncio. */
export async function montadosDelWorkspace(): Promise<CreativoMako[]> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('montaje_trabajos')
    .select(COLUMNAS_MONTAJE)
    .eq('estado', 'listo')
    .order('id', { ascending: false })
    .limit(50);
  if (error) throw new Error(`montaje_trabajos: ${error.message}`);
  return creativosDeMontajes((data ?? []) as unknown as FilaMontajeListo[], urlPublica);
}

/** Las tomas filmadas del historial de /video-generator del workspace en curso. */
export async function tomasDelWorkspace(): Promise<CreativoMako[]> {
  return creativosDeTomas(await leerHistorialEstricto(), urlPublica);
}

/**
 * La referencia que mandó el navegador, resuelta en el workspace en curso. null = no
 * existe acá (otro workspace, un montaje que no terminó, una toma que ya no está).
 * 'cambio' = la toma existe y hoy guarda OTRO clip que el que se mostró (tomaPedida).
 */
export async function resolverCreativoMako(ref: RefCreativoMako): Promise<CreativoMako | 'cambio' | null> {
  if (ref.origen === 'montaje') {
    const db = await getTenantDb();
    const { data, error } = await db
      .from('montaje_trabajos')
      .select(COLUMNAS_MONTAJE)
      .eq('id', ref.id)
      .eq('estado', 'listo')
      .maybeSingle();
    if (error) throw new Error(`montaje_trabajos: ${error.message}`);
    if (!data) return null;
    return creativosDeMontajes([data as unknown as FilaMontajeListo], urlPublica)[0] ?? null;
  }
  const plan = (await leerHistorialEstricto()).find((p) => p.id === ref.plan_id);
  if (!plan) return null;
  return tomaPedida(creativosDeTomas([plan], urlPublica), ref);
}
