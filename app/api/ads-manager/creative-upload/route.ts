// =============================================================================
// POST /api/ads-manager/creative-upload — empuja a Meta un creativo ya en storage
// =============================================================================
// El navegador ya subió el archivo a Supabase Storage (vía /creative-signurl,
// directo, esquivando el límite de body del serverless). Acá: imagen → la baja el
// servidor y la sube a act_<id>/adimages (image_hash). Video → Meta lo descarga
// por file_url firmado (act_<id>/advideos), así los bytes NUNCA pasan por esta
// función. Body: { path, content_type, filename } → UploadResult.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { uploadAdImage, uploadAdVideoByUrl, waitForVideoReady, metaErrorEnvelope, ADS_CREATIVES_BUCKET as BUCKET } from '@/lib/meta-ads-create';
import type { UploadResult } from '@/lib/campaign-types';
import { getTenantDb } from '@/lib/workspace';
import { guardAdsDueno } from '@/lib/ads-guard';
import { transcribeMediaBuffer, structureTranscript } from '@/lib/transcribe';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el procesado de video puede tardar

const IMG = ['image/jpeg', 'image/png'];
const VID = ['video/mp4', 'video/quicktime'];
const MAX_IMG = 30 * 1024 * 1024; // Meta: imagen 30MB

// Whisper no acepta más de 25 MB; arriba de eso ni bajamos el archivo.
const MAX_TRANSCRIBIR = 25 * 1024 * 1024;

/**
 * Transcribe el video que TODAVÍA está en el staging y lo guarda por video_id.
 * Best-effort de punta a punta: subir el creativo no puede fallar porque whisper
 * tenga un mal día. Lo que quede sin transcribir lo levanta el cron como siempre.
 */
async function transcribirYGuardar(path: string, videoId: string, filename: string, mime: string): Promise<void> {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return;
    if (data.size > MAX_TRANSCRIBIR) {
      await guardarTranscripcion(videoId, {
        status: 'muy_grande', transcript: null, secciones: null, idioma: null, duracion_s: null,
        model: null, error: `${(data.size / 1048576).toFixed(1)} MB > 25 MB (límite de OpenAI)`, filename,
      });
      return;
    }
    const t = await transcribeMediaBuffer(await data.arrayBuffer(), mime, filename);
    const secciones = t.status === 'ok' && t.transcript ? await structureTranscript(t.transcript) : null;
    await guardarTranscripcion(videoId, {
      status: t.status, transcript: t.transcript, secciones, idioma: t.idioma,
      duracion_s: t.duracion_s, model: t.status === 'ok' ? 'whisper-1+gpt-4o-mini' : null, error: t.error, filename,
    });
  } catch (e) {
    console.error('[creative-upload] transcripción al subir falló (sigue el cron)', e);
  }
}

async function guardarTranscripcion(
  videoId: string,
  row: { status: string; transcript: string | null; secciones: unknown; idioma: string | null; duracion_s: number | null; model: string | null; error: string | null; filename: string },
): Promise<void> {
  try {
    const db = await getTenantDb();
    await db.from('creative_transcripts').upsert(
      { video_id: videoId, ...row, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,video_id' },
    );
  } catch (e) {
    console.error('[creative-upload] no se pudo guardar la transcripción', e);
  }
}

export async function POST(req: NextRequest) {
  // Fase 1: subir creativos empuja media a la cuenta de Meta global del dueño.
  const no = await guardAdsDueno(); if (no) return no;

  let body: { path?: string; content_type?: string; filename?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const path = String(body.path ?? '');
  const ct = String(body.content_type ?? '');
  const filename = String(body.filename ?? 'creativo');
  if (!path) return Response.json({ ok: false, error: 'falta el archivo subido' }, { status: 400 });

  const isImg = IMG.includes(ct);
  const isVid = VID.includes(ct);
  if (!isImg && !isVid) return Response.json({ ok: false, error: 'Formato no soportado. Imagen (jpg/png) o video (mp4/mov).' }, { status: 400 });

  try {
    const supabase = getSupabaseServer();
    if (isImg) {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error(error?.message ?? 'no se pudo leer el archivo subido');
      const bytes = await data.arrayBuffer();
      if (bytes.byteLength > MAX_IMG) return Response.json({ ok: false, error: 'La imagen supera el máximo (30 MB).' }, { status: 413 });
      const r = await uploadAdImage(bytes, filename);
      supabase.storage.from(BUCKET).remove([path]).catch(() => { /* limpieza best-effort */ });
      const out: UploadResult = { media_type: 'image', image_hash: r.image_hash, thumbnail_url: r.url, width: r.width, height: r.height, filename };
      return Response.json({ ok: true, ...out });
    }
    // Video: URL firmada de descarga → Meta lo baja (no pasa por la función).
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) throw new Error(error?.message ?? 'no se pudo firmar el archivo subido');
    const r = await uploadAdVideoByUrl(data.signedUrl, filename);
    // Transcribimos MIENTRAS Meta procesa el video: el archivo ya está acá y en un
    // rato lo borramos, así que es la única ventana en la que sale gratis. Si no,
    // el cron tendría que volver a bajar el mp4 DESDE Meta al día siguiente (y el
    // anuncio nacería sin texto con el que nombrarlo). En paralelo = sin latencia extra.
    const [estado] = await Promise.all([
      waitForVideoReady(r.video_id, { timeoutMs: 150000 }),
      transcribirYGuardar(path, r.video_id, filename, ct),
    ]);
    // Una vez procesado, Meta ya tiene su copia → limpiamos el staging.
    if (estado === 'ready') supabase.storage.from(BUCKET).remove([path]).catch(() => { /* best-effort */ });
    const out: UploadResult = { media_type: 'video', video_id: r.video_id, thumbnail_url: null, filename };
    return Response.json({ ok: true, ...out, processing: estado !== 'ready', video_status: estado });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:creative-upload] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
