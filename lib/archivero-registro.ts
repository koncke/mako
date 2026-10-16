// =============================================================================
// archivero-registro — lo PURO de guardar en El Archivero un documento que llegó por OTRA puerta
// =============================================================================
// Decisión de Martín (Ticketera, 15/10/2026 05:32, ref `offer-archivero`), textual: «¿El Archivero del
// chat guarda el archivo y paga una extracción por documento? → A · Sí». Hasta ese día el chat de Offer
// leía el documento y BORRABA el binario; ahora cada archivo que el dueño manda ahí queda también en El
// Archivero, con la MISMA extracción de campos del brief que hace su pantalla.
//
// La que escribe es `registrarDocumentoSinPisar` (lib/archivero.ts, server-only). Acá vive lo que DECIDE,
// sin red ni base, para que un test lo EJECUTE (tests/offer-archivero.test.ts):
//   · el id sale del CONTENIDO (sha256 del workspace + los bytes), con forma de UUID: el mismo archivo
//     mandado dos veces, un doble clic o un reintento dan el mismo id y no se paga dos veces. Y el
//     binario queda en `<ws>/<id>`, el formato exacto de `pathSubidoValido` (lib/archivero-bajada.ts);
//   · qué claves del brief toca un documento NUEVO sin recalcular el brief entero (`answersConDocumento`);
//   · cuándo un destino ocupado en Storage es un binario HUÉRFANO de un registro que se cortó.
//
// `computeEffective` vive acá (lib/archivero.ts la re-exporta) para que el test pueda comparar el «sin
// pisar» contra el recálculo de verdad, y no contra una copia.
// =============================================================================

import { createHash } from 'node:crypto';

export type FuenteCampo = { tipo: 'archivo' | 'manual'; id?: string; nombre?: string };

/** Lo que `computeEffective` necesita de un archivo del Archivero. */
export type ArchivoConCampos = { id: string; nombre: string; campos: Record<string, string> };

// ── Brief efectivo (archivos de base + edición manual explícita encima) ──────
export function computeEffective(files: ArchivoConCampos[], manual: Record<string, string>): { answers: Record<string, string>; fuente: Record<string, FuenteCampo> } {
  const answers: Record<string, string> = {};
  const fuente: Record<string, FuenteCampo> = {};
  // Archivos = BASE: llenan todo lo que puedan (entre archivos, el último pisa al anterior).
  for (const f of files) {
    for (const [k, v] of Object.entries(f.campos || {})) {
      if (v != null && String(v).trim()) { answers[k] = String(v); fuente[k] = { tipo: 'archivo', id: f.id, nombre: f.nombre }; }
    }
  }
  // Manual ENCIMA: una edición/respuesta EXPLÍCITA del usuario gana sobre el doc (es
  // una corrección intencional). Como ya NO hay auto-seed, esto es solo lo que él tocó.
  for (const [k, v] of Object.entries(manual || {})) {
    if (v != null && String(v).trim()) { answers[k] = String(v); fuente[k] = { tipo: 'manual' }; }
  }
  return { answers, fuente };
}

/**
 * El id de un documento por su contenido: sha256 de `archivero:<ws>:` + los bytes, con forma de UUID
 * (versión 5, variante RFC). El workspace entra en la huella porque la clave de `archivero_files` es
 * (workspace_id, id): sin él, el mismo PDF en dos negocios daría el mismo id y el mismo path de Storage.
 */
export function idDeContenido(ws: number, bytes: Uint8Array): string {
  const h = createHash('sha256').update(`archivero:${ws}:`).update(bytes).digest('hex');
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** El binario de un documento del Archivero: `<ws>/<id>`, lo mismo que acuña /archivero/upload-url. */
export const pathEnArchivero = (ws: number, id: string): string => `${ws}/${id}`;

/**
 * ¿Es `path` un binario subido por OTRA pantalla de este workspace (`<ws>/<pantalla>/<uuid>`, hoy sólo
 * `<ws>/offer/<uuid>`)? Exacto, como `pathSubidoValido`: ni `..` ni `//` ni otro workspace.
 */
export function origenDelWs(ws: number, path: string): boolean {
  if (!Number.isInteger(ws) || ws <= 0) return false;
  return new RegExp(`^${ws}/[a-z]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`).test(path);
}

/**
 * ¿Ya está este documento en El Archivero? Por el id de contenido (vino por otra puerta antes) o, si lo
 * subió desde la pantalla del Archivero (ahí el id es al azar), por el mismo nombre y el mismo tamaño en
 * bytes. Una web pegada no cuenta: su `tamano` son caracteres, no bytes. Devuelve el id del que ya está.
 */
export function documentoYaArchivado(
  files: ReadonlyArray<{ id: string; nombre: string; mime: string | null; tamano: number | null }>,
  d: { id: string; nombre: string; tamano: number },
): string | null {
  const mismo = files.find((f) => f.id === d.id);
  if (mismo) return mismo.id;
  const nombre = d.nombre.trim();
  if (!nombre || !(d.tamano > 0)) return null;
  const parecido = files.find((f) => f.mime !== 'text/html' && f.nombre.trim() === nombre && Number(f.tamano) === d.tamano);
  return parecido ? parecido.id : null;
}

/**
 * Las answers con un documento NUEVO sumado, SIN recalcular el brief: sólo se escriben las claves que el
 * documento trae y que el dueño no editó a mano. Da lo mismo que recalcular con `computeEffective`
 * agregando el archivo al final (el más nuevo pisa a los otros archivos; lo manual gana siempre), y no
 * toca nada más: lo que el wizard guardó por la otra puerta (negocio_objetivo, negocio_freno, marca_*)
 * queda como estaba, igual que las claves de otros documentos.
 */
export function answersConDocumento(
  previas: Record<string, string>, manual: Record<string, string>, campos: Record<string, string>,
): { siguiente: Record<string, string>; aportadas: string[] } {
  const siguiente: Record<string, string> = { ...previas };
  const aportadas: string[] = [];
  for (const [k, v] of Object.entries(campos || {})) {
    if (v == null || !String(v).trim()) continue;
    const m = manual?.[k];
    if (m != null && String(m).trim()) continue;
    siguiente[k] = String(v);
    aportadas.push(k);
  }
  return { siguiente, aportadas };
}

/** Lo que tarda como mucho un registro (el `maxDuration` de la ruta), con margen. Pasado esto, un destino sin fila es basura. */
export const TOPE_HUERFANO_MS = 10 * 60_000;

/** ¿El error de `storage.move` es «el destino ya existe»? */
export function destinoOcupado(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { message?: unknown; error?: unknown; statusCode?: unknown; status?: unknown };
  const t = [e.message, e.error, e.statusCode, e.status].filter((x) => x != null).join(' ');
  return /already exists|duplicate|\b409\b/i.test(t);
}

/**
 * Un destino ocupado SIN fila es de un registro que se cortó (el proceso murió entre mover el binario y
 * escribir la fila) sólo si es más viejo que lo que puede durar un registro. Si no se sabe la fecha, NO
 * es huérfano: puede ser otro envío del mismo archivo guardándose en este momento.
 */
export function binarioHuerfano(info: unknown, ahora: number): boolean {
  if (!info || typeof info !== 'object') return false;
  const o = info as Record<string, unknown>;
  const crudo = [o.createdAt, o.created_at, o.lastModified, o.last_modified, o.updatedAt, o.updated_at].find((x) => typeof x === 'string' && x.trim());
  const t = typeof crudo === 'string' ? Date.parse(crudo) : NaN;
  return Number.isFinite(t) && ahora - t > TOPE_HUERFANO_MS;
}
