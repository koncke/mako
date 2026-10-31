// =============================================================================
// oferta-entrada — el reloj del 50%, sostenido por el servidor (cookie firmada)
// =============================================================================
// La landing se sirve con caché, así que el reloj se pide aparte (/api/oferta-entrada). La primera visita fija CUÁNDO vence y lo firma
// en una cookie que dura un año: recargar sigue por donde iba, y vencida no vuelve a empezar. Tocar la cookie la invalida.
//
// ⚠️ EL INTERRUPTOR (`OFERTA_ENTRADA_ACTIVA=1`): apagado no hay cartel ni reloj. Se prende cuando el cobro hace el descuento: un 50%
//    prometido que después no se cobra sería peor que no prometerlo. El cobro pregunta con `ofertaVigente`.
// Sin `server-only`, para el test: sólo la importan rutas de server.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { OFERTA_ENTRADA, type EstadoOferta } from './oferta-entrada-reglas';

const firma = (vence: number, secreto: string): string =>
  createHmac('sha256', secreto).update(`oferta-entrada:${vence}`).digest('base64url');

export const firmarVencimiento = (vence: number, secreto: string): string => `${vence}.${firma(vence, secreto)}`;

/** Cuándo vence según la cookie, o null si no hay o la tocaron. */
export function leerVencimiento(cookie: string | null | undefined, secreto: string): number | null {
  const m = /^(\d{10,16})\.([\w-]+)$/.exec(cookie ?? '');
  if (!m) return null;
  const vence = Number(m[1]);
  const esperada = Buffer.from(firma(vence, secreto));
  const vino = Buffer.from(m[2]);
  return esperada.length === vino.length && timingSafeEqual(esperada, vino) ? vence : null;
}

/**
 * Lo que ve esta visita. `cookieNueva` sólo la primera vez: ahí arranca el reloj.
 * Sin secreto o apagada, no hay oferta, y nada arranca.
 */
export function abrirOferta(cookie: string | null | undefined, ahora: number, entorno: { prendida: boolean; secreto: string | undefined }): { estado: EstadoOferta; cookieNueva: string | null } {
  if (!entorno.prendida || !entorno.secreto) return { estado: { hay: false }, cookieNueva: null };
  const ya = leerVencimiento(cookie, entorno.secreto);
  const vence = ya ?? ahora + OFERTA_ENTRADA.minutos * 60_000;
  return {
    estado: vence > ahora ? { hay: true, restanteMs: vence - ahora } : { hay: false },
    cookieNueva: ya === null ? firmarVencimiento(vence, entorno.secreto) : null,
  };
}

/** Lo lee el cobro al arrancar el pago: ¿a esta persona le corresponde el descuento ahora? */
export function ofertaVigente(cookie: string | null | undefined, ahora: number, entorno: { prendida: boolean; secreto: string | undefined }): boolean {
  if (!entorno.prendida || !entorno.secreto) return false;
  const vence = leerVencimiento(cookie, entorno.secreto);
  return vence !== null && vence > ahora;
}

export const entornoOferta = (): { prendida: boolean; secreto: string | undefined } => ({
  prendida: process.env.OFERTA_ENTRADA_ACTIVA === '1',
  secreto: process.env.AUTH_SECRET,
});
