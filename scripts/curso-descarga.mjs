// =============================================================================
// curso-descarga — bajar UN archivo de la plataforma, y saber si lo que llegó sirve
// =============================================================================
// El único lugar donde vive «cómo se obtiene un archivo detrás de la sesión y cómo se
// sabe qué es». Lo escribió `curso-pdfs.mjs` peleando con casos reales; ahora también
// lo necesita `curso-recursos-vip.mjs` para el área /curso/, y copiarlo era garantizar
// que la segunda copia se quedara vieja (AGENTS.md → «una cosa, un lugar»).
//
// Las cuatro cosas que este módulo sabe, y las cuatro se pagaron con un bug:
//
//  1. LA EXTENSIÓN ES UN HECHO DEL ARCHIVO, no una suposición del script. Sale del
//     `Content-Disposition`, después del mime, y recién al final de la URL — que es lo
//     MENOS confiable, porque las de R2 terminan en un id sin extensión. La primera
//     versión asumía `.pdf` y descartaba los tres ZIP de un curso reportando «no
//     apareció ningún PDF» sobre archivos que SÍ pasaban por la red.
//
//  2. `getResponseBody` DEVUELVE 0 BYTES SIN ERROR para lo que el renderer trata como
//     DESCARGA. Por eso hay dos caminos y hacen falta los dos: si el cuerpo de CDP
//     viene vacío, se baja la URL ya resuelta de frente. El bucket es público — la
//     sesión hacía falta para AVERIGUAR la URL, no para leerla.
//
//  3. UNA PÁGINA DE ERROR VESTIDA DE 200 se guarda igual de bien que un archivo. Se
//     valida por firma (`%PDF-`, `PK`) y, cuando no hay firma conocida, al menos se
//     rechaza el HTML. Ya pasó con Drive: el archivo quedaba «bajado» y roto.
//
//  4. LO QUE COMPONE LA PÁGINA NO ES UN ARCHIVO DEL CURSO. Se excluye por FAMILIA de
//     mime (html/css/js/json/fuentes/iconos), no por una lista de lo que sí queremos:
//     el día que el curso sirva un .docx tiene que entrar solo.
// =============================================================================

/** Mime → extensión, por familia. Ampliar acá y lo ven los dos scripts. */
export const MIME_EXT = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/rtf': 'rtf',
  'text/csv': 'csv',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
};

/** Lo que compone la PÁGINA y por lo tanto nunca es un archivo del curso. */
export const ES_PAGINA = /^(text\/(html|css|javascript)|application\/(javascript|json|manifest)|font\/|image\/(svg|x-icon|vnd))/i;

/** La extensión REAL: Content-Disposition → mime → URL (la menos confiable). */
export const extDe = (url, mime, disp) => {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp ?? '');
  if (m) {
    const e = /\.([a-z0-9]{2,5})$/i.exec(decodeURIComponent(m[1]).trim());
    if (e) return e[1].toLowerCase();
  }
  const base = String(mime ?? '').split(';')[0].trim().toLowerCase();
  if (MIME_EXT[base]) return MIME_EXT[base];
  const e = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(url);
  if (e) return e[1].toLowerCase();
  return 'bin';
};

/** El nombre que propone el servidor, sin extensión. null si no propone ninguno. */
export const nombreDisp = (disp) => {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disp ?? '');
  if (!m) return null;
  try { return decodeURIComponent(m[1]).trim().replace(/\.[a-z0-9]{2,5}$/i, ''); } catch { return null; }
};

const FIRMAS = {
  pdf: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  zip: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  docx: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  xlsx: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
  pptx: (b) => b.subarray(0, 2).toString('latin1') === 'PK',
};
const esHtml = (b) => /^\s*(<!doctype html|<html|<head|<body)/i.test(b.subarray(0, 200).toString('latin1'));

/** ¿Lo que llegó es de verdad un archivo de ese tipo, o una página de error de 200? */
/**
 * ¿Lo que llegó es de verdad un archivo de ese tipo, o una página de error de 200?
 *
 * ⚠️ El piso de 64 bytes es una HEURÍSTICA para detectar respuestas vacías, y como toda
 * heurística tiene falsos positivos: rechaza un archivo que de verdad pesa menos. Pasó con
 * «4- enlace» de Organic Ecom, un .txt de **32 bytes** con una URL adentro — el recurso
 * existe, la API declara sus 32 bytes, y el descargador lo informaba como «nada
 * descargable en 30s».
 *
 * Por eso `esperado`: cuando la plataforma DECLARA el tamaño y el buffer coincide exacto,
 * eso es una prueba más fuerte que cualquier piso, y el piso no se aplica. Es la misma
 * regla de siempre — un dato le gana a un desempate.
 */
export const valido = (buf, ext, esperado = null) => {
  if (!buf) return false;
  const declarado = esperado != null && Math.abs(buf.length - esperado) <= 2;
  if (!declarado && buf.length < 64) return false;
  const f = FIRMAS[ext];
  if (f) return f(buf);
  return !esHtml(buf);
};

/** ¿Esta respuesta puede ser un archivo del curso? Cuatro señales, alcanza una. */
export const puedeSerArchivo = (response) => {
  const mime = String(response?.mimeType ?? '');
  if (ES_PAGINA.test(mime)) return null;
  const h = response?.headers ?? {};
  const disp = h['content-disposition'] ?? h['Content-Disposition'] ?? '';
  const adjunto = /attachment/i.test(disp);
  const conocido = !!MIME_EXT[mime.split(';')[0].trim().toLowerCase()];
  const generico = /octet-stream/i.test(mime);
  const porUrl = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|rtf|mp4|mp3|cube|txt|png|jpe?g)(\?|$)/i.test(String(response?.url ?? ''));
  return (adjunto || conocido || generico || porUrl) ? { url: response.url, mime, disp } : null;
};

/** El cuerpo que retuvo Chrome. null si no lo tiene (o si lo trató como descarga). */
export const cuerpoCdp = async (cdp, rid, sessionId) => {
  try {
    const { body, base64Encoded } = await cdp.enviar('Network.getResponseBody', { requestId: rid }, sessionId);
    return base64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'utf8');
  } catch { return null; }
};

/** El plan B, que es el que salva los ZIP: bajar la URL ya resuelta de frente. */
export const cuerpoDirecto = async (url, referer, ua) => {
  try {
    const r = await fetch(url, {
      headers: { ...(referer ? { referer } : {}), ...(ua ? { 'user-agent': ua } : {}) },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
};

/**
 * Los dos caminos, en orden, con la validación puesta. Devuelve
 * `{ buf, ext } | { error }` — nunca un Buffer que no valida, porque un archivo roto
 * guardado en disco es indistinguible de uno bueno hasta que alguien lo abre.
 */
export const bajarCuerpo = async ({ cdp, rid, sessionId, cand, referer, ua }) => {
  let buf = await cuerpoCdp(cdp, rid, sessionId);
  // El umbral de 64 no es cosmético: es el caso «CDP devolvió vacío» sin decirlo.
  if (!buf || buf.length < 64) buf = await cuerpoDirecto(cand.url, referer, ua);
  if (!buf) return { error: 'sin cuerpo por ninguno de los dos caminos' };
  const ext = extDe(cand.url, cand.mime, cand.disp);
  if (!valido(buf, ext)) return { error: `${cand.mime || '?'} ${buf.length}B → no valida como .${ext}` };
  return { buf, ext };
};
