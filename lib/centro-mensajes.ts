// =============================================================================
// Lo de WhatsApp en cada mensaje del Ops Center: responder citando, reenviar, reaccionar, destacar, fijar y
// eliminar para mí (17/10/2026)
// =============================================================================
// Martín, desde el Centro: «Pon la funcionalidad de "Responder" que tiene WhatsApp al desplazar un mensaje hacia la
// derecha... Y agrega todas las funcionalidades de Whatsapp al mantener click en un mensaje». Copiado de WhatsApp (iOS y
// Web, mirados el 17/10): deslizar a la derecha responde, y mantener apretado abre la fila de reacciones arriba y el menú
// abajo (Responder, Reenviar, Copiar, Info, Destacar, Fijar, Eliminar). La pantalla: app/admin/operaciones/MensajeWA.tsx.
//
// Lo que se decidió con criterio, porque acá del otro lado no hay una persona sino un chat de Claude:
//   · RESPONDER viaja en el TEXTO FIRMADO: la PC entrega sólo lo firmado, así que la cita va como un renglón de Markdown
//     arriba («> ↩ «CRM»: …») que el chat lee como contexto, y la burbuja la dibuja como la cita de WhatsApp.
//   · REENVIAR manda el mensaje a otro chat por el MISMO camino firmado (mandar.ts), con «↪ Reenviado de «…»» arriba.
//   · REACCIONAR, DESTACAR, FIJAR y ELIMINAR PARA MÍ son marcas de Martín: se guardan en MaKo (una clave por chat,
//     lib/centro-mensajes-db.ts) y NO se le mandan al chat. Mandar un 👍 le costaría un turno entero de la ventana de
//     5 horas por un emoji (AGENTS.md → «los tokens son la capacidad»).
//   · «Eliminar para todos» NO existe: lo que el chat ya leyó está en su contexto y no se puede sacar.
//
// ⚠️ SIN `server-only`: lo usan las pantallas, la acción y los tests.

import type { LineaChat, TrabajoP } from './centro-chats';
import { textoDeRespuesta } from '../app/admin/runway/decisiones';

/** El id de un mensaje de la conversación: `t:` un turno del transcript, `w:` un trabajo firmado, `r:` una respuesta a la
 *  Ticketera. Estables: no cambian al refrescar ni al renombrar el chat. */
export type IdMensaje = string;
const ID_RE = /^[twr]:[\w-]{1,64}$/;
export const esIdMensaje = (v: unknown): v is IdMensaje => typeof v === 'string' && ID_RE.test(v);

/** El id de una línea, o null si no es un mensaje (una pregunta del chat es un formulario: no se cita ni se reenvía). */
export function idDeLinea(l: LineaChat): IdMensaje | null {
  if (l.tipo === 'turno') return `t:${l.turno.uuid}`;
  if (l.tipo === 'trabajo') return `w:${l.trabajo.id}`;
  if (l.tipo === 'respuesta') return `r:${l.decision.id}`;
  return null;
}
/** El id del elemento de la pantalla (para ir a un mensaje desde su cita o desde un fijado). */
export const idDelElemento = (id: IdMensaje) => `co-msg-${id.replace(':', '-')}`;

// ── Responder citando ──────────────────────────────────────────────────────────────────────────────────────
/** Lo que se cita: quién lo dijo («Tú» o el nombre del chat), un renglón de su texto y de qué mensaje es. */
export type Cita = { de: string; texto: string; id: IdMensaje | null };
/** Cuánto de lo citado viaja: un renglón, como el recuadro de WhatsApp (el chat tiene el mensaje entero en su contexto). */
export const TOPE_CITA = 140;
const MARCA_CITA = '> ↩ ';
const CITA_RE = /^> ↩ «([^»\n]{1,120})»: ([^\n]*)\n\n([\s\S]*)$/;

