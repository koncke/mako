// =============================================================================
// Los adjuntos guardados de un mensaje del chat con MaKo (lógica pura, con test)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md, tanda 4 (16/10/2026): una foto o un PDF que la persona le manda a MaKo
// (Second Brain en la computadora, o el chat del teléfono) se guarda. El binario va al bucket privado `archivero`
// en `<ws>/chat/<uuid>`; en `chart_chats.bloques` (mig 0305) queda la referencia. Lo escribe el server
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

/**
 * La nota de voz de un mensaje copiado de Offer (21/10/2026, el chat «Onboarding»: lib/onboarding-arranque-server.ts). NO
 * lleva ruta de Storage: dice qué mensaje de qué conversación de Offer la tiene, y la ruta de audio de Offer
 * (/api/offer/audio) la vuelve a buscar con su puerta y su workspace. `sanearBloques` y `bloquesGuardados` la saltean.
 */
export type BloqueAudio = { k: 'audio'; sesion: number; mensaje: string; secs: number };

const MENSAJE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function bloqueDeAudio(sesion: number, mensaje: string, secs: number): BloqueAudio {
  return { k: 'audio', sesion, mensaje, secs: Math.max(0, Math.round(secs || 0)) };
}

/** La nota de voz guardada en los bloques de un mensaje, saneada, o null. Nunca tira. */
export function audioDeBloques(crudo: unknown): BloqueAudio | null {
  if (!Array.isArray(crudo)) return null;
  for (const b of crudo.slice(0, MAX_BLOQUES)) {
    if (!b || typeof b !== 'object' || (b as { k?: unknown }).k !== 'audio') continue;
    const { sesion, mensaje, secs } = b as Record<string, unknown>;
    if (typeof sesion !== 'number' || !Number.isInteger(sesion) || sesion <= 0) continue;
    if (typeof mensaje !== 'string' || !MENSAJE_ID.test(mensaje)) continue;
    return bloqueDeAudio(sesion, mensaje, typeof secs === 'number' && Number.isFinite(secs) ? secs : 0);
  }
  return null;
}

/**
 * LA NOTA DE VOZ DE LA PERSONA en el chat de MaKo (OC7, 22/10/2026): el MP3 en la carpeta de los adjuntos y cuánto dura. Se
 * escucha pidiéndola POR SU MENSAJE (`rutaDeVozDelChat`), como un adjunto: el path no sale a la pantalla. `sanearBloques` la
 * saltea (no es un archivo para El Archivero) y va SOLA en su mensaje (la ruta no la acepta con archivos).
 */
export type BloqueVoz = { k: 'voz'; path: string; secs: number };

/** Lo que dura una nota, en segundos enteros: al menos 1, a lo sumo una hora. */
const segundosDeNota = (secs: unknown) => Math.min(3600, Math.max(1, Math.round(typeof secs === 'number' && Number.isFinite(secs) ? secs : 0)));

export function bloqueDeVoz(path: string, secs: number): BloqueVoz {
  return { k: 'voz', path, secs: segundosDeNota(secs) };
}

/** La nota de voz guardada en los bloques de un mensaje de ESTE workspace, saneada, o null. Nunca tira. */
export function vozDeBloques(ws: number, crudo: unknown): BloqueVoz | null {
  if (!Array.isArray(crudo)) return null;
  for (const b of crudo.slice(0, MAX_BLOQUES)) {
    if (!b || typeof b !== 'object' || (b as { k?: unknown }).k !== 'voz') continue;
    const { path, secs } = b as Record<string, unknown>;
    if (esRutaDeChat(ws, path)) return bloqueDeVoz(path, secs as number);
  }
  return null;
}

/** El link de una nota de voz guardada, SIN el `?ws=`: es un `<audio src>`, y se lo pone quien lo dibuja (`conWs`). */
export const rutaDeVozDelChat = (msgId: number): string => `/api/mako/chat?voz=${msgId}`;

/**
 * La de un chat que la persona SIGUE con `antes` (uno «de antes» o el de una tab: el CRM, la ficha de un lead). Sin `&antes=1`
 * el GET la buscaba en el chat propio de la persona y daba 404, también recién mandada (la revisión del 22/10/2026).
 */
export const vozDeChatDeAntes = (url: string): string =>
  (url.startsWith('/api/mako/chat?voz=') && !/[?&]antes=/.test(url) ? `${url}&antes=1` : url);

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
