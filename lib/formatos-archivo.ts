// =============================================================================
// formatos-archivo — QUÉ archivos entiende MaKo. Una lista, para todos.
// =============================================================================
// Esta lista existía TRES veces: en `lib/archivo-a-texto.ts` (el lector), en
// `app/plan/board/ImportarModal.tsx` (con un comentario que decía «duplicado a
// propósito… si allá se agrega un formato, se agrega acá») y, de hecho, una cuarta
// en `lib/mako-doer-in.ts`, que solo aceptaba imágenes y PDF.
//
// Lo que pasó fue lo previsible: Martín mandó un **.txt** por WhatsApp para cargarlo al
// plan y le rebotó con «ese tipo de archivo todavía no» — un .txt, que es texto plano y
// el formato más fácil de leer que existe. El lector sabía abrirlo desde el día uno.
// La copia de WhatsApp no se había enterado.
//
// Por eso este módulo NO tiene `server-only`: lo importan el server (el lector, el
// webhook de WhatsApp) y el navegador (el `accept` del input y los íconos de la bandeja).
// Es la única forma de que sea de verdad UNA lista. Ver «Una cosa, un lugar» en AGENTS.md.
//
// Agregar un formato = agregarlo ACÁ, y darle su rama en `archivoATexto`. Nada más.
// =============================================================================

/** La familia decide CÓMO se lee, y cuánto cuesta. El orden importa poco; lo que
 *  importa es que sea la misma partición que usan las ramas de `archivoATexto`. */
export type FamiliaArchivo = 'texto' | 'docx' | 'pdf' | 'imagen' | 'audio' | 'video' | 'desconocido';

/** Las extensiones de cada familia, sin el punto. */
export const EXT_POR_FAMILIA: Record<Exclude<FamiliaArchivo, 'desconocido'>, string[]> = {
  texto: ['txt', 'md', 'markdown', 'vtt', 'srt', 'csv', 'json', 'log', 'rtf'],
  docx: ['docx'],
  pdf: ['pdf'],
  imagen: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'avif'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'opus', 'aac', 'flac'],
  video: ['mp4', 'mov', 'm4v', 'webm'],
};

/** Todas, con punto adelante, en el orden en que se le muestran al usuario. */
export const EXTENSIONES_SOPORTADAS: string[] = (
  ['texto', 'docx', 'pdf', 'imagen', 'audio', 'video'] as const
).flatMap((f) => EXT_POR_FAMILIA[f].map((e) => `.${e}`));

/** Para el `accept` de un `<input type="file">`. */
export const ACCEPT_IMPORTAR = EXTENSIONES_SOPORTADAS.join(',');

/** 25 MB: el techo del Archivero. Un transcript de 6 horas pesa kilobytes; lo que llega
 *  a este tamaño es un PDF escaneado o un audio, y los dos ya son caros de por sí. */
export const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;

const extDe = (nombre: string): string => (nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');

/**
 * ¿De qué familia es este archivo? Por extensión primero (es lo confiable) y por mime
 * después, porque WhatsApp y algunos navegadores mandan el nombre sin extensión o el
 * mime en blanco — y quedarse sin clasificar significa rebotarle el archivo al usuario.
 */
export function familiaDeArchivo(nombre: string, mime = ''): FamiliaArchivo {
  const e = extDe(nombre);
  for (const f of ['texto', 'docx', 'pdf', 'imagen', 'audio', 'video'] as const) {
    if (EXT_POR_FAMILIA[f].includes(e)) return f;
  }
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m.startsWith('text/')) return 'texto';
  if (m.startsWith('image/')) return 'imagen';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  return 'desconocido';
}

/** ¿MaKo puede sacarle texto a esto? La pregunta que hace WhatsApp antes de rebotar. */
export const puedeLeerse = (nombre: string, mime = ''): boolean =>
  familiaDeArchivo(nombre, mime) !== 'desconocido';

/** Los formatos en prosa, para decírselos a alguien («txt, md, pdf, …»). */
export const formatosLegibles = (): string =>
  [...new Set(EXTENSIONES_SOPORTADAS.map((e) => e.slice(1)))].join(', ');

/** Qué va a tener que hacer MaKo con el archivo. Se dice de entrada porque no cuesta lo
 *  mismo: un .md se lee gratis y un audio hay que transcribirlo. */
export function comoSeLee(nombre: string, mime = ''): string {
  switch (familiaDeArchivo(nombre, mime)) {
    case 'audio': case 'video': return 'lo transcribe';
    case 'imagen': return 'lee la imagen';
    case 'pdf': case 'docx': return 'saca el texto';
    case 'texto': return 'texto directo';
    default: return 'no sé leerlo';
  }
}

/** El ícono de la bandeja de importación. */
export function iconoDeArchivo(nombre: string, mime = ''): string {
  switch (familiaDeArchivo(nombre, mime)) {
    case 'audio': return '🎧';
    case 'video': return '🎬';
    case 'imagen': return '🖼';
    case 'pdf': return '📕';
    case 'docx': return '📄';
    case 'texto': return '📝';
    default: return '❔';
  }
}