/** Un renglón para citar: sin Markdown (asteriscos, almohadillas, viñetas), con «…» si se cortó. */
export function renglonDeCita(texto: string, tope = TOPE_CITA): string {
  const sinCita = leerCita(texto)?.resto ?? leerReenvio(texto)?.resto ?? texto;
  const plano = sinCita
    .split('\n').map((x) => x.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+|#{1,6}\s+|>\s?)/, '').trim()).filter(Boolean).join(' ')
    .replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
  return plano.length > tope ? `${plano.slice(0, tope - 1).trimEnd()}…` : plano;
}

/** El texto que sale con su cita arriba. Sin texto, no sale nada (una cita sola no es un mensaje). */
export function armarConCita(cita: Pick<Cita, 'de' | 'texto'> | null, texto: string): string {
  const t = texto.trim();
  if (!cita || !t) return t;
  const de = cita.de.replace(/[»\n]/g, ' ').trim().slice(0, 120) || 'Mensaje';
  return `${MARCA_CITA}«${de}»: ${renglonDeCita(cita.texto)}\n\n${t}`;
}

/**
 * Lo que se le pide a quien interpreta un pedido (lib/mako-pedidos.ts) es lo ESCRITO: el renglón citado no es un pedido. Con él
 * adentro, citar «Archiva la hoja Ventas» y escribir «mejor no» proponía archivarla. Devuelve lo escrito y con qué volver a citarlo.
 */
export function separarCita(texto: string): { pedido: string; conCita: (t: string | null) => string | null } {
  const l = leerCita(texto);
  return l ? { pedido: l.resto, conCita: (t) => (t ? armarConCita(l.cita, t) : t) } : { pedido: texto, conCita: (t) => t };
}

/** La cita de un texto que salió con ella, y lo que se escribió debajo. null = no trae cita. */
export function leerCita(texto: string): { cita: Pick<Cita, 'de' | 'texto'>; resto: string } | null {
  if (!texto.startsWith(MARCA_CITA)) return null;
  const m = CITA_RE.exec(texto);
  return m ? { cita: { de: m[1], texto: m[2] }, resto: m[3] } : null;
}

// ── Reenviar ───────────────────────────────────────────────────────────────────────────────────────────────
const REENVIO_RE = /^↪ Reenviado de «([^»\n]{1,120})»\n\n([\s\S]*)$/;
/** Lo que sale al reenviar: el rótulo de WhatsApp («Reenviado») con de qué chat viene, y el mensaje tal cual. */
export function armarReenvio(origen: string, texto: string): string {
  const de = origen.replace(/[»\n]/g, ' ').trim().slice(0, 120) || 'otro chat';
  return `↪ Reenviado de «${de}»\n\n${texto.trim()}`;
}
export function leerReenvio(texto: string): { de: string; resto: string } | null {
  const m = REENVIO_RE.exec(texto);
  return m ? { de: m[1], resto: m[2] } : null;
}
/** Cuántos chats a la vez, como el tope de reenvío de WhatsApp (5). */
export const TOPE_REENVIO = 5;

/** El mensaje citado en la conversación: el que empieza con el renglón citado (sin el «…»). null si ya no está. */
export function buscarCitado(lineas: readonly LineaChat[], cita: Pick<Cita, 'texto'>): IdMensaje | null {
  const buscado = cita.texto.replace(/…$/, '').trim();
  if (!buscado) return null;
  for (let i = lineas.length - 1; i >= 0; i--) {
    const l = lineas[i];
    const id = idDeLinea(l);
    if (id && renglonDeCita(textoDeLinea(l), 100_000).startsWith(buscado)) return id;
  }
  return null;
}

/** Un mensaje, para el menú y para responderlo (app/admin/operaciones/MensajeWA.tsx). */
export type MensajeWA = { id: IdMensaje; texto: string; de: string; propio: boolean; instante: number; trabajo: TrabajoP | null };

/** El mensaje de una línea, con quién lo dijo («Tú» lo propio, el nombre del chat lo suyo, el de otra sesión lo de ella).
 *  Vive acá y no en MensajeWA.tsx: el hilo (sin 'use client') no puede importar un VALOR de un módulo de cliente. */
export function mensajeDeLinea(l: LineaChat, titulo: string): MensajeWA | null {
  const id = idDeLinea(l);
  if (!id) return null;
  const propio = l.tipo === 'trabajo' || l.tipo === 'respuesta' || (l.tipo === 'turno' && l.turno.rol !== 'el');
  const de = l.tipo === 'turno' && l.turno.rol === 'otro' ? l.turno.de ?? 'Otro chat' : propio ? 'Tú' : titulo;
  return { id, texto: textoDeLinea(l), de, propio, instante: l.instante, trabajo: l.tipo === 'trabajo' ? l.trabajo : null };
}

/** El texto de un mensaje, para copiarlo, citarlo o reenviarlo. */
export function textoDeLinea(l: LineaChat): string {
  if (l.tipo === 'turno') return l.turno.texto;
  if (l.tipo === 'trabajo') return l.trabajo.texto ?? '';
  if (l.tipo === 'respuesta') return textoDeRespuesta(l.decision);
  return '';
}

// ── Las marcas de Martín: reacciones, destacados, fijados y eliminados para él ───────────────────────────────────
/** La fila de WhatsApp (iOS y Web): las seis de siempre. */
export const REACCIONES = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
/** WhatsApp fija hasta 3 mensajes por chat: el cuarto reemplaza al más viejo. */
export const TOPE_FIJADOS = 3;
/** Un tope por lista: una clave que crece sin tope es un problema mañana. */
export const TOPE_MARCAS = 300;

export type MarcasChat = {
  reacciones: Record<IdMensaje, string>;
  destacados: IdMensaje[];
  /** El más nuevo al final. */
  fijados: IdMensaje[];
  ocultos: IdMensaje[];
};
export const SIN_MARCAS: MarcasChat = { reacciones: {}, destacados: [], fijados: [], ocultos: [] };

export type CambioMarca =
  | { tipo: 'reaccion'; id: IdMensaje; emoji: string | null }
  | { tipo: 'destacar'; id: IdMensaje; si: boolean }
  | { tipo: 'fijar'; id: IdMensaje; si: boolean }
  | { tipo: 'ocultar'; id: IdMensaje };

/** Una reacción es un emoji corto (las seis de la fila u otro del teclado): nada de texto. */
export const esReaccion = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 16 && !/[\p{L}\p{N}\s<>]/u.test(v);

/** Un cambio que vino del navegador: válido, o null. */
export function sanearCambio(x: unknown): CambioMarca | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!esIdMensaje(o.id)) return null;
  if (o.tipo === 'reaccion') return o.emoji === null ? { tipo: 'reaccion', id: o.id, emoji: null } : esReaccion(o.emoji) ? { tipo: 'reaccion', id: o.id, emoji: o.emoji } : null;
  if ((o.tipo === 'destacar' || o.tipo === 'fijar') && typeof o.si === 'boolean') return { tipo: o.tipo, id: o.id, si: o.si };
  if (o.tipo === 'ocultar') return { tipo: 'ocultar', id: o.id };
  return null;
}

