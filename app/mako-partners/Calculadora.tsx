'use client';

// =============================================================================
// Calculadora — «¿cuánto te llevas?», el bloque azul del hero de MaKo Partners (24/10/2026; sólo el azul, 25/10/2026;
// el 30% de por vida, 18/11/2026)
// =============================================================================
// Martín (24/10): «Falta algo como "Calculadora" para que calculen cuanto podrían ganar si refieren a X personas». Y el
// 25/10: «La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul». Por eso es UN bloque: la barra de
// cuántos negocios traes y el resultado, todo adentro del azul, a la derecha del título.
//
// EL PROGRAMA NUEVO (18/11/2026, Martín por el Cerebro: «Me gusta la misma… solamente calculado a esto»): el partner se lleva
// un porcentaje de CADA pago de cada negocio que trae, todos los meses, para siempre. El porcentaje depende de por dónde entra
// la plata (`COMISION_PARTNER_DIRECTO`: Binance o transferencia; `COMISION_PARTNER_PASARELA`: pasarela o link de pago), y la
// cuenta la hace `comisionDelPago` (lib/partners-reglas.ts, del chat de Cobros): acá no se escribe ningún número a mano. El
// resultado grande es lo que le deja CADA MES; abajo, lo de 12 meses. Ni una tasa de conversión inventada. Sin JavaScript se
// lee con el valor de arranque (5 negocios en el plan más caro, cobrando directo).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { PORCENTAJE_PASARELA, gananciaEnUnAnio, gananciaPorMes, usd } from './numeros';

export type PlanCalculadora = { id: string; nombre: string; precioUsd: number };

export const MAX_NEGOCIOS = 50;
export const NEGOCIOS_DE_ARRANQUE = 5;

export function Calculadora({ planes, children }: {
  /** Los planes que puede elegir un referido, del más caro al más barato: la cuenta va con el primero. */
  planes: readonly PlanCalculadora[];
  /** La acción de abajo del resultado (hacerse partner), que la arma la página. */
  children?: ReactNode;
}) {
  const [n, setN] = useState(NEGOCIOS_DE_ARRANQUE);
  const plan = planes[0];
  if (!plan) return null;
  return (
    <div className="mp-calc" id="calculadora" aria-label="Calculadora de lo que ganas">
      <div className="mp-calc-fila">
        <label htmlFor="mp-calc-n">¿Cuántos negocios traes?</label>
        <output htmlFor="mp-calc-n" className="mp-calc-n">{n}</output>
      </div>
      <input id="mp-calc-n" className="mp-calc-barra" type="range" min={1} max={MAX_NEGOCIOS} step={1} value={n}
        onChange={(e) => setN(Number(e.currentTarget.value))}
        style={{ ['--mp-lleno' as string]: `${((n - 1) / (MAX_NEGOCIOS - 1)) * 100}%` }} />
      <div className="mp-calc-res" aria-live="polite">
        <div className="mp-calc-monto">{usd(gananciaPorMes(n, plan.precioUsd, 'directo'))} <span>al mes</span></div>
        <div className="mp-calc-anio">{usd(gananciaEnUnAnio(n, plan.precioUsd, 'directo'))} en un año, con {plan.nombre}</div>
      </div>
      <p className="mp-calc-pasarela">
        Si pagan por pasarela de pago, te llevas el {PORCENTAJE_PASARELA}: {usd(gananciaPorMes(n, plan.precioUsd, 'pasarela'))} al mes.
      </p>
      {children}
    </div>
  );
}
