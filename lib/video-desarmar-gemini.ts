import 'server-only';

// =============================================================================
// video-desarmar-gemini — el Gemini DEL NEGOCIO mira un video entero y devuelve JSON (ticket 97; 14/11/2026)
// =============================================================================
// Dos formas de darle el video, las dos oficiales de la API de Gemini:
//   · un video PÚBLICO de YouTube va por su enlace (`fileData.fileUri`): no se baja nada (lo mismo que el guion de Spy,
//     lib/ai-cheap.ts → `guionDeYoutubeConGemini`);
//   · un reel o un anuncio se SUBE a la File API (subida «resumable»), se espera a que quede ACTIVE y se pide con su `uri`. Un
//     archivo subido con una clave sólo lo ve ESA clave: se sube con cada cuenta que se prueba, y se borra al terminar (igual
//     vence solo a las 48 h).
// `videoMetadata.fps` sube los cuadros por segundo (por defecto mira 1, y un corte de medio segundo se pierde) y
// `endOffset` corta un video largo. `responseSchema` pide el JSON del esquema (lib/video-desarmar.ts → ESQUEMA_DESARME).
//
// ⚠️ CON EL GEMINI DEL NEGOCIO, por `provsDe('gemini')`: sus cuentas, nunca una copia de la de la plataforma, y nada a Gemini si
// el negocio corre con su Claude o su GPT (D6b: `pasaPorLaPuerta` / `conD6bDelPedido`). La plataforma no paga la IA de nadie.
// ⚠️ UN «HIGH DEMAND» (503) NO ES UN FALLO: se prueba el otro modelo y, si todos están saturados, vuelve `saturado`.
// ⚠️ UNA RESPUESTA CORTADA NO SE LEE: `finishReason` distinto de STOP (MAX_TOKENS) deja un JSON a medias; se prueba el otro modelo.
// =============================================================================

import { nroCuenta, provsDe } from './ai-cheap';
import { exigirPermisoIa } from './ia-permiso';
import { conD6bDelPedido, pasaPorLaPuerta } from './solo-su-ia';
import { recordUsage } from './anthropic-usage';
import { leerErrorProveedor } from './ia-rotacion-modelo';
import { anotarSaturado, esSaturacion, primeroLosSanos } from './ia-saturacion';

export type VideoParaGemini =
  | { tipo: 'youtube'; url: string }
  | { tipo: 'archivo'; bytes: Uint8Array; mime: string; nombre: string };

/** Cómo mirarlo: los cuadros por segundo, la resolución, hasta dónde y el pedido (lib/video-desarmar.ts → `comoMirar`). */
export type ComoMirarVideo = { fps: number; resolucion: 'baja' | 'media'; hastaS: number | null; instruccion: string };

export type PedidoVideoGemini = {
  video: VideoParaGemini;
  /** Lo que dura, si se sabe antes de subirlo (Spy, la portada). Un archivo subido trae la suya de la File API. */
  duracionS: number | null;
  /** Se decide con la duración: la de antes o, en un archivo, la que mide la File API al subirlo. */
  mirar: (duracionS: number | null) => ComoMirarVideo;
  esquema: unknown;
  feature: string;
  motivo: string;
  /** Lo más que se puede gastar en reloj, entre subir y mirar (la ruta tiene su `maxDuration`). */
  plazoMs: number;
};

export type RespuestaVideoGemini =
  | { ok: true; json: unknown; modelo: string; tokens: number; duracionS: number | null; como: ComoMirarVideo }
  | { ok: false; motivo: 'sin-gemini' | 'saturado' | 'fallo'; error: string };

/** Un enlace de YouTube que Gemini acepta (el mismo de `ENLACE_YOUTUBE_GEMINI`). */
export const ENLACE_YT = /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/;

