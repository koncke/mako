// =============================================================================
// /m/experimentos — las piezas chicas sin estado: la línea, la tesis y la evidencia de un hallazgo
// =============================================================================
// Sin 'use client' (no tienen estado): se dibujan dentro de los componentes de cliente de la carpeta.
// La línea es un <path> SVG, no recharts: en el teléfono no hay tooltip que mirar (no hay hover) y
// recharts pesa en el bundle. El color va en la MARCA (la línea, el punto), nunca en el texto
// (app/m/_ui/Piezas.tsx: --good y --bad como texto no pasan AA).
// =============================================================================

import type { Evidencia } from '@/lib/retro-reporte';
import { MakoStar } from '@/app/_components/MakoBrand';
import { trazoSpark } from './modelo';

const ANCHO = 320;

/** La serie de un experimento (o de su cierre) como una línea. Sin dos puntos, no dibuja nada. */
export function LineaM({ serie, tono, alto = 56 }: { serie: readonly number[]; tono: 'good' | 'bad' | 'warn' | 'primary'; alto?: number }) {
  const d = trazoSpark(serie, ANCHO, alto);
  if (!d) return null;
  return (
    <svg className="m-experimentos-linea" data-tono={tono} viewBox={`0 0 ${ANCHO} ${alto}`} preserveAspectRatio="none"
      style={{ height: alto }} aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** La tesis del período, con la parte que la Retro marca resaltada (en escritorio va en rojo: acá es un fondo). */
export function TesisM({ texto, highlight, rotulo }: { texto: string; highlight: string | null; rotulo: string }) {
  const i = highlight ? texto.indexOf(highlight) : -1;
  return (
    <section className="m-experimentos-tesis">
      <p className="m-experimentos-tesis__rotulo"><MakoStar size={14} animate={false} />{rotulo}</p>
      <p className="m-experimentos-tesis__texto">
        {i < 0 || !highlight ? texto : (
          <>
            {texto.slice(0, i)}
            <mark className="m-experimentos-tesis__marca">{highlight}</mark>
            {texto.slice(i + highlight.length)}
          </>
        )}
      </p>
    </section>
  );
}

const TONO_EV: Record<string, 'good' | 'bad' | 'warn' | 'primary' | 'neutro'> = {
  good: 'good', bad: 'bad', warn: 'warn', blue: 'primary', gris: 'neutro', gray: 'neutro',
};

/** La evidencia de un hallazgo: el número, las barras o la línea (RetroReport.tsx, `EvidenciaBlock`). */
export function EvidenciaM({ ev }: { ev: Evidencia }) {
  if (ev.type === 'num') {
    return (
      <div className="m-experimentos-ev">
        <span className="m-experimentos-ev__num">{ev.value}</span>
        <span className="m-experimentos-ev__label">{ev.label}</span>
      </div>
    );
  }
  if (ev.type === 'bars') {
    return (
      <div className="m-experimentos-ev m-experimentos-ev--barras">
        {ev.rows.map((r, i) => (
          <div key={i} className="m-experimentos-barra" data-fuerte={r.strong || undefined}>
            <span className="m-experimentos-barra__fila"><span>{r.label}</span><b>{r.val}</b></span>
            <span className="m-experimentos-barra__pista" data-tono={TONO_EV[r.tone] ?? 'neutro'}>
              <i style={{ width: `${Math.max(2, Math.min(100, r.pct))}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  const tono = TONO_EV[ev.tone] ?? 'primary';
  return (
    <div className="m-experimentos-ev">
      <LineaM serie={ev.vals} tono={tono === 'neutro' ? 'primary' : tono} />
      {ev.note && <span className="m-experimentos-ev__label">{ev.note}</span>}
    </div>
  );
}
