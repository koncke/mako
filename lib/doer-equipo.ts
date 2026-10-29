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
import { clasificarIntencion } from './mako-intencion';
import { esFirmaDelEquipo, sinFirmaDelEquipo } from './aviso-arreglo-reglas';

/** El anillo del negocio (app_settings del ws): los últimos `TOPE_GUARDADOS` mensajes del equipo en su grupo. */
export const CLAVE_EQUIPO_EN_EL_GRUPO = 'mako.equipo.grupo';
export const TOPE_GUARDADOS = 10;
export const DIAS_DEL_EQUIPO = 7;
export const MAX_EN_EL_BLOQUE = 6;
export const LARGO_DEL_EQUIPO = 300;

/**
 * `ticket`: el ticket al que pertenece (la respuesta del equipo a un ticket, lib/tickets-cierre.ts). `para`: a quién le habla
 * (sus @menciones, o el nombre con el que arranca: «Leila, …»); sin `para`, a todo el grupo. `respondida`: ya le contestaron,
 * y la ventana de su pregunta se cerró.
 */
export type DelEquipo = { at: string; texto: string; id?: string; ticket?: number; para?: { jids?: string[]; nombre?: string }; respondida?: true };

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

/** El anillo con la pregunta `id` contestada: su ventana se cierra (la verificación de 5b7a1917d). */
export function conLaRespondida(guardado: string | null | undefined, id: string): DelEquipo[] {
  return leer(guardado).map((d) => (d.id === id ? { ...d, respondida: true as const } : d));
}

const SALUDOS = new Set(['hola', 'buenas', 'buen', 'buenos', 'gracias', 'listo', 'perfecto', 'chicos', 'equipo', 'todos', 'gente', 'ok']);
const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** A quién le habla un mensaje del equipo: sus @menciones, y el nombre con el que arranca («Leila, para cargar…»). */
export function paraDelEquipo(texto: string, menciones: readonly string[]): DelEquipo['para'] | undefined {
  const nombre = /^\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s*[,:]/u.exec(sinFirmaDelEquipo(texto))?.[1];
  const sirve = nombre && !SALUDOS.has(norm(nombre)) ? norm(nombre) : undefined;
  if (!menciones.length && !sirve) return undefined;
  return { ...(menciones.length ? { jids: [...menciones] } : {}), ...(sirve ? { nombre: sirve } : {}) };
}

/**
 * ¿El mensaje del equipo PREGUNTA algo? (la verificación de 5b7a1917d). Un «?» dentro de un link no (los avisos reales traen
 * `…/integraciones?abrir=zernio`), ni el título de un ticket: de un aviso de ticket, sólo «el equipo te pregunta».
 */
export function esPreguntaDelEquipo(d: Pick<DelEquipo, 'texto' | 'ticket'>): boolean {
  if (d.ticket) return /el equipo te pregunta/i.test(d.texto);
  // Ni el «?» de un link, ni el de algo CITADO entre «…» o “…”: el aviso de arreglo cita el título del ticket («¿Se pueden
  // responder comentarios como ManyChat?») y abría la ventana para cualquiera (la verificación de c358fd0c4).
  const sinLinks = d.texto.replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w.-]+\.(?:com|app|io|ar|mx)\/\S*/g, ' ')
    .replace(/«[^»]*»/g, ' ').replace(/“[^”]*”/g, ' ');
  return /[¿?]/.test(sinLinks);
}

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
    `LO QUE EL EQUIPO DE MaKo ESCRIBIÓ EN ESTE GRUPO (últimos ${DIAS_DEL_EQUIPO} días; lo escribió el equipo que desarrolla MaKo, no tú). Si la persona contesta a esto, el contexto está aquí: no lo contradigas.`,
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
  /** El mensaje citado (responder a): su id y su texto, si los trae (`citaDelMensaje`). */
  citado: { id: string | null; texto: string | null } | null;
  /** Quién escribe: su jid y su nombre (`pushName`). La ventana vale sólo para quien fue preguntado. */
  autor: { jid: string | null; nombre: string | null };
  /** El anillo del equipo de este negocio. */
  anillo: readonly DelEquipo[];
  /** Cuándo habló MaKo por última vez en este grupo (`ultimaDeMaKo`), o null. */
  ultimaDeMaKo: string | null;
  ahora: Date;
  nombraAMaKo: boolean;
  /** Sólo un texto cuenta por la ventana: un audio o un adjunto sin citar es deliberado, para MaKo. */
  esTexto: boolean;
};

/** ¿El autor es a quien le habló el equipo? Sin `para`, cualquiera del grupo. Por el número (sin el dominio) o por el nombre. */
function esParaEl(para: DelEquipo['para'], autor: EntradaAlEquipo['autor']): boolean {
  if (!para) return true;
  const num = (j: string): string => j.split('@')[0].replace(/\D/g, '');
  if (autor.jid && para.jids?.some((j) => num(j) && num(j) === num(autor.jid!))) return true;
  const primero = autor.nombre ? norm(autor.nombre.trim().split(/\s+/)[0] ?? '') : '';
  return !!para.nombre && !!primero && primero === para.nombre;
}

