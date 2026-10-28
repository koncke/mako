// =============================================================================
// Lo que se adjunta en el chat de Soporte: capturas, fotos, PDF y documentos que llegan AL TICKET (28/10/2026)
// =============================================================================
// Martín (28/10, chat del Cerebro): «las personas no están pudiendo usar la ticketera porque nuevamente el chat está mal
// configurado, solamente permite emojis, no permite adjuntar ni archivos ni capturas ni documentos, eso está muy mal». La caja de
// Soporte (app/tickets/soporte/PiezasSoporte.tsx → CajaSoporte) usaba la caja compartida SIN `adjuntos`, así que el «+» sólo daba
// emojis. Ahora los archivos suben al bucket privado `archivero`, en `<ws>/tickets/<uuid>` (app/api/tickets/adjuntos/route.ts),
// y el ticket guarda sus REFERENCIAS en el `datos` de su evento (`ticket_eventos.datos`, jsonb: no hace falta migración). El
// Cerebro los ve con `scripts/tickets.ts ver <n>` (con un link firmado) y el triage sabe que el ticket trae adjuntos.
// ⚠️ Una referencia que llega del navegador se valida contra el negocio de la SESIÓN (`sanearAdjuntosTicket`): un path de otro
//    negocio no se guarda. Puro: lo usan la ruta, las acciones, el hook y los tests.
// =============================================================================

/** Lo que el ticket guarda de cada adjunto. `path`: dentro del bucket `archivero`. */
export type AdjuntoTicket = { path: string; nombre: string; mime: string; bytes: number };

/** Fotos y capturas, PDF, Word, Excel y texto. Nunca un ejecutable. */
export const MIMES_TICKET: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', csv: 'text/csv',
};
const MIMES = new Set(Object.values(MIMES_TICKET));
/** Lo que ofrece el selector de archivos de la caja. */
export const ACCEPT_TICKET = 'image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';
/** Cuántos por mensaje, y cuánto en total: un POST a Vercel corta a los 4,5 MB (y lo dice en texto, no en JSON). */
export const TOPE_ADJUNTOS_TICKET = 5;
export const TOPE_BYTES_TICKET = 4 * 1024 * 1024;
export const TOPE_NOMBRE_ADJUNTO = 120;

export const rutaDeAdjuntoTicket = (ws: number, id: string): string => `${ws}/tickets/${id}`;

/** El mime de un archivo elegido: el que dice el navegador si es de la lista; si no (algunos Android lo dejan vacío), por su
 *  extensión. null = no se acepta. */
export function mimeDeArchivoTicket(nombre: string, tipo: string): string | null {
  if (MIMES.has(tipo)) return tipo;
  const ext = /\.([a-z0-9]{2,5})$/i.exec(nombre.trim())?.[1]?.toLowerCase() ?? '';
  return MIMES_TICKET[ext] ?? null;
}

/** Por qué no se pueden mandar estos archivos; null = se pueden. */
/** `yaVan`: en la conversación nueva el tope es POR TICKET, y cuenta lo que ya subió o está subiendo (revisión de 046d9e028: del
 *  sexto en adelante, el alta lo recortaba sin decirlo). */
export function problemaDeAdjuntosTicket(archivos: ReadonlyArray<{ name: string; type: string; size: number }>, yaVan = 0): string | null {
  if (archivos.length + yaVan > TOPE_ADJUNTOS_TICKET) {
    return yaVan ? `Hasta ${TOPE_ADJUNTOS_TICKET} archivos por ticket: ya van ${yaVan}.` : `Hasta ${TOPE_ADJUNTOS_TICKET} archivos por mensaje.`;
  }
  const malo = archivos.find((f) => !mimeDeArchivoTicket(f.name, f.type));
  if (malo) return `«${malo.name}» no se puede adjuntar: fotos, capturas, PDF, Word, Excel o texto.`;
  if (archivos.reduce((s, f) => s + f.size, 0) > TOPE_BYTES_TICKET) return 'Los archivos pesan más de 4 MB juntos: manda menos, o en otro mensaje.';
  return null;
}

/** Las referencias que llegan del navegador, saneadas contra el negocio de la sesión: lo que no es de `ws`, fuera. */
export function sanearAdjuntosTicket(x: unknown, ws: number): AdjuntoTicket[] {
  if (!Array.isArray(x)) return [];
  const ruta = new RegExp(`^${ws}/tickets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`);
  const out: AdjuntoTicket[] = [];
  for (const a of x.slice(0, TOPE_ADJUNTOS_TICKET)) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    const nombre = typeof o.nombre === 'string' ? o.nombre.replace(/[\u0000-\u001f]/g, '').trim().slice(0, TOPE_NOMBRE_ADJUNTO) : '';
    const bytes = Number(o.bytes);
    if (typeof o.path !== 'string' || !ruta.test(o.path) || !nombre || typeof o.mime !== 'string' || !MIMES.has(o.mime) || !Number.isFinite(bytes) || bytes < 0) continue;
    out.push({ path: o.path, nombre, mime: o.mime, bytes: Math.round(bytes) });
  }
  return out;
}

/** Cómo se dice en el hilo y en el historial que el mensaje trajo archivos. '' = ninguno. */
/** Lo que un negocio sube a Soporte por día (revisión de 046d9e028: sin tope, una sesión podía llenar el bucket). */
export const TOPE_DIA_ARCHIVOS_TICKET = 30;
export const TOPE_DIA_BYTES_TICKET = 50 * 1024 * 1024;

/** `hoy`: lo que el negocio subió en las últimas 24 h (la ruta lo lista del bucket, así vale en todas las instancias). */
export function problemaDelDiaTicket(hoy: ReadonlyArray<{ bytes: number }>, nuevos: ReadonlyArray<{ size: number }>): string | null {
  if (hoy.length + nuevos.length > TOPE_DIA_ARCHIVOS_TICKET) {
    return `Hoy ya se subieron ${hoy.length} archivos a Soporte y el tope es ${TOPE_DIA_ARCHIVOS_TICKET} por día. Cuéntalo con palabras: si hace falta la captura, el equipo te la pide.`;
  }
  const bytes = hoy.reduce((s, a) => s + a.bytes, 0) + nuevos.reduce((s, f) => s + f.size, 0);
  if (bytes > TOPE_DIA_BYTES_TICKET) return 'Hoy ya se subieron más de 50 MB a Soporte. Cuéntalo con palabras: si hace falta la captura, el equipo te la pide.';
  return null;
}

export const lineaDeAdjuntos = (nombres: readonly string[]): string => (nombres.length ? `📎 ${nombres.join(', ')}` : '');
