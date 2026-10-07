// =============================================================================
// /api/ads-manager/creative-upload — empuja a Meta un creativo ya en storage
// =============================================================================
// POST { path, content_type, filename, size? } → UploadResult
//   El navegador ya subió el archivo a Supabase Storage (vía /creative-signurl,
//   directo, esquivando el límite de body del serverless). Acá: imagen → la baja el
//   servidor y la sube a act_<id>/adimages (image_hash). Video → Meta lo descarga
//   por file_url firmado (act_<id>/advideos), así los bytes NUNCA pasan por esta
//   función.
// POST { mako: 'montaje:<id>' | 'toma:<plan>:<n>' } → UploadResult   (tarea #797)
//   Un video que MaKo ya generó: el anuncio montado o una toma del generador. Meta lo
//   baja de la url pública del bucket propio. El navegador manda SÓLO la referencia;
//   la url se resuelve acá, en el workspace de la sesión (subirCreativoMako).
// GET ?video_id=<dígitos>&path=<nueva/…> → { estado }
//   Lo que dice Meta HOY de un video que se está procesando. El navegador pregunta
//   cada ~5 s hasta 'ready' o 'error' (app/ads-manager/creativeUpload.ts).
//
// ⚠️ UN VIDEO NO SE DA POR LISTO HASTA QUE META LO PROCESÓ (tarea #59, 07/10/2026).
// Esta ruta ya devolvía `processing` y `video_status`, pero el tipo del cliente no los
// declaraba y los TRES modales escribían `processing: false` sin mirar: un video que
// Meta tardaba más de 150 s en procesar entraba a la bandeja como listo. Ahora:
// - el POST espera poco (ESPERA_MS) y contesta lo que hay; si Meta sigue, el
//   navegador mantiene la tarjeta en «Procesando» y pregunta por GET;
// - 'error' (incluido 'expired') es un 422: el video no entra a la bandeja;
// - y las rutas que publican vuelven a preguntar antes de crear (409).
// =============================================================================

import { after, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase';
import { uploadAdImage, uploadAdVideoByUrl, waitForVideoReady, estadoVideo, metaErrorEnvelope, ADS_CREATIVES_BUCKET as BUCKET } from '@/lib/meta-ads-create';
import type { UploadResult } from '@/lib/campaign-types';
import { getTenantDb, getWorkspaceActual, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { guardAdsWs, wsDeAdsManager } from '@/lib/ads-guard';
import { transcribeMediaBuffer, structureTranscript } from '@/lib/transcribe';
import { esPathDeStaging, STAGING_CARPETA, stagingVencido } from '@/lib/ads-staging';
import { leerRefCreativo, mismoOrigen, type CreativoMako } from '@/lib/creativo-mako';
import { resolverCreativoMako } from '@/lib/creativo-mako-fuentes';

export const dynamic = 'force-dynamic';
// ⚠️ after() NO saca nada de estos 300 s: corre «por la duración máxima configurada de la
// ruta» (node_modules/next/dist/docs/…/after.md). Lo único que gana es que la respuesta
// sale antes. Por eso la espera a Meta es corta y el resto lo pregunta el navegador.
export const maxDuration = 300;

const IMG = ['image/jpeg', 'image/png'];
const VID = ['video/mp4', 'video/quicktime'];
const MAX_IMG = 30 * 1024 * 1024; // Meta: imagen 30MB

// Whisper no acepta más de 25 MB; arriba de eso ni bajamos el archivo.
const MAX_TRANSCRIBIR = 25 * 1024 * 1024;

/**
 * Cuánto espera el POST a que Meta procese el video. Eran 150 s adentro de un
 * Promise.all con la transcripción, que no tiene tope: un video pesado pasaba los 300 s,
 * la plataforma cortaba con 504 y el ítem se borraba de la bandeja con el video ya en
 * Meta. Con 25 s casi ningún video llega a 'ready' acá, y está bien: el navegador sigue
 * preguntando por GET, con su propio tope.
 */
const ESPERA_MS = 25_000;

/** Un path de staging que esta ruta acepta borrar: los que firma /creative-signurl. */
const pathDeStaging = esPathDeStaging;

/**
 * Borra los archivos del staging que ya sobran (lib/ads-staging.ts → stagingVencido). Corre
 * en after() de cada subida: así la limpieza no depende de que una pestaña siga abierta.
 *
 * ⚠️ Revisión de la #59: con la espera del POST en 25 s, un video casi nunca llega a 'ready'
 * acá, y su staging lo borraba SÓLO el GET del navegador. Cerrar el modal o quitar la
 * tarjeta cortaba ese sondeo y el archivo quedaba para siempre. Con la carpeta ordenada por
 * nombre, los primeros son los más viejos (empiezan con la hora en ms): se barren de a 100,
 * y lo que quede lo barre la próxima subida. Best-effort: nunca tira.
 */
async function barrerStagingViejo(supabase: SupabaseClient): Promise<void> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(STAGING_CARPETA, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
    if (error || !Array.isArray(data)) return;
    const ahora = Date.now();
    const viejos = data.map((f) => f.name).filter((n) => stagingVencido(n, ahora)).map((n) => `${STAGING_CARPETA}/${n}`);
    if (viejos.length) await supabase.storage.from(BUCKET).remove(viejos);
  } catch { /* best-effort: lo barre la próxima subida */ }
}

/**
 * El tamaño del archivo en el staging, ANTES de bajarlo. La transcripción hacía
 * `download()` y DESPUÉS miraba si pasaba de 25 MB: con un video de 500 MB, la función
 * metía 500 MB en memoria para tirarlos. Primero la metadata del storage; si no contesta,
 * lo que dijo el navegador (`file.size`), que sólo decide si se transcribe.
 */
async function tamanoDelStaging(supabase: SupabaseClient, path: string, delCliente: unknown): Promise<number | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET).info(path);
    if (typeof data?.size === 'number' && Number.isFinite(data.size)) return data.size;
  } catch { /* sigue con lo que dijo el navegador */ }
  return typeof delCliente === 'number' && Number.isFinite(delCliente) && delCliente >= 0 ? delCliente : null;
}

