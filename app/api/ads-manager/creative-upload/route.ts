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
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el procesado de video puede tardar

const IMG = ['image/jpeg', 'image/png'];
const VID = ['video/mp4', 'video/quicktime'];
const MAX_IMG = 30 * 1024 * 1024; // Meta: imagen 30MB

export async function POST(req: NextRequest) {
  // Fase 1: subir creativos empuja media a la cuenta de Meta global del dueño.
  if (!(await esWorkspaceDueno())) {
    return Response.json({ ok: false, error: 'Esta acción solo está disponible en el workspace principal por ahora.' }, { status: 403 });
  }

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
    const estado = await waitForVideoReady(r.video_id, { timeoutMs: 150000 });
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
