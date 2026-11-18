// =============================================================================
// Los números de MaKo Partners que se MUESTRAN (18/11/2026): el porcentaje, los US$, lo del mes y lo del año
// =============================================================================
// Puro y sin 'use client': lo usan la landing (componente del servidor), la calculadora (de cliente), «Tu plan» y /planes. Si
// viviera en Calculadora.tsx, el servidor no lo podría llamar (todo lo que exporta un archivo 'use client' es del cliente).
// Los porcentajes y la cuenta por pago son de lib/partners-reglas.ts (del chat de Cobros): acá no se escribe ninguno.
// =============================================================================

import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, comisionDelPago, type CanalDelPago } from '@/lib/partners-reglas';

export const MESES_DEL_ANIO = 12;

/** «30%», del número de la regla. */
export const porcentaje = (x: number): string => `${Math.round(x * 100)}%`;

/** El porcentaje de cada forma de pago, dicho. */
export const PORCENTAJE_DIRECTO = porcentaje(COMISION_PARTNER_DIRECTO);
export const PORCENTAJE_PASARELA = porcentaje(COMISION_PARTNER_PASARELA);

/** Las dos formas de pago, con su porcentaje. La primera es la de arranque de la calculadora. */
export const CANALES: ReadonlyArray<{ id: CanalDelPago; texto: string }> = [
  { id: 'directo', texto: `Binance o transferencia (${PORCENTAJE_DIRECTO})` },
  { id: 'pasarela', texto: `Pasarela de pago (${PORCENTAJE_PASARELA})` },
];

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
