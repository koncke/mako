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
// Con las órdenes con «-le» (mándale, envíale, contéstale, respóndele, dile): «sí, dale, mándale» sólo ACEPTA, y su «Sí, dale»
// no es un mensaje dictado (revisión del 21/10/2026). «contéstale que sí» sigue dictando por el «que».
const PALABRA_QUE_ACEPTA = '(?:s[ií]|dale|ok(?:ay)?|okey|listo|perfecto|claro|va|vale|bueno|de una|hazlo|h[aá]celo|m[aá]nd[aá]?(?:lo|la|le|selo|sela)?|env[ií][aá]?(?:lo|la|le|selo|sela)?|cont[eé]st[aá]le|resp[oó]nd[eé]le|dile|dec[ií]le|ya|por favor|porfa|ahora|mismo|eso|as[ií])';
const SOLO_ACEPTA = new RegExp(`^[¡¿\\s]*${PALABRA_QUE_ACEPTA}(?:[\\s,.!¡¿?]+${PALABRA_QUE_ACEPTA})*[\\s.!?]*$`, 'i');
/**
 * UNA ORDEN QUE ABRE EL PEDIDO Y DICTA (cuarta revisión, 21/10/2026): «respóndele sí», «contéstale ok», «dile dale»: lo que
 * sigue a la orden ES el mensaje, como en «contéstale que sí». La orden sólo ACEPTA cuando va detrás de otra aceptación
 * («sí, dale, mándale») o sola. «mándale ya» / «envíale ahora» no dictan: dicen cuándo.
 */
const ORDEN_QUE_DICTA = /^[¡¿\s]*(?:cont[eé]st[aá]le|resp[oó]nd[eé]le|dile|dec[ií]le|m[aá]nd[aá]le|env[ií][aá]le|escr[ií]bele)[\s:,]+(?!(?:ya|ahora|mismo|por favor|porfa)[\s.!?]*$)\S/i;

/**
 * El texto a mandar, o por qué no. Vacío no es contenido. Una aceptación sola («sí», «dale», «ok») sólo es un mensaje si la
 * persona lo DICTÓ: «contéstale que sí» manda «Sí»; un «sí, dale» que sólo aceptaba no es el mensaje (revisión del
 * 21/10/2026: antes se rechazaba toda respuesta corta). Pasado el tope del canal: se dice el tope, no se corta.
 */
export function textoDeEnvio(texto: unknown, canal: CanalChat, mensajeUsuario?: string | null): { texto: string } | { error: string; faltan?: string[] } {
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t) return { error: 'Falta el texto del mensaje: ¿qué le digo?', faltan: ['texto'] };
  const usuario = (mensajeUsuario ?? '').trim();
  if (SOLO_ACEPTA.test(t) && (!usuario || (SOLO_ACEPTA.test(usuario) && !ORDEN_QUE_DICTA.test(usuario)))) {
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
  // Las redes cuentan como canal cuando son el MEDIO («por Instagram», «en IG», «al Messenger»): «el link de nuestra
  // página de Facebook» es un tema, no un canal (cuarta revisión, 21/10/2026).
  ['dm', /\b(dms?|mensajes? directos?|messenger)\b|\b(?:por|en|al|via)\s+(?:el\s+|su\s+)?(?:instagram|insta|ig|facebook|fb)\b/],
  ['whatsapp', /\b(whats?app|wsp|wpp|whats)\b/],
];
const OPERACION_DE: Readonly<Record<CanalDeEnvio, string>> = { whatsapp: 'enviar_borrador_whatsapp', dm: 'contestar_dm', email: 'contestar_email_chat' };
const QUE_ES: Readonly<Record<CanalDeEnvio, string>> = { whatsapp: 'un WhatsApp', dm: 'un mensaje directo', email: 'un email' };

/**
 * EL CANAL LO DECIDE LA COSA QUE SE NOMBRA (revisión del 21/10/2026): «respóndele el mail a Pedro» es un email aunque el
 * turno haya traído la de WhatsApp. Si el pedido nombra UN canal y no es el de esta operación, no se propone: se dice
 * cuál es. Si no nombra ninguno, o nombra varios, no frena (lo decide la conversación).
 */
export function canalNombradoNoCoincide(mensajeUsuario: string | null | undefined, propio: CanalDeEnvio, dictado?: string | null): string | null {
  const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // EN EL PEDIDO, NO EN LO DICTADO (revisión del 21/10/2026): «contéstale a Pedro: te mandé el link por mail» es un
  // WhatsApp; «mail» es del mensaje. Se saca el texto dictado, lo que va después del «:» y lo que va entre comillas.
  let m = plano(mensajeUsuario ?? '');
  const d = plano(dictado ?? '').trim();
  if (d && m.includes(d)) m = m.replace(d, ' ');
  // El «:» que abre el dictado lleva un espacio detrás: el de una hora (9:30) o un link (https://) no corta.
  m = m.replace(/[«"“][^»"”]*[»"”]/g, ' ').split(/:\s/)[0];
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

/**
 * ¿No se sabe si salió? Un corte por TIEMPO, o la conexión que se cae DESPUÉS de conectar («fetch failed», ECONNRESET,
 * «socket hang up»): Evolution o el servidor de email pudieron haber entregado el mensaje, y quien lee «no salió» lo
 * manda otra vez (revisiones del 21/10/2026). Lo que falla ANTES de conectar (ECONNREFUSED, ENOTFOUND) sí es «no salió».
 * `contestar_dm` ya lo distingue con `incierto`.
 */
export function esEnvioIncierto(error: string | null | undefined): boolean {
  const e = error ?? '';
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(e)) return false;
  return /abort|time ?out|timed out|tiempo de espera|fetch failed|ECONNRESET|socket hang up|other side closed|UND_ERR_SOCKET|terminated/i.test(e);
}

/**
 * Tras un envío de un borrador de WhatsApp que FALLÓ (`enviarBorrador`, lib/evolution-envio.ts): ¿a qué estado vuelve?
 * «pendiente» si seguro no salió (se puede mandar otra vez), «incierto» si pudo haber salido (un corte por tiempo, la
 * conexión caída a mitad). Hasta el 06/11/2026 volvía siempre a «pendiente», y el próximo «Enviar» —o el envío solo de
 * MaKo— podía mandarle el mismo mensaje dos veces al lead (docs/hallazgos-comunicacion.md, la tercera revisión del 21/10).
 * Un «incierto» no se lista en la bandeja ni frena el flujo, como un descartado.
 */
export function estadoTrasFallarEnvio(error: string | null | undefined): 'pendiente' | 'incierto' {
  return esEnvioIncierto(error) ? 'incierto' : 'pendiente';
}

/** Lo que se le dice a quien mandó un borrador que quedó «incierto». */
export const TEXTO_BORRADOR_INCIERTO = 'WhatsApp no contestó a tiempo y no sé si salió. Mira el chat antes de mandarlo otra vez: si no llegó, escríbelo desde ahí.';
