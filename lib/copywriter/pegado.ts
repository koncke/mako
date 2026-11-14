// =============================================================================
// copywriter/pegado — replicar lo que la persona TRAE: un link o un texto pegado, o un archivo subido (PURO; 14/11/2026)
// =============================================================================
// El Cerebro, de la llamada con Julio (13/11/2026): Martín dijo que Copywriting replica «guion de reels, de historias, secuencias de
// historias, de YouTube, VSL… de tu competencia», y hasta hoy sólo se replicaba desde los outliers. Ahora también desde:
//   · un link de YouTube (se transcribe con el Gemini del negocio, como un YouTube de Spy);
//   · el link de una LANDING (el VSL de la página de un competidor): su texto y, si su video está en YouTube, lo que se dice en él;
//   · un texto pegado o un archivo subido (una secuencia de historias, un guion, capturas de las historias).
// Lo traído se guarda como un ORIGINAL más (`pegado:<n>`, en `app_settings`: ./pegado-servidor.ts) y desde ahí sigue el MISMO
// flujo de la réplica: transcribe si hace falta, pregunta la oferta, el original va al lado y la pieza sale entera (D18).
// De Instagram no se trae el video desde el link (la clave de Apify de Spy da 401): se dice, y se pide su texto o una captura.
// =============================================================================

import { idDeYouTube, primeraLinea, type DeDondeTexto, type FormatoCopy, type OutlierCopy } from './outliers';
import type { TipoGuion } from './tipos';

/** Lo que la persona puede decir que es lo que trae (y en qué página se replica). */
export const TIPOS_PEGADO = ['reel', 'story', 'youtube', 'vsl', 'ad', 'post'] as const satisfies readonly TipoGuion[];
export type TipoPegado = (typeof TIPOS_PEGADO)[number];
export const esTipoPegado = (v: unknown): v is TipoPegado => typeof v === 'string' && (TIPOS_PEGADO as readonly string[]).includes(v);

/** El botón de cada uno (corto) y cómo se nombra el original. */
export const INFO_PEGADO: Readonly<Record<TipoPegado, { boton: string; rotulo: string; formato: FormatoCopy }>> = {
  reel: { boton: 'Reel', rotulo: 'Reel', formato: 'reel' },
  story: { boton: 'Historias', rotulo: 'Secuencia de historias', formato: 'reel' },
  youtube: { boton: 'YouTube', rotulo: 'Video de YouTube', formato: 'youtube' },
  vsl: { boton: 'VSL', rotulo: 'VSL', formato: 'youtube' },
  ad: { boton: 'Anuncio', rotulo: 'Anuncio', formato: 'anuncio' },
  post: { boton: 'Carrusel', rotulo: 'Carrusel', formato: 'carrusel' },
};

/** Los topes: un VSL transcrito de 30 minutos son ~4.500 palabras (~30.000 letras). */
export const TOPE_PEGADO = 40_000;

/** Qué es lo que se pegó: un link (de YouTube, de Instagram o de una página) o un texto. */
export type LoPegado =
  | { clase: 'vacio' }
  | { clase: 'texto'; texto: string }
  | { clase: 'youtube'; url: string; video: string }
  | { clase: 'instagram'; url: string }
  | { clase: 'pagina'; url: string };

