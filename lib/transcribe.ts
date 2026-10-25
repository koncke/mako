// =============================================================================
// Transcripción + estructuración del creativo de un anuncio (y de los creativos que sube el negocio)
// =============================================================================
//   - Video: Meta source (mp4) → la IA del NEGOCIO escucha (`transcribirAudio`) → texto → secciones.
//   - Imagen (sin video): Meta image → la IA del NEGOCIO mira (`leerDocumentoIA`) → texto + descripción → secciones.
// No escribe en la BD; el caller persiste el resultado.
//
// ⚠️ IA7 (22/10/2026): UNA SOLA PUERTA PARA EL AUDIO. Esto era una segunda cascada con las keys del ENTORNO (whisper-1,
// gpt-4o-mini, gpt-4o de MaKo), fuera de D6b y sin registrar uso. La OpenAI de MaKo se quedó sin crédito: en 30 días hubo
// 55 «vision» y 28 «whisper» con «no credits» en ad_transcripts y 0 OK. Ahora todo pasa por la capa de IA con las keys
// del negocio (lib/ai-cheap.ts): su OpenAI si tiene su IA (D6b), sus keys de siempre si no. Los anuncios no van a la red
// gratis de la plataforma (`pii`) mientras Martín no decida si el Groq de MaKo los escucha. Sin con qué, la fila dice POR
// QUÉ (`errorDeCascada`), en vez de un «whisper: You have no credits» que el negocio no puede arreglar.
//
// Lo de la PLATAFORMA (las clases de los cursos, el Conocimiento de MaKo) quedó en lib/transcribe-plataforma.ts.
// Este módulo necesita el server (la capa de IA lleva `server-only`): un script lo corre con `--conditions=react-server`
// y adentro de `runWithWorkspace`.

// Relativo y no `@/`, a propósito: lo importan scripts además de las rutas.
import { salidaDegenerada } from './stt-degenerado';
import { zFetch } from './zernio';
import { mediaDeAnuncio, type MediaDeAnuncio } from './zernio-meta-cuerpo';

const GRAPH = 'https://graph.facebook.com';
const MAX_BYTES = 25 * 1024 * 1024; // lo que escucha Whisper; Gemini topea antes (14 MB inline)

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

