// =============================================================================
// doer-ayuda — «¿Quieres que te ayude a conectarlo?» y «¿Levanto un ticket?» por WhatsApp, SIN IA (25/10/2026)
// =============================================================================
// Martín, 25/10/2026, por Florencia (ws21): «que si detecta que alguien le falta una conexión o algo que le ofrezca ayuda, que le
// de el link y que le pregunte si quiere que le ayude con eso»; y «si hay algo que falta, que esta mal conectado, un bug o lo
// que sea, que le proponga levantar un ticket... Levantar un ticket siente que ser facil para el usuario». Plan:
// docs/conexiones-y-ayuda.md, decisiones 6 y 7.
//
// ⚠️ SIN IA, Y NO ES UN AHORRO: a quien le falta su IA no le contesta ningún modelo. La oferta, la guía paso a paso y el ticket
// los hace el CÓDIGO (el molde de lib/agenda-sin-ia.ts: lo que se le muestra a la persona lo arma una función pura). Y el estado
// vive en app_settings (`mako.doer.ayuda.<jid>`, 30 minutos), porque el cartel no entra al historial del grupo
// (`avisoDeSistema`, lib/mako-doer-in.ts): sin esto, el «sí» siguiente no sabría a qué contesta.
//
// ⚠️ EL TICKET SE PROPONE AL OFRECERLO, Y EL «SÍ» LO CONFIRMA. `confirmarPendiente` (lib/api-mako/acciones.ts) no confirma una
// pendiente que nació en el mismo turno —es la guarda contra un modelo que se contesta su propio «sí»—: proponer y confirmar
// juntos, al recibir el «sí», rebotaba. Así es el camino de siempre: un canal propone, la persona confirma.
//
// ⚠️ MaKo NUNCA PIDE UNA CLAVE POR EL CHAT: la persona la pega en el link (la regla de `link_configurar_integracion`). Si igual la
// pega, lib/doer-claves.ts la tapa antes de que llegue a nada.
//
// Lo que falló de MaKo NO pasa por acá: se registra solo (Martín, 17/10/2026: «ya no se le pregunta a la persona»,
// lib/errores-app.ts). El ticket que se ofrece es el de lo que la persona no pudo resolver: una conexión que, después de la
// guía, sigue sin andar, o un paso que no le sale.
//
// PURO y sin `server-only`: lo usan lib/mako-doer-in.ts y tests/doer-ayuda.test.ts.
// =============================================================================

import { confirmacionPura } from './confirmacion-pura';
import { conexion, normalizar, type Conexion } from './conexiones-catalogo';
import { lineaDelTicket, LINEA_YA_AVISADO } from './no-pude';

/** Cuánto vale la oferta: lo que dura una charla. Después, un «sí» suelto no la revive. */
export const VIGENCIA_AYUDA_MS = 30 * 60_000;
export const claveAyuda = (jid: string): string => `mako.doer.ayuda.${jid}`;

export type EstadoAyuda =
  /** Se le ofreció ayuda para conectar `servicios` (en ese orden). */
  | { tipo: 'oferta'; servicios: string[]; venceAt: number }
  /** Se lo está guiando con el primero de `servicios`, en el paso `paso` (desde 0). */
  | { tipo: 'guia'; servicios: string[]; paso: number; venceAt: number }
  /** Se le ofreció el ticket, que ya quedó propuesto (`pendienteId`, lib/mako-pendientes): el «sí» lo confirma. Desde el 28/10/2026 el
   *  ticket se abre solo (`conTicket`): queda sólo para las ofertas guardadas antes, mientras viven. */
  | { tipo: 'ticket'; pendienteId: number; venceAt: number };

/** El ticket de la guía: lo que no le salió, para el que abre el código (lib/no-pude-server.ts, `ticketDeNoPude`). */
export type TicketAOfrecer = { titulo: string; descripcion: string };

export const OFERTA_AYUDA = '¿Quieres que te ayude a conectarlo? Responde «sí» y te guío paso a paso.';
export const OFERTA_TICKET = '¿Levanto un ticket para que el equipo de MaKo lo revise? Responde «sí».';

