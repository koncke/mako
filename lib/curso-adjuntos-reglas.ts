// =============================================================================
// curso-adjuntos-reglas — lo que decide un adjunto del curso sin tocar la base (puro)
// =============================================================================
// Los adjuntos (imágenes, PDF, documentos) que se meten en la DESCRIPCIÓN de una clase con el
// editor rico. Pedido de Martín (07/10/2026, item 17): «Se debería poder adjuntar cosas a la
// descripción… Imágenes, PDF, archivos, etc.». Diseño: docs/diseno-curso-skool.md, D4.
//
// Sin 'use client' ni 'server-only' a propósito: lo usan el server (lib/curso-adjuntos.ts, la
// ruta del alumno), la pantalla que monta el editor (la subida, el `accept`, la URL del alumno) y
// un test que lo EJECUTA (tests/curso-adjuntos.test.ts). Lo que lee y escribe, en
// lib/curso-adjuntos.ts; la puerta del equipo, en app/customer-success/curso/adjuntos-actions.ts;
// la del alumno, en app/api/compartido/curso/adjunto/route.ts.
//
// El modelo, en una línea: el archivo vive en el bucket PRIVADO `curso-adjuntos`
// (`<ws>/<producto>/<uuid>.<ext>`), su fila en `curso_adjuntos` (id = ese uuid), y el HTML lo
// nombra por referencia, `mako-adjunto:<uuid>` (el formato vive en app/_ui/HtmlSeguro.tsx). La
// URL de verdad la pone quien DIBUJA, según quién mira.

import { idDeRef, refDeId, refsEnHtml } from '@/app/_ui/HtmlSeguro';
import type { AdjuntoSubido } from '@/app/_ui/EditorRico';
import { nombreDeAdjunto, adjuntoSeVe } from '@/app/customer-success/curso/reglas';

export { idDeRef, refDeId, refsEnHtml, nombreDeAdjunto, adjuntoSeVe };

/** El bucket privado de la mig 0216. */
export const BUCKET_ADJUNTOS = 'curso-adjuntos';

/**
 * Los formatos que acepta el bucket (mig 0216, `allowed_mime_types`): los de las notas
 * (`MIME_NOTA`: documentos, planillas, imágenes) más la presentación de LibreOffice y el ZIP.
 *
 * ⚠️ LOS MISMOS QUE LOS DEL BUCKET, por la razón de siempre: Storage rechaza recién al terminar de
 *    SUBIR, y la pantalla tiene que poder decir «no» antes de empezar. Un test compara las dos.
 * ⚠️ SIN SVG NI HTML, a propósito: los dos pueden llevar código, y abiertos desde la URL firmada
 *    corren en el dominio de Storage. Una imagen es PNG, JPG, WEBP o GIF.
 * ⚠️ El ZIP va con UN tipo (`application/zip`): Windows le pone `application/x-zip-compressed`, y
 *    por eso el tipo se decide por la EXTENSIÓN y el archivo se sube re-etiquetado
 *    (`archivoConTipo`). Con dos tipos en la lista, el día que alguien saque uno se rompe la
 *    mitad de las subidas sin que nada lo diga.
 */
export const MIME_ADJUNTO = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
export type MimeAdjunto = (typeof MIME_ADJUNTO)[number];

/** Las imágenes: lo que el editor dibuja como imagen (todo lo demás es el chip de un archivo). */
export const MIME_IMAGEN_ADJUNTO = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/**
 * El tope de un adjunto: 25 MiB, el `file_size_limit` del bucket (mig 0216), igual que las notas.
 * ⚠️ EL DEL BUCKET Y NO UNO MÍO (AGENTS.md, «el entorno tiene un tope y tu código declara otro»).
 * Un video NO va acá: para eso está el video de la clase (`curso-videos`, 2 GiB).
 */
export const TOPE_ADJUNTO_BYTES = 25 * 1024 * 1024;
/** Lo que dice el error cuando el bucket rechaza el tipo (`subirConProgreso`, `formatos`). */
export const FORMATOS_ADJUNTO = 'imágenes, PDF, Office, TXT, CSV o ZIP';

