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

// Lector síncrono del entorno. Es válido SOLO después de `await asegurarCreds()`:
// la hidratación de credenciales no está garantizada cuando entra un request
// (ver credencialesListas() en lib/credenciales.ts).
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} no definida`);
  return v;
}

/**
 * Barrera: espera la hidratación del boot y, si igual no dejó la key de OpenAI,
 * la resuelve contra la base y la deja en el entorno para que `env()` la vea.
 *
 * No es defensivo de más: sin esto, un cold start a medio hidratar hacía que
 * `transcribeAd` tirara "Env var OPENAI_API_KEY no definida", y el cron guardaba
 * la fila con status 'error' — que hasta hoy contaba como "ya transcrito" y dejaba
 * al anuncio sin texto PARA SIEMPRE. Pasó con 9 anuncios de ws1 y ws3 entre el
 * 2026-07-29 y el 08-03.
 *
 * El import es DINÁMICO y con catch a propósito: este módulo se mantiene libre de
 * `server-only` para que lo puedan usar los scripts CLI (backfill-transcripts), y
 * lib/credenciales sí lo tiene. En un script no hay nada que hidratar — la key ya
 * viene del .env — así que el catch es el camino esperado, no un error.
 */
async function asegurarCreds(): Promise<void> {
  if (process.env.OPENAI_API_KEY) return;
  try {
    const { envCred } = await import('./credenciales');
    const k = await envCred('OPENAI_API_KEY');
    if (k) process.env.OPENAI_API_KEY = k;
  } catch {
    /* contexto sin server (script CLI): se sigue con lo que haya en el entorno */
  }
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

/**
 * Mejor imagen del creativo (alta resolución) para anuncios sin video.
 * Para creativos dinámicos (DCO) los campos directos vienen vacíos y el
 * thumbnail es minúsculo (ilegible) → usamos full_picture del post, que apunta
 * a la imagen real (a veces en storage externo vía proxy ?url=).
 * `metaToken`: token de Meta del WORKSPACE (los callers server lo resuelven con
 * credWs); sin él cae al env global (dueño / scripts CLI).
 */
export async function getAdImage(adId: string, metaToken?: string): Promise<string | null> {
  const ver = env('META_API_VERSION'), token = metaToken ?? env('META_ACCESS_TOKEN');
  const cu = new URL(`${GRAPH}/${ver}/${adId}`);
  cu.searchParams.set('fields', 'creative{image_url,object_story_spec{link_data{picture},photo_data{url}},asset_feed_spec{images{url}},effective_object_story_id}');
  cu.searchParams.set('access_token', token);
  const c = await (await fetch(cu, { cache: 'no-store' })).json();
  if (c.error) throw new Error(`creative img: ${c.error.message}`);
  const cr = c.creative ?? {};
  const direct = cr.image_url ?? cr.object_story_spec?.link_data?.picture ?? cr.object_story_spec?.photo_data?.url ?? cr.asset_feed_spec?.images?.[0]?.url;
  if (direct) return direct;

  // Fallback: imagen real del post.
  const story = cr.effective_object_story_id;
  if (story) {
    const su = new URL(`${GRAPH}/${ver}/${story}`);
    su.searchParams.set('fields', 'full_picture');
    su.searchParams.set('access_token', token);
    const sb = await (await fetch(su, { cache: 'no-store' })).json();
    const fp: string | undefined = sb?.full_picture;
    if (fp) {
      try { const real = new URL(fp).searchParams.get('url'); if (real) return real; } catch { /* no es proxy */ }
      return fp;
    }
  }
  return null;
}

// ── OpenAI: estructurar guion / analizar imagen ──────────────────────────────

// Texto base (default) del system de estructuración. Editable desde Configuraciones:
// el caller (ruta server) resuelve el override y lo pasa como `systemBase`. Los
// scripts no pasan nada → usan este default. transcribe.ts queda sin server-only.
export const STRUCTURE_SYSTEM_BASE = 'Eres un analista de anuncios. Divide el guion en secciones consecutivas con títulos cortos en español según su función (ej: Hook, Problema, Agitación, Solución, Oferta, Prueba/Autoridad, CTA — usa solo los que apliquen). No inventes ni resumas: reparte el TEXTO LITERAL entre las secciones. Devuelve SOLO JSON: {"secciones":[{"titulo":"...","texto":"..."}]}.';

/** Divide un guion en secciones con títulos (Hook, Problema, Oferta, CTA…). */
export async function structureTranscript(text: string, instruccion?: string, systemBase: string = STRUCTURE_SYSTEM_BASE): Promise<Seccion[] | null> {
  if (!text || text.trim().length < 20) return null;
  await asegurarCreds();
  const oai = env('OPENAI_API_KEY');
  let sys = systemBase;
  if (instruccion) sys += `\nInstrucción adicional del usuario (priorízala): ${instruccion}`;
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

// ── Transcripción de un archivo SUBIDO (clase, video de curso, audio) ─────────
// Genérica: la usa el Conocimiento de MaKo para "bajar a tierra" cursos a partir
// de un video/audio. OpenAI whisper-1 acepta audio y video hasta 25 MB.
export type UploadTranscribeResult = {
  status: 'ok' | 'muy_grande' | 'error';
  transcript: string | null;
  idioma: string | null;
  duracion_s: number | null;
  error: string | null;
};

export async function transcribeMediaBuffer(
  bytes: ArrayBuffer,
  mime: string,
  filename: string,
  hint?: string,
): Promise<UploadTranscribeResult> {
  const buf = Buffer.from(bytes);
  if (buf.length > MAX_BYTES) {
    return { status: 'muy_grande', transcript: null, idioma: null, duracion_s: null, error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB (límite de OpenAI). Subí solo el audio o recortá el video.` };
  }
  await asegurarCreds();
  try {
    const oai = env('OPENAI_API_KEY');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'application/octet-stream' }), filename || 'clase');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    if (hint?.trim()) form.append('prompt', hint.trim()); // sesga ortografía/términos
    const tr = await (await fetch(`${OAI}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${oai}` }, body: form })).json();
    if (tr.error) return { status: 'error', transcript: null, idioma: null, duracion_s: null, error: `whisper: ${tr.error.message}` };
    return { status: 'ok', transcript: tr.text ?? '', idioma: tr.language ?? null, duracion_s: tr.duration ?? null, error: null };
  } catch (e) {
    return { status: 'error', transcript: null, idioma: null, duracion_s: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Descarga la imagen y la devuelve como data URL base64 (OpenAI no puede bajar
 *  las URLs del CDN de Meta, así que se las mandamos embebidas). */
async function toDataUrl(imageUrl: string): Promise<string> {
  const r = await fetch(imageUrl, { cache: 'no-store' });
  if (!r.ok) throw new Error(`imagen HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:${ct};base64,${buf.toString('base64')}`;
}

// Texto base (default) del prompt de visión. Editable desde Configuraciones (ver
// STRUCTURE_SYSTEM_BASE para el patrón override-por-parámetro).
export const IMAGE_PROMPT_BASE = 'Analiza este creativo de anuncio (imagen). Transcribe TODO el texto visible de forma LITERAL y exacta (respeta saltos y mayúsculas). Devuelve SOLO JSON: {"texto":"todo el texto visible, literal","descripcion":"qué se ve: escena, personas, estilo, colores, elementos","secciones":[{"titulo":"...","texto":"..."}]}. Las secciones estructuran SOLO el MENSAJE del anuncio (ej: Hook, Mensaje, Oferta, CTA); NO pongas la descripción visual como sección. Todo en español.';

/** Analiza la imagen de un anuncio: texto visible + descripción + secciones. */
async function analyzeImage(imageUrl: string, instruccion?: string, promptBase: string = IMAGE_PROMPT_BASE): Promise<{ transcript: string; secciones: Seccion[] }> {
  await asegurarCreds();
  const oai = env('OPENAI_API_KEY');
  const dataUrl = await toDataUrl(imageUrl);
  let prompt = promptBase;
  if (instruccion) prompt += `\nInstrucción adicional del usuario (priorízala): ${instruccion}`;
  const r = await fetch(`${OAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${oai}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }] }] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`vision: ${j.error.message}`);
  const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}');
  const texto: string = parsed.texto ?? '';
  const descripcion: string = parsed.descripcion ?? '';
  const secciones: Seccion[] = (Array.isArray(parsed.secciones) ? parsed.secciones : []).filter((s: Seccion) => !/descripci[oó]n visual/i.test(s.titulo ?? ''));
  if (descripcion) secciones.push({ titulo: 'Descripción visual', texto: descripcion });
  const transcript = [texto && `Texto: ${texto}`, descripcion && `Descripción: ${descripcion}`].filter(Boolean).join('\n\n');
  return { transcript, secciones };
}

// ── Orquestación por anuncio ─────────────────────────────────────────────────

/**
 * Procesa un anuncio completo (video o imagen). Nunca lanza: devuelve un
 * TranscribeResult con status, incluido 'error', para que el caller persista.
 */
export async function transcribeAd(
  adId: string,
  opts?: {
    imageUrl?: string;
    instruccion?: string;
    /** Prompts editables resueltos por el caller (ruta server). Los scripts los omiten. */
    prompts?: { structureSystem?: string; imagePrompt?: string; whisperGlossary?: string };
    /** Token de Meta del WORKSPACE (resolver con credWs en el caller server). Sin
     *  él cae al env global (dueño / scripts CLI) — NUNCA omitir para un cliente. */
    metaToken?: string;
  },
): Promise<TranscribeResult> {
  const instruccion = opts?.instruccion?.trim() || undefined;
  const pr = opts?.prompts;
  // Glosario global para whisper: si no hay instrucción puntual del anuncio, sesga
  // la ortografía con el glosario configurado (vacío → no se manda nada).
  const whisperHint = instruccion || (pr?.whisperGlossary?.trim() || undefined);
  const base: TranscribeResult = { ad_id: adId, video_id: null, tipo: null, status: 'ok', transcript: null, secciones: null, idioma: null, duracion_s: null, model: null, error: null };
  await asegurarCreds();
  try {
    const ver = env('META_API_VERSION'), token = opts?.metaToken ?? env('META_ACCESS_TOKEN'), oai = env('OPENAI_API_KEY');
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
      if (whisperHint) form.append('prompt', whisperHint); // sesga ortografía/términos
      const tr = await (await fetch(`${OAI}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${oai}` }, body: form })).json();
      if (tr.error) return { ...base, tipo: 'video', status: 'error', error: `whisper: ${tr.error.message}` };
      const text: string = tr.text ?? '';
      let secciones: Seccion[] | null = null;
      try { secciones = await structureTranscript(text, instruccion, pr?.structureSystem); } catch { /* no fatal */ }
      return { ...base, tipo: 'video', status: 'ok', transcript: text, secciones, idioma: tr.language ?? null, duracion_s: tr.duration ?? null, model: 'whisper-1+gpt-4o-mini' };
    }

    // Sin video → imagen. Preferir la imagen de ALTA resolución del creativo/post
    // (getAdImage); el thumbnail guardado es respaldo (puede ser minúsculo).
    let img: string | null = null;
    try { img = await getAdImage(adId, opts?.metaToken); } catch { /* no fatal */ }
    img = img ?? opts?.imageUrl ?? null;
    if (!img) return { ...base, status: 'sin_video' };
    const { transcript, secciones } = await analyzeImage(img, instruccion, pr?.imagePrompt);
    return { ...base, tipo: 'imagen', status: 'ok', transcript, secciones, model: 'gpt-4o' };
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
