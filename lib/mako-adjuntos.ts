// =============================================================================
// Una foto o un PDF que le mandan a MaKo: qué se acepta y cómo entra al turno
// =============================================================================
// Lo usan los dos chats que reciben archivos: el doer de WhatsApp (lib/mako-doer-in.ts)
// y el chat del teléfono (lib/mako-turno-app.ts, app/api/m/mako/route.ts). Vivía escrito
// adentro del doer de WhatsApp; copiado en el del teléfono, la segunda copia se queda
// vieja (AGENTS.md, «Una cosa, un lugar»).
//
// ⚠️ UN BLOQUE DE IMAGEN NO LLEGA AL MODELO DEL DOER (medido el 11/10/2026, ws 9).
// `chatClaudeTools` con la feature 'mako-doer' resuelve a Gemini (gemini-flash-latest) y
// corre el loop por `chatCheapTools`, que aplana cada mensaje a TEXTO (`bloqueATexto`,
// lib/ai-cheap.ts): un cuadrado rojo con «¿de qué color es? si no te llegó, NO_VEO»
// contestó «NO_VEO». O sea que `bloquesDeAdjuntos` sólo le sirve a un camino que mande
// bloques nativos (Claude, vetado para el doer). Lo que hace VER la imagen es leerla
// antes con el lector compartido (lib/archivo-a-texto.ts → leerDocumentoIA, Gemini
// nativo con inline_data): el mismo cuadrado volvió «Imagen completamente roja» (52 s).
// El chat del teléfono hace las dos cosas: manda los bloques Y la lectura como texto.
//
// SIN `server-only` y sin importar el registro: lo puede leer la pantalla (los topes, el
// `accept` del input) y los tests.
// =============================================================================

import { familiaDeArchivo } from './formatos-archivo';

export type TipoAdjunto = 'image' | 'document';

/** Un bloque de contenido para el modelo (la forma de la Messages API). */
export type BloqueAdjunto = { type: string } & Record<string, unknown>;

/** Lo que el chat del teléfono acepta: fotos que la visión lee tal cual, y PDF. HEIC no:
 *  iOS lo convierte a JPEG al subirlo desde `<input type=file>`, y si llega crudo la visión
 *  lo rechaza. */
export const ACCEPT_ADJUNTOS_CHAT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

/** Cuántos archivos por mensaje. */
export const TOPE_ADJUNTOS = 4;

/**
 * ⚠️ 4 MB EN TOTAL, y no es un número elegido: Vercel corta todo POST de más de ~4,5 MB con
 * un 413 en TEXTO PLANO que ni llega a la ruta («Request Entity Too Large»; ya mordió en el
 * Archivero y en /api/onboarding/voz, docs/api-mako-inventario.md:1667). Una foto de
 * teléfono pesa 2-5 MB: la pantalla la ACHICA antes de subirla (canvas → JPEG ~1600 px) y
 * lee la respuesta con `res.text()` antes de `JSON.parse`, por si el 413 es el de Vercel.
 */
export const TOPE_TOTAL_BYTES = 4 * 1024 * 1024;

/** Lo que el multipart suma alrededor de los archivos (los límites, el texto, los nombres). */
export const MARGEN_MULTIPART_BYTES = 64 * 1024;

/** Los formatos de imagen que la visión acepta tal cual. */
const IMAGEN_VISION = /^image\/(jpeg|png|gif|webp)$/;

/**
 * El mime de una imagen que llegó por WhatsApp. WhatsApp re-codifica las fotos a JPEG, así
 * que lo que no se reconoce se manda como `image/jpeg`. Sin `toLowerCase` a propósito: es
 * EXACTAMENTE lo que hacía el doer antes de mudarse acá.
 */
export function mimeImagenWhatsApp(mime: string | null | undefined): string {
  const m = (mime || 'image/jpeg').split(';')[0];
  return IMAGEN_VISION.test(m) ? m : 'image/jpeg';
}

/**
 * Qué es un archivo por sus PRIMEROS BYTES, no por lo que dice el navegador: el `type` de
 * un `File` lo pone el cliente y la extensión la elige quien lo nombra. Devuelve null si no
 * es una de las cuatro imágenes que la visión lee ni un PDF.
 */
