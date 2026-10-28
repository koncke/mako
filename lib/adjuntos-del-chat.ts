// =============================================================================
// Los archivos de un chat de MaKo que lee TEXTO: se validan, se leen y van con el pedido (28/10/2026)
// =============================================================================
// Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados» (lib/cajas-de-chat.ts). El asesor de
// WhatsApp, Editar con MaKo y ChartIA recibían sólo texto: su modelo no toma bloques. Acá llegan los archivos (multipart, con los
// topes y la doble llave de lib/mako-adjuntos.ts: lo que declara el archivo y lo que dicen sus bytes) y se LEEN con el lector
// compartido (lib/archivo-a-texto.ts), como el chat del teléfono (lib/mako-turno-app.ts). La lectura va con el pedido
// (`pedidoConLecturas`) y a la memoria del chat va lo escrito con los nombres (`memoriaConArchivos`): el archivo no se guarda.
// =============================================================================

import 'server-only';
import { archivoATexto } from './archivo-a-texto';
import { ERROR_ADJUNTO, MARGEN_MULTIPART_BYTES, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, validarAdjuntos, type AdjuntoListo } from './mako-adjuntos';

/** ¿Llegó con archivos? (multipart). Sin archivos, la ruta sigue leyendo su JSON de siempre. */
export const traeArchivos = (req: Request): boolean => (req.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data');

/** El pedido multipart: sus campos de texto y sus archivos, validados. El largo se mira ANTES de parsear. */
export async function pedidoConArchivos(req: Request): Promise<
  { ok: true; campos: Record<string, string>; adjuntos: AdjuntoListo[] } | { ok: false; error: string; status: number }
> {
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES) return { ok: false, error: ERROR_ADJUNTO.pesado, status: 413 };
  let form: FormData;
  try { form = await req.formData(); } catch { return { ok: false, error: 'No llegaron los archivos: vuelve a mandarlos.', status: 400 }; }
  const archivos = form.getAll('adjuntos').filter((f): f is File => f instanceof File);
  if (archivos.length > TOPE_ADJUNTOS) return { ok: false, error: ERROR_ADJUNTO.muchos, status: 400 };
  if (archivos.reduce((n, f) => n + f.size, 0) > TOPE_TOTAL_BYTES) return { ok: false, error: ERROR_ADJUNTO.pesado, status: 413 };
  const v = validarAdjuntos(await Promise.all(archivos.map(async (f) => ({ nombre: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) }))));
  if (!v.ok) return { ok: false, error: v.error, status: 400 };
  const campos: Record<string, string> = {};
  for (const [k, x] of form.entries()) if (typeof x === 'string') campos[k] = x;
  return { ok: true, campos, adjuntos: v.adjuntos };
}

/** Lo que el sistema leyó de cada archivo; los que no pudo, por nombre (la pantalla lo dice). */
export async function leerLosArchivos(adjuntos: readonly AdjuntoListo[], feature: string): Promise<{ lecturas: Array<{ nombre: string; texto: string }>; noLeidos: string[] }> {
  const lecturas: Array<{ nombre: string; texto: string }> = [];
  const noLeidos: string[] = [];
  for (const a of adjuntos) {
    const leido = await archivoATexto(new File([a.bytes as BlobPart], a.nombre, { type: a.mime }), { feature }).catch(() => null);
    const texto = leido?.texto?.trim();
    if (texto) lecturas.push({ nombre: a.nombre, texto }); else noLeidos.push(a.nombre);
  }
  return { lecturas, noLeidos };
}
