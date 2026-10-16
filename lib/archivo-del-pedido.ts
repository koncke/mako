// =============================================================================
// archivo-del-pedido — ¿el archivo que se adjunta al pedido de MaKo es CONTENIDO del flujo, o INSTRUCCIONES? (16/10/2026)
// =============================================================================
// Martín (por Cerebro, bug A2), con la captura de «Crea una automatización por Instagram dando este "Lead Magnet"…» y el
// lead magnet adjunto (mako-estrella (2).png): MaKo intentó LEERLO con visión («gemini high demand / openrouter
// unavailable») y se cayó todo. Textual: «Entiendo que aveces necesitamos leer porque hay instrucciones, pero otras como
// esta, son docs o cosas para DENTRO de la automatización... Debe razonar.»
//
// Hasta ese día el «+» de la caja leía TODO archivo apenas se elegía (`leerArchivoParaPedido`, una imagen por visión) y
// el pedido no se podía mandar si la lectura fallaba. Ahora:
//   · CONTENIDO (lo que el flujo le DA al lead: «dando este lead magnet», «mándales este PDF»): NO se lee. Se sube a la
//     biblioteca de archivos del negocio y el pedido lo nombra con su id (`pedidoConContenido`); `deIA` lo pone en el
//     mensaje que lo entrega (`archivoDelPedido`, lib/flujo-ia.ts).
//   · INSTRUCCIONES (lo que dice CÓMO armar el flujo: «seguí este proceso», «armalo como esta captura», o el archivo
//     solo): se lee como siempre. Si la lectura falla, la creación SIGUE: el pedido dice que no se pudo leer
//     (`pedidoSinLeer`), en vez de frenar la caja.
//
// ⚠️ LA DECISIÓN ES DEL CÓDIGO, NO DE UNA IA: el caso que la pidió fue justamente la IA caída. Se razona con lo que la
// persona escribió (el verbo de dar o mandar con el archivo como objeto, o las palabras de «seguí esto»), y ante la duda,
// instrucciones, que era lo de siempre.
//
// PURO: lo usan la caja (app/automations/ChatMako.tsx), `deIA` y tests/crear-ia-adjunto.test.ts.
// =============================================================================

export type UsoDelArchivo = 'contenido' | 'instrucciones';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo que nombra AL ARCHIVO como objeto: «este lead magnet», «el PDF», «la imagen», «el regalo». */
const OBJETO = String.raw`(?:este|esta|estos|estas|el|la|los|las|mi|nuestro|nuestra|ese|esa)\s+(?:archivo|adjunto|pdf|imagen|foto|video|lead\s*magnet|leadmagnet|regalo|recurso|material|ebook|e-book|guia|catalogo|brochure|plantilla|checklist|documento|presentacion|clase|descargable)`;
/** Dar o mandar: «dando», «darles», «mándales», «envíale», «entregar», «regalá», «compartí». */
const DAR = String.raw`(?:da(?:ndo|r|le|les|rle|rles|rselo|rselos|selo)?|entreg\w*|envi\w*|mand\w*|regal\w*|compart\w*|pas(?:a|ar|ale|ales|arle)\b)`;
/** Lo que sólo puede ser contenido aunque no haya verbo: «lead magnet», «descargable», «para que lo descargue». */
const SOLO_CONTENIDO = /\blead\s*magnet\b|\bleadmagnet\b|\bdescargable\b|\bpara que (?:lo|la|los|las) descargu/;
/** Lo que dice que el archivo explica CÓMO armar el flujo. */
const INSTRUCCIONES = new RegExp(String.raw`\b(?:segu[ií]r?|sigue|segun|como (?:dice|muestra|esta)|basad[oa]|a partir de|en base a|interpret\w*|replic\w*|copi(?:a|ar|alo|ala)\b|igual (?:a|que)|(?:lee|lea|leer|lee lo)\b|(?:este|esta|el|la) (?:flujo|proceso|guion|diagrama|esquema|captura|pantallazo|mapa|instructivo|paso a paso))`);

/**
 * ¿PARA QUÉ ES EL ARCHIVO? Contenido si lo escrito lo DA o lo MANDA («dando este lead magnet», «mándales el PDF») o
 * nombra algo que sólo es contenido («lead magnet»); instrucciones si dice que hay que seguirlo, o si no hay nada escrito
 * (el archivo ES el pedido). Ante la duda, instrucciones: lo de siempre.
 */
export function usoDelArchivo(escrito: string): UsoDelArchivo {
  const t = sinTildes(escrito ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return 'instrucciones';
  if (SOLO_CONTENIDO.test(t)) return 'contenido';
  if (new RegExp(String.raw`\b${DAR}\b[^.?!\n]{0,40}?\b${OBJETO}\b`).test(t)) return 'contenido';
  if (INSTRUCCIONES.test(t)) return 'instrucciones';
  return 'instrucciones';
}

/** La marca del pedido que lleva el archivo de contenido: la lee `archivoDelPedido` (sin depender del modelo). */
const MARCA = '📎 Archivo para mandar';

/** El pedido con el archivo de CONTENIDO ya en la biblioteca: lo escrito y la marca con su id. */
export function pedidoConContenido(escrito: string, archivo: { nombre: string; id: number }): string {
  const nombre = archivo.nombre.trim().slice(0, 80) || 'sin nombre';
  return `${escrito.trim()}\n\n${MARCA}: «${nombre}» (biblioteca #${archivo.id}). Va adjunto en el mensaje que se lo entrega al lead.`;
}

/** El id del archivo de contenido que nombra el pedido, o null. */
export function archivoDelPedido(pedido: string | null | undefined): number | null {
  const m = new RegExp(`${MARCA}: «[^»]*» \\(biblioteca #(\\d+)\\)`).exec(pedido ?? '');
  const id = m ? Number(m[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** El pedido cuando el archivo no se pudo leer (o subir): la creación sigue, y lo dice. */
export function pedidoSinLeer(escrito: string, nombre: string, que: 'leer' | 'subir' = 'leer'): string {
  const n = nombre.trim().slice(0, 80) || 'sin nombre';
  const base = escrito.trim() || 'Arma la automatización.';
  return `${base}\n\n(Adjuntó «${n}», pero no se pudo ${que}: ármala con lo escrito.)`;
}
