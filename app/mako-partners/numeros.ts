// =============================================================================
// Los números de MaKo Partners que se MUESTRAN (18/11/2026): el porcentaje, los US$, lo del mes y lo del año
// =============================================================================
// Puro y sin 'use client': lo usan la landing (componente del servidor), la calculadora (de cliente), «Tu plan», /planes y la API
// de MaKo (lib/api-mako/areas/negocio.*: lo que lee MaKo para contestar). Si
// viviera en Calculadora.tsx, el servidor no lo podría llamar (todo lo que exporta un archivo 'use client' es del cliente).
// Los porcentajes y la cuenta por pago son de lib/partners-reglas.ts (del chat de Cobros): acá no se escribe ninguno.
// =============================================================================

import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, comisionDelPago, type CanalDelPago } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';

export const MESES_DEL_ANIO = 12;

/** «30%», del número de la regla. */
export const porcentaje = (x: number): string => `${Math.round(x * 100)}%`;

/** El porcentaje de cada forma de pago, dicho. */
export const PORCENTAJE_DIRECTO = porcentaje(COMISION_PARTNER_DIRECTO);
export const PORCENTAJE_PASARELA = porcentaje(COMISION_PARTNER_PASARELA);

/** US$ con centavos sólo si los hay: «US$ 29,10», «US$ 1.746». */
export const usd = (n: number): string =>
  `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

const redondo = (n: number) => Math.round(n * 100) / 100;

/** Lo que le deja POR MES traer `n` negocios a un plan, según cómo pagan. */
export const gananciaPorMes = (n: number, precioUsd: number, canal: CanalDelPago): number =>
  redondo(Math.max(0, Math.floor(n)) * comisionDelPago(precioUsd, canal));

/** Lo de 12 meses: 12 veces lo del mes. */
export const gananciaEnUnAnio = (n: number, precioUsd: number, canal: CanalDelPago): number =>
  redondo(gananciaPorMes(n, precioUsd, canal) * MESES_DEL_ANIO);

// ── La regla dicha en una frase, para la API de MaKo (lo que lee MaKo para contestar, también en los grupos de WhatsApp) ────────
// El Cerebro, 18/11/2026: «Hoy le dice a cualquier cliente "el 100% del primer mes"… 30 % de cada pago; 25 % si los
// negocios pagan por pasarela; se paga del 1 al 5 de cada mes (eso lo está construyendo Cobros: dilo como regla, sin prometer la
// pantalla)». Los montos, de los planes y de la regla.

const planesDeLista = () => PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);

/** «US$ 29,10 por mes por cada MaKo Pro y US$ 14,10 por mes por cada MaKo Essential», según por dónde entra la plata. */
export const montosPorMes = (canal: CanalDelPago): string =>
  planesDeLista().map((p) => `${usd(comisionDelPago(p.precioUsd, canal))} por mes por cada ${p.nombre}`).join(' y ');

/** Lo que gana un partner, entero. */
export const REGLA_PARTNERS = `el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio nuevo que entra con su link o su código, todos los meses, mientras el negocio siga en MaKo, `
  + `si esos negocios pagan por Binance o transferencia bancaria (${montosPorMes('directo')}); el ${PORCENTAJE_PASARELA} si pagan por una `
  + `pasarela o un link de pago, como Mercado Pago, tarjeta o Whop (${montosPorMes('pasarela')})`;

/** Lo mismo, corto (para el resumen de una propuesta). */
export const REGLA_PARTNERS_CORTA = `el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que traiga, todos los meses, mientras siga en MaKo (el ${PORCENTAJE_PASARELA} si pagan por pasarela)`;

/** Cuándo se le paga: la regla (la pantalla que lo hace la está construyendo Cobros). */
export const CUANDO_SE_PAGA_PARTNERS = 'del 1 al 5 de cada mes, MaKo le transfiere lo que tiene a cobrar a la cuenta que dejó';
