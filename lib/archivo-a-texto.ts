import 'server-only';

// =============================================================================
// archivo-a-texto — un archivo entra, texto sale (sin importar el formato)
// =============================================================================
// El Archivero ya sabía leer .txt/.md/.docx/.pdf/imágenes, pero esa lógica vivía
// enterrada dentro de su route handler, así que el importador del tablero —el otro
// lugar donde el usuario sube archivos— solo aceptaba texto plano y de a uno.
// Acá está la misma capacidad, sola, para que los dos la usen y no se desincronicen.
//
// Qué sabe leer, y CÓMO (importa, porque el costo cambia mucho):
//  · .txt .md .vtt .srt y cualquier text/*  → directo del buffer. Gratis.
//  · .docx                                  → mammoth. Gratis.
//  · .pdf                                   → primero la CAPA DE TEXTO (unpdf): gratis
//    y confiable. Solo si el PDF es un escaneo (capa vacía) cae a visión, que es la
//    vía cara. Antes TODO PDF iba por visión y un PDF normal volvía vacío.
//  · imágenes                               → visión.
//  · audio y video                          → transcripción por la cascada barata.
//
// Todo es best-effort POR ARCHIVO: uno que falla devuelve su motivo en `warning` y no
// arrastra a los demás. Quien llama decide si sigue.
// =============================================================================

import { leerDocumentoIA, transcribirAudio } from './ai-cheap';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 25 MB: el techo del Archivero. Un transcript de 6 horas pesa kilobytes; lo que
 *  llega a este tamaño es un PDF escaneado o un audio, y los dos ya son caros. */
export const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;

const LEER_DOC = 'Transcribí TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describí también lo que se ve. Devolvé solo el texto.';

export type LecturaArchivo = { texto: string; warning?: string; via: 'texto' | 'docx' | 'pdf' | 'pdf-vision' | 'imagen' | 'audio' | 'no-soportado' };

const RE_TEXTO = /\.(txt|md|markdown|vtt|srt|csv|json|log|rtf)$/i;
const RE_IMG = /\.(png|jpe?g|webp|gif|bmp|heic|avif)$/i;
const RE_AUDIO = /\.(mp3|m4a|wav|ogg|opus|aac|flac|webm|mp4|mov|m4v)$/i;

/** Los formatos que el importador puede aceptar, para el `accept` del input y para el
 *  texto que se le muestra al usuario. Uno solo: la lista y el lector no se separan. */
export const EXTENSIONES_SOPORTADAS = [
  '.txt', '.md', '.markdown', '.vtt', '.srt', '.csv', '.json', '.log', '.rtf',
  '.docx', '.pdf',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.heic', '.avif',
  '.mp3', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.flac', '.webm', '.mp4', '.mov', '.m4v',
];
export const ACCEPT_IMPORTAR = EXTENSIONES_SOPORTADAS.join(',');

export async function archivoATexto(file: File): Promise<LecturaArchivo> {
  const name = (file.name || '').toLowerCase();
  const mime = file.type || '';
  if (file.size > MAX_ARCHIVO_BYTES) {
    return { texto: '', via: 'no-soportado', warning: `«${file.name}» pesa más de 25 MB. Es demasiado para leerlo de una.` };
  }

  // Texto plano — la vía barata, y la más común (transcripts, notas, exportes).
  if (RE_TEXTO.test(name) || mime.startsWith('text/')) {
    return { texto: await file.text(), via: 'texto' };
  }

  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith('.docx')) {
    try {
      const mammoth = (await import('mammoth')).default;
      return { texto: (await mammoth.extractRawText({ buffer: buf })).value, via: 'docx' };
    } catch (e) { return { texto: '', via: 'docx', warning: `No pude abrir «${file.name}»: ${msg(e)}` }; }
  }

  if (name.endsWith('.pdf') || mime === 'application/pdf') {
    try {
      // pdfjs (dentro de unpdf) usa Math.sumPrecise, que no existe en Node < 22.
      const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
      if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      if (text && text.trim().length > 80) return { texto: text, via: 'pdf' };
    } catch { /* sin capa de texto → es un escaneo, va por visión */ }
    try {
      const { text } = await leerDocumentoIA({ dataUrl: `data:application/pdf;base64,${buf.toString('base64')}`, isPdf: true, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'Importar al plan', motivo: `Leer «${file.name}»` });
      return { texto: text, via: 'pdf-vision' };
    } catch (e) { return { texto: '', via: 'pdf-vision', warning: `No pude leer «${file.name}»: ${msg(e)}` }; }
  }

  if (RE_IMG.test(name) || mime.startsWith('image/')) {
    try {
      const { text } = await leerDocumentoIA({ dataUrl: `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`, isPdf: false, nombreArchivo: file.name, prompt: LEER_DOC, feature: 'Importar al plan', motivo: `Leer «${file.name}»` });
      return { texto: text, via: 'imagen' };
    } catch (e) { return { texto: '', via: 'imagen', warning: `No pude leer «${file.name}»: ${msg(e)}` }; }
  }

  if (RE_AUDIO.test(name) || mime.startsWith('audio/') || mime.startsWith('video/')) {
    try {
      const texto = await transcribirAudio(buf.toString('base64'), mime || 'audio/mpeg', { motivo: `Transcribir «${file.name}»` });
      if (!texto.trim()) return { texto: '', via: 'audio', warning: `«${file.name}» se transcribió vacío: puede que no tenga voz.` };
      return { texto, via: 'audio' };
    } catch (e) { return { texto: '', via: 'audio', warning: `No pude transcribir «${file.name}»: ${msg(e)}` }; }
  }

  return { texto: '', via: 'no-soportado', warning: `«${file.name}»: no sé leer ese formato todavía.` };
}
