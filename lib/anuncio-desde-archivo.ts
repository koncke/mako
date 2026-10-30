// =============================================================================
// anuncio-desde-archivo — «súbeme este anuncio» desde el grupo: la parte PURA (29/10/2026; sin base ni red)
// =============================================================================
// La llamada con Thiago (docs/promesas/2910-llamada-thiago.md, punto 2): «subime este anuncio» mandando un Drive al grupo, o el
// video o la imagen. MaKo baja el archivo, lo guarda en el bucket de los creativos y PROPONE el anuncio EN PAUSA, que se aprueba en
// /mako/revisar; al aprobarlo, el link firmado va a Zernio (`imageUrl`, o `video.url`: Zernio lo baja, lo sube a Meta y lo espera;
// docs.zernio.com, POST /v1/ads/create, «Supply `url` to upload a file», MP4 H.264/AAC, 75 KB a 500 MB).
//
// ⚠️ DETRÁS DE `ZERNIO_ANUNCIOS_PROBADO` (lib/zernio-ads-cuerpo.ts): un anuncio con creativo NUEVO por la app de Meta del cliente
// rebota con el 1885183, y que Zernio no rebote lo dice sólo la prueba de scripts/prueba-zernio-anuncio.mts, que corre Martín. Con
// la bandera apagada, la operación lo dice (`ANUNCIO_DESDE_ARCHIVO_APAGADO`) y no baja ni sube nada.
// =============================================================================

/** Lo que dice MaKo mientras la prueba de anuncios por Zernio no corrió. */
export const ANUNCIO_DESDE_ARCHIVO_APAGADO =
  'Subir un anuncio desde un archivo todavía no está prendido: falta la prueba de anuncios por Zernio, que hace Martín. Hasta entonces, súbelo desde el Media Buyer en la app.';

/** Los topes: la imagen, el de Meta (30 MB); el video, lo que entra en la memoria de la función (Zernio acepta hasta 500 MB por link). */
export const MAX_IMAGEN_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** La carpeta del bucket de los creativos (`ADS_CREATIVES_BUCKET`) para lo que llega desde el grupo: aparte de la de staging, que la
 *  subida de la app limpia sola. */
export const CARPETA_DEL_GRUPO = 'grupo';

/** ¿Imagen o video? Por el mime y, si no hay, por la extensión. Lo demás (un PDF, un audio) no es un creativo. */
export function tipoDelArchivo(mime: string | null | undefined, nombre: string | null | undefined): 'image' | 'video' | null {
  const m = (mime || '').split(';')[0].trim().toLowerCase();
  const n = (nombre || '').toLowerCase();
  if (/^image\/(jpe?g|png)$/.test(m) || (!m && /\.(jpe?g|png)$/.test(n))) return 'image';
  if (/^video\/(mp4|quicktime)$/.test(m) || (!m && /\.(mp4|mov)$/.test(n))) return 'video';
  return null;
}

/** El error si el archivo no sirve como creativo, o null. */
export function errorDelArchivo(tipo: 'image' | 'video' | null, bytes: number): string | null {
  if (!tipo) return 'Ese archivo no es una imagen (JPG o PNG) ni un video (MP4): no sirve como anuncio.';
  if (bytes <= 0) return 'El archivo llegó vacío.';
  if (tipo === 'image' && bytes > MAX_IMAGEN_BYTES) return 'La imagen pasa los 30 MB que acepta Meta.';
  if (tipo === 'video' && bytes > MAX_VIDEO_BYTES) return 'El video pasa los 100 MB: súbelo desde el Media Buyer en la app.';
  return null;
}

/**
 * El link de DESCARGA de un archivo de Drive (`/file/d/<id>/…`, `open?id=<id>`, `uc?id=<id>`), o null si no es de Drive. Un link
 * que no es de Drive tiene que ser https y se baja tal cual.
 */
export function linkDeDescarga(link: string): string | null {
  const t = (link || '').trim();
  let u: URL;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (/(^|\.)drive\.google\.com$/i.test(u.hostname)) {
    const id = /\/file\/d\/([\w-]{10,})/.exec(u.pathname)?.[1] ?? u.searchParams.get('id');
    return id && /^[\w-]{10,}$/.test(id) ? `https://drive.google.com/uc?export=download&id=${id}` : null;
  }
  return u.toString();
}

/** La ruta en el bucket: por negocio, con un nombre que no se repite. */
export function rutaEnElBucket(ws: number, id: string, tipo: 'image' | 'video', mime: string): string {
  const ext = tipo === 'video' ? (/quicktime/i.test(mime) ? 'mov' : 'mp4') : (/png/i.test(mime) ? 'png' : 'jpg');
  return `${CARPETA_DEL_GRUPO}/${ws}/${id}.${ext}`;
}
