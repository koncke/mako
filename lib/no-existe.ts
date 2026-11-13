// =============================================================================
// no-existe — lo que la persona pide y MaKo todavía NO tiene: se dice, no se inventa, y el ticket sale solo (27/10/2026)
// =============================================================================
// Ticket 874749710-14 de Leandro: MaKo le inventó «un bloque de Instagram con tope de comentarios» que no existe, y el
// pedido no le llegó a nadie. Automations ya lo frenaba con `lugarInventado` (lib/flujo-ia-intencion.ts) y un botón
// («Pedírselo al equipo», app/automations/PedirAlEquipo.tsx); los demás chats de MaKo, nada. El criterio, el MISMO en todos:
//   · el modelo nombra sólo lo que está en lo que sabe de MaKo; lo que no existe lo dice en una frase (`REGLA_NO_EXISTE`);
//   · y lo marca con UNA línea `[[no-existe: …]]`. El CÓDIGO la saca del texto (`sacarNoExiste`), levanta el pedido en la
//     Ticketera sin preguntar (lib/no-existe-server.ts) y escribe él la línea que lo dice (`lineaDelPedido`): el modelo no
//     promete ni inventa un número de ticket.
// Es el mismo criterio que el de WhatsApp (mako-wa-conexiones, P3): allá lo que FALLA se propone como ticket; acá lo que NO
// EXISTE sale solo, porque no hay nada que confirmar.
//
// PURO y sin `server-only`: lo usan los chats, lib/no-existe-server.ts y tests/mako-no-existe.test.ts.
// =============================================================================

import { REGLA_NO_PUDE, lineaDelTicket } from './no-pude';

/**
 * La regla que va en el system de TODO chat de MaKo (tests/mako-no-existe.test.ts lo exige en cada uno). Desde el 27/10/2026
 * lleva adentro la de lo que MaKo no pudo (`REGLA_NO_PUDE`, lib/no-pude.ts): así llega a todos los chats que ya la tenían.
 */
export const REGLA_NO_EXISTE = [
  'LO QUE NO EXISTE EN MaKo SE DICE, NO SE INVENTA:',
  '- Nombra sólo funciones, bloques, botones, secciones, pestañas e integraciones que estén en lo que sabes de MaKo (tus herramientas, la referencia y lo que dice esta pantalla). Nunca armes un camino con nombres que no viste.',
  '- Si lo que pide no existe todavía, dilo en una frase («Eso todavía no existe en MaKo») y, si con lo que existe se puede acercar, di cómo. No prometas fechas.',
  '- Y termina tu respuesta con una línea aparte, exactamente así: [[no-existe: lo que pidió, en una frase y con sus palabras]]. El sistema se lo pasa solo al equipo de MaKo: no le pidas que lo reporte ni le propongas un ticket.',
].join('\n') + `\n${REGLA_NO_PUDE}`;

/** La misma regla para un chat que contesta en JSON: las marcas van al final del TEXTO que lee la persona (ese campo). */
export const reglaNoExisteEn = (campo: string): string =>
  REGLA_NO_EXISTE.replace(/([Yy]) termina tu respuesta con una línea aparte/g, (_m, y: string) => `${y} termina el texto de "${campo}" con una línea aparte`);

/**
 * MaKo NUNCA descalifica lo que le piden (27/10/2026, la crítica de Leila): a «¿tenemos registro de cumpleaños de los
 * clientes activos?» contestó «eso es una distracción total». La frase no está en el código: sale de la persona («honestidad
 * radical», «el orden importa más que las tácticas», lib/mako-persona.ts), que es editable y la guardada le gana al default.
 * Por eso va FIJA en el system que arma lib/mako-context.ts (`buildSystemPrompt`, también en el modo lean), después de la
 * persona y del núcleo: ninguna versión guardada la saca. Lo que no existe sigue el camino de `REGLA_NO_EXISTE`.
 */
export const REGLA_NO_DESCALIFICAR = [
  'NUNCA DESCALIFIQUES LO QUE TE PIDEN (regla fija, por encima de tu voz):',
  '- Lo que la persona pregunta o pide le importa. Nunca lo llames distracción, pérdida de tiempo, irrelevante ni vanidad, ni le digas que «no importa» o que «no es prioridad» en vez de contestar.',
  '- Primero contesta lo que preguntó: si el dato está, dalo; si todavía no existe en MaKo, dilo y propón cómo hacerlo con lo que hay.',
  '- Si ves algo más urgente para el negocio, súmalo DESPUÉS, como sugerencia, sin restarle valor a lo que pidió.',
].join('\n');

/** ¿La respuesta descalifica el pedido? (las formas de «eso es una distracción»). Para medir la regla contra el modelo real. */
const DESCALIFICA = /\b(?:distracci[oó]n(?:es)?|p[eé]rdida de tiempo|perder el tiempo|irrelevante|no (?:te )?importa|no (?:es|son) (?:una )?prioridad|no (?:es|son) (?:importante|relevante)s?|no vale la pena)\b/iu;
export const descalificaElPedido = (texto: string): boolean => DESCALIFICA.test(String(texto ?? ''));

/** La marca: una o más líneas `[[no-existe: …]]` (con o sin guion, con espacios de más, y larga o en varias líneas: con el tope de 300 sin saltos, la larga le llegaba al cliente; ver lib/no-pude.ts). */
const MARCA = /\[\[\s*no[\s-]*existe\s*:\s*([^\]]{3,4000}?)\s*\]\]/giu;

/**
 * El texto SIN la marca (nunca le llega a la persona) y lo que pidió (la primera marca), o null si no hay ninguna. Una marca
 * vacía o de menos de tres letras no es un pedido.
 */
export function sacarNoExiste(texto: string): { texto: string; falta: string | null } {
  let falta: string | null = null;
  const limpio = String(texto ?? '')
    .replace(MARCA, (_m, f: string) => {
      const pedido = f.replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!falta && pedido.length >= 3) falta = pedido;
      return '';
    })
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { texto: limpio, falta };
}

/** La línea que escribe el CÓDIGO cuando el pedido ya está en la Ticketera (el número lo pone la base, no el modelo). Es la
 *  de todo ticket automático (lib/no-pude.ts): «Quedó el ticket #N para el equipo de MaKo.» */
export const lineaDelPedido = lineaDelTicket;

