// =============================================================================
// POST /api/ads-manager/creative-upload — sube un creativo (imagen/video) a Meta
// =============================================================================
// Multipart 'file'. Imagen → act_<id>/adimages (devuelve image_hash). Video →
// act_<id>/advideos (devuelve video_id) y esperamos a que termine de procesar
// antes de poder usarlo en un creativo. Devuelve un UploadResult.
// =============================================================================

import { uploadAdImage, uploadAdVideo, waitForVideoReady, metaErrorEnvelope } from '@/lib/meta-ads-create';
import type { UploadResult } from '@/lib/campaign-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el procesado de video puede tardar

const IMG = ['image/jpeg', 'image/png'];
const VID = ['video/mp4', 'video/quicktime'];
const MAX = { image: 30 * 1024 * 1024, video: 1024 * 1024 * 1024 }; // Meta: img 30MB, video hasta ~1GB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el archivo' }, { status: 400 });

    const isImg = IMG.includes(file.type);
    const isVid = VID.includes(file.type);
    if (!isImg && !isVid) return Response.json({ ok: false, error: 'Formato no soportado. Imagen (jpg/png) o video (mp4/mov).' }, { status: 400 });

    const kind: 'image' | 'video' = isImg ? 'image' : 'video';
    if (file.size > MAX[kind]) {
      const mb = Math.round(MAX[kind] / (1024 * 1024));
      return Response.json({ ok: false, error: `El archivo supera el máximo (${mb} MB para ${kind === 'image' ? 'imagen' : 'video'}).` }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    if (kind === 'image') {
      const r = await uploadAdImage(bytes, file.name || 'imagen');
      const out: UploadResult = { media_type: 'image', image_hash: r.image_hash, thumbnail_url: r.url, width: r.width, height: r.height, filename: file.name || null };
      return Response.json({ ok: true, ...out });
    }
    const r = await uploadAdVideo(bytes, file.name || 'video', file.type);
    const estado = await waitForVideoReady(r.video_id, { timeoutMs: 150000 });
    const out: UploadResult = { media_type: 'video', video_id: r.video_id, thumbnail_url: null, filename: file.name || null };
    return Response.json({ ok: true, ...out, processing: estado !== 'ready', video_status: estado });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:creative-upload] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