export function tipoPorFirma(b: Uint8Array): { tipo: TipoAdjunto; mime: string } | null {
  const es = (off: number, ...xs: number[]) => xs.every((x, i) => b[off + i] === x);
  if (b.length >= 3 && es(0, 0xff, 0xd8, 0xff)) return { tipo: 'image', mime: 'image/jpeg' };
  if (b.length >= 8 && es(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { tipo: 'image', mime: 'image/png' };
  if (b.length >= 6 && es(0, 0x47, 0x49, 0x46, 0x38)) return { tipo: 'image', mime: 'image/gif' };
  if (b.length >= 12 && es(0, 0x52, 0x49, 0x46, 0x46) && es(8, 0x57, 0x45, 0x42, 0x50)) return { tipo: 'image', mime: 'image/webp' };
  if (b.length >= 5 && es(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return { tipo: 'document', mime: 'application/pdf' };
  return null;
}

/** Un archivo ya revisado: el tipo y el mime salen de sus BYTES, no de lo que dijo el navegador. */
export type AdjuntoListo = { tipo: TipoAdjunto; mime: string; nombre: string; bytes: Uint8Array };

/** Los rechazos, cortos: los dibuja la pantalla tal cual. */
export const ERROR_ADJUNTO = {
  muchos: `Máximo ${TOPE_ADJUNTOS} archivos.`,
  pesado: 'Pesa demasiado: hasta 4 MB.',
  formato: 'Solo fotos (JPG, PNG, WEBP, GIF) o PDF.',
  vacio: 'El archivo llegó vacío.',
} as const;

/**
 * Revisa lo que subió la persona ANTES de leerlo: cuántos, cuánto pesan y qué son. Dos
 * llaves y las dos tienen que coincidir: la familia que declara el archivo (extensión o
 * mime, con el MISMO clasificador que el resto de la casa, lib/formatos-archivo.ts) y lo
 * que dicen sus primeros bytes. Un HEIC con extensión .jpg, o un .pdf que es una foto, no
 * entran: la visión los rechazaría con un error que no nombra el archivo.
 */
export function validarAdjuntos(
  lista: ReadonlyArray<{ nombre: string; mime: string; bytes: Uint8Array }>,
): { ok: true; adjuntos: AdjuntoListo[] } | { ok: false; error: string } {
  if (lista.length > TOPE_ADJUNTOS) return { ok: false, error: ERROR_ADJUNTO.muchos };
  let total = 0;
  const adjuntos: AdjuntoListo[] = [];
  for (const a of lista) {
    if (!a.bytes.byteLength) return { ok: false, error: ERROR_ADJUNTO.vacio };
    total += a.bytes.byteLength;
    if (total > TOPE_TOTAL_BYTES) return { ok: false, error: ERROR_ADJUNTO.pesado };
    const familia = familiaDeArchivo(a.nombre || '', a.mime || '');
    const firma = tipoPorFirma(a.bytes);
    const coincide = !!firma && ((familia === 'imagen' && firma.tipo === 'image') || (familia === 'pdf' && firma.tipo === 'document'));
    if (!firma || !coincide) return { ok: false, error: ERROR_ADJUNTO.formato };
    adjuntos.push({ tipo: firma.tipo, mime: firma.mime, nombre: (a.nombre || (firma.tipo === 'image' ? 'foto' : 'documento')).slice(0, 120), bytes: a.bytes });
  }
  return { ok: true, adjuntos };
}

/** El pedido por defecto cuando mandan el archivo sin escribir nada. */
export function promptDeAdjunto(tipo: TipoAdjunto): string {
  return tipo === 'image' ? 'Mira esta imagen y dime qué ves y qué hago.' : 'Lee este PDF y dime lo importante.';
}

/** El bloque nativo de un archivo (imagen o PDF), en base64. */
export function bloqueDeAdjunto(a: { tipo: TipoAdjunto; mime: string; base64: string }): BloqueAdjunto {
  return { type: a.tipo, source: { type: 'base64', media_type: a.tipo === 'image' ? a.mime : 'application/pdf', data: a.base64 } };
}

/** El turno del usuario con archivos: un bloque por archivo y, al final, el texto (o el
 *  pedido por defecto del primero). */
export function bloquesDeAdjuntos(adjuntos: ReadonlyArray<{ tipo: TipoAdjunto; mime: string; base64: string }>, texto: string): BloqueAdjunto[] {
  const pedido = texto || (adjuntos.length ? promptDeAdjunto(adjuntos[0].tipo) : '');
  return [...adjuntos.map(bloqueDeAdjunto), { type: 'text', text: pedido }];
}

/** Lo que queda en la MEMORIA del chat en vez del archivo: el historial es texto y vuelve
 *  al modelo en cada turno; el base64 no entra ahí. */
export function placeholderDeAdjunto(tipo: TipoAdjunto, caption: string, textoDirecto: string): string {
  return `(envió ${tipo === 'image' ? 'una imagen' : 'un PDF'}${caption ? `: ${caption}` : ''})${textoDirecto ? ` — ${textoDirecto}` : ''}`;
}
