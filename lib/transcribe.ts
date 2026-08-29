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
  /** Qué proveedor lo transcribió de verdad. Ver la nota de STT_CASCADA. */
  model?: string | null;
};

// ── QUIÉN ESCUCHA, Y EN QUÉ ORDEN ────────────────────────────────────────────
//
// ⚠️ ESTO NO TENÍA FALLBACK, Y SE COBRÓ CARO. Era una sola llamada a OpenAI: el día
// que la cuenta se quedó sin crédito, 7 clases de «Creator Club» quedaron SIN
// transcripción en medio de una corrida de 62 —con el mensaje «You have no credits
// remaining», que es clarísimo, pero llegó después de haber gastado el audio de las
// otras 55—. Y peor: como el .md viejo (truncado) seguía en disco, republicar habría
// publicado el texto cortado igual.
//
// El orden es GRATIS PRIMERO, y no es una degradación: `whisper-large-v3-turbo` de
// Groq es un modelo MÁS grande que `whisper-1`. Es la misma regla que gobierna el
// chat en AGENTS.md —lo que cobra es el último recurso, no el segundo— aplicada a
// escuchar.
//
// ⚠️ Y EL PROVEEDOR QUE ESCUCHÓ SE DEVUELVE, no se calla. «Un fallback que no cobra
// es una degradación silenciosa»: si mañana un proveedor transcribe peor, la única
// forma de enterarse es que el artefacto diga quién lo hizo. `curso-transcribir.ts`
// lo escribe en la cabecera del .md.
//
// No se usa la cascada de `lib/ai-cheap.ts` a propósito, y la diferencia es real: esa
// arranca por Gemini, que manda el audio INLINE y topea en 14 MB, mientras que acá
// entran archivos de hasta 25 MB; además resuelve credenciales por workspace y
// registra uso, que en un script de línea de comandos son efectos que nadie pidió.
// Lo que sí se comparte es el criterio: gratis primero, pago último, y se dice cuál.
const STT_CASCADA: Array<{ nombre: string; base: string; modelo: string; envKey: string }> = [
  { nombre: 'groq', base: 'https://api.groq.com/openai/v1', modelo: 'whisper-large-v3-turbo', envKey: 'GROQ_API_KEY' },
  { nombre: 'openai', base: OAI, modelo: 'whisper-1', envKey: 'OPENAI_API_KEY' },
];

// ── El tercer proveedor, que no habla el mismo protocolo ─────────────────────
//
// Groq y OpenAI comparten `/audio/transcriptions`; Gemini no: manda el audio DENTRO del
// request (`inline_data`) contra `generateContent`. Por eso está aparte y no en la tabla
// de arriba.
//
// Hace falta porque una cascada de dos se agota entera: medido el 2026-08-20, la cuenta
// de OpenAI sin crédito y Groq en su tope de 7.200 s de audio por hora, las dos al mismo
// tiempo, con 48 clases sin transcribir esperando.
//
// ⚠️ Y TRAE UNA TRAMPA QUE WHISPER NO TIENE: un techo de tokens de SALIDA. Con el default
// que usa `lib/ai-cheap.ts` para notas de voz (2.048) una clase de 20 minutos vuelve
// cortada, bien escrita y sin ningún error — que es exactamente la falla que este
// pipeline pasó el día entero sacando. Por eso acá el techo es alto Y se mira
// `finishReason`: si no dice STOP, no es una transcripción, es media.
const MAX_INLINE_GEMINI = 14 * 1024 * 1024;   // va dentro del request: hay techo de tamaño

