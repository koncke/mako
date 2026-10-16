// =============================================================================
// Los adjuntos guardados de un mensaje del chat con MaKo (lógica pura, con test)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 4 (16/10/2026): una foto o un PDF que la persona le manda a MaKo
// (Second Brain en la computadora, o el chat del teléfono) se guarda. El binario va al bucket privado `archivero`
// en `<ws>/chat/<uuid>`; en `chart_chats.bloques` (mig 0303) queda la referencia. Lo escribe el server
// (lib/chat-mako-adjuntos.ts) y lo lee la ruta del adjunto (/api/mako/chat?adjunto=).
//
// ⚠️ LO QUE SE LEE DE LA BASE SE SANEA ANTES DE USARLO: el `path` de un bloque es lo que se firma, así que tiene que
//    ser de ESTE workspace y de esta carpeta (`<ws>/chat/<uuid>`), sin `..` ni nada más. Un bloque que no calza se
//    descarta: no se firma ni se borra.
// ⚠️ LA PANTALLA NUNCA VE EL PATH: ve un `ref` (`<id del mensaje>:<n>`), y la ruta busca el path de nuevo.

import type { TipoAdjunto } from './mako-adjuntos';

/** Lo que pasó al guardar un PDF en El Archivero (lo anota el registro, después de responder). */
export type EstadoArchivero =
  | { estado: 'guardado'; id: string; aviso?: string }
  | { estado: 'fallo'; motivo: string };

/** Un archivo de un mensaje, tal como se guarda en `chart_chats.bloques`. */
export type BloqueChat = {
  k: 'adjunto';
  path: string;
  nombre: string;
  mime: string;
  tipo: TipoAdjunto;
  archivero?: EstadoArchivero;
};

/** Lo que ve la pantalla de un archivo guardado: sin el path. */
export type AdjuntoVisible = {
  /** `<id del mensaje>:<n>`: lo que se le pide a /api/mako/chat?adjunto= */
  ref: string;
  nombre: string;
  tipo: TipoAdjunto;
  archivero?: EstadoArchivero;
};

/** La carpeta de los adjuntos del chat en el bucket `archivero`. */
export const CARPETA_CHAT = 'chat';
/** Como mucho, los que entran en un mensaje (TOPE_ADJUNTOS de lib/mako-adjuntos.ts). */
const MAX_BLOQUES = 4;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Los formatos que el chat acepta (ACCEPT_ADJUNTOS_CHAT), con su tipo. */
const MIMES: Record<string, TipoAdjunto> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image', 'application/pdf': 'document',
};

const wsValido = (ws: number) => Number.isInteger(ws) && ws > 0;

/** Dónde va un adjunto nuevo: `<ws>/chat/<uuid>`. */
export function rutaDeAdjunto(ws: number, uuid: string): string {
  return `${ws}/${CARPETA_CHAT}/${uuid}`;
}

/** ¿Es el path de un adjunto del chat de ESTE workspace? Exacto: ni otra carpeta, ni `..`, ni una extensión. */
export function esRutaDeChat(ws: number, path: unknown): path is string {
  if (!wsValido(ws) || typeof path !== 'string') return false;
  return new RegExp(`^${ws}/${CARPETA_CHAT}/${UUID}$`).test(path);
}

/** ¿Es el path de un adjunto del chat de ALGÚN workspace? Para borrar los de una conversación que se va. */
export function esRutaDeChatDeAlguno(path: unknown): path is string {
  return typeof path === 'string' && new RegExp(`^[1-9][0-9]*/${CARPETA_CHAT}/${UUID}$`).test(path);
}

function sanearArchivero(v: unknown): EstadoArchivero | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (o.estado === 'guardado' && typeof o.id === 'string' && o.id) {
    return typeof o.aviso === 'string' && o.aviso ? { estado: 'guardado', id: o.id, aviso: o.aviso.slice(0, 200) } : { estado: 'guardado', id: o.id };
  }
  if (o.estado === 'fallo' && typeof o.motivo === 'string' && o.motivo) return { estado: 'fallo', motivo: o.motivo.slice(0, 200) };
  return undefined;
}

/**
 * Los bloques de un mensaje, saneados: sólo los adjuntos de este workspace, con un formato que el chat acepta y un
 * tipo que calza con el formato. Lo que no calza se descarta (no se firma ni se borra). Nunca tira.
 */
export function sanearBloques(ws: number, crudo: unknown): BloqueChat[] {
  if (!Array.isArray(crudo)) return [];
  const out: BloqueChat[] = [];
  for (const b of crudo.slice(0, MAX_BLOQUES)) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    if (o.k !== 'adjunto' || !esRutaDeChat(ws, o.path)) continue;
    const mime = typeof o.mime === 'string' ? o.mime : '';
    const tipo = MIMES[mime];
    if (!tipo || o.tipo !== tipo) continue;
    const nombre = typeof o.nombre === 'string' ? o.nombre.trim().slice(0, 120) : '';
    const archivero = sanearArchivero(o.archivero);
    out.push({ k: 'adjunto', path: o.path, nombre: nombre || (tipo === 'image' ? 'foto' : 'documento'), mime, tipo, ...(archivero ? { archivero } : {}) });
  }
  return out;
}

/** Lo que ve la pantalla de los adjuntos de un mensaje (sin el path). */
export function adjuntosVisibles(msgId: number, bloques: readonly BloqueChat[]): AdjuntoVisible[] {
  return bloques.map((b, i) => ({ ref: `${msgId}:${i}`, nombre: b.nombre, tipo: b.tipo, ...(b.archivero ? { archivero: b.archivero } : {}) }));
}

/** `<id del mensaje>:<n>` → sus dos números, o null. */
export function leerRef(ref: unknown): { msgId: number; i: number } | null {
  if (typeof ref !== 'string') return null;
  const m = /^([1-9][0-9]{0,14}):([0-9])$/.exec(ref);
  if (!m) return null;
  const i = Number(m[2]);
  return i < MAX_BLOQUES ? { msgId: Number(m[1]), i } : null;
}

/** Los bloques con lo que pasó en El Archivero anotado en el `i`-ésimo. */
export function conArchivero(bloques: readonly BloqueChat[], i: number, estado: EstadoArchivero): BloqueChat[] {
  return bloques.map((b, j) => (j === i ? { ...b, archivero: estado } : b));
}