/**
 * El mensaje del equipo al que contesta, o null si es para MaKo (o no se sabe). `ventana`: lo es por la ventana (no citó), y al
 * registrarlo hay que cerrarla (`conLaRespondida`).
 *   · CITA uno del anillo, o uno firmado: es respuesta al equipo;
 *   · sin citar, sólo un texto de QUIEN fue preguntado, después de una PREGUNTA del equipo (`esPreguntaDelEquipo`) que nadie
 *     contestó todavía, dentro de la ventana y antes de que MaKo vuelva a hablar.
 * Nombrar a MaKo gana. Si además le pide algo a MaKo, lo decide quien llama (va a los dos).
 */
export function respuestaAlEquipo(e: EntradaAlEquipo): { delEquipo: DelEquipo; ventana: boolean } | null {
  if (e.nombraAMaKo) return null;
  if (e.citado && (e.citado.id || e.citado.texto)) {
    const delAnillo = e.citado.id ? e.anillo.find((d) => d.id === e.citado!.id) : undefined;
    if (delAnillo) return { delEquipo: delAnillo, ventana: false };
    if (esFirmaDelEquipo(e.citado.texto)) return { delEquipo: { at: e.ahora.toISOString(), texto: e.citado.texto ?? '', ...(e.citado.id ? { id: e.citado.id } : {}) }, ventana: false };
    return null;
  }
  if (!e.esTexto) return null;
  const pregunta = [...e.anillo].reverse().find((d) => esPreguntaDelEquipo(d));
  if (!pregunta || pregunta.respondida || !esParaEl(pregunta.para, e.autor)) return null;
  const at = Date.parse(pregunta.at);
  if (!Number.isFinite(at) || e.ahora.getTime() - at > VENTANA_RESPUESTA_AL_EQUIPO_MS) return null;
  // MaKo no tiene que haber hablado después de la pregunta: si habló, lo que sigue puede ser para ella.
  if (e.ultimaDeMaKo && Date.parse(e.ultimaDeMaKo) > at) return null;
  return { delEquipo: pregunta, ventana: true };
}

/**
 * La CITA de un mensaje de WhatsApp (responder a): su id, su texto y su autor, donde venga. Evolution v2 la manda en el nivel de
 * arriba (`contextInfo`, con `message.conversation`): `citaDe` (lib/doer-para-quien.ts) sólo miraba adentro del mensaje, y la
 * respuesta al equipo en la forma real no se leía nunca (la verificación de 5b7a1917d). Como `audioCitadoDe`.
 */
export function citaDelMensaje(m: { message?: Record<string, unknown> | null; contextInfo?: unknown } | null | undefined): { id: string | null; texto: string | null; participante: string | null } | null {
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  type Ctx = { stanzaId?: unknown; participant?: unknown; quotedMessage?: Record<string, unknown> };
  const candidatos: Array<Ctx | undefined> = [
    (msg.extendedTextMessage as { contextInfo?: Ctx } | undefined)?.contextInfo,
    msg.contextInfo as Ctx | undefined,
    m?.contextInfo as Ctx | undefined,
    ...['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'pttMessage'].map((k) => (msg[k] as { contextInfo?: Ctx } | undefined)?.contextInfo),
  ];
  for (const c of candidatos) {
    const id = typeof c?.stanzaId === 'string' && c.stanzaId ? c.stanzaId : null;
    const texto = textoDeCita(c?.quotedMessage);
    if (!id && !texto) continue;
    return { id, texto, participante: typeof c?.participant === 'string' && c.participant ? c.participant : null };
  }
  return null;
}

function textoDeCita(q: Record<string, unknown> | undefined): string | null {
  if (!q) return null;
  const t = (q.conversation as string | undefined)
    ?? (q.extendedTextMessage as { text?: string } | undefined)?.text
    ?? (q.imageMessage as { caption?: string } | undefined)?.caption
    ?? (q.videoMessage as { caption?: string } | undefined)?.caption;
  return typeof t === 'string' && t.trim() ? t : null;
}

/** El texto citado del mensaje (sólo adentro del mensaje; con el nivel de arriba, `citaDelMensaje`). */
export function textoCitado(message: Record<string, unknown> | undefined): string | null {
  return citaDelMensaje({ message })?.texto ?? null;
}

/**
 * ¿El mensaje, además de contestarle al equipo, le PIDE algo a MaKo? («Son 6 quincenas en mxn. Y pásame el resumen de cobros»,
 * la verificación de 5b7a1917d): entonces va a los dos. Un pedido claro del clasificador: actuar, consultar o pensar.
 */
export function pideAlgoAMaKo(texto: string): boolean {
  const v = clasificarIntencion(texto);
  return !v.dudosa && (v.intencion === 'actuar' || v.intencion === 'consultar' || v.intencion === 'pensar');
}

/** Las respuestas al equipo ya avisadas (por el id del mensaje): una re-entrega de Evolution no repite el aviso. */
export const CLAVE_RESPUESTAS_AVISADAS = 'mako.equipo.respuestas';
export const TOPE_RESPUESTAS_AVISADAS = 40;
export function conLaAvisada(guardado: string | null | undefined, id: string): { ids: string[]; yaEstaba: boolean } {
  let ids: string[] = [];
  try { const v = JSON.parse(guardado ?? '[]') as unknown; if (Array.isArray(v)) ids = v.filter((x): x is string => typeof x === 'string'); } catch { /* vacío */ }
  if (ids.includes(id)) return { ids, yaEstaba: true };
  return { ids: [...ids, id].slice(-TOPE_RESPUESTAS_AVISADAS), yaEstaba: false };
}
