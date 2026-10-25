'use client';

// =============================================================================
// Calculadora — «¿cuánto sumarías?» en la página de MaKo Partners (24/10/2026)
// =============================================================================
// Martín (24/10): «Falta algo como "Calculadora" para que calculen cuanto podrían ganar si refieren a X personas». Copiada
// de la de LLM Pulse (llmpulse.ai/affiliate, mirada el 24/10): a la izquierda la barra con cuántos traes y el plan que
// eligen; a la derecha, en el bloque azul, el resultado grande y la acción. La cuenta es la del libro
// (`creditoDelReferido`: el primer mes del plan del referido, a precio de lista) y, desde el 25/10, la del Acelerador en
// efectivo (`comisionDelAcelerador`: el 20% de sus cuotas). Nada más: ni una tasa de conversión inventada. Sin JavaScript
// se lee con el valor de arranque (5 negocios en el plan más caro).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { comisionDelAcelerador, creditoDelReferido } from '@/lib/partners-reglas';

/** Lo que puede tomar un referido: un plan (suma crédito) o el Acelerador (`efectivo`: deja la comisión en efectivo). */
export type PlanCalculadora = { id: string; nombre: string; precioUsd: number; rotulo: string; efectivo?: boolean };

export const MAX_NEGOCIOS = 50;
export const NEGOCIOS_DE_ARRANQUE = 5;

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/** Lo que suma traer `n` negocios a un plan: `n` veces su primer mes. Puro (lo prueba el test). */
export const creditoPorNegocios = (n: number, precioUsd: number): number =>
  Math.round(Math.max(0, Math.floor(n)) * creditoDelReferido(precioUsd) * 100) / 100;

/** Lo que deja UN negocio según lo que toma: su primer mes como crédito, o la comisión del Acelerador en efectivo. */
export const ganaPorNegocio = (p: Pick<PlanCalculadora, 'precioUsd' | 'efectivo'>): number =>
  p.efectivo ? comisionDelAcelerador(p.precioUsd) : creditoDelReferido(p.precioUsd);

/** Lo que suman `n` negocios que toman lo mismo. Puro (lo prueba el test). */
export const gananciaPorNegocios = (n: number, p: Pick<PlanCalculadora, 'precioUsd' | 'efectivo'>): number =>
  Math.round(Math.max(0, Math.floor(n)) * ganaPorNegocio(p) * 100) / 100;

export function Calculadora({ planes, nota, notaEfectivo, children }: {
  /** Lo que puede tomar un referido: los planes, del más caro al más barato, y el Acelerador. */
  planes: readonly PlanCalculadora[];
  /** La letra de abajo: cuándo se suma y lo que pasa hoy con el crédito. */
  nota: string;
  /** La letra de abajo con el Acelerador elegido: de dónde sale la comisión y lo que pasa hoy con ella. */
  notaEfectivo: string;
  /** La acción del bloque azul (unirse), que la arma la página. */
  children?: ReactNode;
}) {
  const [n, setN] = useState(NEGOCIOS_DE_ARRANQUE);
  const [planId, setPlanId] = useState(planes[0]?.id ?? '');
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  if (!plan) return null;
  const total = gananciaPorNegocios(n, plan);
  return (
    <div className="mp-calc">
      <div className="mp-calc-entrada">
        <div className="mp-calc-fila">
          <label htmlFor="mp-calc-n">Negocios que traes</label>
          <output htmlFor="mp-calc-n" className="mp-calc-n">{n}</output>
        </div>
        <input id="mp-calc-n" className="mp-calc-barra" type="range" min={1} max={MAX_NEGOCIOS} step={1} value={n}
          onChange={(e) => setN(Number(e.currentTarget.value))}
          style={{ ['--mp-lleno' as string]: `${((n - 1) / (MAX_NEGOCIOS - 1)) * 100}%` }} />
        <div className="mp-calc-escala"><span>1</span><span>{MAX_NEGOCIOS}</span></div>
        <div className="mp-calc-etq">Lo que toman</div>
        <div className="mp-calc-planes" role="radiogroup" aria-label="Lo que toman">
          {planes.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === plan.id}
              className={`mp-calc-plan${p.efectivo ? ' efectivo' : ''}${p.id === plan.id ? ' activo' : ''}`} onClick={() => setPlanId(p.id)}>
              <b>{p.nombre}</b><span>{p.rotulo}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mp-calc-resultado" aria-live="polite">
        <div className="mp-calc-res-etq">{plan.efectivo ? 'En efectivo' : 'Tu crédito'}</div>
        <div className="mp-calc-res-monto">{usd(total)}</div>
        <div className="mp-calc-res-cuenta">
          {n} {n === 1 ? 'negocio' : 'negocios'} × {usd(ganaPorNegocio(plan))}, {plan.efectivo ? `la comisión de cada ${plan.nombre}` : `el primer mes de ${plan.nombre}`}
        </div>
        {children}
      </div>
      <p className="mp-calc-nota">{plan.efectivo ? notaEfectivo : nota}</p>
    </div>
  );
}
