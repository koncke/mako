// =============================================================================
// Transcripción + estructuración del creativo de un anuncio
// =============================================================================
// Lógica pura (lee process.env): la usan el cron transcribe-ads y el backfill.
//   - Video: Meta source(mp4) → OpenAI whisper-1 → texto → estructura en
//     secciones (gpt-4o-mini).
//   - Imagen (sin video): Meta image → OpenAI visión (gpt-4o-mini) → texto de la
//     imagen + descripción visual → secciones.
// No escribe en la BD; el caller persiste el resultado.

const GRAPH = 'https://graph.facebook.com';
const OAI = 'https://api.openai.com/v1';
const MAX_BYTES = 25 * 1024 * 1024; // límite de OpenAI audio

export type Seccion = { titulo: string; texto: string };
export type TranscribeStatus = 'ok' | 'sin_video' | 'muy_grande' | 'error';
export type TranscribeResult = {
  ad_id: string;
  video_id: string | null;
  tipo: 'video' | 'imagen' | null;
  status: TranscribeStatus;
  transcript: string | null;
  secciones: Seccion[] | null;
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

// ── Meta: video y/o imagen del creativo ──────────────────────────────────────

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

/** Mejor imagen del creativo (para anuncios sin video). */
export async function getAdImage(adId: string): Promise<string | null> {
  const ver = env('META_API_VERSION'), token = env('META_ACCESS_TOKEN');
  const cu = new URL(`${GRAPH}/${ver}/${adId}`);
  cu.searchParams.set('fields', 'creative{image_url,object_story_spec{link_data{picture},photo_data{url}},asset_feed_spec{images{url}}}');
  cu.searchParams.set('access_token', token);
  const c = await (await fetch(cu, { cache: 'no-store' })).json();
  if (c.error) throw new Error(`creative img: ${c.error.message}`);
  const cr = c.creative ?? {};
  return cr.image_url ?? cr.object_story_spec?.link_data?.picture ?? cr.object_story_spec?.photo_data?.url ?? cr.asset_feed_spec?.images?.[0]?.url ?? null;
}

// ── OpenAI: estructurar guion / analizar imagen ──────────────────────────────

/** Divide un guion en secciones con títulos (Hook, Problema, Oferta, CTA…). */
export async function structureTranscript(text: string): Promise<Seccion[] | null> {
  if (!text || text.trim().length < 20) return null;
  const oai = env('OPENAI_API_KEY');
  const sys = 'Eres un analista de anuncios. Divide el guion en secciones consecutivas con títulos cortos en español según su función (ej: Hook, Problema, Agitación, Solución, Oferta, Prueba/Autoridad, CTA — usa solo los que apliquen). No inventes ni resumas: reparte el TEXTO LITERAL entre las secciones. Devuelve SOLO JSON: {"secciones":[{"titulo":"...","texto":"..."}]}.';
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${oai}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: text }] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`structure: ${j.error.message}`);
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}');
    return Array.isArray(parsed.secciones) ? parsed.secciones : null;
  } catch { return null; }
}

/** Analiza la imagen de un anuncio: texto visible + descripción + secciones. */
async function analyzeImage(imageUrl: string): Promise<{ transcript: string; secciones: Seccion[] }> {
  const oai = env('OPENAI_API_KEY');
  const prompt = 'Analiza este creativo de anuncio (imagen). Devuelve SOLO JSON: {"texto":"todo el texto visible en la imagen, literal","descripcion":"qué se ve: escena, personas, estilo, colores, elementos","secciones":[{"titulo":"...","texto":"..."}]}. Las secciones deben estructurar el mensaje del anuncio (ej: Hook, Mensaje, Oferta, CTA) según el texto y la imagen, en español.';
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${oai}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrl } }] }] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`vision: ${j.error.message}`);
  const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}');
  const texto: string = parsed.texto ?? '';
  const descripcion: string = parsed.descripcion ?? '';
  const secciones: Seccion[] = Array.isArray(parsed.secciones) ? parsed.secciones : [];
  if (descripcion) secciones.push({ titulo: 'Descripción visual', texto: descripcion });
  const transcript = [texto && `Texto: ${texto}`, descripcion && `Descripción: ${descripcion}`].filter(Boolean).join('\n\n');
  return { transcript, secciones };
}

// ── Orquestación por anuncio ─────────────────────────────────────────────────

/**
 * Procesa un anuncio completo (video o imagen). Nunca lanza: devuelve un
 * TranscribeResult con status, incluido 'error', para que el caller persista.
 */
export async function transcribeAd(adId: string): Promise<TranscribeResult> {
  const base: TranscribeResult = { ad_id: adId, video_id: null, tipo: null, status: 'ok', transcript: null, secciones: null, idioma: null, duracion_s: null, model: null, error: null };
  try {
    const ver = env('META_API_VERSION'), token = env('META_ACCESS_TOKEN'), oai = env('OPENAI_API_KEY');
    const video = await getAdVideo(adId, ver, token);

    if (video) {
      base.video_id = video.video_id;
      let size = 0;
      try { const h = await fetch(video.source, { method: 'HEAD' }); size = Number(h.headers.get('content-length') || 0); } catch { /* ignore */ }
      if (size > MAX_BYTES) return { ...base, tipo: 'video', status: 'muy_grande', error: `${(size / 1048576).toFixed(1)} MB > 25 MB` };
      const buf = Buffer.from(await (await fetch(video.source, { cache: 'no-store' })).arrayBuffer());
      if (buf.length > MAX_BYTES) return { ...base, tipo: 'video', status: 'muy_grande', error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB` };
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)], { type: 'video/mp4' }), 'ad.mp4');
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      const tr = await (await fetch(`${OAI}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${oai}` }, body: form })).json();
      if (tr.error) return { ...base, tipo: 'video', status: 'error', error: `whisper: ${tr.error.message}` };
      const text: string = tr.text ?? '';
      let secciones: Seccion[] | null = null;
      try { secciones = await structureTranscript(text); } catch { /* no fatal */ }
      return { ...base, tipo: 'video', status: 'ok', transcript: text, secciones, idioma: tr.language ?? null, duracion_s: tr.duration ?? null, model: 'whisper-1+gpt-4o-mini' };
    }

    // Sin video → imagen
    const img = await getAdImage(adId);
    if (!img) return { ...base, status: 'sin_video' };
    const { transcript, secciones } = await analyzeImage(img);
    return { ...base, tipo: 'imagen', status: 'ok', transcript, secciones, model: 'gpt-4o-mini' };
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
