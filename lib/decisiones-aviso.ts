// =============================================================================
// El aviso de una respuesta de la Ticketera — las reglas, sin base y sin React
// =============================================================================
// Pedido (15/10/2026, vía «Estrategia 3 cuentas»): cuando Martín contesta una tarjeta, la
// respuesta tiene que llegarle SOLA al chat que la preguntó. Martín, textual: «Y ya respondí todas
// esas tarjetas y al parecer no te llegó... No sirve de nada la ticketera si no te llega». Había 29
// respuestas esperando en la base, y nadie las empujaba: el chat tenía que correr `contestadas`
// por las dudas.
//
// Lo empuja el CARTERO del Centro de Operaciones, en su vuelta de siempre (lib/operaciones.ts →
// cicloCartero): el servidor reclama las respuestas sin avisar cuyo chat está abierto en ESA
// cuenta, y el cartero le escribe al chat. Nada de esto es una máquina nueva.
//
// ⚠️ EL AVISO NO LLEVA LA RESPUESTA, SÓLO EL `ref`. El mensaje lo arma el cartero con un texto
// fijo y el ref validado («Martín contestó tu tarjeta X: léela con `decisiones.ts contestadas X`»).
// Es la misma regla por la que el cartero no entrega texto libre que no esté firmado en el
// dispositivo (AGENTS.md, «El Centro de Operaciones es una puerta a la PC de Martín»): con la base
// comprometida, lo peor que puede hacer un aviso es avisar de más. Que lleve la respuesta adentro
// necesita firmarla al contestar (fase 2).
//
// ⚠️ UNA RESPUESTA SE AVISA UNA VEZ. La marca es la fecha de ESA respuesta (`aviso_de` =
// `respondida_at`): si Martín la cambia, la nueva se avisa de nuevo; si el chat ya la recogió, no.
// Lo que no se pudo entregar (o no se sabe si llegó) se reintenta, con tope.
//
// ⚠️ SIN `server-only`, a propósito: lo importan el servidor, el script de decisiones y los tests.

import { DESTINO_RE, type ChatCartero } from './operaciones-reglas';

/** Cuántas veces se intenta avisar la MISMA respuesta antes de dejarla para que la mire alguien. */
export const AVISO_MAX_INTENTOS = 5;
/** Un aviso reclamado que no vuelve con acuse en este tiempo se da por perdido y se reintenta. */
export const AVISO_TOMADO_VENCE_MS = 2 * 60 * 60 * 1000;
/** Cuántos avisos reclama un cartero por vuelta. */
export const AVISOS_POR_VUELTA = 10;

export const ESTADOS_AVISO = ['tomado', 'entregado', 'no_entregado', 'incierto'] as const;
export type EstadoAviso = (typeof ESTADOS_AVISO)[number];

/** Lo que el aviso necesita saber de una tarjeta. */
export type FilaAviso = {
  ref: string;
  chat: string;
  destino: string | null;
  respuesta: string | null;
  respondidaAt: string | null;
  recogidaAt: string | null;
  archivadaAt: string | null;
  avisoDe: string | null;
  avisoEstado: EstadoAviso | null;
  avisoAt: string | null;
  avisoIntentos: number;
};

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
/** supabase-js devuelve las fechas como texto y el driver `postgres` del script como Date. */
const fecha = (v: unknown) => (v instanceof Date ? (Number.isFinite(v.getTime()) ? v.toISOString() : null) : typeof v === 'string' && v ? v : null);

/** La fila de `admin_decisiones` tal como la lee el aviso. Lo que no cierra, queda en null. */
export function filaAviso(f: Record<string, unknown>): FilaAviso {
  const destino = txt(f.destino);
  const estado = txt(f.aviso_estado);
  const intentos = Number(f.aviso_intentos);
  return {
    ref: txt(f.ref),
    chat: txt(f.chat),
    destino: DESTINO_RE.test(destino) ? destino : null,
    respuesta: txt(f.respuesta) || null,
    respondidaAt: fecha(f.respondida_at),
    recogidaAt: fecha(f.recogida_at),
    archivadaAt: fecha(f.archivada_at),
    avisoDe: fecha(f.aviso_de),
    avisoEstado: (ESTADOS_AVISO as readonly string[]).includes(estado) ? (estado as EstadoAviso) : null,
    avisoAt: fecha(f.aviso_at),
    avisoIntentos: Number.isInteger(intentos) && intentos > 0 ? intentos : 0,
  };
}