const sinRepetir = (xs: readonly IdMensaje[]) => [...new Set(xs)];
/** Aplica un cambio. Puro: devuelve otras marcas. Ocultar un mensaje le saca también su fijado y su estrella. */
export function aplicarMarca(m: MarcasChat, c: CambioMarca): MarcasChat {
  const quitar = (xs: readonly IdMensaje[]) => xs.filter((x) => x !== c.id);
  switch (c.tipo) {
    case 'reaccion': {
      const r = { ...m.reacciones };
      if (c.emoji && r[c.id] !== c.emoji) r[c.id] = c.emoji; else delete r[c.id];
      return { ...m, reacciones: r };
    }
    case 'destacar':
      return { ...m, destacados: c.si ? sinRepetir([...m.destacados, c.id]).slice(-TOPE_MARCAS) : quitar(m.destacados) };
    case 'fijar':
      return { ...m, fijados: c.si ? sinRepetir([...quitar(m.fijados), c.id]).slice(-TOPE_FIJADOS) : quitar(m.fijados) };
    case 'ocultar': {
      const r = { ...m.reacciones };
      delete r[c.id];
      return { reacciones: r, destacados: quitar(m.destacados), fijados: quitar(m.fijados), ocultos: sinRepetir([...m.ocultos, c.id]).slice(-TOPE_MARCAS) };
    }
  }
}

