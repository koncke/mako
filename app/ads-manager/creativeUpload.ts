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

import { claveIdemGuardada, type ClaveIdem } from '@/lib/meta-idempotencia';
import { wsDeBusqueda } from '@/lib/ws-tab';
import type { CreativoMako } from '@/lib/creativo-mako';

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
 * La miniatura de un video que ya vive en el bucket propio (tarea #797): un frame,
 * dibujado en el navegador, como dataURL. null si no se pudo.
 *
 * ⚠️ NUNCA la url del .mp4 como miniatura: una url http en `thumbnail_url` viaja a Meta
 * como video_data.image_url (lib/meta-ads-create.ts, buildObjectStorySpec) y Meta rechaza
 * el creativo. Una data: no viaja (sólo se reenvía http) y la miniatura de Meta la
 * reemplaza al publicar; y además es lo único que «MaKo mira los creativos» sabe leer.
 *
 * El canvas queda limpio porque el bucket contesta `Access-Control-Allow-Origin: *`
 * (medido el 07/10/2026 sobre una toma real, GET con Range y el preflight). Si eso cambia,
 * el canvas queda «tainted», toDataURL tira y esto devuelve null — que es seguro.
 */
export function makeThumbDeUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    let hecho = false;
    const v = document.createElement('video');
    const fin = (dt: string | null) => {
      if (hecho) return;
      hecho = true;
      clearTimeout(tope);
      v.removeAttribute('src'); v.load();
      resolve(dt && dt.startsWith('data:') ? dt : null);
    };
    // Un video que no carga no deja la tarjeta esperando: sin miniatura se dibuja el ícono.
    const tope = setTimeout(() => fin(null), 15_000);
    try {
      v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'metadata'; v.playsInline = true;
      v.onloadeddata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch { fin(null); } };
      v.onseeked = () => {
        const { canvas, ctx } = fitCanvas(v.videoWidth, v.videoHeight);
        if (!ctx) return fin(null);
        try { ctx.drawImage(v, 0, 0, canvas.width, canvas.height); fin(canvas.toDataURL('image/jpeg', 0.72)); } catch { fin(null); }
      };
      v.onerror = () => fin(null);
      v.src = url;
    } catch { fin(null); }
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
  // `size` le ahorra al server bajar un video de 500 MB para descubrir que no se transcribe.
  return procesarEnMeta(
    { path: sj.path, content_type: file.type, filename: file.name, size: file.size },
    'Vuelve a subirlo.',
    typeof sj.path === 'string' ? sj.path : null,
  );
}

/**
 * Usa un video que MaKo ya generó (tarea #797): el server lo resuelve por `ref` y Meta lo
 * baja de la url pública del bucket propio. Nada pasa por el disco de nadie.
 *
 * ⚠️ Viaja SÓLO `ref`, nunca la url: el server la vuelve a armar en el workspace de la
 * sesión. Y vuelve igual que una subida —con `processing`— porque Meta lo procesa igual.
 */
export async function usarCreativoMako(ref: string): Promise<SubidoCreativo> {
  return procesarEnMeta({ mako: ref }, 'Vuelve a elegirlo.', null);
}

/**
 * El POST a creative-upload con el tope de la ruta, y lo que contestó pasado a
 * SubidoCreativo. Lo comparten las dos puertas (archivo y video de MaKo): dos copias de
 * esto eran justo lo que la #59 vino a sacar.
 */
async function procesarEnMeta(cuerpo: Record<string, unknown>, otraVez: string, pathRespaldo: string | null): Promise<SubidoCreativo> {
  const r = await fetch('/api/ads-manager/creative-upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(TOPE_POST_MS),
  }).catch((e: unknown) => {
    // El corte dice DÓNDE quedó el trabajo: Meta no contestó, así que no hay creativo
    // que usar (en una subida, el archivo ya está en el storage).
    const corte = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new Error(corte ? `Se cortó la espera al procesar el creativo. ${otraVez}` : `Error de red al procesar el creativo. ${otraVez}`);
  });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`El servidor no respondió al procesar el creativo. ${otraVez}`);
  if (!j.ok) throw new Error(j.error || 'No se pudo procesar el creativo');
  return subidoDeRespuesta(j, pathRespaldo);
}