/** El mismo instante aunque venga escrito distinto: la base contesta `+00:00` y JS escribe `Z`. */
export function mismoInstante(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const x = Date.parse(a);
  return Number.isFinite(x) && x === Date.parse(b);
}

/** ¿Hay que avisar ESTA respuesta ahora? (sin mirar todavía a quién: eso es `destinoDeDecision`). */
export function necesitaAviso(d: FilaAviso, ahora: number): boolean {
  if (!d.respuesta || !d.respondidaAt || d.recogidaAt || d.archivadaAt) return false;
  // Una respuesta que nunca se avisó (o que cambió desde el último aviso): sale.
  if (!mismoInstante(d.avisoDe, d.respondidaAt)) return true;
  if (d.avisoEstado === 'entregado') return false;
  if (d.avisoIntentos >= AVISO_MAX_INTENTOS) return false;
  if (d.avisoEstado === 'tomado') {
    const t = Date.parse(d.avisoAt ?? '');
    return !Number.isFinite(t) || ahora - t > AVISO_TOMADO_VENCE_MS;
  }
  // No se pudo entregar, o no se sabe si llegó: para una respuesta, un aviso de más es mucho más
  // barato que uno de menos, así que se reintenta.
  return true;
}

/** Un título comparable: sin tildes, sin mayúsculas y con los espacios colapsados. */
export function normalizarTitulo(t: string): string {
  return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type Resolucion = { ok: true; chat: ChatCartero } | { ok: false; motivo: string };

/**
 * A qué chat va el aviso de una tarjeta, mirando los chats que suben TODOS los carteros.
 * Con `destino` (la sesión que preguntó) es exacto. Sin él, se busca un chat con ese título, y sólo
 * vale si hay UNO: con dos o con ninguno no se adivina (AGENTS.md, «si una rama puede escribir
 * "esto es ambiguo", no puede terminar en [0]»).
 */
export function destinoDeDecision(d: { chat: string; destino: string | null }, chats: readonly ChatCartero[]): Resolucion {
  if (d.destino) {
    const c = chats.find((x) => x.local === d.destino);
    return c ? { ok: true, chat: c } : { ok: false, motivo: 'Espera a que un cartero vea ese chat' };
  }
  const buscado = normalizarTitulo(d.chat);
  const iguales = chats.filter((x) => normalizarTitulo(x.titulo) === buscado);
  if (iguales.length === 1) return { ok: true, chat: iguales[0] };
  if (!iguales.length) return { ok: false, motivo: `Ningún chat se llama «${d.chat}»: hay que publicarla con su destino` };
  return { ok: false, motivo: `Hay ${iguales.length} chats que se llaman «${d.chat}»: hay que publicarla con su destino` };
}

/**
 * En qué anda el aviso de una tarjeta, en una frase (lo imprime `scripts/decisiones.ts`).
 * `hayCartero` = algún cartero dio señal hace poco: sin ninguno, nadie la va a avisar.
 */
export function explicarAviso(d: FilaAviso & { avisoMotivo?: string | null }, chats: readonly ChatCartero[], hayCartero: boolean, ahora: number): string {
  if (!d.respuesta) return 'sin respuesta todavía';
  if (d.recogidaAt) return 'recogida: el chat ya la tiene';
  const mismo = mismoInstante(d.avisoDe, d.respondidaAt);
  if (mismo && d.avisoEstado === 'entregado') return 'avisada: el aviso llegó al chat';
  if (mismo && d.avisoEstado === 'tomado' && !necesitaAviso(d, ahora)) return 'avisando ahora';
  if (mismo && d.avisoIntentos >= AVISO_MAX_INTENTOS) {
    return `no se pudo avisar después de ${d.avisoIntentos} intentos${d.avisoMotivo ? `: ${d.avisoMotivo}` : ''}`;
  }
  const r = destinoDeDecision(d, chats);
  if (!r.ok) return r.motivo;
  if (!hayCartero) return 'sin cartero corriendo: nadie la va a avisar';
  if (!r.chat.vivo) return `espera a que se abra el chat «${r.chat.titulo}»`;
  return `se avisa en la próxima vuelta del cartero${r.chat.cuenta ? ` de ${r.chat.cuenta}` : ''}`;
}
