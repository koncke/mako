// =============================================================================
// Las reglas del Image Editor en la base: tipos, topes, rutas del bucket y el saneo del documento
// =============================================================================
// Funciones PURAS (sin `server-only`, sin base): las usan las rutas de /api/image-editor y las
// importan los tests. El trabajo con la base vive en ./server.ts. Molde: lib/editor-landing/server-reglas.ts.
//
// El contrato con el navegador está en ./tipos.ts.

import { sniffImagen } from '@/lib/editor-landing/server-reglas';

/** El bucket PÚBLICO de las imágenes, audios y miniaturas (mig 0278). Rutas `<ws>/…`. */
export const BUCKET_IMAGE = 'image-editor';

export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const TIPOS_AUDIO = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'] as const;
/** La lista del bucket (mig 0278): un test compara las dos. */
export const TIPOS_BUCKET: readonly string[] = [...TIPOS_IMAGEN, ...TIPOS_AUDIO];

export const TOPE_IMAGEN_BYTES = 15 * 1024 * 1024;
/** El del bucket (mig 0278, `file_size_limit`). */
export const TOPE_AUDIO_BYTES = 25 * 1024 * 1024;
/**
 * El documento entero. Un diseño pesa KB (las imágenes van por URL); lo que lo infla son los `data:`
 * que el motor deja en algunos elementos (un SVG de la biblioteca). 2 MB son cientos de páginas, y
 * una ruta de Vercel corta el cuerpo en ~4,5 MB sin avisar.
 */
export const TOPE_DOC_BYTES = 2 * 1024 * 1024;
/** La miniatura de la primera página (~480 px en WebP): pesa decenas de KB. */
export const TOPE_MINIATURA_BYTES = 600 * 1024;

export const EXT_DE_TIPO: Readonly<Record<string, string>> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'weba', 'audio/mp4': 'm4a',
};
const TIPO_DE_EXT: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(EXT_DE_TIPO).map(([t, e]) => [e, t]));

export const esTipoImagen = (t: unknown): t is (typeof TIPOS_IMAGEN)[number] => (TIPOS_IMAGEN as readonly unknown[]).includes(t);
export const esTipoAudio = (t: unknown): t is (typeof TIPOS_AUDIO)[number] => (TIPOS_AUDIO as readonly unknown[]).includes(t);
export const topeDeTipo = (tipo: string): number => (esTipoAudio(tipo) ? TOPE_AUDIO_BYTES : TOPE_IMAGEN_BYTES);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValido = (raw: unknown): raw is string => typeof raw === 'string' && UUID.test(raw);

/** Lo que se puede subir, antes de firmar: el tipo declarado y el tamaño. El tipo REAL se mira al registrar. */
export function validarSubida(tipo: unknown, tamano: unknown): { ok: true; tipo: string; ext: string } | { ok: false; error: string } {
  if (typeof tipo !== 'string' || !(esTipoImagen(tipo) || esTipoAudio(tipo))) return { ok: false, error: 'Sube PNG, JPG, WEBP, GIF o un audio (MP3, OGG, WAV, M4A).' };
  if (typeof tamano !== 'number' || !Number.isFinite(tamano) || tamano <= 0) return { ok: false, error: 'Falta el tamaño del archivo.' };
  if (tamano > topeDeTipo(tipo)) return { ok: false, error: esTipoAudio(tipo) ? 'El audio pasa de 25 MB.' : 'La imagen pasa de 15 MB.' };
  return { ok: true, tipo, ext: EXT_DE_TIPO[tipo] };
}

export const CARPETA_SUBIDAS = 'subidas';
export const CARPETA_MINIATURAS = 'miniaturas';

/** Donde sube el navegador: `<ws>/subidas/<uuid>.<ext>`. Lo que no se registra se barre a la hora. */
export const pathDeSubida = (ws: number, uuid: string, ext: string): string => `${ws}/${CARPETA_SUBIDAS}/${uuid}.${ext}`;

/** La miniatura de un diseño. Siempre la misma ruta: la URL guardada lleva `?v=` para saltar el caché. */
export const pathDeMiniatura = (ws: number, disenoId: string): string => `${ws}/${CARPETA_MINIATURAS}/${disenoId}.webp`;

