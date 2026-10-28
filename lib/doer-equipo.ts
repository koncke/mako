// =============================================================================
// doer-equipo — lo que el EQUIPO de MaKo escribe en el grupo de un negocio, para el turno (28/10/2026, el diagnóstico del
// Cerebro, F2a)
// =============================================================================
// `enviarAlGrupoMaKo` sólo anotaba el anti-eco: lo que mandaba el equipo (el aviso de un arreglo, la respuesta de un ticket)
// nunca llegaba a un turno. De 30 avisos del equipo en 7 grupos del 21 al 28/10, ninguno. Leandro contestó al aviso de los
// botones de Instagram («no necesitaba eso… tal cual como lo hace manychat») y MaKo no tenía a qué referirlo; Joan preguntó si
// el access token de Meta «sigue siendo el mismo» tres minutos después del aviso «sólo con Zernio», y MaKo le dijo que sí.
//
// ⚠️ NO VA COMO TURNO DE MaKo ('assistant'): `ultimoDeMako` (lib/mako-doer-in.ts) toma el último 'assistant' para saber si
// MaKo preguntó algo, y una pregunta del equipo pasaría por pregunta de MaKo: un «sí» del dueño se volvería una confirmación.
// Va a un anillo propio del negocio (`CLAVE_EQUIPO_EN_EL_GRUPO`) y el turno lo lee como un bloque aparte, con su rótulo.
// =============================================================================

import { cuando } from './doer-hilo';
import { esFirmaDelEquipo } from './aviso-arreglo-reglas';

/** El anillo del negocio (app_settings del ws): los últimos `TOPE_GUARDADOS` mensajes del equipo en su grupo. */
export const CLAVE_EQUIPO_EN_EL_GRUPO = 'mako.equipo.grupo';
export const TOPE_GUARDADOS = 10;
export const DIAS_DEL_EQUIPO = 7;
export const MAX_EN_EL_BLOQUE = 6;
export const LARGO_DEL_EQUIPO = 300;

/** `ticket`: el ticket al que pertenece (la respuesta del equipo a un ticket, lib/tickets-cierre.ts). */
export type DelEquipo = { at: string; texto: string; id?: string; ticket?: number };

function leer(guardado: string | null | undefined): DelEquipo[] {
  try {
    const v = JSON.parse(guardado ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is DelEquipo => !!x && typeof x === 'object' && typeof (x as DelEquipo).at === 'string' && typeof (x as DelEquipo).texto === 'string') : [];
  } catch { return []; }
}

/** El anillo con el nuevo al final, sin pasar del tope (lo más viejo se va). */
export function conElNuevo(guardado: string | null | undefined, nuevo: DelEquipo): DelEquipo[] {
  const antes = leer(guardado);
  // El mismo mensaje entra dos veces: al mandarlo (`enviarAlGrupoMaKo` con 'equipo') y por su eco. Se queda el primero.
  if (nuevo.id && antes.some((d) => d.id === nuevo.id)) return antes;
  return [...antes, { ...nuevo, texto: nuevo.texto.slice(0, 1000) }].slice(-TOPE_GUARDADOS);
}

/** Lo del equipo, para quien lo necesita entero (la respuesta al equipo). */
export const delEquipo = (guardado: string | null | undefined): DelEquipo[] => leer(guardado);

const enUnaLinea = (s: string, max: number): string => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** El bloque del system del turno, o '' si el equipo no escribió en los últimos `DIAS_DEL_EQUIPO` días. */
export function bloqueDelEquipo(guardado: string | null | undefined, ahora: Date, tz: string): string {
  const desde = ahora.getTime() - DIAS_DEL_EQUIPO * 24 * 60 * 60 * 1000;
  const vivos = leer(guardado).filter((d) => Date.parse(d.at) >= desde).slice(-MAX_EN_EL_BLOQUE);
  if (!vivos.length) return '';
  return [
    `LO QUE EL EQUIPO DE MaKo ESCRIBIÓ EN ESTE GRUPO (últimos ${DIAS_DEL_EQUIPO} días; lo escribió el equipo que desarrolla MaKo, no tú). Si la persona contesta a esto, el contexto está acá: no lo contradigas.`,
    ...vivos.map((d) => `- ${cuando(d.at, ahora, tz)} — «${enUnaLinea(d.texto, LARGO_DEL_EQUIPO)}»`),
  ].join('\n');
}