/** Lo guardado (o lo que llegó del servidor): sólo ids y emojis válidos, con sus topes. Lo que no sirve se tira. */
export function sanearMarcas(x: unknown): MarcasChat {
  if (!x || typeof x !== 'object') return SIN_MARCAS;
  const o = x as Record<string, unknown>;
  const ids = (v: unknown, tope: number) => (Array.isArray(v) ? sinRepetir(v.filter(esIdMensaje)).slice(-tope) : []);
  const reacciones: Record<IdMensaje, string> = {};
  if (o.reacciones && typeof o.reacciones === 'object' && !Array.isArray(o.reacciones)) {
    for (const [k, v] of Object.entries(o.reacciones as Record<string, unknown>).slice(-TOPE_MARCAS)) if (esIdMensaje(k) && esReaccion(v)) reacciones[k] = v;
  }
  return { reacciones, destacados: ids(o.destacados, TOPE_MARCAS), fijados: ids(o.fijados, TOPE_FIJADOS), ocultos: ids(o.ocultos, TOPE_MARCAS) };
}

/** La conversación sin lo que Martín eliminó para él. */
export const sinOcultos = (lineas: readonly LineaChat[], m: MarcasChat | null | undefined): LineaChat[] =>
  !m?.ocultos.length ? [...lineas] : lineas.filter((l) => { const id = idDeLinea(l); return !id || !m.ocultos.includes(id); });

// ── El menú de un mensaje (mantener apretado, clic derecho o la flechita) ──────────────────────────────────────
export type OpcionMensaje = { id: 'transcripcion' | 'responder' | 'reenviar' | 'copiar' | 'info' | 'destacar' | 'fijar' | 'reportar' | 'eliminar'; label: string };
/**
 * Las opciones de un mensaje, en el ORDEN de WhatsApp en el iPhone (Responder, Reenviar, Copiar, Info, Destacar, Fijar,
 * Reportar, Eliminar). «Info» sólo en lo PROPIO, como allá: de lo que contestó el chat no hay entregas que mirar. Destacar y
 * Fijar cambian de nombre si ya lo están.
 *
 * «REPORTAR» VIVE ACÁ Y NO DEBAJO DEL MENSAJE (4/11/2026, ticket #57; Martín: «Debajo del mensaje de funnel coach me aparecia un
 * botón de "reportar" eso no tiene sentido»). Play pide denunciar una respuesta de IA sin salir de la app
 * (app/_chat/ReportarRespuesta.tsx); en el menú del mensaje se sigue pudiendo, sin un renglón debajo de cada respuesta. Lo
 * decide quien monta el menú (`reportable`): sólo lo que escribió MaKo, nunca lo propio ni un chat de Claude Code.
 */
export function opcionesDelMensaje(
  m: { id: IdMensaje; propio: boolean; trabajo?: { voz?: unknown } | null }, marcas: MarcasChat,
  /** La transcripción de esta nota de voz ya está abierta (app/admin/operaciones/voces-enviadas.ts). */
  transcripcionAbierta = false,
  /** Este mensaje se puede reportar (una respuesta de MaKo). Lo propio, nunca. */
  reportable = false,
): OpcionMensaje[] {
  return [
    // Una nota de voz, primero lo que la lee (26/10/2026, Martín: «de ultima en los 3 puntitos ver la transcripción»).
    ...(m.trabajo?.voz ? [{ id: 'transcripcion' as const, label: transcripcionAbierta ? 'Ocultar transcripción' : 'Ver transcripción' }] : []),
    { id: 'responder', label: 'Responder' },
    { id: 'reenviar', label: 'Reenviar' },
    { id: 'copiar', label: 'Copiar' },
    ...(m.propio ? [{ id: 'info' as const, label: 'Info' }] : []),
    { id: 'destacar', label: marcas.destacados.includes(m.id) ? 'No destacar' : 'Destacar' },
    { id: 'fijar', label: marcas.fijados.includes(m.id) ? 'No fijar' : 'Fijar' },
    ...(reportable && !m.propio ? [{ id: 'reportar' as const, label: 'Reportar' }] : []),
    { id: 'eliminar', label: 'Eliminar para mí' },
  ];
}
