import 'server-only';

// =============================================================================
// video-desarmar-servidor — desarmar un video: traerlo, que lo mire el Gemini del negocio y guardarlo (ticket 97; 14/11/2026)
// =============================================================================
// El lado del servidor de lib/video-desarmar.ts. Lo llama /api/video-editor/desarmar, con el negocio ya resuelto y adentro de
// `conSuIADelNegocio` (D6b).
//
// DE DÓNDE SALE EL VIDEO:
//   · YouTube: el enlace, que Gemini abre solo (no se baja nada);
//   · un reel de Instagram o un anuncio de la biblioteca de Meta: el enlace FRESCO por Apify con la clave de Spy del negocio
//     (`videoDeUnaPublicacion` / `videoDeUnAnuncio`, lib/spy-todo.ts, con su tope del día), bajado por la puerta SSRF-segura;
//   · un archivo que sube la persona (cuando Apify no lo trae: el 13/11/2026 la clave de Spy de MaKo daba 401). Llega al bucket
//     privado `archivero` en `<ws>/desarmar/<uuid>` (el navegador sube directo: Vercel corta un POST de más de ~4,5 MB) y se
//     borra apenas se lee.
// Nada se inventa: si el video no se puede traer, se dice por qué y se ofrece subirlo.
//
// UNA VEZ POR VIDEO Y POR NEGOCIO (`app_settings`, `video.desarme.<red>.<id>`): lo desarmado queda y no se vuelve a pagar. El
// trabajo se RECLAMA con compare-and-set («mirando»): dos clics, o dos pestañas, no lo pagan dos veces. Un «mirando» de más de
// `MIRANDO_VENCE_MS` se cortó (la función murió) y se puede volver a reclamar. Al lado, en `.videomd`, el paquete VIDEO.md.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { cambiarSettingSi, getSettingEstricto, setSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { bajarWebSegura, pedirClavado } from './archivero-bajada';
import { validarDestino } from './landing-fetch';
import { videoDeUnAnuncio, videoDeUnaPublicacion } from './spy-todo';
import { mirarVideoConGemini, type VideoParaGemini } from './video-desarmar-gemini';
import {
  ESQUEMA_DESARME, VERSION_DESARME, claveDeDesarme, comoMirar, estiloMasParecido, instruccionDesarme, leerDesarme, settingDeDesarme,
  type DesarmeGuardado, type EstiloDeGaleria, type FuenteDesarme,
} from './video-desarmar';
import { paqueteVideoMd } from './video-desarmar-videomd';
import { PLANTILLAS_SUBTITULO } from '@/app/video-editor/_opencut/subtitles/estilos';

export const BUCKET_DESARMAR = 'archivero';
export const CARPETA_DESARMAR = 'desarmar';
/** Lo más pesado que se baja o se sube: un reel pesa de 2 a 15 MB; un anuncio largo, algo más. */
export const MAX_BYTES_DESARMAR = 100 * 1024 * 1024;
/** Un «mirando» más viejo que esto se cortó (la ruta tiene `maxDuration = 800`). */
export const MIRANDO_VENCE_MS = 15 * 60_000;
const FEATURE = 'video-desarmar';
const UA = 'Mozilla/5.0 (compatible; MaKoBot/1.0; +https://hola-mako.com)';

type Estado =
  | { estado: 'mirando'; desde: string; intento: string }
  | { estado: 'listo'; guardado: DesarmeGuardado }
  | { estado: 'fallo'; motivo: string; cuando: string };

export type VistaDesarme =
  | { estado: 'nada' }
  | { estado: 'mirando'; desde: string }
  | { estado: 'listo'; guardado: DesarmeGuardado }
  | { estado: 'fallo'; motivo: string };

function leerEstado(crudo: string | null): Estado | null {
  if (!crudo) return null;
  try {
    const e = JSON.parse(crudo) as Estado;
    if (e?.estado === 'listo' && e.guardado?.version === VERSION_DESARME && e.guardado.desarme?.planos?.length) return e;
    if (e?.estado === 'mirando' && typeof e.desde === 'string') return e;
    if (e?.estado === 'fallo' && typeof e.motivo === 'string') return e;
  } catch { /* una fila rota es «no hay» */ }
  return null;
}

