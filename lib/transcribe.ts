// =============================================================================
// Transcripción del video de un anuncio (Meta → mp4 → OpenAI whisper-1)
// =============================================================================
// Lógica pura (lee process.env): la usan el cron transcribe-ads y el backfill.
// No escribe en la BD — el caller decide dónde guardar el resultado.

const GRAPH = 'https://graph.facebook.com';
const MAX_BYTES = 25 * 1024 * 1024; // límite de OpenAI

export type TranscribeStatus = 'ok' | 'sin_video' | 'muy_grande' | 'error';
export type TranscribeResult = {
  ad_id: string;
  video_id: string | null;
  status: TranscribeStatus;
  transcript: string | null;
  idioma: string | null;
  duracion_s: number | null;
  model: string | null;
  error: string | null;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} no definida`);
  return v;
}

/** Devuelve { video_id, source(mp4) } del creativo del anuncio, o null si no hay video. */
async function getAdVideo(adId: string, ver: string, token: string): Promise<{ video_id: string; source: string } | null> {
  const cu = new URL(`${GRAPH}/${ver}/${adId}`);
  cu.searchParams.set('fields', 'creative{object_story_spec{video_data{video_id}},video_id}');
  cu.searchParams.set('access_token', token);
  const c = await (await fetch(cu, { cache: 'no-store' })).json();
  if (c.error) throw new Error(`creative: ${c.error.message}`);
  const vid: string | undefined = c?.creative?.object_story_spec?.video_data?.video_id || c?.creative?.video_id;
  if (!vid) return null;
  const vu = new URL(`${GRAPH}/${ver}/${vid}`);
  vu.searchParams.set('fields', 'source');
  vu.searchParams.set('access_token', token);
  const vb = await (await fetch(vu, { cache: 'no-store' })).json();
  if (vb.error || !vb.source) return null;
  return { video_id: vid, source: vb.source };
}

/**
 * Transcribe el video de un anuncio. Nunca lanza: devuelve un TranscribeResult
 * con status (incluido 'error') para que el caller persista igual y no reintente.
 */
export async function transcribeAd(adId: string): Promise<TranscribeResult> {
  const base: TranscribeResult = { ad_id: adId, video_id: null, status: 'ok', transcript: null, idioma: null, duracion_s: null, model: null, error: null };
  try {
    const ver = env('META_API_VERSION');
    const token = env('META_ACCESS_TOKEN');
    const oai = env('OPENAI_API_KEY');

    const video = await getAdVideo(adId, ver, token);
    if (!video) return { ...base, status: 'sin_video' };
    base.video_id = video.video_id;

    // Tamaño antes de descargar (HEAD; si no, Range).
    let size = 0;
    try { const h = await fetch(video.source, { method: 'HEAD' }); size = Number(h.headers.get('content-length') || 0); } catch { /* ignore */ }
    if (size > MAX_BYTES) return { ...base, status: 'muy_grande', error: `${(size / 1048576).toFixed(1)} MB > 25 MB` };

    const buf = Buffer.from(await (await fetch(video.source, { cache: 'no-store' })).arrayBuffer());
    if (buf.length > MAX_BYTES) return { ...base, status: 'muy_grande', error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB` };

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: 'video/mp4' }), 'ad.mp4');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${oai}` },
      body: form,
    });
    const j = await r.json();
    if (j.error) return { ...base, status: 'error', error: `openai: ${j.error.message}` };
    return { ...base, status: 'ok', transcript: j.text ?? '', idioma: j.language ?? null, duracion_s: j.duration ?? null, model: 'whisper-1' };
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
