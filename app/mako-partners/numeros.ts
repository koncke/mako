// =============================================================================
// Los números de MaKo Partners que se MUESTRAN (18/11/2026): el porcentaje, los US$, lo del mes y lo del año
// =============================================================================
// Puro y sin 'use client': lo usan la landing (componente del servidor), la calculadora (de cliente), «Tu plan», /planes y la API
// de MaKo (lib/api-mako/areas/negocio.*: lo que lee MaKo para contestar). Si viviera en Calculadora.tsx, el servidor no lo podría
// llamar (todo lo que exporta un archivo 'use client' es del cliente).
//
// EL PARTNER COBRA SIEMPRE EL 30% (18/11/2026, ~18:50 UTC, Martín dio vuelta el modelo: «al final toda la ingeniería estaría aquí
// dentro de la pasarela de pago y ya el usuario final elige»). Si el negocio paga por pasarela, a ÉL se le suma un recargo en el
// checkout: no sale del partner ni de MaKo. Por eso acá sólo se usa `COMISION_PARTNER_DIRECTO` (lib/partners-reglas.ts, del chat de
// Cobros), sin la forma de pago: la cuenta no depende de cómo pague el negocio.
// =============================================================================

import { COMISION_PARTNER_DIRECTO } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';

export const MESES_DEL_ANIO = 12;

/** «30%», del número de la regla. */
export const porcentaje = (x: number): string => `${Math.round(x * 100)}%`;

/** Lo que se lleva el partner, dicho. */
export const PORCENTAJE_DIRECTO = porcentaje(COMISION_PARTNER_DIRECTO);

/** US$ con centavos sólo si los hay: «US$ 29,10», «US$ 1.746». */
export const usd = (n: number): string =>
  `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

const redondo = (n: number) => Math.round(n * 100) / 100;

/** Lo que le deja al partner por mes UN negocio de un plan: el 30% de su precio, en centavos. */
export const comisionPorMes = (precioUsd: number): number => redondo(precioUsd * COMISION_PARTNER_DIRECTO);

/** Lo que le deja POR MES traer `n` negocios a un plan. */
export const gananciaPorMes = (n: number, precioUsd: number): number =>
  redondo(Math.max(0, Math.floor(n)) * comisionPorMes(precioUsd));

/** Lo de 12 meses: 12 veces lo del mes. */
export const gananciaEnUnAnio = (n: number, precioUsd: number): number =>
  redondo(gananciaPorMes(n, precioUsd) * MESES_DEL_ANIO);

// ── La regla dicha en una frase, para la API de MaKo (lo que lee MaKo para contestar, también en los grupos de WhatsApp) ────────
// El Cerebro, 18/11/2026: el 30% de cada pago, todos los meses, y se paga del 1 al 5 de cada mes (eso lo está construyendo Cobros:
// dilo como regla, sin prometer la pantalla). Los montos, de los planes y de la regla.

const planesDeLista = () => PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);

/** «US$ 29,10 por mes por cada MaKo Pro y US$ 14,10 por mes por cada MaKo Essential». */
export const montosPorMes = (): string =>
  planesDeLista().map((p) => `${usd(comisionPorMes(p.precioUsd))} por mes por cada ${p.nombre}`).join(' y ');

/** Lo que gana un partner, entero. */
export const REGLA_PARTNERS = `el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio nuevo que entra con su link o su código, todos los meses, mientras el negocio siga en MaKo (${montosPorMes()})`;

/** Lo mismo, corto (para el resumen de una propuesta). */
export const REGLA_PARTNERS_CORTA = `el ${PORCENTAJE_DIRECTO} de cada pago de cada negocio que traiga, todos los meses, mientras siga en MaKo`;

/** Cuándo se le paga: la regla (la pantalla que lo hace la está construyendo Cobros). */
export const CUANDO_SE_PAGA_PARTNERS = 'del 1 al 5 de cada mes, MaKo le transfiere lo que tiene a cobrar a la cuenta que dejó';
