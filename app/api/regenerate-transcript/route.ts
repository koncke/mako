// =============================================================================
// POST /api/regenerate-transcript — re-genera la transcripción/ordenamiento de
// un anuncio, con una instrucción opcional para OpenAI.
// =============================================================================
// La dispara el botón "Re-generar" del modal cuando la transcripción o la
// descripción de imagen salió mal. La instrucción se inyecta en whisper, en la
// estructuración y en el análisis de imagen.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { transcribeAd } from '@/lib/transcribe';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { ad_id?: string; instruccion?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'body inválido' }, { status: 400 }); }
  const adId = body.ad_id;
  const instruccion = (body.instruccion ?? '').slice(0, 1000);
  if (!adId || !/^\d+$/.test(adId)) return Response.json({ error: 'ad_id inválido' }, { status: 400 });

  const supabase = getSupabaseServer();

  // Thumbnail (fuente de imagen para anuncios sin video).
  const { data: th } = await supabase
    .from('marketing_metrics_daily')
    .select('ad_thumbnail_url, fecha')
    .eq('plataforma', 'meta')
    .eq('ad_id', adId)
    .not('ad_thumbnail_url', 'is', null)
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();

  const res = await transcribeAd(adId, { imageUrl: th?.ad_thumbnail_url ?? undefined, instruccion });

  const { error: upErr } = await supabase.from('ad_transcripts').upsert({
    ad_id: res.ad_id, video_id: res.video_id, tipo: res.tipo, status: res.status, transcript: res.transcript,
    secciones: res.secciones, idioma: res.idioma, duracion_s: res.duracion_s, model: res.model, error: res.error, updated_at: new Date().toISOString(),
  }, { onConflict: 'ad_id' });
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

  return Response.json({ status: res.status, tipo: res.tipo, transcript: res.transcript, secciones: res.secciones, idioma: res.idioma, duracion_s: res.duracion_s, error: res.error });
}