const RAIZ = (base: string) => base.replace(/\/openai\/?$/, '').replace(/\/v1(beta)?\/?$/, '');
const MODELOS = () => [...new Set([process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest'])];
const PLAZO_PEDIDO_MS = 300_000;
const ESPERA_ACTIVO_MS = 180_000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** «12.5s» → 12.5 (lo que devuelve la File API en `videoMetadata.videoDuration`). */
export function segundosDeDuracion(x: unknown): number | null {
  const m = typeof x === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(x.trim()) : null;
  return m ? Number(m[1]) : null;
}

type Subido = { ok: true; nombre: string; uri: string; mime: string; duracionS: number | null } | { ok: false; error: string };

/** Sube el video a la File API de la cuenta y espera a que quede ACTIVE. */
async function subir(raiz: string, key: string, v: Extract<VideoParaGemini, { tipo: 'archivo' }>, hastaMs: number): Promise<Subido> {
  try {
    const inicio = await fetch(`${raiz}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(v.bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': v.mime,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: v.nombre.slice(0, 120) } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const destino = inicio.headers.get('x-goog-upload-url');
    if (!inicio.ok || !destino) {
      const data = await inicio.json().catch(() => ({}));
      return { ok: false, error: `HTTP ${inicio.status} ${leerErrorProveedor(data, inicio.status).mensaje}` };
    }
    const fin = await fetch(destino, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Length': String(v.bytes.byteLength) },
      body: Buffer.from(v.bytes),
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    });
    const data = (await fin.json().catch(() => ({}))) as { file?: { name?: string; uri?: string; mimeType?: string; state?: string; videoMetadata?: { videoDuration?: string } } };
    if (!fin.ok || !data.file?.name || !data.file.uri) return { ok: false, error: `HTTP ${fin.status} ${leerErrorProveedor(data, fin.status).mensaje}` };
    let archivo = data.file;
    // Un video recién subido queda PROCESSING unos segundos: hasta que no está ACTIVE, Gemini no lo puede mirar.
    const tope = Math.min(hastaMs, Date.now() + ESPERA_ACTIVO_MS);
    while (archivo.state !== 'ACTIVE') {
      if (archivo.state === 'FAILED') return { ok: false, error: 'Gemini no pudo procesar el video (FAILED).' };
      if (Date.now() > tope) return { ok: false, error: 'Gemini tardó demasiado en procesar el video.' };
      await esperar(2_500);
      const r = await fetch(`${raiz}/v1beta/${data.file.name}`, { headers: { 'x-goog-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      const j = (await r.json().catch(() => ({}))) as typeof archivo;
      if (r.ok && j?.name) archivo = j;
    }
    return { ok: true, nombre: data.file.name, uri: archivo.uri ?? data.file.uri, mime: archivo.mimeType ?? v.mime, duracionS: segundosDeDuracion(archivo.videoMetadata?.videoDuration) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function borrar(raiz: string, key: string, nombre: string): Promise<void> {
  await fetch(`${raiz}/v1beta/${nombre}`, { method: 'DELETE', headers: { 'x-goog-api-key': key }, cache: 'no-store', signal: AbortSignal.timeout(15_000) }).catch(() => null);
}

/** El texto de la respuesta, como JSON. `null` si no es JSON (no se adivina). */
export function jsonDeRespuesta(texto: string): unknown {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(limpio); } catch { return null; }
}

/**
 * El Gemini del negocio mira el video y contesta el JSON del esquema. Prueba sus cuentas en orden y, en cada una, los modelos
 * (el saturado al final). Nunca tira por un error del proveedor: vuelve `{ ok: false, motivo }`.
 */
export async function mirarVideoConGemini(p: PedidoVideoGemini): Promise<RespuestaVideoGemini> {
  await exigirPermisoIa();
  if (pasaPorLaPuerta(p.feature)) return conD6bDelPedido(p.feature, () => mirarVideoConGemini(p));
  if (p.video.tipo === 'youtube' && !ENLACE_YT.test(p.video.url)) return { ok: false, motivo: 'fallo', error: 'No es el enlace de un video de YouTube.' };
  const provs = await provsDe('gemini');
  if (!provs.length) return { ok: false, motivo: 'sin-gemini', error: 'Sin Gemini conectado.' };
  const finDelPlazo = Date.now() + p.plazoMs;
  let ultimo = '';
  let saturados = 0;
  for (const prov of provs) {
    const raiz = RAIZ(prov.base);
    let parteVideo: Record<string, unknown>;
    let subido: Extract<Subido, { ok: true }> | null = null;
    if (p.video.tipo === 'archivo') {
      const s = await subir(raiz, prov.key, p.video, finDelPlazo);
      if (!s.ok) { ultimo = s.error; console.warn(`[desarmar-gemini] cuenta ${nroCuenta(prov)}, al subir: ${s.error.slice(0, 200)}`); continue; }
      subido = s;
      parteVideo = { fileData: { fileUri: s.uri, mimeType: s.mime } };
    } else {
      parteVideo = { fileData: { fileUri: p.video.url } };
    }
    const duracionS = p.duracionS ?? subido?.duracionS ?? null;
    const como = p.mirar(duracionS);
    parteVideo.videoMetadata = { fps: como.fps, ...(como.hastaS ? { endOffset: `${Math.floor(como.hastaS)}s` } : {}) };
    try {
      for (const model of primeroLosSanos('gemini', MODELOS(), 'gemini-flash-latest')) {
        const queda = finDelPlazo - Date.now();
        if (queda < 30_000) { ultimo = ultimo || 'se acabó el plazo'; break; }
        let res: Response;
        try {
          res = await fetch(`${raiz}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'x-goog-api-key': prov.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [parteVideo, { text: como.instruccion }] }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 65536,
                responseMimeType: 'application/json',
                responseSchema: p.esquema,
                mediaResolution: como.resolucion === 'baja' ? 'MEDIA_RESOLUTION_LOW' : 'MEDIA_RESOLUTION_MEDIUM',
              },
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(Math.min(PLAZO_PEDIDO_MS, queda)),
          });
        } catch (e) {
          ultimo = e instanceof Error ? e.message : String(e);
          console.warn(`[desarmar-gemini] cuenta ${nroCuenta(prov)} · ${model}: ${ultimo.slice(0, 200)}`);
          break;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          const detalle = `HTTP ${res.status} ${leerErrorProveedor(data, res.status).mensaje}`;
          ultimo = detalle;
          console.warn(`[desarmar-gemini] cuenta ${nroCuenta(prov)} · ${model}: ${detalle.slice(0, 200)}`);
          if (esSaturacion(detalle)) { anotarSaturado('gemini', model); saturados += 1; continue; }
          // ⚠️ LA CUOTA ES POR MODELO (medido el 14/11/2026 en el negocio de MaKo: «limit: 20, model: gemini-3.8-flash» por día en
          // el plan gratis). Un 429 del modelo principal deja probar el de respaldo en la MISMA cuenta, que tiene la suya.
          if (res.status === 429) continue;
          // Otro error (un video privado, una clave mala) no cambia con otro modelo: otra cuenta.
          break;
        }
        const u = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
        void recordUsage(p.feature, model,
          { prompt_tokens: u?.promptTokenCount ?? 0, completion_tokens: u?.candidatesTokenCount ?? 0, total_tokens: u?.totalTokenCount ?? 0 },
          p.motivo, 'gemini', nroCuenta(prov));
        const finRazon = data.candidates?.[0]?.finishReason;
        const texto = ((data.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string }>).map((x) => x.text ?? '').join('');
        if (finRazon && finRazon !== 'STOP') { ultimo = `la respuesta se cortó (finishReason=${finRazon}, ${model})`; console.warn(`[desarmar-gemini] ${ultimo}`); continue; }
        const json = jsonDeRespuesta(texto);
        if (json == null) { ultimo = `la respuesta no es JSON (${model})`; console.warn(`[desarmar-gemini] ${ultimo}`); continue; }
        return { ok: true, json, modelo: model, tokens: u?.totalTokenCount ?? 0, duracionS, como };
      }
    } finally {
      if (subido) await borrar(raiz, prov.key, subido.nombre);
    }
  }
  if (saturados > 0 && esSaturacion(ultimo)) return { ok: false, motivo: 'saturado', error: ultimo };
  return { ok: false, motivo: 'fallo', error: ultimo || 'Gemini no contestó.' };
}
