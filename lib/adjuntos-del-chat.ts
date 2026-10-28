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
import { ERROR_ADJUNTO, MARGEN_MULTIPART_BYTES, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, leerConPlazo, validarAdjuntos, type AdjuntoListo } from './mako-adjuntos';

/** Lo que puede tardar la lectura de TODOS los archivos de un mensaje, juntos (la revisión de chats-unificados, 28/10/2026). */
export const PLAZO_LECTURA_MS = 90_000;
/** Un PDF del chat se lee hasta acá: al modelo van 40 k caracteres, y un PDF «bomba» no se recorre entero. */
const TOPE_PAGINAS_CHAT = 30;

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

/**
 * Lo que el sistema leyó de cada archivo; los que no pudo (o no llegó a tiempo), por nombre: la pantalla lo dice. Todos a la
 * vez y con un plazo total (`leerConPlazo`). El lector recibe un nombre que sale de la FIRMA («archivo.pdf», «foto.png»): el de
 * la persona puede decir otra cosa (`.txt`) y el lector clasifica por extensión. El de la persona queda para mostrar.
 */
export async function leerLosArchivos(adjuntos: readonly AdjuntoListo[], feature: string, plazoMs = PLAZO_LECTURA_MS): Promise<{ lecturas: Array<{ nombre: string; texto: string }>; noLeidos: string[] }> {
  return leerConPlazo(adjuntos, async (a, ms) => {
    const paraLeer = a.tipo === 'document' ? 'archivo.pdf' : `foto.${a.mime.split('/')[1] || 'jpg'}`;
    const leido = await archivoATexto(new File([a.bytes as BlobPart], paraLeer, { type: a.mime }), { feature, motivo: `Leer «${a.nombre}»`, timeoutMs: ms, topePaginas: TOPE_PAGINAS_CHAT });
    return leido.texto;
  }, plazoMs);
}

/** El cuerpo de un pedido que puede traer archivos: el JSON de siempre, o el multipart con `datos` (JSON) y `adjuntos`. */
export async function cuerpoYArchivos(req: Request): Promise<
  { ok: true; body: Record<string, unknown>; adjuntos: AdjuntoListo[] } | { ok: false; error: string; status: number }
> {
  let body: unknown;
  let adjuntos: AdjuntoListo[] = [];
  if (traeArchivos(req)) {
    const p = await pedidoConArchivos(req);
    if (!p.ok) return p;
    adjuntos = p.adjuntos;
    try { body = JSON.parse(p.campos.datos ?? '{}'); } catch { body = null; }
  } else {
    try { body = await req.json(); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') return { ok: false, error: 'Pedido inválido.', status: 400 };
  return { ok: true, body: body as Record<string, unknown>, adjuntos };
}
