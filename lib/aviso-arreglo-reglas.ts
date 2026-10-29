// =============================================================================
// aviso-arreglo-reglas — el aviso «ya quedó arreglado» al grupo de MaKo de un cliente (puro)
// =============================================================================
// Pedido de Martín (17/10/2026, 09:36, por el Ops Center): «al terminar de solucionar algo que detectaste de un cliente
// … le envíes un mensaje al grupo de MaKo diciendo que se solucionó eso. Con una aclaración de que sos el
// "Desarrollador"». Cambia la regla vieja del vigía (nunca escribe en un grupo de cliente): ahora escribe, pero SÓLO
// para avisar que algo que le falló a ESE cliente ya está arreglado EN PRODUCCIÓN.
//
// Acá vive lo que decide si el aviso puede salir y cómo se ve; el envío es lib/aviso-arreglo.ts. PURO y sin
// `server-only`: lo usan esa lib, scripts/avisar-arreglo-al-grupo.mts y tests/aviso-arreglo.test.ts.
// =============================================================================

import { promesasDe, groseriasDe } from './doer-salida';

/** La firma que va arriba de todo aviso. Lo que la distingue de MaKo: no es la IA la que habla, es el equipo. */
export const FIRMA_DESARROLLADOR = '👨‍💻 *Desarrollador de MaKo*';
/** ¿El texto lleva la firma del equipo AL PRINCIPIO (así firma el equipo)? Con o sin los asteriscos (un copiado los saca). Una
 *  cita de la firma en el medio (el aviso de «respuesta al equipo» al grupo de SuperAdmin) no es un mensaje del equipo. */
export const esFirmaDelEquipo = (texto: string | null | undefined): boolean => /^\s*👨‍💻\s*\*?\s*Desarrollador de MaKo\b/u.test(texto ?? '');
/** El texto sin la firma del equipo (para citarlo en otro lado sin que su eco pase por un mensaje del equipo). */
export const sinFirmaDelEquipo = (texto: string): string => texto.replace(/👨‍💻\s*\*?\s*Desarrollador de MaKo\s*\*?\s*/gu, '').trim();

/** Cuántos avisos de arreglo por negocio en 24 horas. Un cliente al que le llegan cinco «ya quedó arreglado» en un día
 *  lee cinco cosas rotas: más que eso se junta en uno. */
export const TOPE_AVISOS_POR_DIA = 3;

/** El largo del texto, sin la firma: un aviso es corto (qué falló, que ya anda, cómo probarlo). */
export const TOPE_TEXTO_AVISO = 500;

/** Dónde queda el registro de cada aviso (app_settings del negocio): `<prefijo><clave>`. Es también el «no repetir». */
export const PREFIJO_REGISTRO_AVISO = 'mako.dev.aviso_arreglo.';

/** El negocio de Mauricio (OWNER_WS): un cliente, y el más viejo. Ahí no se avisa sin decirlo a propósito. */
export const WS_MAURICIO = 1;

/**
 * La clave que identifica UN arreglo para un negocio: el incidente del vigía («conv:12345»), el ticket («ticket:42») o el
 * commit («commit:618c79c4»). Un aviso por clave. Sólo letras, números y `:_.-`, hasta 80: va dentro de una key.
 */
export function claveDelAviso(clave: string): string | null {
  const c = (clave ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9:_.-]{2,79}$/.test(c) ? c : null;
}

export type TextoAviso = { ok: true; texto: string } | { ok: false; error: string };

/**
 * El texto que sale, con la firma arriba, o por qué no puede salir. NO corrige: rechaza. Un aviso al cliente lo escribe
 * una persona o el código, nunca se arregla a medias.
 *  · vacío o más largo que `TOPE_TEXTO_AVISO`;
 *  · con una grosería (la regla de la voz del grupo, lib/doer-salida.ts);
 *  · con una PROMESA («ya te lo arreglo», «déjame ver»): un aviso de arreglo dice lo que YA pasó.
 */
export function textoDelAviso(texto: string): TextoAviso {
  let t = (texto ?? '').trim();
  if (t.startsWith(FIRMA_DESARROLLADOR)) t = t.slice(FIRMA_DESARROLLADOR.length).trim();
  if (!t) return { ok: false, error: 'el aviso está vacío' };
  if (t.length > TOPE_TEXTO_AVISO) return { ok: false, error: `el aviso tiene ${t.length} caracteres (tope ${TOPE_TEXTO_AVISO})` };
  const gr = groseriasDe(t);
  if (gr.length) return { ok: false, error: `el aviso tiene una grosería: ${gr.join(', ')}` };
  const pr = promesasDe(t);
  if (pr.length) return { ok: false, error: `el aviso promete algo (${pr.join(', ')}): tiene que decir lo que ya quedó arreglado` };
  return { ok: true, texto: `${FIRMA_DESARROLLADOR}\n${t}` };
}

/** ¿Se puede avisar en este negocio? El ws de Mauricio sólo con `ws1Seguro`. Devuelve el motivo, o null. */
export function bloqueoDelWs(ws: number, ws1Seguro: boolean): string | null {
  if (!Number.isInteger(ws) || ws <= 0) return 'el negocio no es válido';
  if (ws === WS_MAURICIO && !ws1Seguro) return 'el ws1 es de Mauricio: sólo con --ws1-seguro, después de mirar que el arreglo es suyo';
  return null;
}

/** Cuántos avisos salieron (o se están mandando) en las últimas 24 horas, de las filas del registro del negocio. */
export function avisosDelDia(filas: ReadonlyArray<{ key: string; updated_at: string }>, ahora: number): number {
  const desde = ahora - 24 * 3600_000;
  return filas.filter((f) => f.key.startsWith(PREFIJO_REGISTRO_AVISO) && Date.parse(f.updated_at) >= desde).length;
}
