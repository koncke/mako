// =============================================================================
// Cron: transcribe los videos de los anuncios cargados que aún no tienen texto
// =============================================================================
// Corre a diario después de la ingesta de Meta. Toma los ad_id recientes que no
// están en ad_transcripts y los transcribe (Meta mp4 → OpenAI whisper-1),
// guardando el resultado. Tope por corrida (cantidad + tiempo) para no exceder
// el timeout; lo pendiente se completa en corridas siguientes. El grueso
// histórico se siembra una vez con scripts/backfill-transcripts.mjs.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { transcribeAd } from '@/lib/transcribe';
import { diasAntes, ayerEnTijuana } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_POR_CORRIDA = 8;
const TIME_BUDGET_MS = 240_000;

function checkAuth(request: NextRequest): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const authFail = checkAuth(request);
  if (authFail) return authFail;

  const tStart = Date.now();
  const supabase = getSupabaseServer();
  const desde = diasAntes(ayerEnTijuana(), 45);

  // Anuncios recientes con video potencial
  const { data: adsData, error: adsErr } = await supabase
    .from('marketing_metrics_daily')
    .select('ad_id')
    .eq('plataforma', 'meta')
    .not('ad_id', 'is', null)
    .gte('fecha', desde);
  if (adsErr) return Response.json({ ok: false, error: adsErr.message }, { status: 500 });
  const adIds = [...new Set((adsData ?? []).map((r) => r.ad_id as string))];

  // Ya transcritos (cualquier status) → no reprocesar
  const { data: doneData, error: doneErr } = await supabase.from('ad_transcripts').select('ad_id');
  if (doneErr) return Response.json({ ok: false, error: doneErr.message }, { status: 500 });
  const done = new Set((doneData ?? []).map((r) => r.ad_id as string));

  const pendientes = adIds.filter((id) => !done.has(id));

  let ok = 0, sinVideo = 0, grandes = 0, errores = 0, procesados = 0;
  for (const adId of pendientes) {
    if (procesados >= MAX_POR_CORRIDA || Date.now() - tStart > TIME_BUDGET_MS) break;
    procesados++;
    const res = await transcribeAd(adId);
    const { error: upErr } = await supabase.from('ad_transcripts').upsert({
      ad_id: res.ad_id, video_id: res.video_id, tipo: res.tipo, status: res.status, transcript: res.transcript,
      secciones: res.secciones, idioma: res.idioma, duracion_s: res.duracion_s, model: res.model, error: res.error, updated_at: new Date().toISOString(),
    }, { onConflict: 'ad_id' });
    if (upErr) { errores++; continue; }
    if (res.status === 'ok') ok++;
    else if (res.status === 'sin_video') sinVideo++;
    else if (res.status === 'muy_grande') grandes++;
    else errores++;
  }

  const ms = Date.now() - tStart;
  console.log(`[cron:transcribe-ads] pendientes=${pendientes.length} procesados=${procesados} ok=${ok} sin_video=${sinVideo} grandes=${grandes} err=${errores} ms=${ms}`);
  return Response.json({ ok: true, total_pendientes: pendientes.length, procesados, ok_count: ok, sin_video: sinVideo, muy_grande: grandes, errores, restantes: pendientes.length - procesados, ms });
}