async function sttGemini(buf: Buffer, mime: string, key: string, hint?: string): Promise<{ texto: string; modelo: string }> {
  if (buf.length > MAX_INLINE_GEMINI) throw new Error(`${(buf.length / 1048576).toFixed(1)} MB: no entra inline (tope 14 MB)`);
  const modelo = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  // ⚠️ «EN SU IDIOMA ORIGINAL» NO ES UNA PREFERENCIA: ACÁ DECÍA «en español» Y ESO ES UNA
  // ORDEN DE TRADUCIR.
  //
  // Se escribió cuando todos los cursos eran en español, donde no cambiaba nada. El primer
  // curso en inglés (Iman Gadzhi, 24/08/2026) salió con 3 de sus 26 clases TRADUCIDAS al
  // español y 22 en inglés: Gemini obedeció la orden unas veces y la ignoró otras, así que
  // el resultado es una moneda al aire y volver a correrlo no lo arregla.
  //
  // Y no salió gratis en contenido. Traducir compite con transcribir literal —son dos
  // tareas, no una— y en la clase 020 el modelo resolvió el conflicto RESUMIENDO: 95
  // palabras por minuto contra una mediana de 215 en las que quedaron en inglés, con el
  // medio de la clase degenerado en apuntes sueltos («Formulario de admisión.», «Tamaños
  // de audiencia.»). El pedido de traducir se llevó puesta la mitad del material.
  //
  // Es «un tope elegido contra UN proveedor apaga a los demás» (AGENTS.md) aplicada al
  // IDIOMA: un valor elegido cuando el universo era homogéneo pasa a gobernar al primero
  // que no lo es, y nadie vuelve a mirarlo.
  const instruccion = [
    'Transcribí este audio EN SU IDIOMA ORIGINAL. NO traduzcas: si el audio está en inglés,',
    'la transcripción va en inglés; si está en español, en español.',
    'Devolvé SOLO la transcripción literal de lo que se dice: sin comillas, sin timestamps,',
    'sin nombres de hablante, sin comentarios tuyos y sin describir el audio.',
    'Transcribí el audio COMPLETO, de principio a fin, sin resumir ni abreviar.',
    hint?.trim() ? `Contexto (nombres propios y jerga que pueden aparecer): ${hint.trim()}` : '',
  ].filter(Boolean).join(' ');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruccion }, { inline_data: { mime_type: (mime || 'audio/mp4').split(';')[0].trim(), data: buf.toString('base64') } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(300000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || 'sin detalle'}`);
  const fin = data.candidates?.[0]?.finishReason;
  if (fin && fin !== 'STOP') throw new Error(`se cortó (finishReason=${fin}): no devuelvo media transcripción`);
  const texto = (data.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? '').join('').trim();
  if (!texto) throw new Error('devolvió vacío');
  return { texto, modelo };
}

export async function transcribeMediaBuffer(
  bytes: ArrayBuffer,
  mime: string,
  filename: string,
  hint?: string,
): Promise<UploadTranscribeResult> {
  const buf = Buffer.from(bytes);
  if (buf.length > MAX_BYTES) {
    return { status: 'muy_grande', transcript: null, idioma: null, duracion_s: null, model: null, error: `${(buf.length / 1048576).toFixed(1)} MB > 25 MB (límite de OpenAI). Sube solo el audio o recorta el video.` };
  }
  await asegurarCreds();

  const errores: string[] = [];
  for (const p of STT_CASCADA) {
    let key = '';
    try { key = env(p.envKey); } catch { /* sin key: se prueba el que sigue */ }
    if (!key) { errores.push(`${p.nombre}: sin ${p.envKey}`); continue; }
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buf)], { type: mime || 'application/octet-stream' }), filename || 'clase');
      form.append('model', p.modelo);
      form.append('response_format', 'verbose_json');
      if (hint?.trim()) form.append('prompt', hint.trim()); // sesga ortografía/términos
      const tr = await (await fetch(`${p.base}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })).json();
      if (tr.error) { errores.push(`${p.modelo}: ${tr.error.message}`); continue; }
      // ⚠️ Un 200 con texto VACÍO no es un éxito ni un fallo del proveedor: puede ser
      // un audio sin voz. Se devuelve como ok con el texto vacío y el que llama decide,
      // pero NO se cae al siguiente proveedor —gastar dos veces por un silencio.
      return { status: 'ok', transcript: tr.text ?? '', idioma: tr.language ?? null, duracion_s: tr.duration ?? null, model: p.modelo, error: null };
    } catch (e) {
      errores.push(`${p.modelo}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Gemini va ÚLTIMO entre los gratis y no primero: los dos Whisper devuelven además la
  // duración y el idioma medidos del audio —que es lo que después permite comparar la
  // transcripción contra la fuente— y Gemini no devuelve ninguno de los dos. Se usa
  // cuando los otros no pueden, que es para lo que se sumó.
  const kGemini = (() => { try { return env('GEMINI_API_KEY'); } catch { return ''; } })();
  if (kGemini) {
    try {
      const { texto, modelo } = await sttGemini(buf, mime, kGemini, hint);
      return { status: 'ok', transcript: texto, idioma: null, duracion_s: null, model: modelo, error: null };
    } catch (e) {
      errores.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    errores.push('gemini: sin GEMINI_API_KEY');
  }

  return { status: 'error', transcript: null, idioma: null, duracion_s: null, model: null, error: `ningún proveedor pudo transcribir — ${errores.join(' | ')}` };
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