/** Baja el archivo para transcribirlo. Nunca tira: null = no se pudo (sigue el cron). */
async function bajarStaging(supabase: SupabaseClient, path: string): Promise<ArrayBuffer | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return await data.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * ⚠️ El staging se borra SÓLO cuando Meta dijo 'ready' o 'error': Meta lo baja del
 * file_url firmado (1 h), y borrarlo antes deja el video en 'error'. Lo que este borrado
 * no alcanza —el modal se cerró antes del veredicto— lo barre barrerStagingViejo.
 */
async function borrarStaging(supabase: SupabaseClient, path: string): Promise<void> {
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* best-effort */ }
}

/**
 * Transcribe el video del staging y lo guarda por video_id. Corre en after(): la
 * respuesta ya salió. Best-effort de punta a punta: subir el creativo no puede fallar
 * porque whisper tenga un mal día. Lo que quede sin transcribir lo levanta el cron.
 * ⚠️ Si after() no corriera, se pierde la transcripción gratuita y el cron la vuelve a
 * pagar con whisper (bajando el mp4 desde Meta). Es el mismo costo que un fallo de whisper.
 */
async function transcribirYGuardar(bajada: Promise<ArrayBuffer | null>, tamano: number | null, videoId: string, filename: string, mime: string): Promise<void> {
  try {
    if (tamano == null) return; // sin tamaño no se baja a ciegas: lo levanta el cron
    if (tamano > MAX_TRANSCRIBIR) {
      await guardarTranscripcion(videoId, {
        status: 'muy_grande', transcript: null, secciones: null, idioma: null, duracion_s: null,
        model: null, error: `${(tamano / 1048576).toFixed(1)} MB > 25 MB (límite de OpenAI)`, filename,
      });
      return;
    }
    const buf = await bajada;
    if (!buf) return;
    const t = await transcribeMediaBuffer(buf, mime, filename);
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

/** El nombre del video en la biblioteca de la cuenta de Meta: de qué anuncio sale. */
function nombreEnMeta(c: CreativoMako): string {
  return `${c.titulo}${c.toma != null ? ` · toma ${c.toma}` : ''}`.slice(0, 120);
}

/**
 * Un video que MaKo ya generó → act_<id>/advideos por file_url (tarea #797).
 *
 * ⚠️ RECIBE SÓLO LA REFERENCIA. El bucket `video-clips` es público y su ruta no lleva el
 * workspace: si la url viajara del navegador, un admin del ws A podría publicar el video
 * del ws B. Se resuelve por id en el workspace de la sesión, con la url DERIVADA
 * (lib/creativo-mako.ts), y el origen se vuelve a mirar con new URL antes de dársela a Meta.
 *
 * ⚠️ NINGÚN borrado y NINGUNA transcripción en esta rama. Los dos son del staging
 * ('ads-creatives'), que es una copia temporal; acá el archivo es el ORIGINAL: el worker
 * sube `montado-<id>.mp4` con upsert sobre la misma ruta y no queda otra copia. Y el guion
 * del plan no se guarda como transcripción: el generador dice palabras distintas del
 * guion, y una fila en creative_transcripts hace que el cron transcribe-ads se saltee ese
 * anuncio para siempre. El audio real lo transcribe el cron, bajándolo de Meta.
 *
 * ⚠️ El workspace se FIJA (runWithWorkspace) para que la lectura y cred() —la cuenta de
 * Meta que escribe— resuelvan el mismo. Sin contexto, getTenantDb lee con -1 y cred() cae
 * a OWNER_WS: el admin de agencia sin workspace no encontraba nada y subía al ws1.
 */
async function subirCreativoMako(crudo: unknown): Promise<Response> {
  const ref = leerRefCreativo(crudo);
  if (!ref) return Response.json({ ok: false, error: 'Ese video no es válido.' }, { status: 400 });
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  return runWithWorkspace(ws, async () => {
    let c: CreativoMako | null;
    try {
      c = await resolverCreativoMako(ref);
    } catch (e) {
      console.error('[ads-manager:creative-upload] no se pudo leer el video de MaKo', e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'No pude leer ese video de MaKo. Vuelve a intentar.' }, { status: 500 });
    }
    if (!c) return Response.json({ ok: false, error: 'Ese video ya no está.' }, { status: 404 });
    // La imagen todavía no tiene de dónde salir (lib/creativo-mako.ts): el tipo la admite
    // y esta rama no, para que nadie la mande por `advideos`.
    if (c.media_type !== 'video') return Response.json({ ok: false, error: 'Por ahora, sólo videos.' }, { status: 400 });
    if (!mismoOrigen(c.url, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return Response.json({ ok: false, error: 'Ese video no es de MaKo.' }, { status: 400 });
    }
    const nombre = nombreEnMeta(c);
    try {
      const r = await uploadAdVideoByUrl(c.url, nombre);
      // La misma espera corta que la subida de un archivo (#59): lo que falte lo pregunta
      // el navegador por GET, sin `path` —no hay staging que borrar—.
      const estado = await waitForVideoReady(r.video_id, { timeoutMs: ESPERA_MS });
      if (estado === 'error') {
        return Response.json({ ok: false, error: 'Meta no pudo procesar ese video. Prueba con otro.', video_id: r.video_id, video_status: 'error' }, { status: 422 });
      }
      // thumbnail_url null A PROPÓSITO: la url del .mp4 puesta ahí viaja como
      // video_data.image_url y Meta rechaza el creativo. La miniatura la pone el
      // navegador (una data:, que nunca va a Meta) y la de Meta llega al publicar.
      const out: UploadResult = { media_type: 'video', video_id: r.video_id, thumbnail_url: null, filename: nombre, processing: estado !== 'ready', video_status: estado };
      return Response.json({ ok: true, ...out, path: null });
    } catch (err) {
      const env = metaErrorEnvelope(err);
      console.error(`[ads-manager:creative-upload] video de MaKo: ${env.message}`);
      return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
    }
  });
}

export async function POST(req: NextRequest) {
  // Sube a la cuenta de Meta DEL workspace (lib/meta-ads-create.ts: cred() por workspace).
  const no = await guardAdsWs(); if (no) return no;

  let body: { path?: string; content_type?: string; filename?: string; size?: number; mako?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // Un video que MaKo ya generó va por su propia rama, ANTES de exigir `path`: la subida
  // de un archivo la comparten los tres modales y no se toca. Sólo viaja `mako`.
  if (body.mako !== undefined) return subirCreativoMako(body.mako);

  const path = String(body.path ?? '');
  const ct = String(body.content_type ?? '');
  const filename = String(body.filename ?? 'creativo');
  if (!path) return Response.json({ ok: false, error: 'falta el archivo subido' }, { status: 400 });

  const isImg = IMG.includes(ct);
  const isVid = VID.includes(ct);
  if (!isImg && !isVid) return Response.json({ ok: false, error: 'Formato no soportado. Imagen (jpg/png) o video (mp4/mov).' }, { status: 400 });

  let supabase: SupabaseClient | null = null;
  let videoId: string | null = null;
  try {
    supabase = getSupabaseServer();
    const limpiar = supabase;
    after(() => barrerStagingViejo(limpiar));
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
    const sb = supabase;
    // El workspace se captura ACÁ: lo que corre en after() lo necesita para guardar la
    // transcripción en el cliente correcto (molde: app/api/webhooks/fathom/route.ts).
    const ws = (await getWorkspaceActual()) ?? OWNER_WS;
    const tamano = await tamanoDelStaging(sb, path, body.size);
    // La bajada para transcribir ARRANCA YA, en paralelo con Meta: así está terminada
    // mucho antes de que alguien pueda borrar el staging (el navegador pregunta recién
    // después de esta respuesta). Arriba de 25 MB ni se baja.
    const bajada = tamano != null && tamano <= MAX_TRANSCRIBIR ? bajarStaging(sb, path) : Promise.resolve(null);
    // Video: URL firmada de descarga → Meta lo baja (no pasa por la función).
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error || !data) throw new Error(error?.message ?? 'no se pudo firmar el archivo subido');
    const r = await uploadAdVideoByUrl(data.signedUrl, filename);
    videoId = r.video_id;
    const estado = await waitForVideoReady(r.video_id, { timeoutMs: ESPERA_MS });
    if (estado === 'ready' || estado === 'error') {
      // Meta ya tiene su copia (o ya no la va a tener): el staging se va, después de que
      // termine la bajada de la transcripción.
      after(async () => { await bajada; await borrarStaging(sb, path); });
    }
    if (estado === 'error') {
      // Antes era ok:true y el video entraba a la bandeja como listo.
      return Response.json({ ok: false, error: 'Meta no pudo procesar el video. Prueba con otro archivo.', video_id: r.video_id, video_status: 'error' }, { status: 422 });
    }
    // Transcribimos MIENTRAS Meta procesa: el archivo todavía está en el staging, y es la
    // única ventana en la que sale gratis. Si no, el cron tendría que bajar el mp4 DESDE
    // Meta al día siguiente (y el anuncio nacería sin texto con el que nombrarlo).
    after(() => runWithWorkspace(ws, () => transcribirYGuardar(bajada, tamano, r.video_id, filename, ct)));
    const out: UploadResult = { media_type: 'video', video_id: r.video_id, thumbnail_url: null, filename, processing: estado !== 'ready', video_status: estado };
    return Response.json({ ok: true, ...out, path });
  } catch (err) {
    // Si Meta no llegó a aceptar el video, el staging no le sirve a nadie.
    if (supabase && isVid && !videoId) { const sb = supabase; after(() => borrarStaging(sb, path)); }
    const env = metaErrorEnvelope(err);
    console.error(`[ads-manager:creative-upload] ${env.message}`);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}

export async function GET(req: NextRequest) {
  const no = await guardAdsWs(); if (no) return no;
  const videoId = req.nextUrl.searchParams.get('video_id') ?? '';
  if (!/^\d{1,30}$/.test(videoId)) return Response.json({ ok: false, error: 'video_id inválido' }, { status: 400 });
  const path = req.nextUrl.searchParams.get('path');
  try {
    // null = no se pudo leer: el navegador sigue preguntando, nada se borra.
    const estado = await estadoVideo(videoId);
    // ⚠️ Sólo con un veredicto de Meta: antes de eso el staging es lo que Meta está bajando.
    if ((estado === 'ready' || estado === 'error') && pathDeStaging(path)) {
      try { await borrarStaging(getSupabaseServer(), path); } catch { /* best-effort */ }
    }
    return Response.json({ ok: true, video_id: videoId, estado });
  } catch (err) {
    const env = metaErrorEnvelope(err);
    return Response.json({ ok: false, error: env.message, code: env.code, error_subcode: env.error_subcode }, { status: env.status });
  }
}