/** Un link SOLO (sin otro texto) es un link; si no, lo pegado es el texto. Sin «https://» también («miweb.com/clase»). */
export function queEsLoPegado(crudo: string): LoPegado {
  const t = (crudo ?? '').trim();
  if (!t) return { clase: 'vacio' };
  if (/\s/.test(t)) return { clase: 'texto', texto: t.slice(0, TOPE_PEGADO) };
  const conEsquema = /^https?:\/\//i.test(t) ? t : /^(?:www\.)?[\p{L}\d-]+(?:\.[\p{L}\d-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/iu.test(t) ? `https://${t}` : null;
  if (!conEsquema) return { clase: 'texto', texto: t };
  let u: URL;
  try { u = new URL(conEsquema); } catch { return { clase: 'texto', texto: t }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { clase: 'texto', texto: t };
  const yt = idDeYouTube(u.href);
  if (yt) return { clase: 'youtube', url: u.href, video: `https://www.youtube.com/watch?v=${yt}` };
  const host = u.hostname.toLowerCase().replace(/^(?:www|m)\./, '');
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return { clase: 'instagram', url: u.href };
  return { clase: 'pagina', url: u.href };
}

/** Lo que se guarda de un original traído. `video`: el YouTube que se transcribe (el link, o el VSL de la página). */
export type OriginalPegado = {
  tipo: TipoPegado;
  /** De dónde salió, como se lee: «YouTube · @canal», «ejemplo.com», «lo que pegaste», el nombre del archivo. */
  de: string;
  titulo: string;
  texto: string;
  deDonde: DeDondeTexto;
  /** El link al original ('' = se pegó o se subió). */
  url: string;
  video: string | null;
  /** La duración del video (ISO, «PT12M3S»), para pedirlo por tramos. */
  duracion: string | null;
  /** Lo que MaKo dice de lo que no pudo traer («su video está en Panda: no lo puedo transcribir»). */
  nota: string | null;
  creado: string;
};

/** La clave de un original traído, y la de su transcripción (la misma forma que un guion de Spy: lib/spy-transcripcion.ts). */
export const PREFIJO_PEGADO = 'mako.copywriter.original.';
export const claveDePegado = (n: number): string => `${PREFIJO_PEGADO}${n}`;
export const claveGuionDePegado = (n: number): string => `${PREFIJO_PEGADO}${n}.guion`;

/** El número de un `pegado:<n>`; null si no es uno. */
export function numeroDePegado(id: string): number | null {
  const m = /^pegado:(\d{1,12})$/.exec(id ?? '');
  return m ? Number(m[1]) : null;
}

const texto = (v: unknown, tope: number): string => (typeof v === 'string' ? v.slice(0, tope) : '');

/** Lo guardado, saneado (lo que no se entiende es null: no se replica algo roto). */
export function leerOriginalPegado(crudo: string | null): OriginalPegado | null {
  if (!crudo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { return null; }
  if (!o || typeof o !== 'object' || !esTipoPegado(o.tipo)) return null;
  const deDonde: DeDondeTexto = o.deDonde === 'copy' || o.deDonde === 'descripcion' || o.deDonde === 'pie' ? o.deDonde : 'guion';
  const t = texto(o.texto, TOPE_PEGADO).trim();
  if (!t) return null;
  return {
    tipo: o.tipo, de: texto(o.de, 120) || 'lo que pegaste', titulo: texto(o.titulo, 200), texto: t, deDonde,
    url: /^https?:\/\//.test(texto(o.url, 2000)) ? texto(o.url, 2000) : '',
    video: typeof o.video === 'string' && idDeYouTube(o.video) ? o.video : null,
    duracion: typeof o.duracion === 'string' && /^P/.test(o.duracion) ? o.duracion.slice(0, 20) : null,
    nota: texto(o.nota, 300) || null, creado: texto(o.creado, 40),
  };
}

/**
 * El original traído como un outlier más (el mismo flujo de la réplica lo lee igual). Con la transcripción de su video, el texto es
 * lo que se DICE (`guion`); sin ella, lo traído (el texto de la página, el título del video) y su nota.
 */
export function outlierDePegado(n: number, o: OriginalPegado, transcripcion: string | null = null): OutlierCopy {
  const dicho = transcripcion?.trim() ? transcripcion.trim() : null;
  const t = dicho ?? o.texto;
  return {
    id: `pegado:${n}`, fuente: 'pegado', formato: INFO_PEGADO[o.tipo].formato, tipo: o.tipo, rotulo: INFO_PEGADO[o.tipo].rotulo,
    creador: { nombre: o.de, usuario: null, foto: null, competidorId: null },
    url: o.url, miniatura: null,
    gancho: (dicho ? primeraLinea(dicho) : o.titulo || primeraLinea(o.texto)) || INFO_PEGADO[o.tipo].rotulo,
    texto: t, deDonde: dicho ? 'guion' : o.deDonde,
    multiplo: null, vistas: null, megusta: null, comentarios: null, publicada: null,
    ...(o.nota && !dicho ? { nota: o.nota } : {}),
  };
}