/** El estado guardado, si sigue vivo y tiene la forma de uno. Lo que no se reconoce es «no hay oferta». */
export function leerEstadoAyuda(crudo: string | null | undefined, ahora: number): EstadoAyuda | null {
  if (!crudo) return null;
  let e: unknown;
  try { e = JSON.parse(crudo); } catch { return null; }
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  if (typeof o.venceAt !== 'number' || o.venceAt <= ahora) return null;
  const servicios = Array.isArray(o.servicios) ? o.servicios.filter((s): s is string => typeof s === 'string' && !!conexion(s)) : [];
  if (o.tipo === 'oferta' && servicios.length) return { tipo: 'oferta', servicios, venceAt: o.venceAt };
  if (o.tipo === 'guia' && servicios.length && typeof o.paso === 'number' && o.paso >= 0) return { tipo: 'guia', servicios, paso: Math.floor(o.paso), venceAt: o.venceAt };
  if (o.tipo === 'ticket' && typeof o.pendienteId === 'number' && Number.isInteger(o.pendienteId) && o.pendienteId > 0) {
    return { tipo: 'ticket', pendienteId: o.pendienteId, venceAt: o.venceAt };
  }
  return null;
}

export const ofertaDeAyuda = (servicios: readonly string[], ahora: number): EstadoAyuda =>
  ({ tipo: 'oferta', servicios: [...new Set(servicios)].filter((s) => !!conexion(s)), venceAt: ahora + VIGENCIA_AYUDA_MS });
export const guiaEn = (servicios: readonly string[], paso: number, ahora: number): EstadoAyuda =>
  ({ tipo: 'guia', servicios: [...servicios], paso, venceAt: ahora + VIGENCIA_AYUDA_MS });
export const ticketOfrecido = (pendienteId: number, ahora: number): EstadoAyuda =>
  ({ tipo: 'ticket', pendienteId, venceAt: ahora + VIGENCIA_AYUDA_MS });

export type RespuestaAyuda = 'si' | 'no' | 'listo' | 'problema' | 'otra';

// «deja(lo)?»: es lo que escribe la persona, en cualquier variante; escrito así no lo marca la guarda de voseo (tests/puente-panel-copy.test.ts).
const NO = /^(no|nop|nel|ahora no|despues|mas tarde|luego|cancelar|cancela|salir|deja(lo)?|en otro momento)( (gracias|por ahora|ahora|todavia|mako|por favor|luego|despues))*$/;
const LISTO = /^(listo|ya|ya esta|ya lo hice|ya lo conecte|ya quedo|hecho|termine|siguiente|sigue|el que sigue|ok listo|listo ya)( .{0,12})?$/;
const PROBLEMA = /\b(no (me )?(sale|funciona|anda|puedo|deja|aparece|encuentro|entiendo|carga|abre)|error|falla|fallo|no se como)\b/;

/**
 * Qué contestó la persona a la oferta o a un paso. Ante la duda, `otra`: el mensaje sigue su camino de siempre.
 * ⚠️ «No me sale» va ANTES que el «no»: empieza con «no» y es lo contrario de un «ahora no».
 */
