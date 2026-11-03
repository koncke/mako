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

/** La línea que va adentro de un pegado recortado por el tope de la pantalla (`conPegadosHasta`). */
export const SIGUE_CORTADO = '[…sigue: no entró entero en este chat]';

/**
 * Lo mismo, con el TOPE de la pantalla (27/10/2026, la revisión del Cerebro): el Video Editor y el Image Editor cortaban lo
 * adjuntado a 2.000 caracteres, callados y sin la marca de cierre (partirPegados ya no lo encontraba, y MaKo trabajaba sobre
 * un pedazo como si fuera el documento). Lo escrito va entero; los pegados entran en orden hasta el tope, cada uno CON su marca
 * de cierre y la línea `SIGUE_CORTADO` si se recortó. Devuelve el mensaje y cuántos caracteres de lo pegado quedaron afuera
 * (0 = entró todo), para que la caja lo diga.
 */
export function conPegadosHasta(texto: string, pegados: readonly string[], tope: number): { mensaje: string; afuera: number } {
  const entero = conPegados(texto, pegados);
  if (entero.length <= tope) return { mensaje: entero, afuera: 0 };
  const limpios = pegados.map((p) => p.trim()).filter(Boolean);
  const total = limpios.reduce((n, p) => n + p.length, 0);
  let lugar = tope - conPegados(texto, []).length;
  const entran: string[] = [];
  for (const p of limpios) {
    // Lo que ocupa un pegado además de su texto: las dos marcas, los saltos y, si se recorta, la línea que lo dice.
    const marco = ABRE.length + CIERRA.length + 4 + 2;
    if (lugar - marco >= p.length) { entran.push(p); lugar -= marco + p.length; continue; }
    const cabe = lugar - marco - SIGUE_CORTADO.length - 1;
    if (cabe > 0) entran.push(`${p.slice(0, cabe).trimEnd()}\n${SIGUE_CORTADO}`);
    break;
  }
  const mensaje = conPegados(texto, entran);
  const dentro = entran.reduce((n, p) => n + p.replace(`\n${SIGUE_CORTADO}`, '').length, 0);
  return { mensaje, afuera: Math.max(0, total - dentro) };
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
/** El corte cuando el texto NO va a El Archivero (otra persona que el admin, el MaKo Analyst de un lead, o un negocio con
 *  su IA sin con qué archivar): se dice que se cortó, sin prometer lo que no pasa. */
export const AVISO_CORTE_SIN_ARCHIVO = '[…se cortó aquí por largo]';

/**
 * El corte del mensaje del turno, SIN romper las marcas. El turno cortaba el mensaje entero en 8.000 caracteres: con un
 * pegado largo se perdía la marca de cierre y el hilo mostraba el pegado crudo. Ahora lo escrito se corta en
 * `topeTexto` y los pegados comparten `topePegados`; el que se corta lo dice.
 * ⚠️ LO ESCRITO TAMBIÉN LO DICE (22/10/2026, la prueba de los chats): un mensaje tipeado o dictado de más del tope se
 *    cortaba CALLADO (`texto.slice`), y MaKo contestaba sin el final sin saber que faltaba. `archivado`: si lo que no
 *    entra queda entero en El Archivero (`textosParaArchivar`), el aviso lo dice; si no, sólo que se cortó.
 */
export function recortarMensaje(mensaje: string, topeTexto: number, topePegados = TOPE_PEGADOS_MENSAJE, archivado = true): string {
  const { texto, pegados } = partirPegados(mensaje);
  const aviso = archivado ? AVISO_CORTE_PEGADO : AVISO_CORTE_SIN_ARCHIVO;
  let queda = topePegados;
  const cortados = pegados.map((p) => {
    if (queda <= 0) return '';
    const parte = p.length <= queda ? p : `${p.slice(0, queda).trimEnd()}\n${aviso}`;
    queda -= p.length;
    return parte;
  }).filter(Boolean);
  return conPegados(texto.length <= topeTexto ? texto : `${texto.slice(0, topeTexto).trimEnd()}\n${aviso}`, cortados);
}

/** Lo que va ENTERO a El Archivero de un mensaje (#884): cada pegado y, si lo escrito no entra en `topeTexto`, lo escrito. */
export function textosParaArchivar(mensaje: string, topeTexto: number): string[] {
  const { texto, pegados } = partirPegados(mensaje);
  return texto.length > topeTexto ? [texto, ...pegados] : pegados;
}

/** «Texto pegado — Bueno entonces lo que vamos…»: el nombre del documento (en el hilo y en El Archivero). */
export function nombrePegado(p: string, max = 48): string {
  const primera = p.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return `Texto pegado — ${primera}${p.replace(/\s+/g, ' ').trim().length > max ? '…' : ''}`;
}

/**
 * Lo que la persona PIDE en un mensaje con texto pegado: lo que escribió, sin el material (ticket #44, 3/11/2026). El
 * clasificador leía el documento pegado como «material dictado» (títulos, listas) y «sumá este documento al second brain»
 * salía `capturar`, sin una sola herramienta. Lo pegado es DATO; el pedido es lo escrito. Un mensaje que es sólo un pegado
 * se clasifica entero, como siempre.
 */
export function pedidoDelMensaje(mensaje: string): string {
  const { texto, pegados } = partirPegados(mensaje);
  return pegados.length && texto ? texto : mensaje;
}

const LINEAS_DE_CORTE = [SIGUE_CORTADO, AVISO_CORTE_PEGADO, AVISO_CORTE_SIN_ARCHIVO];

/**
 * Un documento que el modelo copia del chat para guardarlo (`sumar_documento_second_brain`, ticket #44, 3/11/2026): sin
 * las marcas del pegado y sin la línea con que el chat dice que lo cortó. `cortado` lo dice: guardar como entero un
 * documento al que le falta el final es lo que no puede pasar (al de #44 le faltaba desde el punto 10).
 * `nombre`: el del archivo, si el texto empieza como lo arma el lector de adjuntos (`textoDelArchivo`, lib/chat-formatos.ts).
 * El texto NO se toca más que eso: su id sale del contenido, y el que el chat ya archivó solo tiene que dar el mismo.
 */
export function documentoDelChat(crudo: string): { texto: string; cortado: boolean; nombre: string | null } {
  let cortado = false;
  const lineas = crudo.split('\n').filter((l) => {
    const t = l.trim();
    if (t === ABRE || t === CIERRA) return false;
    if (LINEAS_DE_CORTE.some((c) => t.includes(c))) { cortado = true; return false; }
    return true;
  });
  const texto = lineas.join('\n').trim();
  const nombre = /^Archivo «([^»\n]{1,200})»:/.exec(texto)?.[1].trim() || null;
  return { texto, cortado, nombre };
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
