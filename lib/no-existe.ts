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

/** La regla que va en el system de TODO chat de MaKo (tests/mako-no-existe.test.ts lo exige en cada uno). */
export const REGLA_NO_EXISTE = [
  'LO QUE NO EXISTE EN MaKo SE DICE, NO SE INVENTA:',
  '- Nombra sólo funciones, bloques, botones, secciones, pestañas e integraciones que estén en lo que sabes de MaKo (tus herramientas, la referencia y lo que dice esta pantalla). Nunca armes un camino con nombres que no viste.',
  '- Si lo que pide no existe todavía, dilo en una frase («Eso todavía no existe en MaKo») y, si con lo que existe se puede acercar, di cómo. No prometas fechas.',
  '- Y termina tu respuesta con una línea aparte, exactamente así: [[no-existe: lo que pidió, en una frase y con sus palabras]]. El sistema se lo pasa solo al equipo de MaKo: no le pidas que lo reporte ni le propongas un ticket.',
].join('\n');

/** La misma regla para un chat que contesta en JSON: la marca va al final del TEXTO que lee la persona (ese campo). */
export const reglaNoExisteEn = (campo: string): string =>
  REGLA_NO_EXISTE.replace('Y termina tu respuesta con una línea aparte', `Y termina el texto de "${campo}" con una línea aparte`);

/** La marca: una o más líneas `[[no-existe: …]]` (con o sin guion, con espacios de más). */
const MARCA = /\[\[\s*no[\s-]*existe\s*:\s*([^\]\n]{3,300}?)\s*\]\]/giu;

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

/** La línea que escribe el CÓDIGO cuando el pedido ya está en la Ticketera (el número lo pone la base, no el modelo). */
export const lineaDelPedido = (id: number): string => `Se lo pasé al equipo de MaKo como pedido (#${id}).`;

/** La clave de idempotencia: el mismo pedido en el mismo chat del mismo negocio es UN ticket, aunque se repita. */
export function refDeNoExiste(ws: number, chat: string, falta: string): string {
  let h = 0;
  const norm = falta.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  for (const c of norm) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `no-existe:${ws}:${chat}:${(h >>> 0).toString(36)}`;
}
