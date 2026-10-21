// =============================================================================
// onboarding-guardia — los topes contra el abuso del onboarding (17/10/2026)
// =============================================================================
// Martín, desde el Ops Center: «Como el onboarding lo pago yo en tokens, mete mucha ciberseguridad contra ataques DDoS
// o cosas así, si me envían mil consultas... O si un troll le empieza a decir cualquier cosa, que tenga la capacidad de
// bloquear al usuario». El onboarding usa el crédito de Claude de la plataforma (`CREDITO_HABILITADO_PARA`,
// lib/veto-claude.ts): cada turno de la conversación lo paga Martín.
//
// TRES CAPAS, de la más barata a la más dura:
//   1. Por minuto, por usuario y por IP (en memoria, lib/rate-limit.ts): corta la ráfaga de una misma persona o
//      máquina. Es por instancia: frena un script, no un ataque distribuido (para eso está la protección de Vercel).
//   2. Un TOPE por onboarding, en la base (`onboarding.guardia`, un JSON por workspace): turnos de IA y documentos.
//      Es el que protege la plata: vale entre instancias y entre días.
//   3. El TROLEO: un mensaje que insulta, intenta sacar a MaKo de su papel o es basura suma una falta, NO llega a la IA
//      (no se paga), y a la tercera el onboarding se BLOQUEA y se le avisa al equipo por email. Lo desbloquea el super
//      admin, mirando al cliente, desde el mismo onboarding.
//
// PURO (sin `server-only`): lo prueban los tests ejecutándolo. Lo que lee y escribe, en lib/onboarding-guardia-server.ts.
// La voz: de «tú», neutra (lo lee el cliente).
// =============================================================================

export const CLAVE_GUARDIA = 'onboarding.guardia';

export const TOPES = {
  /** Pedidos de IA (turnos de la conversación y documentos) por minuto, por usuario. */
  iaPorMinutoUsuario: 8,
  /** Lo mismo, por IP (varias cuentas desde la misma máquina). */
  iaPorMinutoIp: 20,
  /** Respuestas al arranque (el nombre, las opciones) por minuto, por usuario. No pagan IA: es contra el bucle. */
  arranquePorMinutoUsuario: 40,
  /** Turnos de IA en TODO el onboarding. Contar lo que vende lleva de 5 a 10; con 60 sobra para lo legítimo. */
  turnosPorOnboarding: 60,
  /** Documentos leídos con IA en todo el onboarding. */
  documentosPorOnboarding: 15,
  /** Faltas (troleo) hasta el bloqueo. */
  faltasParaBloquear: 3,
} as const;

/** Lo que guarda el workspace. */
export type EstadoGuardia = {
  turnos?: number;
  documentos?: number;
  faltas?: number;
  /** Lo último que sumó una falta (recortado), para el email al equipo. */
  ultimasFaltas?: string[];
  bloqueo?: { at: string; motivo: string; usuario?: string } | null;
};

export type TipoPedido = 'turno' | 'documento';

export type Decision =
  | { ok: true }
  | { ok: false; razon: 'bloqueado' | 'tope'; mensaje: string };

export const MENSAJE_BLOQUEADO = 'Tu onboarding quedó en revisión. El equipo de MaKo te escribe en breve.';
export const MENSAJE_TOPE = 'Llegaste al máximo de mensajes del onboarding. Si te falta algo, sigue desde la tab Offer cuando termines.';
export const MENSAJE_RAPIDO = 'Vas muy rápido. Espera un momento y vuelve a intentarlo.';
export const MENSAJE_FALTA = 'Eso no lo puedo contestar. Sigamos con tu negocio.';

/** ¿Puede pasar este pedido de IA? El bloqueo primero, después el tope del onboarding. */
export function decidir(e: EstadoGuardia, tipo: TipoPedido): Decision {
  if (e.bloqueo) return { ok: false, razon: 'bloqueado', mensaje: MENSAJE_BLOQUEADO };
  const usados = tipo === 'turno' ? e.turnos ?? 0 : e.documentos ?? 0;
  const tope = tipo === 'turno' ? TOPES.turnosPorOnboarding : TOPES.documentosPorOnboarding;
  if (usados >= tope) return { ok: false, razon: 'tope', mensaje: MENSAJE_TOPE };
  return { ok: true };
}

