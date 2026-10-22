// =============================================================================
// flujo-ia-intencion — «Discutir» o «Editar» en el chat de MaKo de una automatización (puro)
// =============================================================================
// La llamada con Mauricio del 22/10/2026 (02:05-02:10). Le pegaron los mensajes de la campaña y MaKo:
//   1. contestó que «habría que editarlos o añadir nuevas tarjetas» en vez de hacerlo (la ruta lo tomó por pregunta);
//   2. a «hazlo como te lo indiqué» contestó «indícame qué cambios…»: el prompt de editar NO veía la charla, sólo el
//      último mensaje, y «como te lo indiqué» no se podía resolver;
//   3. al tercer intento armó dos de los cuatro mensajes y metió una variable que no existe.
// Martín (02:09): «lo que puedo agregar en el chat para que sea similar a Lovable: un botón de discutir y otro de
// editar. En uno puedes discutir, que te dé sugerencias; en otro, que haga todo lo pedido» — Mauricio: «que obedezca».
//
// Lo que decide este módulo, y la ruta (app/api/chat-agent/secuencias/ia) aplica:
//   · DISCUTIR: siempre el prompt de explicar (sólo puede devolver `{"respuesta"}`): sugiere, no toca el lienzo.
//   · EDITAR: nunca el de explicar, aunque suene a pregunta; y si el modelo contesta en vez de cambiar, es un ERROR que
//     se le devuelve para que lo corrija (el reintento de `generar`). Con las reglas de obedecer al pie de la letra.
//   · SIN ELEGIR (la API de MaKo, un cliente viejo): lo de antes (`esConsulta`).
//   · En los TRES, lo último de la charla viaja al modelo (`bloqueDeLaCharla`): sin eso, «como te dije» no existe.
// =============================================================================

export type IntencionChat = 'discutir' | 'editar';

/** Lo que llega del cliente: sólo esas dos palabras valen; lo demás es «sin elegir». */
export function intencionDe(raw: unknown): IntencionChat | null {
  return raw === 'discutir' || raw === 'editar' ? raw : null;
}

/** Las reglas de EDITAR (van en el `user`: un system guardado en /configuraciones no conoce bloques nuevos). */
export const REGLAS_EDITAR = [
  'MODO EDITAR — OBEDECE AL PIE DE LA LETRA:',
  '- Haz EXACTAMENTE lo que pide el dueño: ni más ni menos. No agregues tarjetas, casos, condiciones, etiquetas ni variables que no pidió.',
  '- Los textos que el dueño pega o pone entre comillas van TAL CUAL en las tarjetas, con sus palabras, signos y emojis. Una lista de mensajes es una tarjeta por mensaje, en ese orden.',
  '- «{Nombre}», «{nombre}» o «[Nombre]» es {{nombre}}. Cualquier otro dato entre llaves que no esté en la lista de datos NO se inventa: devuelve una "pregunta" diciendo qué va ahí.',
  '- No contestes con "respuesta": en este modo cambias el flujo, o preguntas lo que falta con "pregunta".',
].join('\n');

/** Las reglas de DISCUTIR (el prompt de explicar ya sólo puede devolver "respuesta"). */
export const REGLAS_DISCUTIR = [
  'MODO DISCUTIR — NO CAMBIES NADA:',
  '- El dueño quiere pensar contigo: contesta, sugiere qué cambiarías y por qué, y si pegó textos, comenta cómo quedarían en el flujo.',
  '- Si quiere que lo hagas, dile que toque «Editar» y lo pida.',
].join('\n');

/** El error que se le devuelve al modelo si en EDITAR contestó sin cambiar nada (lo corrige el reintento). */
export const ERROR_EDITAR_SIN_CAMBIOS = 'En modo EDITAR no se contesta con "respuesta": haz el cambio que pidió el dueño, tal cual, o devuelve una "pregunta" con lo que falta.';

/** Un mensaje del chat como lo lee este módulo (`MensajeChatMako`, lib/automatizacion-chat.ts). */
type MensajeCharla = { de: string; texto?: string | null };

/** Cuántos mensajes de la charla viajan, y cuánto de cada uno. */
export const MENSAJES_DE_LA_CHARLA = 6;
const TOPE_MENSAJE = 900;

/**
 * LO ÚLTIMO DE LA CHARLA, para que el modelo entienda «como te lo indiqué», «hazlo», «eso no»: los últimos
 * `MENSAJES_DE_LA_CHARLA` con quién los dijo. null si no hay nada que decir.
 */
export function bloqueDeLaCharla(historial: readonly MensajeCharla[] | null | undefined): string | null {
  const lineas = (historial ?? [])
    .filter((m) => (m.de === 'yo' || m.de === 'mako') && typeof m.texto === 'string' && m.texto.trim())
    .slice(-MENSAJES_DE_LA_CHARLA)
    .map((m) => `- ${m.de === 'yo' ? 'El dueño' : 'MaKo'}: ${m.texto!.trim().replace(/\s+/g, ' ').slice(0, TOPE_MENSAJE)}`);
  return lineas.length ? `LO ÚLTIMO DE ESTA CHARLA (para entender «como te dije», «hazlo», «eso no»):\n${lineas.join('\n')}` : null;
}

/** Lo que se le suma al `user` de editar o de explicar según la intención, y la charla. */
export function extrasDelUser(intencion: IntencionChat | null, historial: readonly MensajeCharla[] | null | undefined): string[] {
  const charla = bloqueDeLaCharla(historial);
  return [
    ...(charla ? [charla] : []),
    ...(intencion === 'editar' ? [REGLAS_EDITAR] : intencion === 'discutir' ? [REGLAS_DISCUTIR] : []),
  ];
}

/** ¿Va al prompt de explicar (sólo contesta)? Discutir siempre; editar nunca; sin elegir, lo que diga `esConsulta`. */
export function vaAExplicar(intencion: IntencionChat | null, conRespuestas: boolean, esConsulta: boolean): boolean {
  if (conRespuestas) return false;
  if (intencion === 'discutir') return true;
  if (intencion === 'editar') return false;
  return esConsulta;
}
