'use client';

// =============================================================================
// creativeUpload — la ÚNICA subida de creativos del Ads Manager
// =============================================================================
// El navegador sube directo a Supabase Storage (URL firmada) para esquivar el
// límite de body del serverless; el server empuja a Meta. La usan los TRES modales:
// Nueva campaña (y su modo «subir creativos a una campaña»), Agregar anuncio y
// Agregar conjunto.
//
// ⚠️ Hasta el 07/10/2026 Nueva campaña tenía SU PROPIA copia de esta subida, con su
// putWithProgress y su makeThumb, y los tres escribían `processing: false` al volver
// del server sin mirar lo que el server decía (tarea #59): un video que Meta todavía
// no había procesado quedaba como listo. Dos implementaciones del mismo camino = dos
// lugares donde arreglar lo mismo; quedó una.
// =============================================================================

export type SubidoCreativo = {
  media_type: 'image' | 'video';
  image_hash: string | null;
  video_id: string | null;
  thumbnail_url: string | null;
  /** true = Meta todavía procesa el video: NO se puede usar. Esperarlo con esperarVideoListo. */
  processing: boolean;
  video_status: 'ready' | 'processing' | 'error' | null;
  /** El archivo en el staging: el server lo borra cuando Meta da su veredicto. */
  path: string | null;
};

/** El tope de la ruta (maxDuration 300 s) + margen: un fetch sin signal con la conexión
 *  caída no resuelve nunca, y la tarjeta quedaría en «Procesando» para siempre. */
const TOPE_POST_MS = 305_000;

/** Por qué este archivo no se puede subir, o null. Se pregunta ANTES de agregarlo a la
 *  bandeja: una tarjeta que aparece y desaparece se lee como un error de la subida. */
export function limiteCreativo(file: File): string | null {
  const esVideo = file.type.startsWith('video');
  const maxMb = esVideo ? 512 : 30;
  return file.size > maxMb * 1024 * 1024 ? `"${file.name}" supera el máximo (${maxMb} MB).` : null;
}

