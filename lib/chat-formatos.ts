// =============================================================================
// chat-formatos — lo que acepta TODA caja de chat de MaKo (27/10/2026, ticket #16 de Leila y Martín)
// =============================================================================
// Leila (ws11): «No me deja adjuntar un documento ni por arrastrar, ni por adjuntar». Martín, el mismo día: «Muchos chats no
// están tomando el formato docs para adjuntar archivos, revisa que todos los chats acepten todos los formatos». Lo que acepta
// una caja es lo que MaKo sabe LEER (lib/formatos-archivo.ts, `archivoATexto`): Word, Excel, PowerPoint, PDF, texto, CSV,
// Markdown, imágenes y audio, entre otros. tests/chat-formatos.test.ts recorre las cajas y falla si una rechaza alguno de
// los REQUERIDOS.
//
// Puro: lo usan las cajas, la ruta que lee (app/api/chat/leer-archivo) y el test.
// =============================================================================

import { ACCEPT_IMPORTAR, MAX_ARCHIVO_BYTES, puedeLeerse } from './formatos-archivo';

/** El `accept` de una caja de chat: todo lo que MaKo sabe leer. */
export const ACCEPT_CHAT = `image/*,audio/*,${ACCEPT_IMPORTAR}`;

/** Lo que TODA caja tiene que aceptar (Martín, 27/10/2026): documentos, planillas, presentaciones, texto, imágenes y audio. */
export const REQUERIDOS_EN_EL_CHAT = ['.docx', '.xlsx', '.pptx', '.pdf', '.csv', '.txt', '.md', '.png', '.jpg', '.mp3', '.m4a'] as const;

const IMAGEN = /^\.(png|jpe?g|webp|gif|heic)$/;
const AUDIO = /^\.(mp3|m4a|wav|ogg|opus)$/;

/** ¿El `accept` de una caja toma este archivo? (como el navegador: la extensión, el mime exacto o «image/*»). */
export function aceptaArchivo(accept: string, f: { name: string; type: string }): boolean {
  const nombre = f.name.toLowerCase();
  const mime = (f.type || '').toLowerCase();
  return accept.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).some((a) => (a.startsWith('.')
    ? nombre.endsWith(a)
    : a.endsWith('/*') ? !!mime && mime.startsWith(a.slice(0, -1)) : a === mime));
}

/** Lo REQUERIDO que un `accept` deja afuera ([] = acepta todo lo requerido). */
export function faltanEnAccept(accept: string): string[] {
  const partes = accept.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return REQUERIDOS_EN_EL_CHAT.filter((ext) => !(partes.includes(ext)
    || (IMAGEN.test(ext) && partes.includes('image/*'))
    || (AUDIO.test(ext) && partes.includes('audio/*'))));
}

/** ¿La caja lo toma? Se lee (`puedeLeerse`) y no pasa del tope. Si no, la frase de por qué. */
export function porQueNoSeAdjunta(nombre: string, mime: string, bytes: number): string | null {
  if (!puedeLeerse(nombre, mime)) return `MaKo todavía no sabe leer «${nombre}».`;
  if (bytes > MAX_ARCHIVO_BYTES) return `«${nombre}» pesa más de ${Math.round(MAX_ARCHIVO_BYTES / 1024 / 1024)} MB.`;
  return null;
}

/** Lo leído de un archivo, como va en el mensaje: un texto pegado con su nombre arriba (la caja lo manda entre marcas). */
export const textoDelArchivo = (nombre: string, texto: string): string => `Archivo «${nombre}»:\n${texto.trim()}`;

/** El tope de lo leído que viaja en el mensaje (lo demás, a El Archivero si es del admin; el chat lo dice). */
export const TOPE_LEIDO = 40_000;

/** Dónde sube la caja lo que va a leer (app/api/chat/leer-archivo), dentro de la carpeta del workspace. */
export const CARPETA_LEER = 'chat-leer';
/** El path lo escribe el navegador: sólo uno de ESTE workspace y de esa carpeta, con el id que puso el servidor. */
export const esArchivoParaLeer = (ws: number, path: string): boolean =>
  Number.isInteger(ws) && new RegExp(`^${ws}/${CARPETA_LEER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`).test(path);