const vencido = (e: Estado | null) => e?.estado === 'mirando' && Date.now() - Date.parse(e.desde) > MIRANDO_VENCE_MS;

/** Lo que hay de un video en este negocio, sin pedir nada. */
export async function vistaDeDesarme(clave: string): Promise<VistaDesarme> {
  const e = leerEstado(await getSettingEstricto(settingDeDesarme(clave)));
  if (!e || vencido(e)) return { estado: 'nada' };
  if (e.estado === 'listo') return { estado: 'listo', guardado: e.guardado };
  if (e.estado === 'mirando') return { estado: 'mirando', desde: e.desde };
  return { estado: 'fallo', motivo: e.motivo };
}

/** Lo guardado de un video, o null (la página del editor arma la plantilla con esto). */
export async function desarmeGuardado(clave: string): Promise<DesarmeGuardado | null> {
  const v = await vistaDeDesarme(clave);
  return v.estado === 'listo' ? v.guardado : null;
}

/** El paquete VIDEO.md guardado (ruta → contenido); si falta, se arma de nuevo del desarme (es la misma función). */
export async function paqueteGuardado(clave: string): Promise<Record<string, string> | null> {
  const crudo = await getSettingEstricto(`${settingDeDesarme(clave)}.videomd`).catch(() => null);
  if (crudo) {
    try { const p = JSON.parse(crudo) as Record<string, string>; if (p['VIDEO.md']) return p; } catch { /* se arma abajo */ }
  }
  const g = await desarmeGuardado(clave);
  return g ? paqueteVideoMd(g) : null;
}

/** El estilo de subtítulos de la galería del editor más parecido al detectado (id y nombre), o null si no lleva. */
export function estiloDeGaleria(g: DesarmeGuardado): { id: string; nombre: string } | null {
  const id = estiloMasParecido(g.desarme.subtitulos, PLANTILLAS_SUBTITULO as unknown as readonly EstiloDeGaleria[]);
  const e = PLANTILLAS_SUBTITULO.find((x) => x.id === id);
  return e ? { id: e.id, nombre: e.nombre } : null;
}

export type PedidoDesarme = {
  fuente: FuenteDesarme;
  /** Lo que dura, si se sabe (la portada, Spy). */
  duracionS: number | null;
  /** El archivo que subió la persona (`<ws>/desarmar/<uuid>`), si Apify no lo trae. */
  subido?: string | null;
};

export type ResultadoDesarme =
  | { ok: true; guardado: DesarmeGuardado; nuevo: boolean }
  | { ok: false; motivo: 'sin-gemini' | 'sin-video' | 'ocupado' | 'saturado' | 'fallo'; error: string; subir?: boolean };

/** ¿Es un archivo subido por ESTE negocio para desarmar? (El path lo escribe el navegador.) */
export const esSubidoDelNegocio = (ws: number, path: unknown): path is string =>
  typeof path === 'string' && new RegExp(`^${ws}/${CARPETA_DESARMAR}/[0-9a-f-]{36}$`).test(path);

/** Dónde sube el navegador el video (el PUT firmado). */
export async function urlParaSubir(ws: number): Promise<{ path: string; signedUrl: string; apikey: string | null } | null> {
  const path = `${ws}/${CARPETA_DESARMAR}/${randomUUID()}`;
  const { data, error } = await getSupabaseServer().storage.from(BUCKET_DESARMAR).createSignedUploadUrl(path);
  if (error || !data) { console.error('[desarmar] subir-url', error?.message); return null; }
  // La clave PÚBLICA de Supabase (la anónima), la que pide el PUT firmado (app/customer-success/curso/subir-video.ts).
  return { path, signedUrl: data.signedUrl, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null };
}

