// =============================================================================
// setting-adjuntos-reglas — lo que decide un archivo de los mensajes sin tocar la base (puro)
// =============================================================================
// La biblioteca de ARCHIVOS del chatbot (mig 0225, `setting_adjuntos`): las fotos, los videos y
// los documentos que un mensaje de WhatsApp lleva por referencia (`tipo: 'media'` + `media_id`).
// Pedido de Martín (08/10/2026, punto 8): «que se pueda adjuntar archivos, emojis etc.».
//
// Sin `server-only` ni 'use client' a propósito: lo usan lib/setting-adjuntos.ts (server), el
// editor del mensaje (el `accept`, el chequeo antes de subir), el motor (qué tipo le pide a
// Evolution) y un test que lo EJECUTA (tests/setting-adjuntos.test.ts).
//
// El modelo, en una línea: el binario vive en el bucket `wa-media` bajo
// `<ws>/setting-adjuntos/<uuid>.<ext>`, la fila en `setting_adjuntos`, y el paso lo nombra por
// `media_id`. NUNCA bajo `<ws>/mako_ws<ws>/`: ése es el prefijo del espejo de las
// conversaciones, que se limpia (docs/hallazgos-comunicacion.md, «wa-media es un bucket
// compartido»).
//
// ⚠️ EL BUCKET NO FILTRA NADA. `wa-media` es privado y NO tiene `file_size_limit` ni
//    `allowed_mime_types` (medido el 08/10/2026): guarda el espejo, y el espejo guarda lo que
//    llegue. Así que la lista de abajo es la ÚNICA puerta, y se pregunta dos veces: al firmar la
//    subida (lo que el navegador DECLARA) y al registrar (lo que Storage dice que se GUARDÓ, con
//    `info()`). Lo que no pasa la segunda se borra.

/** El bucket del espejo del no oficial, que también guarda la biblioteca. */
export const BUCKET_ADJUNTOS_WA = 'wa-media';
/** La carpeta de la biblioteca adentro del prefijo del workspace. */
export const CARPETA_ADJUNTOS = 'setting-adjuntos';

/**
 * Lo que se puede mandar por WhatsApp como archivo de un mensaje.
 *
 * ⚠️ SIN SVG NI HTML: los dos pueden llevar código, y abiertos desde la URL firmada corren en el
 *    dominio de Storage. Es la misma regla que `MIME_ADJUNTO` del curso.
 * ⚠️ SIN WEBP NI GIF como imagen: WhatsApp manda un webp como STICKER y un gif lo convierte a
 *    video; por `sendMedia` con `mediatype: 'image'` no hay garantía de qué le llega al lead. Una
 *    foto es JPG o PNG.
 * ⚠️ El video, MP4 o 3GP: los dos que WhatsApp reproduce en todos los teléfonos. Un `.mov` de
 *    iPhone no entra (en Android puede no abrir) y la pantalla lo dice antes de subir.
 */
export const MIME_ADJUNTO_WA = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/3gpp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
] as const;
export type MimeAdjuntoWA = (typeof MIME_ADJUNTO_WA)[number];

const EXT_DE_MIME_WA: Record<MimeAdjuntoWA, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};
const MIME_DE_EXT_WA: Record<string, MimeAdjuntoWA> = {
  ...Object.fromEntries(Object.entries(EXT_DE_MIME_WA).map(([m, e]) => [e, m as MimeAdjuntoWA])),
  jpeg: 'image/jpeg',
};
const EXTS_WA = [...new Set(Object.values(EXT_DE_MIME_WA))].join('|');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const esMimeAdjuntoWA = (m: string | null | undefined): m is MimeAdjuntoWA =>
  (MIME_ADJUNTO_WA as readonly string[]).includes((m ?? '').toLowerCase());

