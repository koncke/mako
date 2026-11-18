// =============================================================================
// Transcribir el creativo de un anuncio UNA VEZ POR VIDEO (18/11/2026, O9) — la parte que lee y escribe la base
// =============================================================================
// El porqué y qué se guarda, en ./transcripcion-por-video-reglas.ts. Acá: `transcribirAnuncio` es `transcribeAd` con la caché
// de `creative_transcripts` puesta, y la usan los dos que transcriben anuncios en lote (el cron diario y la extracción del
// historial). El botón «Re-generar» (app/api/regenerate-transcript) sigue con `transcribeAd` a secas: rehacerla es el pedido.
//
// TENANT-SAFETY: `db` es el `getTenantDb()` del negocio en curso (la tabla está en TENANT_TABLES, lib/workspace.ts): el mismo
// `video_id` en otro negocio no se ve ni se pisa. Guardar es best-effort: la fila de `ad_transcripts` es la que manda, y una
// caché que no se pudo escribir sólo vuelve a pagar la próxima vez (lo de antes).
// =============================================================================

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { transcribeAd, type TranscribeResult } from './transcribe';
import { COLUMNAS_GUARDADA, filaParaGuardar, guardadaDeFila, type TranscripcionGuardada } from './transcripcion-por-video-reglas';

type OpcionesTranscribir = Omit<NonNullable<Parameters<typeof transcribeAd>[1]>, 'guardada'>;

/** La transcripción ya guardada de un video en ESTE negocio, o null. Tira si no la pudo leer (transcribeAd la hace igual). */
export async function transcripcionGuardada(db: SupabaseClient, videoId: string): Promise<TranscripcionGuardada | null> {
  const { data, error } = await db.from('creative_transcripts').select(COLUMNAS_GUARDADA).eq('video_id', videoId).maybeSingle();
  if (error) throw new Error(`creative_transcripts: ${error.message}`);
  return guardadaDeFila(data);
}

/** `transcribeAd` con la transcripción del video reusada si ya está, y guardada si se acaba de hacer. Nunca tira. */
export async function transcribirAnuncio(db: SupabaseClient, adId: string, opts: OpcionesTranscribir = {}): Promise<TranscribeResult> {
  const res = await transcribeAd(adId, { ...opts, guardada: (videoId) => transcripcionGuardada(db, videoId) });
  const fila = filaParaGuardar(res);
  if (fila) {
    const { error } = await db.from('creative_transcripts').upsert({ ...fila, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,video_id' });
    if (error) console.warn(`[transcribe] no pude guardar la transcripción del video ${res.video_id} (el próximo anuncio con ese video la vuelve a hacer): ${error.message}`);
  }
  return res;
}
