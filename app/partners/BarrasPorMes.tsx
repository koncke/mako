'use client';

// =============================================================================
// BarrasPorMes — lo ganado por mes, en columnas (el «Earnings» del portal de Tolt), para el panel del partner y el del
// programa (25/10/2026)
// =============================================================================
// UNA serie: sin leyenda (el título dice qué es). Columnas finas (≤ 24px) con la punta redondeada y la base recta, sobre
// una línea de base recesiva; el valor sólo en el mes de hoy y en el más alto (nunca en todos; si son vecinos, sólo el de hoy:
// dos etiquetas pegadas se pisan en el teléfono), y el resto al pasar el mouse
// o con el foco (cada columna entera es el blanco, no sólo la barra). El color es el del tema (`--primary`): cambia solo con
// el oscuro y el Nord. Todo en cero: las columnas quedan en la base y una línea dice qué va a aparecer.
// =============================================================================

import { useState } from 'react';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mesCorto = (m: string) => MESES[Number(m.slice(5, 7)) - 1] ?? m;
const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const CSS = `
.bm { position: relative; }
.bm-plot { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; align-items: end; height: 168px; gap: 2px;
  border-bottom: 1px solid var(--border); padding-top: 22px; }
.bm-col { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  border: 0; background: none; padding: 0; cursor: default; font: inherit; color: inherit; }
.bm-col:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 6px; }
.bm-barra { width: min(24px, 60%); border-radius: 4px 4px 0 0; background: var(--primary); min-height: 2px; transition: opacity .15s ease; }
.bm-barra.cero { background: var(--border); }
.bm:hover .bm-barra:not(.activa) { opacity: .55; }
.bm-valor { position: absolute; transform: translateY(-100%); margin-top: -4px; font-size: 12px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.bm-ejes { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; margin-top: 6px; }
.bm-ejes span { text-align: center; font-size: 12px; color: var(--dim); }
.bm-tip { position: absolute; top: 0; transform: translate(-50%, -6px); background: var(--ink); color: var(--surface); font-size: 12.5px; font-weight: 600;
  padding: 6px 10px; border-radius: 8px; white-space: nowrap; pointer-events: none; z-index: 2; }
.bm-vacio { margin: 10px 0 0; font-size: var(--fs-sm); color: var(--dim); }
`;

export function BarrasPorMes({ datos, vacio }: { datos: ReadonlyArray<{ mes: string; usd: number }>; vacio: string }) {
  const [activa, setActiva] = useState<number | null>(null);
  const max = Math.max(0, ...datos.map((d) => d.usd));
  const iMax = max > 0 ? datos.findIndex((d) => d.usd === max) : -1;
  const iHoy = datos.length - 1;
  const total = datos.reduce((a, d) => a + d.usd, 0);
  return (
    <div className="bm" onMouseLeave={() => setActiva(null)}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bm-plot" role="list" aria-label="Lo ganado por mes">
        {datos.map((d, i) => {
          const alto = max > 0 ? Math.max(2, (d.usd / max) * 100) : 0;
          const etiqueta = (i === iHoy || (i === iMax && Math.abs(iMax - iHoy) >= 2)) && d.usd > 0;
          return (
            <button key={d.mes} type="button" role="listitem" className="bm-col" aria-label={`${mesCorto(d.mes)} ${d.mes.slice(0, 4)}: ${usd(d.usd)}`}
              onMouseEnter={() => setActiva(i)} onFocus={() => setActiva(i)} onBlur={() => setActiva(null)}>
              <span className={`bm-barra${d.usd > 0 ? '' : ' cero'}${activa === i ? ' activa' : ''}`} style={{ height: d.usd > 0 ? `${alto}%` : 2 }}>
                {etiqueta && activa == null && <span className="bm-valor" style={{ position: 'relative', display: 'block', textAlign: 'center' }}>{usd(d.usd)}</span>}
              </span>
              {activa === i && <span className="bm-tip" style={{ left: '50%' }}>{mesCorto(d.mes)} · {usd(d.usd)}</span>}
            </button>
          );
        })}
      </div>
      <div className="bm-ejes" aria-hidden="true">{datos.map((d) => <span key={d.mes}>{mesCorto(d.mes)}</span>)}</div>
      {total === 0 && <p className="bm-vacio">{vacio}</p>}
    </div>
  );
}