export function respuestaAyuda(texto: string | null | undefined): RespuestaAyuda {
  const t = normalizar(String(texto ?? '')).replace(/[!¡.,;:?¿👍🙌✅]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return 'otra';
  if (PROBLEMA.test(t)) return 'problema';
  if (LISTO.test(t)) return 'listo';
  if (NO.test(t)) return 'no';
  if (confirmacionPura(texto)) return 'si';
  return 'otra';
}

/**
 * Un paso de la guía, como mensaje de WhatsApp. El primero lleva el link (desde la computadora: en el teléfono no se conecta) y,
 * si es una clave, que se pega en el link y nunca acá.
 */
export function textoDelPaso(c: Conexion, pasos: readonly string[], i: number, link: string): string {
  const total = pasos.length;
  const ultimo = i >= total - 1;
  const cabeza = i === 0
    ? [
        `Vamos con ${c.nombre}. Hazlo desde tu computadora, en este link 👇`,
        link,
        ...(c.verifica === 'probar_conexion' ? ['', 'La clave la pegas ahí, nunca aquí en el chat.'] : []),
        '',
      ]
    : [];
  if (!total) return [...cabeza, 'Ahí están los pasos. Cuando termines, responde «listo» y me fijo si quedó conectado.'].join('\n');
  return [
    ...cabeza,
    `Paso ${i + 1} de ${total}: ${pasos[i]}`,
    '',
    ultimo ? 'Cuando termines, responde «listo» y me fijo si quedó conectado.' : 'Cuando lo hagas, responde «listo» y te paso el siguiente.',
  ].join('\n');
}

/**
 * Lo que se dice al verificar, lo que queda guardado si quedó conectado, y el ticket a abrir si no. El texto del «no» NO
 * nombra el ticket: eso lo agrega `conTicket` según si se abrió.
 */
export function despuesDeVerificar(
  c: Conexion, conectada: boolean | null, servicios: readonly string[], link: string, ahora: number, motivo?: string | null,
): { texto: string; siguiente: EstadoAyuda | null; ticket: TicketAOfrecer | null } {
  const resto = servicios.slice(1).map((s) => conexion(s)).filter((x): x is Conexion => !!x);
  if (conectada) {
    const sigue = resto[0];
    return sigue
      ? { texto: `✅ ${c.nombre} quedó conectado.\n\nTe falta ${sigue.nombre}. ¿Te guío también? Responde «sí».`, siguiente: ofertaDeAyuda(resto.map((x) => x.key), ahora), ticket: null }
      : { texto: `✅ ${c.nombre} quedó conectado. Ya puedes escribirme lo que necesitas.`, siguiente: null, ticket: null };
  }
  const noSe = conectada === null ? 'No pude comprobar si quedó conectado.' : `Todavía no veo ${c.nombre} conectado${motivo ? ` (${motivo})` : ''}.`;
  return {
    texto: [noSe, 'Revisa que lo hayas guardado en el link 👇', link].join('\n'),
    siguiente: null,
    ticket: {
      titulo: `No queda conectado ${c.nombre}`.slice(0, 80),
      descripcion: `Siguió la guía de MaKo por WhatsApp para conectar ${c.nombre} y no quedó conectado${motivo ? `: ${motivo}` : ''}.`,
    },
  };
}

/** Cuando la persona dice que algo no le sale en medio de la guía: el ticket, con lo que dijo y en qué paso. */
export function ticketPorProblema(c: Conexion, paso: number, loQueDijo: string): TicketAOfrecer {
  return {
    titulo: `No le sale conectar ${c.nombre}`.slice(0, 80),
    descripcion: `En el paso ${paso + 1} de la guía de ${c.nombre} por WhatsApp escribió: «${loQueDijo.trim().slice(0, 300)}».`,
  };
}

/**
 * El texto con el ticket que ya se ABRIÓ (28/10/2026, la regla de Martín del 27/10: «siempre que MaKo responda "No lo pude
 * hacer" debe levantar automáticamente un ticket»; antes se ofrecía y esperaba un «sí»): su número, «Ya estaba avisado» si la
 * conversación ya tenía el suyo, o el camino a mano si no se pudo abrir (sin identidad, la base no contestó).
 */
export function conTicket(texto: string, ticket: { id: number; nuevo: boolean } | null): string {
  const cola = ticket ? (ticket.nuevo ? lineaDelTicket(ticket.id) : LINEA_YA_AVISADO) : `Si sigue sin andar, ${minuscula(TICKET_NO_SALIO)}`;
  return [texto.trim(), cola].filter(Boolean).join('\n\n');
}
/** La primera letra en minúscula, después de un «¿» o un «¡» si los hay. */
const minuscula = (s: string): string => s.replace(/^([¿¡«]*)(\p{L})/u, (_, p: string, l: string) => p + l.toLowerCase());

export const NO_AHORA = 'Está bien. Cuando quieras, pídemelo de nuevo.';
export const ENTIENDO = 'Entiendo, a veces ese paso se traba.';
/** El ticket mandado, con su número (lo dice `levantar_ticket`: «Listo, es el ticket #12…»). Nada de «te aviso»: lo que ya pasó. */
export const ticketMandado = (resumen: string | null | undefined): string => {
  const n = /#(\d+)/.exec(resumen ?? '')?.[1];
  return `Listo: el equipo de MaKo ya tiene tu ticket${n ? ` #${n}` : ''}. Cuando esté resuelto, el aviso llega por este grupo.`;
};
export const TICKET_NO_SALIO = 'Levántalo desde «Reportar problema», en el menú de tu perfil en MaKo: no pude mandarlo desde aquí.';