async function bajar(url: string): Promise<{ bytes: Uint8Array; mime: string } | { error: string }> {
  try {
    const r = await bajarWebSegura(url, { validar: validarDestino, pedir: (u, ips) => pedirClavado(u, ips, UA, { maxBytes: MAX_BYTES_DESARMAR + 1, timeoutMs: 120_000 }) });
    if (r.status < 200 || r.status >= 300) return { error: `HTTP ${r.status}` };
    if (r.cuerpo.length > MAX_BYTES_DESARMAR) return { error: 'pesa más de 100 MB' };
    const mime = (r.tipo ?? '').split(';')[0].trim();
    return { bytes: new Uint8Array(r.cuerpo), mime: /^video\//.test(mime) ? mime : 'video/mp4' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const MOTIVO_APIFY: Record<'sin-clave' | 'limite' | 'no-esta' | 'fallo', string> = {
  'sin-clave': 'Para traer el video hace falta tu clave de Apify (la de Competitors Spy).',
  limite: 'Llegaste al tope de videos que se traen por día. Mañana sigue.',
  'no-esta': 'La red no devolvió el video de esta publicación.',
  fallo: 'No pude traer el video: la clave de Apify de Competitors Spy no respondió.',
};

/** El video para Gemini: el enlace de YouTube, el archivo subido o el que trae Apify. */
async function videoDe(ws: number, p: PedidoDesarme): Promise<{ ok: true; video: VideoParaGemini } | { ok: false; error: string; subir: boolean }> {
  const f = p.fuente;
  if (p.subido) {
    if (!esSubidoDelNegocio(ws, p.subido)) return { ok: false, error: 'Ese archivo no es de esta cuenta. Vuelve a subirlo.', subir: true };
    const storage = getSupabaseServer().storage.from(BUCKET_DESARMAR);
    try {
      const { data, error } = await storage.download(p.subido);
      if (error || !data) return { ok: false, error: 'No encontré el video que subiste. Vuelve a subirlo.', subir: true };
      if (data.size > MAX_BYTES_DESARMAR) return { ok: false, error: 'El video pesa más de 100 MB.', subir: true };
      const mime = /^video\//.test(data.type) ? data.type : 'video/mp4';
      if (!/^video\/(mp4|quicktime|webm|mpeg|x-msvideo|3gpp)$/.test(mime)) return { ok: false, error: 'Eso no es un video (mp4, mov o webm).', subir: true };
      return { ok: true, video: { tipo: 'archivo', bytes: new Uint8Array(await data.arrayBuffer()), mime, nombre: `${f.red}-${f.id}` } };
    } finally {
      await storage.remove([p.subido]).catch(() => null);
    }
  }
  if (f.red === 'youtube') return { ok: true, video: { tipo: 'youtube', url: `https://www.youtube.com/watch?v=${f.id}` } };
  if (f.red === 'subido') return { ok: false, error: 'Sube el video para desarmarlo.', subir: true };
  if (f.red === 'tiktok') return { ok: false, error: 'Todavía no traigo videos de TikTok: súbelo y lo desarmo.', subir: true };
  const r = f.red === 'meta-ads'
    ? await videoDeUnAnuncio(ws, `https://www.facebook.com/ads/library/?id=${f.id}`)
    : await videoDeUnaPublicacion(ws, f.url && /^https:\/\/(www\.)?instagram\.com\//i.test(f.url) ? f.url : `https://www.instagram.com/reel/${f.id}/`);
  if (!r.ok) return { ok: false, error: MOTIVO_APIFY[r.motivo], subir: true };
  const b = await bajar(r.url);
  if ('error' in b) return { ok: false, error: `No pude bajar el video (${b.error}).`, subir: true };
  return { ok: true, video: { tipo: 'archivo', ...b, nombre: `${f.red}-${f.id}` } };
}

/**
 * Desarma el video (o devuelve el que ya está). Reclama el trabajo, trae el video, lo mira el Gemini del negocio y guarda el
 * desarme y su VIDEO.md. Nunca tira por un error del proveedor.
 */
export async function desarmarVideo(ws: number, p: PedidoDesarme): Promise<ResultadoDesarme> {
  const clave = claveDeDesarme(p.fuente.red, p.fuente.id);
  if (!clave) return { ok: false, motivo: 'fallo', error: 'No sé qué video es.' };
  const fila = settingDeDesarme(clave);
  const crudo = await getSettingEstricto(fila);
  const actual = leerEstado(crudo);
  if (actual?.estado === 'listo') return { ok: true, guardado: actual.guardado, nuevo: false };
  if (actual?.estado === 'mirando' && !vencido(actual)) return { ok: false, motivo: 'ocupado', error: 'Ya lo estoy mirando. En un minuto está.' };
  const intento = randomUUID();
  const mirando = JSON.stringify({ estado: 'mirando', desde: new Date().toISOString(), intento } satisfies Estado);
  if (!(await cambiarSettingSi(fila, crudo, mirando))) return { ok: false, motivo: 'ocupado', error: 'Ya lo estoy mirando. En un minuto está.' };

  const fallar = async (r: Extract<ResultadoDesarme, { ok: false }>): Promise<ResultadoDesarme> => {
    await cambiarSettingSi(fila, mirando, JSON.stringify({ estado: 'fallo', motivo: r.error, cuando: new Date().toISOString() } satisfies Estado)).catch(() => false);
    return r;
  };

  const v = await videoDe(ws, p);
  if (!v.ok) return fallar({ ok: false, motivo: 'sin-video', error: v.error, subir: v.subir });
  const visto = await mirarVideoConGemini({
    video: v.video,
    duracionS: p.duracionS,
    mirar: (d) => {
      const c = comoMirar(d, p.fuente.red);
      return { ...c, instruccion: instruccionDesarme({ fps: c.fps, duracionS: d, hastaS: c.hastaS, cuenta: p.fuente.cuenta, titulo: p.fuente.titulo }) };
    },
    esquema: ESQUEMA_DESARME,
    feature: FEATURE,
    motivo: `Desarmar el video de ${p.fuente.cuenta ? `@${p.fuente.cuenta}` : p.fuente.red}`,
    plazoMs: 700_000,
  });
  if (!visto.ok) {
    const error = visto.motivo === 'sin-gemini'
      ? 'Desarmar un video lo hace Gemini, el único que mira un video entero, con la clave de tu negocio, y este negocio no tiene una.'
      : visto.motivo === 'saturado'
        ? 'Gemini está saturado ahora mismo. Vuelve a intentar en unos minutos.'
        : `Gemini no pudo mirar el video (${visto.error.slice(0, 160)}).`;
    return fallar({ ok: false, motivo: visto.motivo, error });
  }
  const leido = leerDesarme(visto.json, { duracionS: visto.duracionS ?? p.duracionS });
  if (!leido.ok) return fallar({ ok: false, motivo: 'fallo', error: `La respuesta de Gemini no sirvió: ${leido.error}` });
  const guardado: DesarmeGuardado = {
    version: VERSION_DESARME,
    fuente: p.fuente,
    miro: {
      modelo: visto.modelo,
      fps: visto.como.fps,
      cuadros: Math.round(Math.min(leido.desarme.duracionS, visto.como.hastaS ?? Infinity) * visto.como.fps),
      tokens: visto.tokens,
      resolucion: visto.como.resolucion,
      hastaS: visto.como.hastaS,
      cuando: new Date().toISOString(),
    },
    desarme: leido.desarme,
  };
  // Lo pagado se guarda primero; el VIDEO.md al lado (si falla, `paqueteGuardado` lo vuelve a armar del desarme).
  const escrito = await cambiarSettingSi(fila, mirando, JSON.stringify({ estado: 'listo', guardado } satisfies Estado));
  if (!escrito) await setSetting(fila, JSON.stringify({ estado: 'listo', guardado } satisfies Estado));
  await setSetting(`${fila}.videomd`, JSON.stringify(paqueteVideoMd(guardado))).catch((e) => console.warn('[desarmar] videomd', e instanceof Error ? e.message : e));
  return { ok: true, guardado, nuevo: true };
}