/**
 * Una subida de ESTE workspace, por su ruta: el tipo que dice su extensión y dónde queda al
 * registrarla (`<ws>/<uuid>.<ext>`). Cualquier otra forma, o el workspace de otro, es null: el
 * navegador manda la ruta y no decide nada.
 */
export function subidaDelWs(path: unknown, ws: number): { tipo: string; final: string; uuid: string } | null {
  if (typeof path !== 'string') return null;
  const m = /^(\d+)\/subidas\/([0-9a-f-]{36})\.([a-z0-9]{2,4})$/i.exec(path);
  if (!m || Number(m[1]) !== ws || !uuidValido(m[2])) return null;
  const tipo = TIPO_DE_EXT[m[3].toLowerCase()];
  if (!tipo) return null;
  return { tipo, final: `${ws}/${m[2]}.${m[3].toLowerCase()}`, uuid: m[2] };
}

const ascii = (b: Uint8Array, desde: number, hasta: number) => String.fromCharCode(...b.subarray(desde, hasta));

/**
 * El tipo REAL de un archivo por sus primeros bytes. Imágenes raster (nunca SVG, ver la mig) y los
 * audios del bucket. Un WEBM puede ser video: el bucket lo acepta como audio/webm y el motor lo usa
 * como pista de sonido, así que se trata como audio.
 */
export function sniffArchivo(buf: Uint8Array): string | null {
  const img = sniffImagen(buf);
  if (img) return img;
  if (buf.length >= 3 && ascii(buf, 0, 3) === 'ID3') return 'audio/mpeg';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buf.length >= 4 && ascii(buf, 0, 4) === 'OggS') return 'audio/ogg';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WAVE') return 'audio/wav';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp') return 'audio/mp4';
  return null;
}

export function sanearTitulo(raw: unknown): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return t || 'Diseño sin título';
}

export function sanearNombre(raw: unknown, def = 'Archivo'): string {
  const t = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200) : '';
  return t || def;
}

/** Medidas de una imagen que manda el navegador (las lee al subir); fuera de rango, 0. */
export function medida(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 && raw <= 100_000 ? raw : 0;
}

/**
 * Lo que la lista necesita del documento, y la prueba de que TIENE la forma de un diseño: ancho y
 * alto positivos y al menos una página con su lista de objetos. Lo demás lo valida el motor al
 * abrirlo (un documento viejo lo migra él).
 */
export function resumirDoc(doc: unknown): { ancho: number; alto: number; paginas: number } | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const d = doc as { width?: unknown; height?: unknown; pages?: unknown };
  const ancho = typeof d.width === 'number' && Number.isFinite(d.width) && d.width > 0 ? Math.round(d.width) : 0;
  const alto = typeof d.height === 'number' && Number.isFinite(d.height) && d.height > 0 ? Math.round(d.height) : 0;
  if (!ancho || !alto || !Array.isArray(d.pages) || d.pages.length === 0) return null;
  if (!d.pages.every((p) => p && typeof p === 'object' && Array.isArray((p as { objects?: unknown }).objects))) return null;
  return { ancho, alto, paginas: d.pages.length };
}

/**
 * Los `src` que no sirven fuera de ESTE navegador: `blob:` (vive lo que dura la pestaña) e `idb://`
 * (la base local de la etapa 1). Un documento con alguno no se guarda: en otra máquina, o mañana,
 * esa imagen sería un hueco. El editor los sube antes (adaptador de MaKo, mako/nube.ts).
 */
export function srcsLocales(doc: unknown): string[] {
  const out = new Set<string>();
  const visitar = (v: unknown, prof: number) => {
    if (prof > 40 || v == null) return;
    if (typeof v === 'string') {
      if (/^(blob:|idb:\/\/)/i.test(v)) out.add(v.slice(0, 80));
      return;
    }
    if (Array.isArray(v)) { for (const x of v) visitar(x, prof + 1); return; }
    if (typeof v === 'object') for (const x of Object.values(v as Record<string, unknown>)) visitar(x, prof + 1);
  };
  visitar(doc, 0);
  return [...out];
}

/** Una versión que manda el editor: entero ≥ 1, o null. */
export function versionValida(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
}