const EXT_DE_MIME: Record<MimeAdjunto, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/zip': 'zip',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MIME_DE_EXT: Record<string, MimeAdjunto> = {
  ...Object.fromEntries(Object.entries(EXT_DE_MIME).map(([m, e]) => [e, m as MimeAdjunto])),
  jpeg: 'image/jpeg',
};
const EXTS = [...new Set(Object.values(EXT_DE_MIME))].join('|');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const esMimeAdjunto = (m: string | null | undefined): m is MimeAdjunto => (MIME_ADJUNTO as readonly string[]).includes(m ?? '');
export const esImagenAdjunto = (m: string | null | undefined): boolean => (MIME_IMAGEN_ADJUNTO as readonly string[]).includes(m ?? '');

/** El `accept` del botón «Adjuntar archivo»: los tipos y las extensiones. */
export const ACEPTA_ADJUNTO = [...MIME_ADJUNTO, ...Object.keys(MIME_DE_EXT).map((e) => `.${e}`)].join(',');
/** El `accept` del botón «Imagen». */
export const ACEPTA_IMAGEN_ADJUNTO = [...MIME_IMAGEN_ADJUNTO, '.png', '.jpg', '.jpeg', '.webp', '.gif'].join(',');

/**
 * El tipo de un archivo elegido. PRIMERO la extensión, después lo que diga el navegador: la misma
 * regla que `mimeDeNota` y por lo mismo (Windows con Excel le pone `application/vnd.ms-excel` a un
 * .csv, y hay navegadores que dejan vacío un .docx). `null` = no es un formato que el bucket acepte.
 */
export function mimeDeAdjunto(nombre: string, tipo: string | null | undefined): MimeAdjunto | null {
  const ext = (nombre.includes('.') ? nombre.split('.').pop() ?? '' : '').toLowerCase();
  if (MIME_DE_EXT[ext]) return MIME_DE_EXT[ext];
  return esMimeAdjunto(tipo) ? tipo : null;
}

/**
 * El mismo archivo con el tipo que decidió `mimeDeAdjunto`. El tipo viaja en la parte del
 * multipart, y con el que puso el sistema operativo el bucket rebota un archivo bueno.
 */