/** Lector del entorno, SÓLO para Meta (la versión de la API y el token del dueño para los scripts). Ninguna key de IA. */
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} no definida`);
  return v;
}

/** El porqué en palabras del negocio cuando su IA no pudo (o no tiene con qué). */
async function porQueNoPudo(e: unknown, tema: string): Promise<string> {
  const ai = await import('./ai-cheap');
  const errores = e instanceof ai.SttSinEscucha ? e.errores : [e instanceof Error ? e.message : String(e)];
  return ai.errorDeCascada(errores, tema).catch(() => (e instanceof Error ? e.message : String(e)));
}

/**
 * Escucha un audio o video del NEGOCIO con su IA (lib/ai-cheap.ts → `transcribirAudio`). Nunca tira: devuelve el texto y
 * quién lo escuchó, o el porqué.
 */
async function escuchar(buf: Buffer, mime: string, o: { hint?: string; feature: string; motivo: string }): Promise<{ texto: string; quien: string | null } | { error: string }> {
  const ai = await import('./ai-cheap');
  let quien: string | null = null;
  try {
    const texto = await ai.transcribirAudio(buf.toString('base64'), mime, {
      prompt: o.hint, feature: o.feature, motivo: o.motivo,
      // Los anuncios y los creativos del negocio llevan sus datos (`pii`): sus keys, y de la red sólo el Gemini de la
      // plataforma en el plan pago. Groq no: no es una nota de voz (IA16, Martín 22/10/2026: «Groq sólo para las notas de
      // voz», y «la transcripción de anuncios pasa a Gemini»).
      pii: true,
      sinGroq: true,
      alEscuchar: (q) => { quien = q; },
    });
    const bucle = salidaDegenerada(texto);
    if (bucle) return { error: bucle.motivo };
    return { texto, quien };
  } catch (e) {
    return { error: await porQueNoPudo(e, 'transcribir el audio del anuncio') };
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

// ── La IA del negocio: estructurar el guion / mirar la imagen ─────────────────

// Texto base (default) del system de estructuración. Editable desde Configuraciones:
// el caller (ruta server) resuelve el override y lo pasa como `systemBase`. Los
// scripts no pasan nada → usan este default.
export const STRUCTURE_SYSTEM_BASE = 'Eres un analista de anuncios. Divide el guion en secciones consecutivas con títulos cortos en español según su función (ej: Hook, Problema, Agitación, Solución, Oferta, Prueba/Autoridad, CTA — usa solo los que apliquen). No inventes ni resumas: reparte el TEXTO LITERAL entre las secciones. Devuelve SOLO JSON: {"secciones":[{"titulo":"...","texto":"..."}]}.';

const leerSecciones = (t: string): Seccion[] | null => {
  try {
    const parsed = JSON.parse(t) as { secciones?: unknown };
    return Array.isArray(parsed.secciones) ? (parsed.secciones as Seccion[]) : null;
  } catch { return null; }
};

/** Divide un guion en secciones con títulos (Hook, Problema, Oferta, CTA…), con la IA del negocio. */
export async function structureTranscript(text: string, instruccion?: string, systemBase: string = STRUCTURE_SYSTEM_BASE): Promise<Seccion[] | null> {
  if (!text || text.trim().length < 20) return null;
  let sys = systemBase;
  if (instruccion) sys += `\nInstrucción adicional del usuario (priorízala): ${instruccion}`;
  const { chatCheapCascade } = await import('./ai-cheap');
  const salida = await chatCheapCascade({
    system: sys, user: text, json: true, maxTokens: 4000, feature: 'anuncios-estructura', motivo: 'Estructurar el guion de un anuncio',
    validar: (t) => leerSecciones(t) != null,
  });
  return salida ? leerSecciones(salida) : null;
}

// ── Transcripción de un creativo SUBIDO por el negocio (Ads Manager) ──────────
// Lo de la plataforma (las clases de los cursos, el Conocimiento de MaKo) está en lib/transcribe-plataforma.ts.
export type UploadTranscribeResult = {
  status: 'ok' | 'muy_grande' | 'error';
  transcript: string | null;
  idioma: string | null;
  duracion_s: number | null;
  error: string | null;
  /** Qué IA del negocio lo transcribió de verdad. */
  model?: string | null;
};

export async function transcribeMediaBuffer(bytes: ArrayBuffer, mime: string, _filename: string, hint?: string): Promise<UploadTranscribeResult> {
  const buf = Buffer.from(bytes);
  if (buf.length > MAX_BYTES) {
    return { status: 'muy_grande', transcript: null, idioma: null, duracion_s: null, model: null, error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB. Sube solo el audio o recorta el video.` };
  }
  const r = await escuchar(buf, mime, { hint, feature: 'anuncios-transcribir', motivo: 'Transcribir un creativo subido' });
  if ('error' in r) return { status: 'error', transcript: null, idioma: null, duracion_s: null, model: null, error: r.error };
  // ⚠️ Un 200 con texto VACÍO no es un fallo: puede ser un video sin voz. Se devuelve ok y el que llama decide.
  return { status: 'ok', transcript: r.texto, idioma: null, duracion_s: null, model: r.quien, error: null };
}

/** Descarga la imagen y la devuelve como data URL base64 (los modelos no pueden bajar las URLs del CDN de Meta). */
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