// PUT del archivo a la URL firmada de Supabase con progreso (multipart + apikey).
// `fetch` NO expone el progreso de SUBIDA: hace falta xhr.upload.onprogress (AGENTS.md,
// «Tres topes del entorno»). Topea en 99: el 100 lo pone quien llama al terminar.
function putWithProgress(url: string, file: File, apikey: string | null, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('x-upsert', 'true');
    if (apikey) { xhr.setRequestHeader('apikey', apikey); xhr.setRequestHeader('authorization', `Bearer ${apikey}`); }
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detalle = (xhr.responseText || '').replace(/\s+/g, ' ').slice(0, 200);
      try { const j = JSON.parse(xhr.responseText); detalle = String(j.message || j.error || detalle); } catch { /* texto plano */ }
      if (xhr.status === 413 || /too large|maximum allowed size|exceeded/i.test(detalle)) {
        return reject(new Error('El archivo supera el límite de Supabase Storage. Súbelo en Supabase → Storage → Settings → "Upload file size limit".'));
      }
      reject(new Error(`No se pudo subir el archivo (HTTP ${xhr.status})${detalle ? ` — ${detalle}` : ''}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo.'));
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', file);
    xhr.send(fd);
  });
}

function fitCanvas(w: number, h: number) {
  const max = 240; const scale = Math.min(1, max / Math.max(w || max, h || max));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((w || max) * scale));
  canvas.height = Math.max(1, Math.round((h || max) * scale));
  return { canvas, ctx: canvas.getContext('2d') };
}
// Miniatura local (dataURL) de la imagen o de un frame del video: para la previa en la
// app, para que MaKo mire el creativo (analyze-creatives sólo lee data:) y para el
// borrador. NO se manda a Meta: una data: URL Meta no la descarga (#3858258).
export function makeThumb(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (file.type.startsWith('image')) {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => { const { canvas, ctx } = fitCanvas(img.width, img.height); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      } else if (file.type.startsWith('video')) {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.muted = true; v.preload = 'metadata'; v.playsInline = true;
        v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch { /* */ } };
        v.onseeked = () => { const { canvas, ctx } = fitCanvas(v.videoWidth, v.videoHeight); if (!ctx) { URL.revokeObjectURL(url); return resolve(null); } ctx.drawImage(v, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); try { resolve(canvas.toDataURL('image/jpeg', 0.72)); } catch { resolve(null); } };
        v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        v.src = url;
      } else resolve(null);
    } catch { resolve(null); }
  });
}

/**
 * Sube un archivo (imagen/video) y lo empuja a Meta. onProgress 0..100.
 *
 * ⚠️ Volver de acá NO quiere decir que el creativo esté listo: con un video, `processing`
 * dice si Meta todavía lo procesa. Quien llama lo pasa a su bandeja TAL CUAL —nunca un
 * `processing: false` escrito a mano— y, si es true, espera con esperarVideoListo.
 */
export async function subirCreativo(file: File, onProgress: (pct: number) => void): Promise<SubidoCreativo> {
  const tope = limiteCreativo(file);
  if (tope) throw new Error(tope);
  const s = await fetch('/api/ads-manager/creative-signurl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type }) });
  const sj = await s.json().catch(() => null);
  if (!sj?.ok) throw new Error(sj?.error || 'No se pudo preparar la subida');
  await putWithProgress(sj.signedUrl, file, sj.apikey ?? null, onProgress);
  onProgress(100);
  const r = await fetch('/api/ads-manager/creative-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // `size` le ahorra al server bajar un video de 500 MB para descubrir que no se transcribe.
    body: JSON.stringify({ path: sj.path, content_type: file.type, filename: file.name, size: file.size }),
    signal: AbortSignal.timeout(TOPE_POST_MS),
  }).catch((e: unknown) => {
    // El corte dice DÓNDE quedó el trabajo: el archivo ya está en el storage, pero Meta
    // no contestó, así que no hay creativo que usar.
    const corte = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new Error(corte ? 'Se cortó la espera al procesar el creativo. Vuelve a subirlo.' : 'Error de red al procesar el creativo. Vuelve a subirlo.');
  });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('El servidor no respondió al procesar el creativo. Vuelve a subirlo.');
  if (!j.ok) throw new Error(j.error || 'No se pudo procesar el creativo');
  const vs = j.video_status === 'ready' || j.video_status === 'processing' || j.video_status === 'error' ? j.video_status : null;
  return {
    media_type: j.media_type,
    image_hash: j.image_hash ?? null,
    video_id: j.video_id ?? null,
    thumbnail_url: j.thumbnail_url ?? null,
    // Sólo un video puede estar procesándose; y sin video_id no hay a quién esperar.
    processing: j.media_type === 'video' && !!j.video_id && j.processing === true,
    video_status: vs,
    path: typeof j.path === 'string' ? j.path : (typeof sj.path === 'string' ? sj.path : null),
  };
}

export type FinEspera = 'ready' | 'error' | 'tope' | 'cancelado';

/** Cada cuánto se pregunta, y hasta cuándo. Meta suele tardar segundos; un video pesado,
 *  minutos. Pasado el tope no se da por bueno: se pide subirlo de nuevo. */
const CADA_MS = 5_000;
const TOPE_ESPERA_MS = 15 * 60_000;

function dormir(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Pregunta a Meta (vía GET /api/ads-manager/creative-upload) hasta que el video esté
 * 'ready' o 'error', o hasta el tope. 'cancelado' = el modal se cerró o el ítem se quitó.
 * Una respuesta que no se pudo leer NO es un veredicto: se vuelve a preguntar.
 * El server borra el staging cuando Meta contesta 'ready' o 'error'.
 */
export async function esperarVideoListo(videoId: string, path: string | null, opts: { signal?: AbortSignal; cadaMs?: number; topeMs?: number } = {}): Promise<FinEspera> {
  const cada = opts.cadaMs ?? CADA_MS;
  const hasta = Date.now() + (opts.topeMs ?? TOPE_ESPERA_MS);
  const qs = `video_id=${encodeURIComponent(videoId)}${path ? `&path=${encodeURIComponent(path)}` : ''}`;
  while (Date.now() < hasta) {
    await dormir(cada, opts.signal);
    if (opts.signal?.aborted) return 'cancelado';
    try {
      const r = await fetch(`/api/ads-manager/creative-upload?${qs}`, { cache: 'no-store', signal: opts.signal });
      const j = await r.json().catch(() => null);
      if (j?.ok && j.estado === 'ready') return 'ready';
      if (j?.ok && j.estado === 'error') return 'error';
    } catch {
      if (opts.signal?.aborted) return 'cancelado';
      /* un bache de red: se vuelve a preguntar */
    }
  }
  return 'tope';
}

/**
 * POST de una publicación (campaign-create, ad-add, adset-add) con el tope de la ruta.
 * null = no hubo respuesta legible: la plataforma cortó (504), la red se cayó o pasó el
 * tope. Antes era un `r.json()` sin catch y sin signal: un 504 tiraba «Unexpected token»
 * y el botón volvía a quedar listo para crear OTRA campaña.
 */
export async function postConTope(url: string, body: unknown): Promise<RespuestaPublicar | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(TOPE_POST_MS) });
    const j = (await r.json().catch(() => null)) as RespuestaPublicar | null;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

/** Lo que contestan campaign-create, ad-add y adset-add. `estado` viene en los 409 de la
 *  idempotencia ('esperar' | 'a-medias') y del chequeo de videos. */
export type RespuestaPublicar = {
  ok?: boolean; error?: string; estado?: string; repetida?: boolean;
  campaign_id?: string; adset_id?: string; ad_id?: string;
  ad_ids?: string[]; creative_ids?: string[]; created?: number;
};

/** Sin respuesta, con la clave de idempotencia puesta, el server sabe qué pasó: el mismo
 *  clic contesta lo que ya se creó en vez de crearlo de nuevo. */
export const SIN_RESPUESTA = 'El servidor no respondió. Reintentar es seguro: no se duplica.';

/**
 * La línea que acompaña a una tarjeta en «Procesando». La regla de la casa para un
 * spinner que puede pasar los ~8 s: decir cuánto puede tardar y qué pasa si se cierra.
 * Y lo que pasa depende del modal: Nueva campaña guarda el borrador y retoma la espera;
 * los otros dos no guardan nada.
 */
export const AVISO_PROCESANDO_RETOMA = 'Meta está procesando el video. Puede tardar unos minutos; si cierras, sigue al volver.';
export const AVISO_PROCESANDO_NO_CIERRES = 'Meta está procesando el video. Puede tardar unos minutos; no cierres esta ventana.';

/** ¿Hay un video ya subido que Meta todavía procesa? (progress 100 = la subida terminó). */
export const esperandoAMeta = (t: { processing?: boolean; media_type?: string; progress?: number } | null | undefined): boolean =>
  !!t?.processing && t.media_type === 'video' && (t.progress ?? 0) >= 100;

/** Lo que se le dice a la persona cuando la espera no terminó bien. Corto: es el pie de
 *  un modal. */
export function motivoFinEspera(fin: FinEspera, nombre: string): string | null {
  if (fin === 'error') return `Meta no pudo procesar «${nombre}». Prueba con otro archivo.`;
  if (fin === 'tope') return `Meta no terminó de procesar «${nombre}». Súbelo de nuevo.`;
  return null;
}