export function archivoConTipo(file: File, mime: string): File {
  return file.type === mime ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

/**
 * Dónde se guarda un adjunto: `<ws>/<producto>/<uuid>.<ext>` en `curso-adjuntos`.
 * ⚠️ El workspace primero y puesto por el SERVER, como el video y las notas: es lo que deja
 *    preguntar «¿este archivo es de este negocio?» con un prefijo. El nombre original NO entra
 *    (acentos, espacios, el nombre de un cliente): va aparte, en la fila.
 */
export function pathDeAdjunto(ws: number, productoId: number, mime: string, uuid: string): string | null {
  if (!esMimeAdjunto(mime) || !Number.isInteger(ws) || ws <= 0 || !Number.isInteger(productoId) || productoId <= 0) return null;
  if (!new RegExp(`^${UUID}$`).test(uuid)) return null;
  return `${ws}/${productoId}/${uuid}.${EXT_DE_MIME[mime]}`;
}

/** ¿Este path es un adjunto subido para ESTE producto de ESTE workspace? */
export function pathEsAdjuntoDelProducto(path: string | null | undefined, ws: number, productoId: number): boolean {
  return typeof path === 'string' && new RegExp(`^${ws}/${productoId}/${UUID}\\.(${EXTS})$`).test(path);
}

/** ¿Este path tiene la forma de un adjunto de la descripción, de cualquier workspace? (la purga) */
export const esAdjuntoDescripcionSubido = (p: string): boolean => new RegExp(`^\\d{1,12}/\\d{1,12}/${UUID}\\.(${EXTS})$`).test(p);

/** El uuid de un path de adjunto (que es el id de su fila), o `null`. */
export function uuidDePath(path: string | null | undefined): string | null {
  if (typeof path !== 'string') return null;
  const m = new RegExp(`^\\d{1,12}/\\d{1,12}/(${UUID})\\.(?:${EXTS})$`).exec(path);
  return m ? m[1] : null;
}

/** Lo que manda el navegador al registrar un adjunto ya subido. Viaja desde el navegador: se valida entero. */
export type EntradaRegistroAdjunto = {
  productoId: number;
  claseId?: number | null;
  path: string;
  nombre: string;
  mime: string;
  bytes: number;
};

/** La fila de `curso_adjuntos` que escribe un registro (sin workspace ni autor: los pone el server). */
export type FilaAdjuntoGuardar = {
  id: string;
  producto_id: number;
  clase_id: number | null;
  path: string;
  nombre: string;
  mime: MimeAdjunto;
  bytes: number;
};

/**
 * Valida un registro. Errores CORTOS: se dibujan tal cual.
 *
 * ⚠️ Lo que no se puede saber sin la base (que la clase sea de este producto, que el archivo haya
 *    llegado) lo mira `registrarAdjunto`. Acá: que el path sea de ESTE producto de ESTE workspace
 *    (el id de la fila sale de ahí, nunca del pedido), que el tipo y el tope sean los del bucket,
 *    y que el tipo coincida con la extensión del path (un `.pdf` registrado como imagen se
 *    dibujaría como una imagen rota).
 */
export function validarRegistroAdjunto(
  raw: unknown,
  ctx: { ws: number; productoId: number },
): { ok: true; fila: FilaAdjuntoGuardar } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'No llegó el archivo.' };
  const r = raw as Record<string, unknown>;
  if (Number(r.productoId) !== ctx.productoId) return { ok: false, error: 'Ese producto no es este.' };
  const claseId = r.claseId == null || r.claseId === '' ? null : Number(r.claseId);
  if (claseId != null && (!Number.isInteger(claseId) || claseId <= 0)) return { ok: false, error: 'Esa clase no existe.' };
  const path = typeof r.path === 'string' ? r.path : '';
  if (!pathEsAdjuntoDelProducto(path, ctx.ws, ctx.productoId)) return { ok: false, error: 'Ese archivo no es de este curso.' };
  const mime = typeof r.mime === 'string' ? r.mime : '';
  if (!esMimeAdjunto(mime)) return { ok: false, error: 'Ese formato no va.' };
  if (!path.endsWith(`.${EXT_DE_MIME[mime]}`)) return { ok: false, error: 'Ese formato no va.' };
  const bytes = Number(r.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > TOPE_ADJUNTO_BYTES) return { ok: false, error: 'Pasa de 25 MB.' };
  const id = uuidDePath(path)!;
  return {
    ok: true,
    fila: { id, producto_id: ctx.productoId, clase_id: claseId, path, nombre: nombreDeAdjunto(r.nombre), mime, bytes: Math.round(bytes) },
  };
}

// ── El alumno ────────────────────────────────────────────────────────────────

/**
 * La URL con la que el ALUMNO pide un adjunto de una clase: la ruta pública que valida su token y
 * el candado de la etapa en cada pedido (/api/compartido/curso/adjunto). Es lo que el portal le
 * pasa a `<HtmlSeguro urlDeAdjunto>`. `null` si la referencia no es una referencia.
 */
export function urlAdjuntoDelAlumno(token: string, claseId: number, ref: string): string | null {
  const id = idDeRef(ref);
  if (!id || !token || !Number.isInteger(claseId) || claseId <= 0) return null;
  return `/api/compartido/curso/adjunto?t=${encodeURIComponent(token)}&c=${claseId}&a=${id}`;
}

/**
 * ¿Se le sirve este adjunto al alumno que pide la clase `clase`? Corre DESPUÉS de que
 * `claseDelAlumno` (lib/curso-portal.ts, la ÚNICA puerta) dijo que la clase se le abre, con su
 * candado de etapa. Acá se contesta lo que falta:
 *
 *   · que el adjunto exista en ESTE workspace (lo leyó `getTenantDb`) y sea del MISMO producto;
 *   · que la descripción PUBLICADA de esa clase lo nombre.
 *
 * ⚠️ LA PRUEBA DE PERTENENCIA ES QUE LA CLASE LO PUBLICA, no la `clase_id` de la fila. La columna
 *    dice dónde se subió (y la llena el guardado), pero una imagen copiada de una clase y pegada en
 *    otra del mismo curso es de las dos: con «clase_id = c» el alumno la vería rota en la segunda.
 *    Y al revés, lo que la descripción ya no nombra (se sacó) deja de servirse aunque la fila diga
 *    que es de esa clase: lo bloqueado y lo retirado no viajan.
 */
