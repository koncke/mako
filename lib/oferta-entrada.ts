// =============================================================================
// oferta-entrada — el reloj del 50% del primer mes, de verdad y del lado del servidor (30/10/2026)
// =============================================================================
// docs/estrategia-lanzamiento-low-to-high.md §3: un cartel con un reloj de 5 a 10 minutos. El cartel lo dibuja la landing; esto
// es lo que hace que el reloj sea cierto: un token firmado con la hora en que arrancó, que la landing pasa en `?oferta=` hasta
// /planes/<plan>, y que el checkout mira antes de dar el descuento. Sin esto el reloj sería un adorno: al llegar a cero, el
// mismo descuento seguiría ahí.
//
// ⚠️ QUÉ PASA AL VOLVER (Martín lo dejó abierto: §7, «si el reloj del 50% se reinicia»; el Cerebro: «que no reaparezca infinitas
// veces»). Lo elegido, y si Martín quiere otra cosa se cambia acá:
//   · el reloj NO se reinicia: quien vuelve con su token ve el mismo reloj, vencido si venció. Vuelve a poder arrancar a los
//     `DIAS_SIN_REPETIR` días, un cartel nuevo para alguien que ya se olvidó;
//   · la landing guarda el token en el navegador, así que otro navegador arranca otro reloj. Lo que cierra ese agujero es el
//     EMAIL: un descuento por email (`puedeUsarOferta`, lib/compra-plan.ts). Quien abandona a mitad del pago conserva su link y
//     puede rearmar el pago por 24 h con el mismo email; después, precio normal;
//   · los `MINUTOS_DE_GRACIA`: quien tocó el botón con el reloj en 0:30 no pierde el descuento por llenar el formulario. La gracia
//     nunca se muestra.
//
// ⚠️ SIN `server-only`, a propósito: la regla es lo que hay que poder testear; lo que lo mantiene fuera del navegador es el
// `node:crypto`, como lib/curso-acceso.ts. Con su propio prefijo de firma: ninguna otra firma de la casa sirve como ésta.
// =============================================================================

import crypto from 'node:crypto';
import { DESCUENTO_PRIMER_MES_PCT } from './planes-mako';

export const MINUTOS_OFERTA = 10;
export const MINUTOS_DE_GRACIA = 15;
export const DIAS_SIN_REPETIR = 30;

const MIN_MS = 60_000;
const DIA_MS = 86_400_000;
const PREFIJO = 'o1';
const firmar = (cuerpo: string, secreto: string) => crypto.createHmac('sha256', secreto).update(`oferta-entrada:${cuerpo}`).digest('base64url');

/** El token de un reloj que arranca en `desdeMs`. null sin secreto configurado (nunca se firma con un secreto vacío). */
export function firmarOferta(desdeMs: number, secreto: string | null | undefined = process.env.AUTH_SECRET): string | null {
  if (!secreto?.trim() || !Number.isSafeInteger(desdeMs) || desdeMs <= 0) return null;
  const cuerpo = String(desdeMs);
  return `${PREFIJO}.${cuerpo}.${firmar(cuerpo, secreto)}`;
}

/** Cuándo arrancó ese reloj, si la firma es buena. Nunca tira. */
export function leerOferta(token: string | null | undefined, secreto: string | null | undefined = process.env.AUTH_SECRET): number | null {
  if (!token || !secreto?.trim() || token.length > 120) return null;
  const p = token.split('.');
  if (p.length !== 3 || p[0] !== PREFIJO || !/^\d{1,16}$/.test(p[1])) return null;
  const esperada = Buffer.from(firmar(p[1], secreto));
  const dada = Buffer.from(p[2]);
  if (esperada.length !== dada.length || !crypto.timingSafeEqual(esperada, dada)) return null;
  const desde = Number(p[1]);
  return Number.isSafeInteger(desde) ? desde : null;
}

export type EstadoOferta = { desdeMs: number; hastaMs: number; vigente: boolean; aceptable: boolean };

/** En qué está ese reloj. null = no es un token nuestro, o arranca en el futuro. */
export function estadoDeOferta(token: string | null | undefined, ahoraMs: number = Date.now(), secreto: string | null | undefined = process.env.AUTH_SECRET): EstadoOferta | null {
  const desdeMs = leerOferta(token, secreto);
  if (desdeMs == null || desdeMs > ahoraMs + MIN_MS) return null;
  const hastaMs = desdeMs + MINUTOS_OFERTA * MIN_MS;
  return { desdeMs, hastaMs, vigente: ahoraMs <= hastaMs, aceptable: ahoraMs <= hastaMs + MINUTOS_DE_GRACIA * MIN_MS };
}

/**
 * Lo que la landing pide para dibujar el cartel. Con un token suyo de menos de `DIAS_SIN_REPETIR` días, ESE reloj (vencido si
 * venció: no se regala de nuevo). Si no, uno nuevo. null = sin secreto: la landing no dibuja el cartel.
 */
export function ofertaParaLaLanding(tokenGuardado: string | null | undefined, ahoraMs: number = Date.now(), secreto: string | null | undefined = process.env.AUTH_SECRET): {
  token: string; hastaMs: number; vigente: boolean; pct: number;
} | null {
  const previa = estadoDeOferta(tokenGuardado, ahoraMs, secreto);
  if (previa && ahoraMs - previa.desdeMs < DIAS_SIN_REPETIR * DIA_MS) {
    return { token: tokenGuardado as string, hastaMs: previa.hastaMs, vigente: previa.vigente, pct: DESCUENTO_PRIMER_MES_PCT };
  }
  const token = firmarOferta(ahoraMs, secreto);
  return token ? { token, hastaMs: ahoraMs + MINUTOS_OFERTA * MIN_MS, vigente: true, pct: DESCUENTO_PRIMER_MES_PCT } : null;
}
