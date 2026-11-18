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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CanalDelPago } from '@/lib/partners-reglas';
import { gananciaEnUnAnio, gananciaPorMes, usd } from './numeros';

export type PlanCalculadora = { id: string; nombre: string; precioUsd: number };

export const MAX_NEGOCIOS = 50;
export const NEGOCIOS_DE_ARRANQUE = 5;

// LOS DOS BOTONES QUE ALTERNAN (18/11/2026, Martín sobre los interruptores dobles: «Yo no quiero que sea un botón doble donde se vea
// las dos opciones. Yo quiero que sea un único botón que si lo cliqueas cambia a la otra opción y que esté un botón al lado del
// otro… se tiene que dar cuenta la persona que es un botón… para que lo clique y pueda jugar»). Cada botón muestra SÓLO la opción
// de ahora y, al tocarlo, pasa a la otra. Se nota que es un botón: borde, fondo y sombra, el ícono de alternar, se levanta al pasar
// el mouse y se hunde al tocarlo; el texto entra con una transición corta y el monto corre hasta el número nuevo. El ícono late UNA
// vez cuando el recuadro aparece en pantalla, como invitación (sin textos de «toca para cambiar»).
// El del plan va en dos líneas a propósito: «MaKo Essential · US$ 47» no entra en un renglón en medio recuadro con el ícono (ni en
// la computadora), así que el nombre arriba y el precio abajo, más chico. En el teléfono (menos de 480 px), los nombres cortos.

/** Una opción de un botón que alterna: lo que dice en la computadora, en el teléfono, y (si tiene) la línea chica de abajo. */
type Opcion<T extends string> = { id: T; texto: string; corto: string; sub?: string };

/** Cómo te pagan: el texto simple, sin el porcentaje (Martín: «transferencia o pasarela de pago. Simple»). */
const CANALES: readonly [Opcion<CanalDelPago>, Opcion<CanalDelPago>] = [
  { id: 'directo', texto: 'Transferencia', corto: 'Transferencia' },
  { id: 'pasarela', texto: 'Pasarela de pago', corto: 'Pasarela' },
];

/** El ícono de alternar (⇄). */
function IconoAlternar() {
  return (
    <svg className="mp-calc-alt-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h13l-3.5-3.5" /><path d="M19 16H6l3.5 3.5" />
    </svg>
  );
}

/** UN botón que muestra la opción de ahora y, al tocarlo, pasa a la otra. */
function Alternar<T extends string>({ opciones: [a, b], valor, cambiar, etiqueta }: {
  opciones: readonly [Opcion<T>, Opcion<T>]; valor: T; cambiar: (v: T) => void; etiqueta: string;
}) {
  const actual = valor === b.id ? b : a;
  const otra = actual === a ? b : a;
  return (
    <button type="button" className="mp-calc-alt" onClick={() => cambiar(otra.id)} aria-label={`${etiqueta}: ${actual.texto}. Cambiar a ${otra.texto}`}>
      <span className="mp-calc-alt-tx" key={actual.id}>
        <span className="mp-calc-alt-largo">{actual.texto}</span><span className="mp-calc-alt-corto">{actual.corto}</span>
        {actual.sub && <span className="mp-calc-alt-sub">{actual.sub}</span>}
      </span>
      <IconoAlternar />
    </button>
  );
}

/** El número que se muestra corre hasta el nuevo (un tercio de segundo); sin movimiento si la persona lo pidió así. */
function useCorre(valor: number): number {
  const [visto, setVisto] = useState(valor);
  const ahora = useRef(valor);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { ahora.current = valor; setVisto(valor); return; }
    const de = ahora.current, inicio = performance.now();
    let id = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / 320);
      ahora.current = de + (valor - de) * (1 - (1 - k) ** 3);
      setVisto(ahora.current);
      if (k < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [valor]);
  return Math.round(visto * 100) / 100;
}

export function Calculadora({ planes, children }: {
  /** Los planes que puede elegir un referido, del más caro al más barato (el primero es el de arranque; el botón alterna dos). */
  planes: readonly PlanCalculadora[];
  /** La acción de abajo del resultado (hacerse partner), que la arma la página. */
  children?: ReactNode;
}) {
  const [n, setN] = useState(NEGOCIOS_DE_ARRANQUE);
  const [planId, setPlanId] = useState(planes[0]?.id ?? '');
  const [canal, setCanal] = useState<CanalDelPago>(CANALES[0].id);
  const [invita, setInvita] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  const porMes = useCorre(plan ? gananciaPorMes(n, plan.precioUsd, canal) : 0);
  // El pulso del ícono, UNA vez, cuando el recuadro aparece en pantalla.
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setInvita(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (!plan) return null;
  const opcionesPlan = planes.slice(0, 2).map((p) => ({ id: p.id, texto: p.nombre, corto: p.nombre.replace(/^MaKo\s+/, ''), sub: usd(p.precioUsd) }));
  return (
    <div ref={caja} className={`mp-calc${invita ? ' mp-invita' : ''}`} id="calculadora" aria-label="Calculadora de lo que ganas">
      <div className="mp-calc-alts">
        {opcionesPlan.length === 2 && (
          <Alternar etiqueta="Plan" opciones={[opcionesPlan[0], opcionesPlan[1]]} valor={plan.id} cambiar={setPlanId} />
        )}
        <Alternar etiqueta="Cómo te pagan" opciones={CANALES} valor={canal} cambiar={setCanal} />
      </div>
      <div className="mp-calc-fila">
        <label htmlFor="mp-calc-n">¿Cuántos negocios traes?</label>
        <output htmlFor="mp-calc-n" className="mp-calc-n">{n}</output>
      </div>
      <input id="mp-calc-n" className="mp-calc-barra" type="range" min={1} max={MAX_NEGOCIOS} step={1} value={n}
        onChange={(e) => setN(Number(e.currentTarget.value))}
        style={{ ['--mp-lleno' as string]: `${((n - 1) / (MAX_NEGOCIOS - 1)) * 100}%` }} />
      <div className="mp-calc-res" aria-live="polite">
        <div className="mp-calc-monto">{usd(porMes)} <span>al mes</span></div>
        <div className="mp-calc-anio">{usd(gananciaEnUnAnio(n, plan.precioUsd, canal))} en un año</div>
      </div>
      {children}
    </div>
  );
}
