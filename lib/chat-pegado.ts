// =============================================================================
// chat-pegado — un texto LARGO pegado en el chat de MaKo es un documento, no un mazacote (17/10/2026)
// =============================================================================
// Tarjetas de las llamadas del 16/10 (Martín):
//   #848: pegar una transcripción larga en el chat del Second Brain rompía la pantalla. Reproducido con 400 líneas: la
//         página no se desborda a lo ancho, pero la burbuja medía 24.474 px de alto — el chat ENTERO pasaba a ser el
//         pegado. Se acota: el pegado largo va como documento y la burbuja larga se pliega (app/_chat/PegadoHilo.tsx).
//   #864: un texto pegado de más de 1.000 caracteres se ve como un documento adjunto, como en Claude.
//   #884: lo que se pega queda guardado solo en el Second Brain (El Archivero), sin pedirlo.
//
// CÓMO VIAJA: el pegado no es un archivo (los adjuntos del chat son fotos y PDF validados por sus bytes,
// lib/mako-adjuntos.ts); va DENTRO del mensaje, entre dos marcas que el modelo entiende y que el hilo sabe partir. Así
// se guarda en el hilo como siempre, se relee igual al volver, y el servidor lo encuentra para archivarlo.
//
// PURO: lo usan la caja (escritorio y teléfono), el hilo (los dos) y el turno (lib/mako-turno-app.ts). Lo prueba
// tests/chat-pegado.test.ts.
// =============================================================================

/** Desde cuántos caracteres un pegado deja de ir a la caja y pasa a ser un documento (lo que hace Claude). */
export const TOPE_PEGADO = 1000;
/** Desde cuántos caracteres (o renglones) una burbuja se pliega con «Ver todo». */
export const TOPE_BURBUJA = 1200;
export const RENGLONES_BURBUJA = 14;

const ABRE = '[[texto pegado]]';
const CIERRA = '[[/texto pegado]]';

/** ¿Este pegado va como documento? */
export const esPegadoLargo = (t: string): boolean => t.trim().length > TOPE_PEGADO;

/** El mensaje que sale: lo escrito, y cada pegado entre sus marcas. */
export function conPegados(texto: string, pegados: readonly string[]): string {
  const partes = [texto.trim(), ...pegados.map((p) => p.trim()).filter(Boolean).map((p) => `${ABRE}\n${p}\n${CIERRA}`)];
  return partes.filter(Boolean).join('\n\n');
}

/** Al revés, para dibujarlo y para archivarlo: lo escrito y los pegados. Un mensaje sin marcas es todo «texto». */
export function partirPegados(mensaje: string): { texto: string; pegados: string[] } {
  const pegados: string[] = [];
  let resto = '';
  let i = 0;
  for (;;) {
    const a = mensaje.indexOf(ABRE, i);
    if (a < 0) { resto += mensaje.slice(i); break; }
    const c = mensaje.indexOf(CIERRA, a + ABRE.length);
    if (c < 0) { resto += mensaje.slice(i); break; }   // una marca sin cerrar no es un pegado: va como texto
    resto += mensaje.slice(i, a);
    pegados.push(mensaje.slice(a + ABRE.length, c).trim());
    i = c + CIERRA.length;
  }
  return { texto: resto.replace(/\n{3,}/g, '\n\n').trim(), pegados: pegados.filter(Boolean) };
}

/** Lo que entra de un pegado en el MENSAJE (lo que lee el modelo y queda en el hilo). El texto entero va a El Archivero
 *  (#884): mandarlo completo en cada turno —el historial viaja con los últimos 12 mensajes— sería pagarlo doce veces. */
export const TOPE_PEGADOS_MENSAJE = 12_000;
export const AVISO_CORTE_PEGADO = '[…se cortó aquí por largo: el texto entero quedó en El Archivero]';

/**
 * El corte del mensaje del turno, SIN romper las marcas. El turno cortaba el mensaje entero en 8.000 caracteres: con un
 * pegado largo se perdía la marca de cierre y el hilo mostraba el pegado crudo. Ahora lo escrito se corta en
 * `topeTexto` y los pegados comparten `topePegados`; el que se corta lo dice.
 */
export function recortarMensaje(mensaje: string, topeTexto: number, topePegados = TOPE_PEGADOS_MENSAJE): string {
  const { texto, pegados } = partirPegados(mensaje);
  let queda = topePegados;
  const cortados = pegados.map((p) => {
    if (queda <= 0) return '';
    const parte = p.length <= queda ? p : `${p.slice(0, queda).trimEnd()}\n${AVISO_CORTE_PEGADO}`;
    queda -= p.length;
    return parte;
  }).filter(Boolean);
  return conPegados(texto.slice(0, topeTexto), cortados);
}

/** «Texto pegado — Bueno entonces lo que vamos…»: el nombre del documento (en el hilo y en El Archivero). */
export function nombrePegado(p: string, max = 48): string {
  const primera = p.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return `Texto pegado — ${primera}${p.replace(/\s+/g, ' ').trim().length > max ? '…' : ''}`;
}

/** ¿Esta burbuja se pliega? Muy larga, o con muchos renglones. */
export const esBurbujaLarga = (t: string): boolean => t.length > TOPE_BURBUJA || t.split('\n').length > RENGLONES_BURBUJA;

/** «12.345 caracteres», con el punto de miles a mano (`toLocaleString('es')` no agrupa cuatro cifras). */
export const caracteres = (p: string): string => `${String(p.length).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} caracteres`;

/** Lo que titula un chat nuevo: lo escrito, o el nombre del primer pegado si el mensaje es sólo eso (nunca las marcas). */
export function textoParaTitulo(mensaje: string): string {
  const { texto, pegados } = partirPegados(mensaje);
  return texto || (pegados[0] ? nombrePegado(pegados[0]) : '');
}
