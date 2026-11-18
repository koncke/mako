'use client';

// =============================================================================
// Calculadora — «¿cuánto te llevas?», el bloque azul del hero de MaKo Partners (24/10/2026; sólo el azul, 25/10/2026;
// el 30% de por vida, 18/11/2026)
// =============================================================================
// Martín (24/10): «Falta algo como "Calculadora" para que calculen cuanto podrían ganar si refieren a X personas». Y el
// 25/10: «La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul». Por eso es UN bloque: la barra de
// cuántos negocios traes, el plan que eligen, cómo pagan y el resultado, todo adentro del azul, a la derecha del título.
//
// EL PROGRAMA NUEVO (18/11/2026, Martín por el Cerebro: «Me gusta la misma… solamente calculado a esto»): el partner se lleva
// un porcentaje de CADA pago de cada negocio que trae, todos los meses, para siempre. El porcentaje depende de por dónde entra
// la plata (`COMISION_PARTNER_DIRECTO`: Binance o transferencia; `COMISION_PARTNER_PASARELA`: pasarela o link de pago), y la
// cuenta la hace `comisionDelPago` (lib/partners-reglas.ts, del chat de Cobros): acá no se escribe ningún número a mano. El
// resultado grande es lo que le deja CADA MES; abajo, lo de 12 meses. Ni una tasa de conversión inventada. Sin JavaScript se
// lee con el valor de arranque (5 negocios en el plan más caro, cobrando directo).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, comisionDelPago, type CanalDelPago } from '@/lib/partners-reglas';
import { CANALES, MESES_DEL_ANIO, gananciaEnUnAnio, gananciaPorMes, porcentaje, usd } from './numeros';

export type PlanCalculadora = { id: string; nombre: string; precioUsd: number };

export const MAX_NEGOCIOS = 50;
export const NEGOCIOS_DE_ARRANQUE = 5;

export function Calculadora({ planes, children }: {
  /** Los planes que puede elegir un referido, del más caro al más barato. */
  planes: readonly PlanCalculadora[];
  /** La acción de abajo del resultado (hacerse partner), que la arma la página. */
  children?: ReactNode;
}) {
  const [n, setN] = useState(NEGOCIOS_DE_ARRANQUE);
  const [planId, setPlanId] = useState(planes[0]?.id ?? '');
  const [canal, setCanal] = useState<CanalDelPago>(CANALES[0].id);
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  if (!plan) return null;
  const porMes = gananciaPorMes(n, plan.precioUsd, canal);
  const parte = canal === 'directo' ? COMISION_PARTNER_DIRECTO : COMISION_PARTNER_PASARELA;
  return (
    <div className="mp-calc" id="calculadora" aria-label="Calculadora de lo que ganas">
      <div className="mp-calc-etq">Calcula lo que te llevas</div>
      <div className="mp-calc-fila">
        <label htmlFor="mp-calc-n">Negocios que traes</label>
        <output htmlFor="mp-calc-n" className="mp-calc-n">{n}</output>
      </div>
      <input id="mp-calc-n" className="mp-calc-barra" type="range" min={1} max={MAX_NEGOCIOS} step={1} value={n}
        onChange={(e) => setN(Number(e.currentTarget.value))}
        style={{ ['--mp-lleno' as string]: `${((n - 1) / (MAX_NEGOCIOS - 1)) * 100}%` }} />
      <div className="mp-calc-planes" role="radiogroup" aria-label="El plan que eligen">
        {planes.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === plan.id}
            className={`mp-calc-plan${p.id === plan.id ? ' activo' : ''}`} onClick={() => setPlanId(p.id)}>
            {p.nombre} · {usd(p.precioUsd)}
          </button>
        ))}
      </div>
      <div className="mp-calc-sub" id="mp-calc-canal">Cómo te pagan los negocios</div>
      <div className="mp-calc-planes" role="radiogroup" aria-labelledby="mp-calc-canal">
        {CANALES.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === canal}
            className={`mp-calc-plan${c.id === canal ? ' activo' : ''}`} onClick={() => setCanal(c.id)}>
            {c.texto}
          </button>
        ))}
      </div>
      <div className="mp-calc-res" aria-live="polite">
        <div className="mp-calc-res-etq">Te llevas cada mes</div>
        <div className="mp-calc-res-monto">{usd(porMes)}</div>
        <div className="mp-calc-res-anio">En {MESES_DEL_ANIO} meses: <b>{usd(gananciaEnUnAnio(n, plan.precioUsd, canal))}</b></div>
        <div className="mp-calc-res-cuenta">
          {n} {n === 1 ? 'negocio' : 'negocios'} × {usd(comisionDelPago(plan.precioUsd, canal))}: el {porcentaje(parte)} de {n === 1 ? 'su' : 'cada'} {plan.nombre}, todos los meses
        </div>
      </div>
      {children}
    </div>
  );
}
