import 'server-only';

// =============================================================================
// spy-transcripcion-servidor — el guion de un reel: su video por Apify, bajado seguro y escuchado por la IA del negocio
// =============================================================================
// El lado del servidor de lib/spy-transcripcion.ts. Lo llama /api/competitor-spy/transcribir (al abrir el detalle de un
// reel), con el negocio ya resuelto y adentro de `conSuIADelNegocio` (D6b).
//
// ⚠️ EL VIDEO SE BAJA POR LA PUERTA SSRF-SEGURA (`bajarWebSegura` + `pedirClavado`, lib/archivero-bajada.ts): el enlace lo
// devuelve un tercero (Apify), y cada salto se revalida. Con su techo: pasado `MAX_BYTES_VIDEO`, no se transcribe un video
// cortado (un mp4 a medias no se puede escuchar), se dice que pesa demasiado.
// ⚠️ LO ESCUCHA LA IA DEL NEGOCIO, como el audio de un anuncio (lib/transcribe.ts → `escuchar`): `pii` para que no vaya a
// la red gratis de la plataforma («cada negocio paga la suya») y `sinGroq` porque no es una nota de voz (IA16).
// ⚠️ UN VIDEO DE YOUTUBE NO SE BAJA: lo transcribe el Gemini DEL NEGOCIO desde su enlace (`guionDeYoutubeConGemini`), con el
// tope del día en la base (`CLAVE_DIA_GUIONES_YT`). Sin el Gemini del negocio no se reclama nada (la pantalla lo pide); la
// clave de Gemini de la plataforma NO se usa acá (AGENTS: las claves de la plataforma nunca son para un negocio).
// =============================================================================

import { randomUUID } from 'node:crypto';
import { cambiarSettingSi, getSettingEstricto, getSettingsConPrefijo } from './settings';
import { getTenantDb } from './workspace';
import { bajarWebSegura, pedirClavado } from './archivero-bajada';
import { validarDestino } from './landing-fetch';
import { errorDeCascada, guionDeYoutubeConGemini, SttSinEscucha, transcribirAudio } from './ai-cheap';
import { salidaDegenerada } from './stt-degenerado';
import { esSinPermisoIa, TEXTO_SIN_PERMISO_IA } from './ia-permiso-reglas';
import { reservarDelDia, videoDeUnAnuncio, videoDeUnaPublicacion } from './spy-todo';
import {
  CLAVE_DIA_GUIONES_YT, GUIONES_YT_POR_DIA, MAX_BYTES_VIDEO, TRANSCRIBIENDO_YT_VENCE_MS, claveTranscripcion, enlaceDeLaPublicacion, esAnuncioConVideo, esDeLaBibliotecaDeAnuncios, esDeYoutube,
  leerGuion, prefijoTranscripciones, reclamarGuion, tieneGuion, transcribirGuion, transcribirGuionYoutube, vencido, vistaDeGuion,
  type DepsGuion, type DepsGuionYoutube, type ResultadoTramoYt, type VistaGuion,
} from './spy-transcripcion';

const UA = 'Mozilla/5.0 (compatible; MaKoBot/1.0; +https://hola-mako.com)';

async function bajarVideo(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const r = await bajarWebSegura(url, { validar: validarDestino, pedir: (u, ips) => pedirClavado(u, ips, UA, { maxBytes: MAX_BYTES_VIDEO + 1, timeoutMs: 60_000 }) });
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  if (r.cuerpo.length > MAX_BYTES_VIDEO) return null;
  const mime = (r.tipo ?? '').split(';')[0].trim();
  return { bytes: new Uint8Array(r.cuerpo), mime: /^(video|audio)\//.test(mime) ? mime : 'video/mp4' };
}

async function escuchar(bytes: Uint8Array, mime: string): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  try {
    const texto = await transcribirAudio(Buffer.from(bytes).toString('base64'), mime, {
      feature: 'spy', motivo: 'Competitors Spy: el guion de un reel', pii: true, sinGroq: true,
    });
    const bucle = salidaDegenerada(texto);
    if (bucle) return { ok: false, error: bucle.motivo };
    return { ok: true, texto };
  } catch (e) {
    const errores = e instanceof SttSinEscucha ? e.errores : [e instanceof Error ? e.message : String(e)];
    return { ok: false, error: await errorDeCascada(errores, 'transcribir este reel').catch(() => 'No pude transcribirlo.') };
  }
}

/** UN tramo de un video de YouTube, con el Gemini del negocio. Un error que no es «high demand» vuelve en palabras de la persona. */
async function tramoDeYoutube(url: string, tramo: { desdeS: number; hastaS: number } | null, duracionS?: number | null): Promise<ResultadoTramoYt> {
  let r: ResultadoTramoYt;
  try {
    r = await guionDeYoutubeConGemini(url, tramo, { feature: 'spy', motivo: 'Competitors Spy: el guion de un video de YouTube', duracionS });
  } catch (e) {
    return { ok: false, motivo: 'fallo', error: esSinPermisoIa(e) ? TEXTO_SIN_PERMISO_IA : 'No pude transcribirlo.' };
  }
  if (r.ok || r.motivo !== 'fallo') return r;
  console.warn(`[spy-guion-yt] ${url}: ${r.error}`);
  return { ...r, error: await errorDeCascada([r.error], 'transcribir este video').catch(() => 'No pude transcribirlo.') };
}

