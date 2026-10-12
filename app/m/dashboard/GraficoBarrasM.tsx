'use client';

// =============================================================================
// GraficoBarrasM — el ÚNICO gráfico de una hoja en el teléfono: barras, y el valor de la barra
// tocada arriba
// =============================================================================
// SVG propio y liviano (sin librería de gráficos en el bundle del teléfono). Anatomía del
// prototipo (docs/prototipos/mako-mobile-v2.html, `.graf`): la caja de la casa, arriba a la
// izquierda la barra elegida («11 oct · 7 leads») y a la derecha el total («248 en 30 días»).
// Una sola serie: sin leyenda (el título de la sección la nombra). Marcas de dataviz: barra de
// 24 px como mucho, 4 px redondeados arriba y recta en la base, grilla recesiva.
//
// Se elige una barra TOCÁNDOLA o ARRASTRANDO el dedo de lado (`touch-action: pan-y`: el gesto
// vertical sigue siendo el scroll de la página), y con las flechas del teclado (es un slider para
// el lector de pantalla). Por defecto, la última.
// =============================================================================

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LIENZO, caminoBarra, ejeCompacto, geometria, indiceEn, type GraficoM } from './modelo';

export function GraficoBarrasM({ g }: { g: GraficoM }) {
  const n = g.barras.length;
  const [sel, setSel] = useState(n - 1);
  const i = Math.max(0, Math.min(n - 1, sel));
  const geo = useMemo(() => geometria(g.barras.map((b) => b.valor), g.entero), [g]);
  const lienzo = useRef<SVGSVGElement>(null);
  const arrastrando = useRef<number | null>(null);

  if (!n) return null;
  const b = g.barras[i];

  const elegirEn = (clientX: number) => {
    const el = lienzo.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    setSel(indiceEn(((clientX - r.left) / r.width) * LIENZO.W, n));
  };
  const alBajar = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    arrastrando.current = e.pointerId;
    elegirEn(e.clientX);
  };
  const alMover = (e: PointerEvent<SVGSVGElement>) => {
    if (arrastrando.current !== e.pointerId) return;
    elegirEn(e.clientX);
  };
  const alSoltar = (e: PointerEvent<SVGSVGElement>) => {
    if (arrastrando.current === e.pointerId) arrastrando.current = null;
  };
  const alTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const salto = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (e.key === 'Home') { e.preventDefault(); setSel(0); return; }
    if (e.key === 'End') { e.preventDefault(); setSel(n - 1); return; }
    if (!salto) return;
    e.preventDefault();
    setSel((s) => Math.max(0, Math.min(n - 1, s + salto)));
  };

  const { ARRIBA, BASE, IZQ, W, H } = LIENZO;
  const y = (v: number) => BASE - (geo.techo > 0 ? (v / geo.techo) * (BASE - ARRIBA) : 0);
  const sel0 = geo.barras[i];

  return (
    <div className="m-dash-graf">
      <div className="m-dash-graf__cab">
        <strong className="m-dash-graf__sel" aria-live="polite">{b.titulo} · {b.texto}</strong>
        <span className="m-dash-graf__total">{g.total}</span>
      </div>
      <div
        className="m-dash-graf__lienzo"
        role="slider"
        tabIndex={0}
        aria-label={g.titulo}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={i + 1}
        aria-valuetext={`${b.titulo}: ${b.texto}`}
        onKeyDown={alTecla}
      >
        <svg
          ref={lienzo}
          viewBox={`0 0 ${W} ${H}`}
          aria-hidden
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          {geo.ticks.map((t) => {
            const yy = y(t);
            return (
              <g key={t}>
                <line className="m-dash-grilla" x1={IZQ} x2={W} y1={yy} y2={yy} />
                <text className="m-dash-eje" x={IZQ - 6} y={yy + 4} textAnchor="end">{ejeCompacto(t)}</text>
              </g>
            );
          })}
          {geo.barras.map((r, k) => (r.h > 0
            ? <path key={g.barras[k].clave} className={k === i ? 'm-dash-barra m-dash-barra--sel' : 'm-dash-barra'} d={caminoBarra(r)} />
            : null))}
          {/* Una barra en cero no tiene alto: elegida, se marca con un trazo en la base. */}
          {sel0 && sel0.h <= 0 && <rect className="m-dash-barra m-dash-barra--sel" x={sel0.x} y={BASE - 2} width={sel0.w} height={2} />}
          {geo.marcas.map((k) => {
            const x = IZQ + k * geo.hueco + geo.hueco / 2;
            const ancla = k === 0 && n > 1 ? 'start' : k === n - 1 && n > 1 ? 'end' : 'middle';
            const xx = ancla === 'start' ? IZQ + k * geo.hueco : ancla === 'end' ? IZQ + (k + 1) * geo.hueco : x;
            return <text key={`m${k}`} className="m-dash-eje" x={xx} y={H - 6} textAnchor={ancla}>{g.barras[k].eje}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}