export function decidirAdjuntoAlumno(p: {
  adjunto: { id: string; productoId: number; path: string } | null;
  clase: { id: number; productoId: number };
  htmlDeClase: string | null | undefined;
  ws: number;
}): 'ok' | 'no-existe' {
  const a = p.adjunto;
  if (!a) return 'no-existe';
  if (a.productoId !== p.clase.productoId) return 'no-existe';
  if (!pathEsAdjuntoDelProducto(a.path, p.ws, p.clase.productoId)) return 'no-existe';
  if (uuidDePath(a.path) !== a.id) return 'no-existe';
  if (!refsEnHtml(p.htmlDeClase).includes(a.id)) return 'no-existe';
  return 'ok';
}

/** Lo que el server firma: ¿se abre en el navegador (`null`) o se baja con su nombre? */
export const descargaComo = (mime: string | null | undefined, nombre: string): string | undefined =>
  adjuntoSeVe(mime) ? undefined : nombre || 'archivo';

// ── La subida, armada para el editor ─────────────────────────────────────────

/**
 * Lo que devuelve `subirAdjunto` al editor. Es EL tipo del contrato de `EditorRico`, importado y no
 * copiado: un tipo copiado a mano se queda viejo el día que el editor le sume un campo. Es
 * `import type`, así que no trae el editor (ni TipTap) a quien importa estas reglas.
 */
export type { AdjuntoSubido };

type Firma = { ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string };
type Registro = { ok: true; id: string; ref: string; nombre: string; mime: string } | { ok: false; error: string };

/**
 * Las tres piezas de una subida, INYECTADAS: así esto se puede ejecutar en un test con piezas de
 * mentira, y la pantalla le pasa las de verdad —las actions de adjuntos-actions.ts y
 * `subirConProgreso` (app/customer-success/curso/subir-video.ts)—.
 *
 * ⚠️ `subir` ES EL XHR: `fetch` no expone el progreso de SUBIDA y la barra del editor saltaría de 0
 *    a 100 (AGENTS.md, «tres topes del entorno»).
 */
export type PiezasSubida = {
  firmar: (productoId: number, mime: string, bytes: number) => Promise<Firma>;
  subir: (signedUrl: string, file: File, apikey: string | null, onProgreso: (pct: number) => void, formatos?: string) => { promesa: Promise<void>; cancelar: () => void };
  registrar: (entrada: EntradaRegistroAdjunto) => Promise<Registro>;
};

/**
 * El `subirAdjunto` que se le pasa a `<EditorRico>`: valida antes de gastar la subida, firma, sube
 * con progreso, registra, y devuelve la referencia. Si algo falla, RECHAZA con un error corto que
 * el editor dibuja tal cual.
 *
 * `claseId` puede ser `null` (una clase que todavía no se guardó): el adjunto queda del producto y
 * el guardado de la clase lo reclama (`vincularAdjuntos`, lib/curso-adjuntos.ts).
 */
export function crearSubidorDeAdjuntos(piezas: PiezasSubida, ctx: { productoId: number; claseId?: number | null }) {
  return async (file: File, onProgreso?: (pct: number) => void): Promise<AdjuntoSubido> => {
    const mime = mimeDeAdjunto(file.name, file.type);
    if (!mime) throw new Error('Ese formato no va.');
    if (!(file.size > 0)) throw new Error('El archivo está vacío.');
    if (file.size > TOPE_ADJUNTO_BYTES) throw new Error('Pasa de 25 MB.');
    const firma = await piezas.firmar(ctx.productoId, mime, file.size);
    if (!firma.ok) throw new Error(firma.error);
    await piezas.subir(firma.signedUrl, archivoConTipo(file, mime), firma.apikey, (p) => onProgreso?.(p), FORMATOS_ADJUNTO).promesa;
    const reg = await piezas.registrar({
      productoId: ctx.productoId, claseId: ctx.claseId ?? null, path: firma.path, nombre: file.name, mime, bytes: file.size,
    });
    if (!reg.ok) throw new Error(reg.error);
    if (!idDeRef(reg.ref)) throw new Error('No se pudo adjuntar.');
    onProgreso?.(100);
    return { ref: reg.ref, nombre: reg.nombre, mime: reg.mime };
  };
}
