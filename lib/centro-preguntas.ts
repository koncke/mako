// =============================================================================
// Las preguntas de cada chat del Centro: cuáles son suyas, en qué orden y cómo se dibujan (puro, con test)
// =============================================================================
// Martín (16/10/2026): «si un chat llegó al punto de necesitar una toma de desición, que ahí mismo... se renderice
// ESA o ESAS decisiones de ese chat... en el botón de "ticketera" visualizo todas, pero si es desde un chat, las que lo
// competen nada más». Y después: «Me dice "Espera tu respuesta" y aún no me salta lo que te pedí tipo claude». La
// pregunta se dibuja como AskUserQuestion de Claude Code (app/admin/operaciones/Pregunta.tsx); lo que decide qué
// tarjeta es de qué chat vive acá, para que el globito del muñeco, la pregunta arriba de la caja y la conversación
// cuenten lo MISMO.
//
// ⚠️ DE QUÉ CHAT ES UNA TARJETA SE DECIDE UNA VEZ: con su `destino` (la sesión que preguntó) si lo tiene; si no, por
// el nombre, sólo cuando un único chat se llama así (`destinoDeDecision`, lib/decisiones-aviso.ts). Así una tarjeta
// publicada sin destino y con un nombre repetido no aparece en dos chats.
// ⚠️ SIN `server-only`: lo usan la pantalla de la computadora y la del teléfono.

import { DESTINO_RE, type ChatCartero } from './operaciones-reglas';
import { destinoDeDecision } from './decisiones-aviso';
import { RESUELTA, URGENCIAS, type Decision } from '../app/admin/runway/decisiones';

type Carteros = readonly { cuenta: string; chats: readonly ChatCartero[] }[];
const chatsDe = (carteros: Carteros): ChatCartero[] => carteros.flatMap((k) => k.chats.map((c) => ({ ...c, cuenta: c.cuenta ?? k.cuenta })));

/** La sesión (`local_…` / `cli_…`) de la que es una tarjeta, o null si no se sabe. */
export function sesionDeDecision(d: Pick<Decision, 'chat' | 'destino'>, chats: readonly ChatCartero[]): string | null {
  if (d.destino && DESTINO_RE.test(d.destino)) return d.destino;
  const r = destinoDeDecision({ chat: d.chat, destino: null }, chats);
  return r.ok ? r.chat.local : null;
}

const ORDEN_URGENCIA = new Map<string, number>(URGENCIAS.map((u, i) => [u.clave, i]));
/** El orden de la Ticketera: lo que frena a un chat primero, después su `orden`, y a igual, la más vieja. */
const enOrden = (a: Decision, b: Decision) =>
  (ORDEN_URGENCIA.get(a.urgencia) ?? 9) - (ORDEN_URGENCIA.get(b.urgencia) ?? 9) || a.orden - b.orden
  || a.creadaAt.localeCompare(b.creadaAt) || a.id - b.id;

const delChat = (c: { miembros: readonly string[] }, d: Decision, chats: readonly ChatCartero[]) => {
  const s = sesionDeDecision(d, chats);
  return s != null && c.miembros.includes(s);
};

/** Las que ESTE chat espera (sin contestar), en el orden de la Ticketera. */
export function preguntasDelChat(c: { miembros: readonly string[] }, decisiones: readonly Decision[], carteros: Carteros): Decision[] {
  const chats = chatsDe(carteros);
  return decisiones.filter((d) => !d.respuesta && delChat(c, d, chats)).sort(enOrden);
}

/** Las que este chat preguntó y Martín ya contestó: van en la conversación, como respuestas suyas. */
export function respuestasDelChat(c: { miembros: readonly string[] }, decisiones: readonly Decision[], carteros: Carteros): Decision[] {
  const chats = chatsDe(carteros);
  return decisiones.filter((d) => !!d.respuesta && !!d.respondidaAt && delChat(c, d, chats));
}

/**
 * Cuál pregunta está abierta: la ELEGIDA por su id, o la primera si no hay elegida o ya no está (se contestó acá o en
 * otro lado). ⚠️ Nunca por su posición: el refresco de cada 8 s puede meter adelante una tarjeta que frena, y con la
 * posición lo que se escribía para una se guardaba en otra (revisión adversarial, 16/10/2026).
 */
export function preguntaAbierta<T extends { id: number }>(preguntas: readonly T[], elegida: number | null): { d: T | undefined; pos: number } {
  const i = elegida == null ? -1 : preguntas.findIndex((p) => p.id === elegida);
  const pos = Math.max(0, i);
  return { d: preguntas[pos], pos };
}

/** El rótulo de la pestaña de una pregunta (el `header` de Claude Code, un tema de una o dos palabras). */
const TEMA: Record<Decision['urgencia'], string> = { bloquea: 'Frena el chat', cuesta: 'Cuesta dinero', criterio: 'Criterio', aviso: 'Para saber' };
export const temaDePregunta = (d: Pick<Decision, 'urgencia'>): string => TEMA[d.urgencia];

export type OpcionDePregunta = { clave: string; titulo: string; detalle: string | null; recomendada: boolean };

/**
 * Las opciones como los renglones de Claude Code: el título y, abajo, la descripción. La descripción es la que publicó
 * el chat (`detalle`); una opción que la trae en el mismo texto («Sí — porque…») se parte en la raya. Un «Para saber»
 * sin opciones se contesta con «Entendido», que la saca como «Resuelta» (igual que en la Ticketera).
 */
export function opcionesDePregunta(d: Pick<Decision, 'opciones' | 'recomendada' | 'urgencia'>): OpcionDePregunta[] {
  if (!d.opciones.length && d.urgencia === 'aviso') return [{ clave: RESUELTA, titulo: 'Entendido', detalle: null, recomendada: true }];
  return d.opciones.map((o) => {
    const raya = o.detalle ? -1 : o.texto.indexOf(' — ');
    return {
      clave: o.clave,
      titulo: raya > 0 ? o.texto.slice(0, raya).trim() : o.texto,
      detalle: o.detalle ?? (raya > 0 ? o.texto.slice(raya + 3).trim() || null : null),
      recomendada: o.clave === d.recomendada,
    };
  });
}