type Pieza = { id: number; competidor_id: number; canal: string; tipo: string; ref: string; url: string | null; duracion: string | null; medio?: string | null };

async function piezaDe(piezaId: number): Promise<Pieza | null> {
  const db = await getTenantDb();
  // `*` y no una lista: `medio` (mig 0391, si es un anuncio en video) puede no existir, y una columna nombrada que falta rechaza
  // la consulta (lo mismo que lib/copywriter/outliers-servidor.ts).
  const { data, error } = await db.from('spy_piezas').select('*').eq('id', piezaId).maybeSingle();
  if (error) throw new Error(`No pude leer la pieza: ${error.message}`);
  return (data as Pieza | null) ?? null;
}

function depsDe(ws: number, p: Pieza): DepsGuion & DepsGuionYoutube {
  const clave = claveTranscripcion(p.competidor_id, p.id);
  return {
    leer: async () => { const crudo = await getSettingEstricto(clave); return { crudo, version: crudo }; },
    cambiarSi: (version, nuevo) => cambiarSettingSi(clave, version, nuevo),
    // Un anuncio de la biblioteca de Meta, por el actor de anuncios (13/11/2026); una publicación de Instagram, como siempre.
    video: (enlace) => (esDeLaBibliotecaDeAnuncios(enlace) ? videoDeUnAnuncio(ws, enlace) : videoDeUnaPublicacion(ws, enlace)),
    bajar: bajarVideo,
    escuchar,
    youtube: tramoDeYoutube,
    reservarDia: () => reservarDelDia(CLAVE_DIA_GUIONES_YT, GUIONES_YT_POR_DIA),
    nuevoIntento: () => randomUUID(),
  };
}

/**
 * Lo que hay del guion de una pieza y, si hace falta transcribirlo, el trabajo para un `after()`. Sin IA o sin la clave de
 * Spy (un reel), o sin el Gemini del negocio (un video de YouTube), no se reclama nada: la pantalla lo dice y no queda un
 * «transcribiendo» colgado.
 */
export async function asegurarGuion(
  ws: number,
  piezaId: number,
  opts: { hayIA: boolean; hayClave: boolean; hayGemini: () => Promise<boolean>; huellas?: readonly string[] | null },
): Promise<{ vista: VistaGuion; trabajo: (() => Promise<void>) | null } | null> {
  const p = await piezaDe(piezaId);
  if (!p) return null;
  // Un anuncio en video también (13/11/2026): lo pide Copywriting al replicarlo; la pantalla de Spy no (ver `esAnuncioConVideo`).
  const enlace = tieneGuion(p) || esAnuncioConVideo(p) ? enlaceDeLaPublicacion(p) : null;
  if (!enlace) return { vista: { estado: 'no-aplica' }, trabajo: null };
  const deps = depsDe(ws, p);
  if (esDeYoutube(enlace)) {
    if (!(await opts.hayGemini())) {
      const g = leerGuion((await deps.leer()).crudo);
      return { vista: vistaDeGuion(g, { aplica: true, sinGemini: true }), trabajo: null };
    }
    const r = await reclamarGuion(deps, Date.now(), TRANSCRIBIENDO_YT_VENCE_MS);
    if (!r.corre) return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo: null };
    const trabajo = async () => {
      try {
        const fin = await transcribirGuionYoutube(deps, enlace, p.duracion, r);
        if (fin.estado !== 'listo') console.warn(`[spy-guion-yt] pieza=${p.id}: ${fin.motivo ?? (fin.reintentarEn ? `pendiente hasta ${fin.reintentarEn}` : fin.estado)}`);
      } catch (e) {
        console.error(`[spy-guion-yt] pieza=${p.id}:`, e instanceof Error ? e.message : String(e));
      }
    };
    return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo };
  }
  if (!opts.hayIA || !opts.hayClave) {
    const g = leerGuion((await deps.leer()).crudo);
    return { vista: vistaDeGuion(g, { aplica: true, sinIA: !opts.hayIA, sinClave: !opts.hayClave }), trabajo: null };
  }
  const r = await reclamarGuion(deps, Date.now(), undefined, opts.huellas);
  if (!r.corre) return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo: null };
  const trabajo = async () => {
    try {
      const fin = await transcribirGuion(deps, enlace, r);
      if (fin.estado !== 'listo') console.warn(`[spy-guion] pieza=${p.id}: ${fin.motivo ?? fin.estado}`);
    } catch (e) {
      console.error(`[spy-guion] pieza=${p.id}:`, e instanceof Error ? e.message : String(e));
    }
  };
  return { vista: vistaDeGuion(r.actual, { aplica: true }), trabajo };
}

/** Los guiones ya transcriptos de un competidor, pieza → texto (la API de MaKo: `que_esta_haciendo`). Sin pedir nada. */
export async function guionesGuardados(competidorId: number): Promise<Map<number, string>> {
  const prefijo = prefijoTranscripciones(competidorId);
  const filas = await getSettingsConPrefijo(prefijo);
  const ahora = Date.now();
  const out = new Map<number, string>();
  for (const [clave, crudo] of filas) {
    const g = leerGuion(crudo);
    const id = Number(clave.slice(prefijo.length));
    if (g?.estado === 'listo' && g.texto && !vencido(g, ahora) && Number.isInteger(id)) out.set(id, g.texto);
  }
  return out;
}