/** Lo que contestó creative-upload, como lo usa la bandeja. Exportada para el test. */
export function subidoDeRespuesta(j: Record<string, unknown>, pathRespaldo: string | null): SubidoCreativo {
  const vs = j.video_status === 'ready' || j.video_status === 'processing' || j.video_status === 'error' ? j.video_status : null;
  return {
    media_type: j.media_type === 'video' ? 'video' : 'image',
    image_hash: typeof j.image_hash === 'string' ? j.image_hash : null,
    video_id: typeof j.video_id === 'string' ? j.video_id : null,
    thumbnail_url: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : null,
    // Sólo un video puede estar procesándose; y sin video_id no hay a quién esperar.
    processing: j.media_type === 'video' && !!j.video_id && j.processing === true,
    video_status: vs,
    path: typeof j.path === 'string' ? j.path : pathRespaldo,
  };
}

/** Lo que el modal ofrece además del disco: primero los montados, después las tomas. */
export type MisCreativos = { montados: CreativoMako[]; tomas: CreativoMako[] };

/**
 * La lista de /api/ads-manager/mis-creativos. TIRA si el server no la pudo leer: «no
 * pude leer» no se pinta como «todavía no hay videos».
 */
export async function listarCreativosMako(signal?: AbortSignal): Promise<MisCreativos> {
  const r = await fetch('/api/ads-manager/mis-creativos', { cache: 'no-store', signal })
    .catch(() => { throw new Error('Error de red al leer tus videos de MaKo.'); });
  const j = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(j?.error || 'No pude leer tus videos de MaKo.');
  return { montados: Array.isArray(j.montados) ? j.montados : [], tomas: Array.isArray(j.tomas) ? j.tomas : [] };
}

/**
 * 'tope' = Meta SIGUIÓ diciendo 'processing' hasta el final. 'sin_lectura' = no se le pudo
 * preguntar (la sesión venció, la credencial de Meta se revocó, se cayó la red): eso no es
 * un veredicto sobre el video, así que el ítem no se descarta.
 */
export type FinEspera = 'ready' | 'error' | 'tope' | 'sin_lectura' | 'cancelado';

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
 *
 * ⚠️ Al tope, 'tope' SÓLO si la última lectura fue Meta diciendo 'processing'. Hasta la
 * revisión de la #59 «no pude leer» —un 401 del guard, un ok:false, `estado: null`, la red—
 * terminaba igual, y los tres modales descartaban el ítem con «Meta no terminó de procesar
 * … Súbelo de nuevo»: un fallo nuestro de lectura contado como veredicto de Meta, y otro
 * video subido a Meta sobre uno que quizás ya estaba listo.
 */
export async function esperarVideoListo(videoId: string, path: string | null, opts: { signal?: AbortSignal; cadaMs?: number; topeMs?: number } = {}): Promise<FinEspera> {
  const cada = opts.cadaMs ?? CADA_MS;
  const hasta = Date.now() + (opts.topeMs ?? TOPE_ESPERA_MS);
  const qs = `video_id=${encodeURIComponent(videoId)}${path ? `&path=${encodeURIComponent(path)}` : ''}`;
  // Lo que dijo la ÚLTIMA vuelta: Meta contestó 'processing', o no se pudo leer.
  let ultima: 'processing' | 'sin_lectura' = 'sin_lectura';
  while (Date.now() < hasta) {
    await dormir(cada, opts.signal);
    if (opts.signal?.aborted) return 'cancelado';
    try {
      const r = await fetch(`/api/ads-manager/creative-upload?${qs}`, { cache: 'no-store', signal: opts.signal });
      const j = await r.json().catch(() => null);
      if (j?.ok && j.estado === 'ready') return 'ready';
      if (j?.ok && j.estado === 'error') return 'error';
      ultima = j?.ok && j.estado === 'processing' ? 'processing' : 'sin_lectura';
    } catch {
      if (opts.signal?.aborted) return 'cancelado';
      ultima = 'sin_lectura'; /* un bache de red: se vuelve a preguntar */
    }
  }
  return ultima === 'processing' ? 'tope' : 'sin_lectura';
}