/** Cómo lo manda Evolution (`sendMedia.mediatype`): lo decide el tipo, nunca la extensión. */
export function tipoEnvioDeMime(mime: string | null | undefined): 'image' | 'video' | 'document' {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Los topes, por tipo. ⚠️ SON LOS DE WHATSAPP O MÁS BAJOS, NUNCA MÁS ALTOS (AGENTS.md: «el entorno
 * tiene un tope y tu código declara otro»): WhatsApp acepta 5 MB por foto y 16 MB por video; un
 * documento admite 100 MB, y aquí se corta en 16 porque el motor lo baja entero a la memoria de la
 * función y lo manda en base64 (×1,37). El tope de Evolution 2.3.7 para `sendMedia` NO se midió.
 */
export const TOPE_IMAGEN_BYTES = 5 * 1024 * 1024;
export const TOPE_VIDEO_BYTES = 16 * 1024 * 1024;
export const TOPE_DOCUMENTO_BYTES = 16 * 1024 * 1024;

export function topeDe(mime: string | null | undefined): number {
  const t = tipoEnvioDeMime(mime);
  return t === 'image' ? TOPE_IMAGEN_BYTES : t === 'video' ? TOPE_VIDEO_BYTES : TOPE_DOCUMENTO_BYTES;
}

/** «Foto o video» del clip: el `accept` del selector de archivos. */
export const ACEPTA_FOTO_VIDEO = ['image/jpeg', 'image/png', 'video/mp4', 'video/3gpp', '.jpg', '.jpeg', '.png', '.mp4', '.3gp'].join(',');
/** «Documento» del clip. */
export const ACEPTA_DOCUMENTO = [
  ...MIME_ADJUNTO_WA.filter((m) => tipoEnvioDeMime(m) === 'document'),
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
].join(',');

/**
 * El tipo de un archivo elegido. PRIMERO la extensión, después lo que diga el navegador: Windows
 * con Excel le pone `application/vnd.ms-excel` a un .csv y hay navegadores que dejan vacío un
 * .docx (la misma regla que `mimeDeAdjunto` del curso). `null` = no es un formato que entre.
 */
export function mimeDeArchivoWA(nombre: string, tipo: string | null | undefined): MimeAdjuntoWA | null {
  const ext = (nombre.includes('.') ? nombre.split('.').pop() ?? '' : '').toLowerCase();
  if (ext) return MIME_DE_EXT_WA[ext] ?? null;
  return esMimeAdjuntoWA(tipo) ? (tipo!.toLowerCase() as MimeAdjuntoWA) : null;
}

/** Megas para un mensaje de error: «5 MB», «16 MB». */
const megas = (b: number) => `${Math.round(b / (1024 * 1024))} MB`;

/** Lo que se pregunta ANTES de subir (y otra vez en el server, con lo que llegó). */
export function validarArchivoWA(a: { nombre: string; tipo?: string | null; tamano: number }):
  | { ok: true; mime: MimeAdjuntoWA }
  | { ok: false; error: string } {
  const mime = mimeDeArchivoWA(a.nombre ?? '', a.tipo);
  if (!mime) return { ok: false, error: 'Ese formato no va.' };
  if (!Number.isFinite(a.tamano) || a.tamano <= 0) return { ok: false, error: 'El archivo está vacío.' };
  if (a.tamano > topeDe(mime)) return { ok: false, error: `Pasa de ${megas(topeDe(mime))}.` };
  return { ok: true, mime };
}

/**
 * Dónde se guarda: `<ws>/setting-adjuntos/<uuid>.<ext>`. El workspace primero y puesto por el
 * SERVER, como los audios: es lo que deja preguntar «¿este archivo es de este negocio?» con un
 * prefijo. El nombre original NO entra (acentos, espacios, el nombre de un cliente): va en la fila.
 */
export function pathDeAdjuntoWA(ws: number, mime: string, uuid: string): string | null {
  if (!esMimeAdjuntoWA(mime) || !Number.isInteger(ws) || ws <= 0) return null;
  if (!new RegExp(`^${UUID}$`).test(uuid)) return null;
  return `${ws}/${CARPETA_ADJUNTOS}/${uuid}.${EXT_DE_MIME_WA[mime.toLowerCase() as MimeAdjuntoWA]}`;
}

/**
 * ¿Este path es un archivo de la biblioteca de ESTE workspace? La guarda de dos cosas:
 *   · registrar: el navegador devuelve el path que se le firmó, y se vuelve a preguntar;
 *   · borrar: el binario se borra SÓLO si contesta que sí.
 *
 * ⚠️ «Completar con los datos de Mau» copia la FILA con su `media_path` apuntando al prefijo del
 *    dueño (`1/setting-adjuntos/…`), igual que con los audios (lib/setting-audios.ts, `borrarAudio`).
 *    Sin esta guarda, borrar esa copia desde el cliente de prueba borraría el archivo de Mauricio.
 * ⚠️ EXACTO, NO UN `startsWith`: con `startsWith('1/')`, el workspace 1 no se confunde con el 11
 *    gracias a la barra, pero un `startsWith('1/')` sí aceptaría `1/mako_ws1/…` (el espejo) o un
 *    `1/setting-adjuntos/../`. Se exige la forma entera.
 */
export function pathEsAdjuntoDe(path: string | null | undefined, ws: number): boolean {
  if (!path || !Number.isInteger(ws) || ws <= 0) return false;
  return new RegExp(`^${ws}/${CARPETA_ADJUNTOS}/${UUID}\\.(${EXTS_WA})$`).test(path);
}

/**
 * El mismo archivo con el tipo que decidió `mimeDeArchivoWA`. La subida firmada manda el tipo en
 * la parte del multipart, y Storage guarda ESE: con el que puso el sistema operativo (un
 * `application/octet-stream`), el registro lo rechaza al leer lo que se guardó.
 */
export function archivoConTipoWA(file: File, mime: string): File {
  return file.type === mime ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

/** El título por default: el nombre sin la extensión. */
export function tituloDeArchivo(nombre: string): string {
  const base = (nombre ?? '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/\s+/g, ' ').trim();
  return (base || 'Archivo').slice(0, 160);
}

/** «240 KB», «3,1 MB»: lo que dice el chip del archivo. */
export function pesoLegible(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** ¿Algún paso de esta secuencia nombra este archivo? (para no dejar un `media_id` colgado al borrar) */
export function pasosUsanAdjunto(pasos: unknown, id: number): boolean {
  if (!Array.isArray(pasos)) return false;
  return pasos.some((p) => !!p && typeof p === 'object' && Number((p as { media_id?: unknown }).media_id) === id);
}

/** Lo que viaja a la pantalla: sin el path del bucket, con la URL firmada para verlo. */
export type AdjuntoDto = {
  id: number;
  titulo: string;
  media_mime: string;
  nombre_archivo: string | null;
  tamano: number | null;
  url: string | null;
};

/**
 * La extensión de un archivo por su tipo, para el path del bucket (la usan el espejo de los
 * mensajes y las bibliotecas). Exacta para lo que manda un mensaje; para el resto, la regla vieja
 * por pedazos, y `bin` si no la conoce.
 *
 * Vive aquí y no en lib/evolution-media.ts (que la re-exporta) para que un test la pueda importar:
 * aquél es `server-only`. ANTES no conocía docx ni xlsx y el espejo los guardaba como `.bin`.
 */
export function extDeMime(mime: string): string {
  const m = (mime || '').toLowerCase().split(';')[0]!.trim();
  if (esMimeAdjuntoWA(m)) return EXT_DE_MIME_WA[m as MimeAdjuntoWA];
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('mp4')) return 'mp4';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'bin';
}
