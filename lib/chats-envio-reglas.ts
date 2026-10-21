// =============================================================================
// chats-envio-reglas — lo que MaKo decide ANTES de proponer un envío desde Chats (21/10/2026, Ops Center 2.1)
// =============================================================================
// Las operaciones que mandan algo desde la bandeja (`enviar_borrador_whatsapp`, `contestar_dm`, `contestar_email_chat`,
// lib/api-mako/areas/chats.*) proponen una tarjeta y una PERSONA la toca: el toque en «Enviar» ES la aprobación del
// mensaje al lead (D3a, Martín, 21/10/2026). Lo que se puede equivocar sin que nada se vea roto vive acá, puro y con
// test (tests/chats-mako-envio.test.ts):
//   · el TEXTO: «sí, dale» no es contenido (docs/ops-center-principal.md §4.1). Si lo que viene como mensaje es la
//     misma frase corta con que la persona aceptó, MaKo pregunta qué decir en vez de mandarla;
//   · la IDENTIDAD: por qué canal y qué cuenta sale, entre las del contacto (lib/chats-tipos.ts), y por qué no se puede.
// Sin `server-only`: lo importan los cuerpos del área y el test.
// =============================================================================

import type { CanalChat, IdentidadCanal } from './chats-tipos';
import { MAX_TEXTO } from './inbox-movil-reglas';

/**
 * Lo más largo que se propone por cada canal. ⚠️ NUNCA más de lo que la tarjeta muestra ENTERO (`MAX_TEXTO`, el detalle de
 * la tarjeta, lib/inbox-movil-reglas.ts): lo que sale tiene que ser exactamente lo que se vio (revisión del 21/10/2026: se
 * aceptaban 4.000 y 20.000 y la tarjeta cortaba en 2.000). Instagram y Messenger cortan antes, en 1.000.
 */
export const TOPE_TEXTO_ENVIO: Readonly<Record<CanalChat, number>> = { whatsapp: MAX_TEXTO, instagram: 1000, messenger: 1000, email: MAX_TEXTO };

/** Una aceptación, no un mensaje: «sí», «dale», «ok», «mándalo», «listo», «envíalo ya»… solas o juntas. */
const PALABRA_QUE_ACEPTA = '(?:s[ií]|dale|ok(?:ay)?|okey|listo|perfecto|claro|va|vale|bueno|de una|hazlo|h[aá]celo|m[aá]nd[aá]?(?:lo|la|selo|sela)?|env[ií][aá]?(?:lo|la|selo|sela)?|ya|por favor|porfa|ahora|mismo|eso|as[ií])';
const SOLO_ACEPTA = new RegExp(`^[¡¿\\s]*${PALABRA_QUE_ACEPTA}(?:[\\s,.!¡¿?]+${PALABRA_QUE_ACEPTA})*[\\s.!?]*$`, 'i');

/**
 * El texto a mandar, o por qué no. Vacío no es contenido. Una aceptación sola («sí», «dale», «ok») sólo es un mensaje si la
 * persona lo DICTÓ: «contéstale que sí» manda «Sí»; un «sí, dale» que sólo aceptaba no es el mensaje (revisión del
 * 21/10/2026: antes se rechazaba toda respuesta corta). Pasado el tope del canal: se dice el tope, no se corta.
 */
export function textoDeEnvio(texto: unknown, canal: CanalChat, mensajeUsuario?: string | null): { texto: string } | { error: string; faltan?: string[] } {
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t) return { error: 'Falta el texto del mensaje: ¿qué le digo?', faltan: ['texto'] };
  const usuario = (mensajeUsuario ?? '').trim();
  if (SOLO_ACEPTA.test(t) && (!usuario || SOLO_ACEPTA.test(usuario))) {
    return { error: '«Sí, dale» no es el mensaje: ¿qué le digo exactamente?', faltan: ['texto'] };
  }
  const tope = TOPE_TEXTO_ENVIO[canal];
  if (t.length > tope) return { error: `El mensaje tiene ${t.length} caracteres y por ${NOMBRE_CANAL[canal]} van hasta ${tope}. Acórtalo.` };
  return { texto: t };
}

export const NOMBRE_CANAL: Readonly<Record<CanalChat, string>> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', email: 'email' };

/**
 * POR DÓNDE SALE: la identidad del contacto en ese canal (y esa cuenta, si se pidió: la línea de WhatsApp). Con varias,
 * la más reciente (vienen ordenadas así). Si existe pero no se puede escribir (bloqueado, la ventana de 24 h cerrada),
 * se dice el motivo: es lo que la persona ve en el selector de /chats.
 */