/** Después de un 'sin_lectura' se sigue preguntando, más espaciado: el ítem no se descarta
 *  por algo que no es un veredicto, y cerrar el modal o quitar el ítem lo corta igual. */
export const CADA_MS_SIN_LECTURA = 30_000;

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
 *  clic contesta lo que ya se creó en vez de crearlo de nuevo. «Es seguro» aunque se edite
 *  algo en el medio: la clave sin respuesta queda ABIERTA y manda (claveAbierta, abajo). */
export const SIN_RESPUESTA = 'El servidor no respondió. Reintentar es seguro: no se duplica.';

/** La respuesta a una clave abierta habló de lo que se mandó ANTES (trasRespuesta →
 *  `deAntes`): no es el éxito de lo que está en pantalla. El próximo clic publica esto. */
export const ANTERIOR_PUBLICADA = 'La publicación anterior sí entró. Revísala en la tabla antes de publicar otra.';
export const ANTERIOR_A_MEDIAS = 'La publicación anterior quedó a medias en Meta. Revísala en la tabla antes de publicar otra.';

// ── la clave ABIERTA de cada destino (lib/meta-idempotencia.ts → claveAMandar) ──
//
// Vive FUERA del modal a propósito: en Agregar anuncio / Agregar conjunto la clave vivía en
// un ref, y cerrar y reabrir el modal después de un corte la perdía — el mismo anuncio salía
// con otra clave y se creaba dos veces. En localStorage sobrevive a cerrar y a recargar; si
// el navegador no deja escribir (ventana privada), queda en memoria mientras la pestaña viva.
// El destino lleva el `?ws=` de la pestaña: el super admin publica en varios clientes desde
// el mismo navegador, y la clave del server es por workspace.
const ABIERTAS_KEY = 'mako.ads.idem-abiertas.v1';
const abiertasEnMemoria = new Map<string, ClaveIdem>();

function claveDeDestino(destino: string): string {
  const ws = typeof window === 'undefined' ? null : wsDeBusqueda(window.location.search);
  return `${ws ?? '-'}:${destino}`;
}

function leerAbiertas(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(ABIERTAS_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch { return {}; }
}

/** La clave que quedó abierta para este destino ('campaign-create', `ad-add:<adset>`…). */
export function claveAbierta(destino: string): ClaveIdem | null {
  const k = claveDeDestino(destino);
  return claveIdemGuardada(leerAbiertas()[k]) ?? abiertasEnMemoria.get(k) ?? null;
}

/** Anota (o suelta, con null) la clave abierta de un destino. */
export function anotarClaveAbierta(destino: string, clave: ClaveIdem | null): void {
  const k = claveDeDestino(destino);
  if (clave) abiertasEnMemoria.set(k, clave); else abiertasEnMemoria.delete(k);
  try {
    const todas = leerAbiertas();
    if (clave) todas[k] = clave; else delete todas[k];
    window.localStorage.setItem(ABIERTAS_KEY, JSON.stringify(todas));
  } catch { /* sin almacenamiento: queda la de memoria */ }
}

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
  // No es un veredicto de Meta: el ítem se queda y se sigue preguntando.
  if (fin === 'sin_lectura') return `No pude consultar a Meta por «${nombre}». Sigo intentando.`;
  return null;
}
