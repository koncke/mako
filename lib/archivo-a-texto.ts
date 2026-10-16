import 'server-only';
import { textoParaBase } from './texto-para-base';

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
import { familiaDeArchivo, porQueNoPuedo, MAX_ARCHIVO_BYTES } from './formatos-archivo';

// La lista de formatos vive en `formatos-archivo.ts` y se re-exporta desde acá para no
// romper a quien ya la importaba. NO la copies: eso fue exactamente lo que hizo que un
// .txt rebotara en WhatsApp durante semanas.
export { EXTENSIONES_SOPORTADAS, ACCEPT_IMPORTAR, MAX_ARCHIVO_BYTES, puedeLeerse, formatosLegibles, familiaDeArchivo, porQueNoPuedo } from './formatos-archivo';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const LEER_DOC = 'Transcribe TODO el texto legible de este documento, tal cual, sin resumir ni omitir nada. Si es una imagen o captura, describe también lo que se ve. Devuelve solo el texto.';

export type LecturaArchivo = { texto: string; warning?: string; via: 'texto' | 'docx' | 'pdf' | 'pdf-vision' | 'imagen' | 'audio' | 'planilla' | 'diapositivas' | 'opendocument' | 'no-soportado' };

/**
 * A quién se le anota el gasto de IA (visión y transcripción) en el Saldo de IA.
 *
 * `feature` es el tag de gasto; sin él, visión queda en 'Importar al plan' (el primer llamador de este
 * módulo, y lo que todos anotaban hasta el 11/10/2026) y la transcripción en el default de
 * `transcribirAudio`. `motivo` reemplaza la descripción por defecto («Leer «archivo»»). Los dos son
 * opcionales para que los llamadores de siempre sigan anotando exactamente lo mismo; la tab Offer los
 * pasa para que lo que lee se vea como suyo y no como una importación al plan.
 */
export type OpcionesLectura = {
  feature?: string; motivo?: string;
  /**
   * La red de la plataforma para la lectura por VISIÓN (PDF escaneado, imagen), como en
   * `leerDocumentoIA`. Opt-in, porque sólo el que llama sabe si lo usa un cliente nuevo sin API:
   * Offer la pide (16/10/2026, la primera semana de un cliente sin API). El audio ya la tiene
   * siempre (`transcribirAudio`).
   */
  redDePlataforma?: boolean;
};

/**
 * El texto sale limpio de lo que la base no acepta guardar (el NUL de un PDF, un sustituto suelto):
 * todos los que leen un archivo lo guardan después en un `text` o un `jsonb`, y uno de esos caracteres
 * tira el guardado entero («unsupported Unicode escape sequence»). Ver lib/texto-para-base.ts.
 */
export async function archivoATexto(file: File, opts: OpcionesLectura = {}): Promise<LecturaArchivo> {
  const lectura = await leerArchivo(file, opts);
  return { ...lectura, texto: textoParaBase(lectura.texto) };
}

async function leerArchivo(file: File, opts: OpcionesLectura): Promise<LecturaArchivo> {
  const name = (file.name || '').toLowerCase();
  const mime = file.type || '';
  const featureVision = opts.feature || 'Importar al plan';
  if (file.size > MAX_ARCHIVO_BYTES) {
    return { texto: '', via: 'no-soportado', warning: `«${file.name}» pesa más de 25 MB. Es demasiado para leerlo de una.` };
  }
  // Una sola clasificación, la misma que usan el `accept` del importador y el webhook
  // de WhatsApp. Antes cada rama de acá tenía su propio regex y la lista de afuera era
  // otra cosa: por eso podían divergir sin que nada avisara.
  const familia = familiaDeArchivo(name, mime);

  // Texto plano — la vía barata, y la más común (transcripts, notas, exportes).
  if (familia === 'texto') {
    return { texto: await file.text(), via: 'texto' };
  }

  const buf = Buffer.from(await file.arrayBuffer());

  if (familia === 'docx') {
    try {
      const mammoth = (await import('mammoth')).default;
      return { texto: (await mammoth.extractRawText({ buffer: buf })).value, via: 'docx' };
    } catch (e) { return { texto: '', via: 'docx', warning: `No pude abrir «${file.name}»: ${msg(e)}` }; }
  }

  // Planillas, decks y OpenDocument: ZIP + XML, se leen sin gastar una sola llamada de
  // IA. Un .xlsx de leads o un .pptx de propuesta antes rebotaban con «no sé leerlo».
  if (familia === 'xlsx' || familia === 'pptx' || familia === 'opendocument') {
    const via = familia === 'xlsx' ? 'planilla' : familia === 'pptx' ? 'diapositivas' : 'opendocument';
    try {
      const { officeATexto } = await import('./office-a-texto');
      return { texto: await officeATexto(familia, buf, file.name), via };
    } catch (e) { return { texto: '', via, warning: msg(e) }; }
  }

  if (familia === 'pdf') {
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
      const { text } = await leerDocumentoIA({ dataUrl: `data:application/pdf;base64,${buf.toString('base64')}`, isPdf: true, nombreArchivo: file.name, prompt: LEER_DOC, feature: featureVision, motivo: opts.motivo || `Leer «${file.name}»`, redDePlataforma: opts.redDePlataforma });
      return { texto: text, via: 'pdf-vision' };
    } catch (e) { return { texto: '', via: 'pdf-vision', warning: `No pude leer «${file.name}»: ${msg(e)}` }; }
  }

  if (familia === 'imagen') {
    try {
      const { text } = await leerDocumentoIA({ dataUrl: `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`, isPdf: false, nombreArchivo: file.name, prompt: LEER_DOC, feature: featureVision, motivo: opts.motivo || `Leer «${file.name}»`, redDePlataforma: opts.redDePlataforma });
      return { texto: text, via: 'imagen' };
    } catch (e) { return { texto: '', via: 'imagen', warning: `No pude leer «${file.name}»: ${msg(e)}` }; }
  }

  if (familia === 'audio' || familia === 'video') {
    try {
      const texto = await transcribirAudio(buf.toString('base64'), mime || 'audio/mpeg', { feature: opts.feature, motivo: opts.motivo || `Transcribir «${file.name}»` });
      if (!texto.trim()) return { texto: '', via: 'audio', warning: `«${file.name}» se transcribió vacío: puede que no tenga voz.` };
      return { texto, via: 'audio' };
    } catch (e) { return { texto: '', via: 'audio', warning: `No pude transcribir «${file.name}»: ${msg(e)}` }; }
  }

  // Si sabemos POR QUÉ no se puede, se dice —«es el Word viejo, guardalo como .docx»—
  // en vez de dejar al usuario adivinando qué hacer con su archivo.
  const porque = porQueNoPuedo(file.name);
  return { texto: '', via: 'no-soportado', warning: porque ? `«${file.name}» ${porque}` : `«${file.name}»: no sé leer ese formato todavía.` };
}
