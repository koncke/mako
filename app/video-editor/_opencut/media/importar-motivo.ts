// =============================================================================
// Qué hacer con un video que se importa, y POR QUÉ no se pudo (ticket #15, Leila, 27/10/2026)
// =============================================================================
// Leila: «No se pudo importar. ESP_Fabi sentada_limpio.mp4», sin ningún error técnico en el reporte. Lo que pasaba:
//   · cualquier falla al leer el video (el contenedor que mediabunny no entiende, un archivo de la nube sin bajar, la
//     miniatura que no se pudo decodificar) daba el MISMO «No se pudo importar» con sólo el nombre, y el porqué quedaba
//     en la consola: ni la persona sabía qué hacer ni el reporte llevaba la causa;
//   · y si la lectura fallaba, el clip igual se sumaba a la biblioteca, sin duración ni tamaño (roto);
//   · una miniatura que no se podía decodificar tumbaba la importación entera, aunque el resto se leyera bien.
// Ahora la decisión vive acá (pura, con test): importar, importar avisando que puede verse mal, importar como audio si
// no tiene imagen, o NO importar diciendo por qué y qué hacer. El detalle técnico viaja en el reporte a Soporte.
//
// ⚠️ Un .mp4 CORTADO (bajado o copiado a medias: el índice `moov` va al final y no llegó) no da error de lectura: se
// lee como un archivo SIN PISTAS. Hasta el 28/10 eso decía «no tiene imagen; si es sólo audio, impórtalo desde Audio»,
// que es falso (medido con un .mp4 de ffmpeg cortado antes del índice: ni imagen ni sonido). Y es una causa probable del
// ticket: antes del arreglo del 27/10 daba justo «No se pudo importar» con el nombre.
// =============================================================================

export type ArchivoLeido = { name: string; size: number; type: string };

export type ResultadoLectura =
  | { ok: true; canDecode: boolean; codec: string | null; errorDecodificar: string | null }
  | { ok: false; error: unknown; sinImagenConAudio: boolean };

export type DecisionImportar =
  | { accion: 'importar' }
  | { accion: 'importar-con-aviso'; aviso: string; tecnico: string }
  | { accion: 'como-audio'; aviso: string }
  | { accion: 'rechazar'; motivo: string; tecnico: string };

const TOPE_TECNICO = 400;

function mb(bytes: number): string {
  if (!(bytes > 0)) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** El detalle para Soporte: el error tal cual, el tipo y el peso. Nunca lo lee la persona. */
export function detalleTecnico(error: unknown, archivo: ArchivoLeido): string {
  const e = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? 'sin error');
  return `${e} · ${archivo.type || 'sin tipo'} · ${mb(archivo.size)}`.slice(0, TOPE_TECNICO);
}

/** El porqué de un video que no se pudo leer, para la persona: qué pasó y qué hacer. */
export function motivoDeLectura(error: unknown, archivo: ArchivoLeido): string {
  const nombre = error instanceof Error ? error.name : '';
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (archivo.size === 0) {
    return 'El archivo está vacío. Si está en OneDrive, Google Drive o Dropbox, descárgalo a tu computadora y vuelve a importarlo.';
  }
  if (nombre === 'NotReadableError' || nombre === 'NotFoundError' || /could not be read|not readable|permission/i.test(msg)) {
    return 'Tu computadora no dejó leer el archivo. Si está en OneDrive, Google Drive o Dropbox sin descargar, ábrelo una vez (o elige «Mantener siempre en este dispositivo») y vuelve a importarlo.';
  }
  if (/quota/i.test(nombre) || /quota/i.test(msg)) {
    return 'No hay espacio en el navegador para guardarlo. Borra proyectos o archivos que no uses y vuelve a importarlo.';
  }
  // Sin pista de video llega acá sólo si tampoco tiene sonido (con sonido entra como audio): está cortado o no es un video.
  if (/no video track/i.test(msg)) {
    return 'El archivo no tiene ni imagen ni sonido: parece incompleto, como un video que se bajó o se copió a medias. Fíjate que se reproduzca en tu computadora; si no, bájalo o cópialo de nuevo.';
  }
  if (/unsupported|unrecognizable|not supported|unknown format|no format/i.test(msg)) {
    return 'El formato del archivo no se reconoce. Expórtalo de nuevo como MP4 (H.264) e impórtalo.';
  }
  if (/eof|end of (file|stream)|truncat|unexpected end|moov|corrupt|invalid|malformed/i.test(msg)) {
    return 'El archivo parece incompleto o dañado. Fíjate que se reproduzca en tu computadora; si no, cópialo o expórtalo de nuevo.';
  }
  return 'No se pudo leer el archivo. Expórtalo de nuevo (un video, como MP4 H.264) e impórtalo; si sigue igual, repórtalo.';
}

/** El aviso de un video que se importa pero el navegador no decodifica (se ve negro o mal en el reproductor). */
export function avisoNoDecodifica(codec: string | null): string {
  const codecLabel = codec ? codec.toUpperCase() : 'este códec';
  return codec === 'hevc'
    ? `Este navegador no decodifica ${codecLabel}: el clip puede verse mal. Conviértelo a MP4 H.264 o ábrelo en Safari.`
    : `Este navegador no decodifica ${codecLabel}: el clip puede verse mal. Conviértelo a MP4 H.264 e impórtalo de nuevo.`;
}

/** Qué se hace con el video, según lo que se pudo leer. */
export function decidirImportacionVideo(r: ResultadoLectura, archivo: ArchivoLeido): DecisionImportar {
  if (r.ok) {
    if (r.canDecode && !r.errorDecodificar) return { accion: 'importar' };
    return {
      accion: 'importar-con-aviso',
      aviso: avisoNoDecodifica(r.codec),
      tecnico: `${r.errorDecodificar ?? `sin decodificador para ${r.codec ?? 'el códec'}`} · ${archivo.type || 'sin tipo'} · ${mb(archivo.size)}`.slice(0, TOPE_TECNICO),
    };
  }
  if (r.sinImagenConAudio) return { accion: 'como-audio', aviso: 'No tiene imagen: se importó como audio.' };
  return { accion: 'rechazar', motivo: motivoDeLectura(r.error, archivo), tecnico: detalleTecnico(r.error, archivo) };
}