/** Analiza la imagen de un anuncio con la IA del negocio: texto visible + descripción + secciones. */
async function analyzeImage(imageUrl: string, instruccion?: string, promptBase: string = IMAGE_PROMPT_BASE): Promise<{ transcript: string; secciones: Seccion[]; quien: string }> {
  const dataUrl = await toDataUrl(imageUrl);
  let prompt = promptBase;
  if (instruccion) prompt += `\nInstrucción adicional del usuario (priorízala): ${instruccion}`;
  const { leerDocumentoIA } = await import('./ai-cheap');
  const r = await leerDocumentoIA({ dataUrl, isPdf: false, nombreArchivo: 'creativo.jpg', prompt, json: true, feature: 'anuncios-imagen', motivo: 'Leer la imagen de un anuncio' });
  const parsed = JSON.parse(r.text || '{}') as { texto?: string; descripcion?: string; secciones?: unknown };
  const texto: string = parsed.texto ?? '';
  const descripcion: string = parsed.descripcion ?? '';
  const secciones: Seccion[] = (Array.isArray(parsed.secciones) ? (parsed.secciones as Seccion[]) : []).filter((s) => !/descripci[oó]n visual/i.test(s.titulo ?? ''));
  if (descripcion) secciones.push({ titulo: 'Descripción visual', texto: descripcion });
  const transcript = [texto && `Texto: ${texto}`, descripcion && `Descripción: ${descripcion}`].filter(Boolean).join('\n\n');
  return { transcript, secciones, quien: r.provider };
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
    /** La clave de Zernio del negocio, si conectó Meta por ahí (`accesoDeMeta`, lib/meta-via.ts, 25/10/2026). Con ella el
     *  video y la imagen salen de `GET /v1/ads/{adId}/media`; si Zernio falla, sigue por `metaToken` si lo hay. Con clave
     *  y sin token NUNCA cae al token del entorno: sería el de otro negocio. */
    zernioClave?: string;
  },
): Promise<TranscribeResult> {
  const instruccion = opts?.instruccion?.trim() || undefined;
  const pr = opts?.prompts;
  // Glosario global para la escucha: si no hay instrucción puntual del anuncio, sesga
  // la ortografía con el glosario configurado (vacío → no se manda nada).
  const whisperHint = instruccion || (pr?.whisperGlossary?.trim() || undefined);
  const base: TranscribeResult = { ad_id: adId, video_id: null, tipo: null, status: 'ok', transcript: null, secciones: null, idioma: null, duracion_s: null, model: null, error: null };
  try {
    // Por Zernio (25/10/2026): los links directos del video y la imagen. Si falla y hay token, por la Graph API.
    let porZernio: MediaDeAnuncio | null = null;
    if (opts?.zernioClave) {
      try {
        porZernio = mediaDeAnuncio(await zFetch<unknown>(opts.zernioClave, `/ads/${encodeURIComponent(adId)}/media`, undefined, 30_000));
        if (!porZernio) throw new Error('Zernio contestó el creativo sin la lista `media`');
      } catch (e) {
        if (!opts.metaToken) throw e;
        console.error(`[transcribe] creativo de ${adId} por Zernio falló, sigo por el token: ${e instanceof Error ? e.message : String(e)}`);
        porZernio = null;
      }
    }
    const token = porZernio ? null : (opts?.metaToken ?? env('META_ACCESS_TOKEN'));
    const video = porZernio
      ? (porZernio.video ? { video_id: porZernio.video.videoId ?? '', source: porZernio.video.url } : null)
      : await getAdVideo(adId, env('META_API_VERSION'), token!);

    if (video) {
      base.video_id = video.video_id;
      let size = 0;
      try { const h = await fetch(video.source, { method: 'HEAD' }); size = Number(h.headers.get('content-length') || 0); } catch { /* ignore */ }
      if (size > MAX_BYTES) return { ...base, tipo: 'video', status: 'muy_grande', error: `${(size / 1048576).toFixed(1)} MB > 25 MB` };
      const buf = Buffer.from(await (await fetch(video.source, { cache: 'no-store' })).arrayBuffer());
      if (buf.length > MAX_BYTES) return { ...base, tipo: 'video', status: 'muy_grande', error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB` };
      const r = await escuchar(buf, 'video/mp4', { hint: whisperHint, feature: 'anuncios-transcribir', motivo: `Transcribir el anuncio ${adId}` });
      if ('error' in r) return { ...base, tipo: 'video', status: 'error', error: r.error };
      let secciones: Seccion[] | null = null;
      try { secciones = await structureTranscript(r.texto, instruccion, pr?.structureSystem); } catch { /* no fatal */ }
      return { ...base, tipo: 'video', status: 'ok', transcript: r.texto, secciones, model: r.quien };
    }

    // Sin video → imagen. Preferir la imagen de ALTA resolución del creativo/post
    // (getAdImage); el thumbnail guardado es respaldo (puede ser minúsculo).
    let img: string | null = porZernio ? porZernio.imagen : null;
    if (!porZernio) { try { img = await getAdImage(adId, opts?.metaToken); } catch { /* no fatal */ } }
    img = img ?? opts?.imageUrl ?? null;
    if (!img) return { ...base, status: 'sin_video' };
    try {
      const { transcript, secciones, quien } = await analyzeImage(img, instruccion, pr?.imagePrompt);
      return { ...base, tipo: 'imagen', status: 'ok', transcript, secciones, model: quien };
    } catch (e) {
      return { ...base, tipo: 'imagen', status: 'error', error: await porQueNoPudo(e, 'leer la imagen del anuncio') };
    }
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