// ── LA RESPUESTA AL EQUIPO NO ES PARA MaKo (28/10/2026, Leila, ws11) ───────────────────────────────────────────────────────
// El equipo le preguntó en el grupo cuántas quincenas eran y en qué moneda; Leila contestó «Nadia es su proporcional en mxn son
// 6 meses de 12000 y luego a 10000», y MaKo le puso 👍 y le contestó una cuenta («eso suma 72,000 MXN… dime y lo hacemos
// juntos»). Martín: «Leila respondió al desarrollador y MaKo saltó a decirle cualquier cosa».
// Es respuesta al equipo si CITA un mensaje del equipo (con su firma, o uno del anillo), o si es un texto que llega después de
// una PREGUNTA del equipo, dentro de `VENTANA_RESPUESTA_AL_EQUIPO_MS` y antes de que MaKo vuelva a hablar. Nombrar a MaKo gana:
// «mako, ¿y los leads?» es para MaKo aunque el equipo haya preguntado algo.

export const VENTANA_RESPUESTA_AL_EQUIPO_MS = 6 * 60 * 60 * 1000;

export type EntradaAlEquipo = {
  /** El mensaje citado (responder a): su id y su texto, si los trae. */
  citado: { id: string | null; texto: string | null } | null;
  /** El anillo del equipo de este negocio. */
  anillo: readonly DelEquipo[];
  /** Cuándo habló MaKo por última vez en este grupo (`ultimaDeMaKo`), o null. */
  ultimaDeMaKo: string | null;
  ahora: Date;
  nombraAMaKo: boolean;
  /** Sólo un texto cuenta por la ventana: un audio o un adjunto sin citar es deliberado, para MaKo. */
  esTexto: boolean;
};

/** El mensaje del equipo al que contesta, o null si es para MaKo (o no se sabe). */
export function respuestaAlEquipo(e: EntradaAlEquipo): DelEquipo | null {
  if (e.nombraAMaKo) return null;
  if (e.citado && (e.citado.id || e.citado.texto)) {
    const delAnillo = e.citado.id ? e.anillo.find((d) => d.id === e.citado!.id) : undefined;
    if (delAnillo) return delAnillo;
    if (esFirmaDelEquipo(e.citado.texto)) return { at: e.ahora.toISOString(), texto: e.citado.texto ?? '', ...(e.citado.id ? { id: e.citado.id } : {}) };
    return null;
  }
  if (!e.esTexto) return null;
  const pregunta = [...e.anillo].reverse().find((d) => d.texto.includes('?'));
  if (!pregunta) return null;
  const at = Date.parse(pregunta.at);
  if (!Number.isFinite(at) || e.ahora.getTime() - at > VENTANA_RESPUESTA_AL_EQUIPO_MS) return null;
  // MaKo no tiene que haber hablado después de la pregunta: si habló, lo que sigue puede ser para ella.
  if (e.ultimaDeMaKo && Date.parse(e.ultimaDeMaKo) > at) return null;
  return pregunta;
}

/** El texto citado de un mensaje de WhatsApp (responder a), si lo trae. */
export function textoCitado(message: Record<string, unknown> | undefined): string | null {
  const ctx = (message?.extendedTextMessage as { contextInfo?: { quotedMessage?: Record<string, unknown> } } | undefined)?.contextInfo
    ?? (message?.contextInfo as { quotedMessage?: Record<string, unknown> } | undefined);
  const q = ctx?.quotedMessage;
  if (!q) return null;
  const t = (q.conversation as string | undefined)
    ?? (q.extendedTextMessage as { text?: string } | undefined)?.text
    ?? (q.imageMessage as { caption?: string } | undefined)?.caption
    ?? (q.videoMessage as { caption?: string } | undefined)?.caption;
  return typeof t === 'string' && t.trim() ? t : null;
}
