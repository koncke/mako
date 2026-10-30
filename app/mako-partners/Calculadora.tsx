'use client';

// =============================================================================
// Calculadora — «¿cuánto te llevas?», el bloque azul del hero de MaKo Partners (24/10/2026; sólo el azul, 25/10/2026)
// =============================================================================
// Martín (24/10): «Falta algo como "Calculadora" para que calculen cuanto podrían ganar si refieren a X personas». Y el
// 25/10: «La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul». Por eso es UN bloque: la barra de
// cuántos negocios traes, el plan que eligen y el resultado, todo adentro del azul, a la derecha del título (donde estaba la
// ficha «Si se suscribe»). El resultado grande es lo que se lleva: n veces el 100% del primer mes, a precio de lista
// (`gananciaDelReferido`). Ni una tasa de conversión inventada. Sin JavaScript se lee con el valor de arranque (5 negocios
// en el plan más caro).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { gananciaDelReferido } from '@/lib/partners-reglas';

export type PlanCalculadora = { id: string; nombre: string; precioUsd: number };

export const MAX_NEGOCIOS = 50;
export const NEGOCIOS_DE_ARRANQUE = 5;

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/** Lo que se lleva por traer `n` negocios a un plan: `n` veces su primer mes entero. Puro (lo prueba el test). */
export const gananciaPorNegocios = (n: number, precioUsd: number): number =>
  Math.round(Math.max(0, Math.floor(n)) * gananciaDelReferido(precioUsd) * 100) / 100;

export function Calculadora({ planes, children }: {
  /** Los planes que puede elegir un referido, del más caro al más barato. */
  planes: readonly PlanCalculadora[];
  /** La acción de abajo del resultado (hacerse partner), que la arma la página. */
  children?: ReactNode;
}) {
  const [n, setN] = useState(NEGOCIOS_DE_ARRANQUE);
  const [planId, setPlanId] = useState(planes[0]?.id ?? '');
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  if (!plan) return null;
  const total = gananciaPorNegocios(n, plan.precioUsd);
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
      <div className="mp-calc-res" aria-live="polite">
        <div className="mp-calc-res-etq">Te llevas</div>
        <div className="mp-calc-res-monto">{usd(total)}</div>
        <div className="mp-calc-res-cuenta">
          {n} {n === 1 ? 'negocio' : 'negocios'} × {usd(gananciaDelReferido(plan.precioUsd))}: el primer mes entero de {n === 1 ? 'su' : 'cada'} {plan.nombre}
        </div>
      </div>
      {children}
    </div>
  );
}
