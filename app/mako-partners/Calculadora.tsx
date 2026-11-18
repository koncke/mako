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
// el 30% de CADA pago de cada negocio que trae, todos los meses. Desde las ~18:50 UTC del 18/11 es SIEMPRE el 30%, pague como
// pague el negocio (si paga por pasarela, el recargo se le suma a él en el checkout): sale el botón de la forma de pago, y la cuenta
// es `gananciaPorMes` (./numeros.ts, con `COMISION_PARTNER_DIRECTO`): acá no se escribe ningún número a mano. El resultado grande
// es lo que le deja CADA MES; abajo, lo de 12 meses. Ni una tasa de conversión inventada. Sin JavaScript se lee con el valor de
// arranque (5 negocios en el plan más caro).
// =============================================================================

import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { gananciaEnUnAnio, gananciaPorMes, usd } from './numeros';

export type PlanCalculadora = { id: string; nombre: string; precioUsd: number };

/** Hasta 100 negocios (Martín, 18/11/2026: «que el deslizable sea hasta 100»). */
export const MAX_NEGOCIOS = 100;

/**
 * LAS FRENADAS (18/11/2026, Martín: «que se detenga en 20, en 50 y después en 100… no que se detenga, sino que haga una muy pequeña
 * frenada»): al arrastrar, un valor a ±2 de una marca se acomoda en ella (100 es el final). Sólo al arrastrar: con el teclado sigue de
 * a 1 (si no, desde 18 la flecha caería siempre en 20 y no se podría pasar a 21). Sin marcas debajo de la pista (Martín: «no hace falta
 * que pongas… abajo 20, 50 o 100… Sí que se detenga ahí»).
 */
export const MARCAS_NEGOCIOS = [20, 50, MAX_NEGOCIOS] as const;
export const iman = (v: number): number => MARCAS_NEGOCIOS.find((m) => Math.abs(v - m) <= 2) ?? v;
const posicion = (v: number) => `${((v - 1) / (MAX_NEGOCIOS - 1)) * 100}%`;
export const NEGOCIOS_DE_ARRANQUE = 5;

// LOS DOS BOTONES QUE ALTERNAN (18/11/2026, Martín sobre los interruptores dobles: «Yo no quiero que sea un botón doble donde se vea
// las dos opciones. Yo quiero que sea un único botón que si lo cliqueas cambia a la otra opción y que esté un botón al lado del
// otro… se tiene que dar cuenta la persona que es un botón… para que lo clique y pueda jugar»). Cada botón muestra SÓLO la opción
// de ahora y, al tocarlo, pasa a la otra. Se nota que es un botón: borde, fondo y sombra, el ícono de alternar, se levanta al pasar
// el mouse y se hunde al tocarlo; el texto entra con una transición corta y el monto corre hasta el número nuevo. El ícono late UNA
// vez cuando el recuadro aparece en pantalla, como invitación (sin textos de «toca para cambiar»).
// AJUSTE (18/11/2026, Martín sobre la versión 60: «me gusta… el pequeño botoncito dentro del botón que se note que es switchable,
// pero no me convence el ícono… yo lo haría parpadear hasta que el usuario dé clic… MaKo Pro tiene que ser dos puntos US$ 97… en
// una sola línea»): en vez del ⇄, un MINI INTERRUPTOR (una pista con su bolita, que se desliza al otro lado al tocar); late cada
// ~2 s hasta que tocan ESE botón; y el plan en una línea, «MaKo Pro: US$ 97». En el teléfono «Pro: US$ 97» no entra al lado del mini
// interruptor con letra de 13 px en medio recuadro: ahí el mini interruptor va arriba a la derecha y el texto, en una línea, abajo.

/** Una opción de un botón que alterna: lo que dice en la computadora y en el teléfono, y (si hace falta) el nombre completo para el
 *  lector de pantalla. El plan dice «MaKo: US$ 97» (Martín, 18/11/2026: «simplemente MaKo US$ 97 o MaKo US$ 47 porque se queda muy
 *  largo»), pero el lector de pantalla oye «MaKo Pro, US$ 97». */
type Opcion<T extends string> = { id: T; texto: string; corto: string; completo?: string };



/**
 * LOS DOS PLANES, DOS BOTONES (18/11/2026, Martín por el Cerebro: «en lugar del botón con el deslizable que cambia de 97 a 47, ya
 * podrían ser dos botones, y el que esté seleccionado que se note, y el otro más apagado»). Uno al lado del otro: el elegido, lleno
 * y con sombra; el otro, apagado (se aviva al pasar el mouse). Sin mini interruptor ni latido. Es un grupo de radio: las flechas
 * pasan de uno al otro y el lector de pantalla oye cuál está elegido.
 */
function ElegirPlan<T extends string>({ opciones, valor, cambiar, etiqueta }: {
  opciones: readonly Opcion<T>[]; valor: T; cambiar: (v: T) => void; etiqueta: string;
}) {
  const mover = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const k = (i + paso + opciones.length) % opciones.length;
    cambiar(opciones[k].id);
    (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[k])?.focus();
  };
  return (
    <div className="mp-calc-alts" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o, i) => {
        const si = o.id === valor;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={si} tabIndex={si ? 0 : -1}
            className={`mp-calc-alt${si ? ' elegido' : ''}`} aria-label={o.completo ?? o.texto}
            onClick={() => cambiar(o.id)} onKeyDown={(e) => mover(e, i)}>
            <span className="mp-calc-alt-largo">{o.texto}</span><span className="mp-calc-alt-corto">{o.corto}</span>
          </button>
        );
      })}
    </div>
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
  const arrastrando = useRef(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? '');
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  const porMes = useCorre(plan ? gananciaPorMes(n, plan.precioUsd) : 0);
  if (!plan) return null;
  // «MaKo: US$ 97» y «MaKo: US$ 47», también en el teléfono (Martín, 18/11/2026: «MaKo 97 o MaKo 47, sin el nombre del plan»); el
  // lector de pantalla sí oye el nombre del plan.
  const opcionesPlan = planes.slice(0, 2).map((p) => ({
    id: p.id, texto: `MaKo: ${usd(p.precioUsd)}`, corto: `MaKo: ${usd(p.precioUsd)}`, completo: `${p.nombre}, ${usd(p.precioUsd)}`,
  }));
  return (
    <div className="mp-calc" id="calculadora" aria-label="Calculadora de lo que ganas">
      {opcionesPlan.length === 2 && <ElegirPlan etiqueta="Plan del negocio que traes" opciones={opcionesPlan} valor={plan.id} cambiar={setPlanId} />}
      <div className="mp-calc-fila">
        <label htmlFor="mp-calc-n">¿Cuántos negocios traes?</label>
        <output htmlFor="mp-calc-n" className="mp-calc-n">{n}</output>
      </div>
      <input id="mp-calc-n" className="mp-calc-barra" type="range" min={1} max={MAX_NEGOCIOS} step={1} value={n}
        onPointerDown={() => { arrastrando.current = true; }} onPointerUp={() => { arrastrando.current = false; }}
        onChange={(e) => { const v = Number(e.currentTarget.value); setN(arrastrando.current ? iman(v) : v); }}
        style={{ ['--mp-lleno' as string]: posicion(n) }} />
      <div className="mp-calc-res" aria-live="polite">
        <div className="mp-calc-monto">{usd(porMes)} <span>al mes</span></div>
        <div className="mp-calc-anio">{usd(gananciaEnUnAnio(n, plan.precioUsd))} en un año</div>
      </div>
      {children}
    </div>
  );
}