/** El estado después de contar un pedido que pasó. */
export function contar(e: EstadoGuardia, tipo: TipoPedido): EstadoGuardia {
  return tipo === 'turno' ? { ...e, turnos: (e.turnos ?? 0) + 1 } : { ...e, documentos: (e.documentos ?? 0) + 1 };
}

/**
 * Lo que cuenta un pedido. Un turno con un texto más LARGO que el chat se lee con IA como un documento (por partes, hasta
 * 20 pedidos): cuenta como turno Y como documento, y tiene que pasar los dos topes (20/10/2026, noche, revisión del Cerebro:
 * contado sólo como turno salteaba el tope de 15 documentos, unas 3,5 veces las llamadas que permite el diseño).
 */
export function tiposDelPedido(tipo: TipoPedido, largo: boolean): TipoPedido[] {
  return tipo === 'turno' && largo ? ['turno', 'documento'] : [tipo];
}

/** ¿Pasan todos los topes del pedido? El primero que no, decide. */
export function decidirTodos(e: EstadoGuardia, tipos: readonly TipoPedido[]): Decision {
  for (const t of tipos) {
    const d = decidir(e, t);
    if (!d.ok) return d;
  }
  return { ok: true };
}

/** El estado después de contar un pedido que pasó, con todo lo que cuenta. */
export function contarTodos(e: EstadoGuardia, tipos: readonly TipoPedido[]): EstadoGuardia {
  return tipos.reduce(contar, e);
}

/**
 * La falta que cuenta. Un texto LARGO llega recortado a su principio (lo que queda en el chat) y sólo cuenta el insulto: la
 * inyección y la «basura» dan falsos positivos en un texto armado con ChatGPT («Olvida las reglas de siempre…», un índice
 * «…… 3»), que sumaban faltas y bloqueaban el onboarding (revisión del Cerebro, 20/10). Un insulto, en cambio, no se
 * esconde adentro de un texto largo para pasar.
 */
export function faltaDelPedido(texto: string | undefined, largo: boolean): ReturnType<typeof falta> {
  if (!texto) return null;
  const f = falta(texto);
  return largo && f !== 'insulto' ? null : f;
}

// ── El troleo ───────────────────────────────────────────────────────────────
// Los patrones viven en lib/onboarding-troleo.ts: reconocen lo que escribe la persona, voseo incluido («sos un
// inútil»), y por eso están fuera de la guarda de voseo; acá, que hay copy, la guarda sigue mirando.
import { falta } from './onboarding-troleo';
export { falta };

/** El estado después de una falta, y si con ésta se bloquea. */
export function conFalta(e: EstadoGuardia, texto: string, motivo: string, usuario: string | null, ahora: string): { estado: EstadoGuardia; bloquea: boolean } {
  const faltas = (e.faltas ?? 0) + 1;
  const ultimasFaltas = [...(e.ultimasFaltas ?? []), `${motivo}: ${texto.replace(/\s+/g, ' ').trim().slice(0, 140)}`].slice(-5);
  const bloquea = !e.bloqueo && faltas >= TOPES.faltasParaBloquear;
  return {
    estado: { ...e, faltas, ultimasFaltas, ...(bloquea ? { bloqueo: { at: ahora, motivo: `${faltas} faltas (${motivo})`, ...(usuario ? { usuario } : {}) } } : {}) },
    bloquea,
  };
}

/** Desbloquear: se borra el bloqueo y las faltas (lo decidió una persona); los contadores de IA siguen. */
export function desbloquear(e: EstadoGuardia): EstadoGuardia {
  return { ...e, faltas: 0, ultimasFaltas: [], bloqueo: null };
}

export function parseGuardia(raw: string | null | undefined): EstadoGuardia {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as EstadoGuardia) : {};
  } catch { return {}; }
}