export function identidadParaEnviar(canales: readonly IdentidadCanal[], canal: CanalChat, cuenta?: string | null): { identidad: IdentidadCanal } | { error: string } {
  const delCanal = canales.filter((i) => i.canal === canal && (!cuenta || i.cuenta === cuenta));
  if (!delCanal.length) {
    const tiene = [...new Set(canales.map((i) => NOMBRE_CANAL[i.canal]))].join(', ') || 'ninguno';
    return { error: cuenta ? `Ese contacto no tiene conversación por esa línea de ${NOMBRE_CANAL[canal]}.` : `Ese contacto no tiene ${NOMBRE_CANAL[canal]} (tiene: ${tiene}).` };
  }
  const libre = delCanal.find((i) => i.puedeEscribir && !i.bloqueado);
  if (libre) return { identidad: libre };
  const motivo = delCanal[0].motivoNoEscribir || (delCanal[0].bloqueado ? 'Bloqueado' : 'no se puede escribir');
  return { error: `Por ${NOMBRE_CANAL[canal]} no se le puede escribir ahora: ${motivo}.` };
}

/** Por qué canal se manda, según la COSA que nombró la persona. */
export type CanalDeEnvio = 'whatsapp' | 'dm' | 'email';
const NOMBRADO: ReadonlyArray<[CanalDeEnvio, RegExp]> = [
  ['email', /\b(e-?mails?|mails?|correos?)\b/],
  ['dm', /\b(dms?|mensajes? directos?|instagram|insta|messenger)\b/],
  ['whatsapp', /\b(whats?app|wsp|wpp|whats)\b/],
];
const OPERACION_DE: Readonly<Record<CanalDeEnvio, string>> = { whatsapp: 'enviar_borrador_whatsapp', dm: 'contestar_dm', email: 'contestar_email_chat' };
const QUE_ES: Readonly<Record<CanalDeEnvio, string>> = { whatsapp: 'un WhatsApp', dm: 'un mensaje directo', email: 'un email' };

/**
 * EL CANAL LO DECIDE LA COSA QUE SE NOMBRA (revisión del 21/10/2026): «respóndele el mail a Pedro» es un email aunque el
 * turno haya traído la de WhatsApp. Si el pedido nombra UN canal y no es el de esta operación, no se propone: se dice
 * cuál es. Si no nombra ninguno, o nombra varios, no frena (lo decide la conversación).
 */
export function canalNombradoNoCoincide(mensajeUsuario: string | null | undefined, propio: CanalDeEnvio): string | null {
  const m = (mensajeUsuario ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nombrados = NOMBRADO.filter(([, re]) => re.test(m)).map(([c]) => c);
  if (nombrados.length !== 1 || nombrados[0] === propio) return null;
  const pedido = nombrados[0];
  return `Pediste ${QUE_ES[pedido]}: eso es ${OPERACION_DE[pedido]}, no ${QUE_ES[propio]}.`;
}

/**
 * La clave contra el duplicado de un DM: la MISMA propuesta (la conversación, el texto, el turno) da la misma clave, así
 * dos llamadas iguales del modelo en un turno son UNA pendiente y un doble toque sale una vez (revisión del 21/10/2026:
 * era al azar y desarmaba las dos cosas). Otro turno, otra clave: mandar lo mismo otro día es otro mensaje.
 */
export function claveDeDm(convId: number, texto: string, turno: number | null | undefined): string {
  let h = 0x811c9dc5;
  for (const ch of `${convId}|${texto}|${turno ?? 0}`) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 0x01000193) >>> 0; }
  return `mako-${h.toString(36)}`;
}

/** Un contacto con Instagram Y Messenger y sin canal pedido: ¿por cuál? Uno solo: ése. Ninguno: no hay DM. */
export function canalDeDm(canales: readonly IdentidadCanal[], pedido?: string | null): { canal: 'instagram' | 'messenger' } | { error: string; faltan?: string[] } {
  if (pedido === 'instagram' || pedido === 'messenger') return { canal: pedido };
  const hay = (['instagram', 'messenger'] as const).filter((c) => canales.some((i) => i.canal === c));
  if (hay.length === 1) return { canal: hay[0] };
  if (!hay.length) return { error: 'Ese contacto no tiene mensajes directos de Instagram ni de Messenger. Para WhatsApp, enviar_borrador_whatsapp; para email, contestar_email_chat.' };
  return { error: 'Ese contacto te escribe por Instagram y por Messenger: ¿por cuál le contesto?', faltan: ['canal'] };
}
