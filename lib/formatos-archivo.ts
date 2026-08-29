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
export type FamiliaArchivo =
  | 'texto' | 'docx' | 'pdf' | 'imagen' | 'audio' | 'video'
  | 'xlsx' | 'pptx' | 'opendocument'
  | 'desconocido';

/** Las extensiones de cada familia, sin el punto. */
export const EXT_POR_FAMILIA: Record<Exclude<FamiliaArchivo, 'desconocido'>, string[]> = {
  // Cualquier cosa que sea texto plano se lee gratis: agregar una extensión acá no
  // cuesta nada y evita un rebote. `tsv`, `yaml`, `xml`, `html` y `svg` entraron por eso.
  texto: ['txt', 'md', 'markdown', 'vtt', 'srt', 'csv', 'tsv', 'json', 'log', 'rtf', 'yaml', 'yml', 'xml', 'html', 'htm', 'svg', 'ini', 'conf', 'tex'],
  docx: ['docx'],
  pdf: ['pdf'],
  // Planillas y decks: ZIP + XML, se leen sin IA (lib/office-a-texto). La lista de leads
  // viene en planilla y la propuesta del cliente viene en deck: rebotarlos era raro.
  xlsx: ['xlsx', 'xlsm'],
  pptx: ['pptx'],
  opendocument: ['odt', 'ods', 'odp'],
  // Imágenes: las que aguantan Gemini y OpenAI, que son las dos que hacen la visión.
  // `jfif` es un .jpg con otro nombre y `heif` es el hermano de `heic` (fotos de iPhone).
  imagen: ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'gif', 'bmp', 'heic', 'heif', 'avif'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'aac', 'flac', 'aiff', 'aif'],
  // Video: los contenedores que Gemini acepta para transcribir. `mkv` NO está a
  // propósito: Gemini no lo toma y aceptarlo sería prometer algo que falla después.
  video: ['mp4', 'mov', 'm4v', 'webm', 'mpeg', 'mpg', 'avi', 'wmv', 'flv', '3gp', '3gpp'],
};

/**
 * Formatos que MaKo NO puede abrir pero que alguien va a mandar igual, con la razón
 * concreta y qué hacer. Un «no sé leer ese formato» a secas deja al usuario adivinando;
 * «guardalo como .docx» lo resuelve en diez segundos.
 */
export const NO_SOPORTADOS: Record<string, string> = {
  doc: 'es el Word viejo (97-2003) y necesita otra librería. Ábrelo y guárdalo como .docx.',
  xls: 'es el Excel viejo (97-2003). Ábrelo y guárdalo como .xlsx.',
  ppt: 'es el PowerPoint viejo (97-2003). Ábrelo y guárdalo como .pptx.',
  pages: 'es de Pages (Apple) y es un formato cerrado. Expórtalo a .docx o .pdf.',
  numbers: 'es de Numbers (Apple) y es un formato cerrado. Expórtalo a .xlsx o .csv.',
  key: 'es de Keynote (Apple) y es un formato cerrado. Expórtalo a .pptx o .pdf.',
  zip: 'es un comprimido: no lo abro por seguridad. Mándame los archivos sueltos.',
  rar: 'es un comprimido: no lo abro por seguridad. Mándame los archivos sueltos.',
  '7z': 'es un comprimido: no lo abro por seguridad. Mándame los archivos sueltos.',
  epub: 'es un libro electrónico y todavía no lo leo. Pasámelo a .pdf.',
  mkv: 'es un contenedor de video que la transcripción no acepta. Pásalo a .mp4.',
  tiff: 'es un formato de imagen que la visión no acepta. Pásalo a .png o .jpg.',
  tif: 'es un formato de imagen que la visión no acepta. Pásalo a .png o .jpg.',
};

/** Si el formato no se puede leer PERO sabemos por qué, la explicación concreta. */
export const porQueNoPuedo = (nombre: string): string =>
  NO_SOPORTADOS[nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''] ?? '';

/** El orden en que se le muestran al usuario: de lo más común a lo más raro. */
const ORDEN = ['texto', 'docx', 'pdf', 'xlsx', 'pptx', 'opendocument', 'imagen', 'audio', 'video'] as const;

export const EXTENSIONES_SOPORTADAS: string[] = ORDEN.flatMap((f) => EXT_POR_FAMILIA[f].map((e) => `.${e}`));

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
  for (const f of ORDEN) {
    if (EXT_POR_FAMILIA[f].includes(e)) return f;
  }
  // Una extensión que sabemos que NO se puede no cae al mime: un .doc con mime
  // `application/msword` no es un .docx, y tratarlo como tal daría un error críptico.
  if (NO_SOPORTADOS[e]) return 'desconocido';
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (m.startsWith('application/vnd.oasis.opendocument.')) return 'opendocument';
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
    case 'pdf': case 'docx': case 'opendocument': return 'saca el texto';
    case 'xlsx': return 'lee la planilla';
    case 'pptx': return 'lee las diapositivas';
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
    case 'docx': case 'opendocument': return '📄';
    case 'xlsx': return '📊';
    case 'pptx': return '📽';
    case 'texto': return '📝';
    default: return '❔';
  }
}
