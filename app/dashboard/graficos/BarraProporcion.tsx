'use client';

// =============================================================================
// BarraProporcion — «Barra de proporción»: UNA barra partida entre 2 a 4 métricas que se suman
// =============================================================================
// Reemplaza la barra cobrado / pendiente del bloque Revenue (v5: los bloques se van). Sin dimensión: cada
// parte es una métrica (`Resultado.totales`), en el orden del gráfico. Debajo, cada una con su nombre, su
// número y su porcentaje.
//
//   · Con todo en cero NO hay partes (`partesDeProporcion`): la barra vieja pintaba 100 % rojo con 0 cobrado
//     y 0 pendiente (docs/hallazgos-graficos.md, «Marcar cobrada»). Queda la pista vacía.
//   · El color de cada parte sale de lo que SIGNIFICA su métrica (lo cobrado, verde; lo pendiente, rojo:
//     `tonoDe`), y si no dice nada, de la paleta de la hoja.
//   · Cada parte (y su renglón) abre lo que hay atrás de esa métrica, si tiene filas atrás.

import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { partesDeProporcion, textoConMuestra } from '@/lib/graficos-gordo';
import { useMedida } from './medida';

/** Por debajo de este alto, la versión de UNA línea: la barra y, al lado de cada color, su número y su %. */
const ALTO_COMPACTA = 84;

export function BarraProporcion({ r, colorDe, compacto, alMetrica }: {
  r: Resultado;
  colorDe: (i: number) => string;
  compacto: boolean;
  /** El clic en una parte: abre su métrica, o null si no tiene filas atrás. */
  alMetrica: (i: number) => (() => void) | null;
}) {
  const [ref, tam] = useMedida<HTMLDivElement>();
  const compacta = !!tam && tam.h < ALTO_COMPACTA;
  const pct = partesDeProporcion(r.totales);
  const hay = pct.some((p) => p > 0);
  const texto = (p: number) => `${p.toLocaleString('es-AR', { maximumFractionDigits: p > 0 && p < 1 ? 1 : 0 })}%`;
  return (
    <div className={`gr-prop${compacta ? ' gr-prop--compacta' : ''}`} ref={ref}>
      <div className="gr-prop-barra" role="img" aria-label={r.columnas.map((c, i) => `${c.nombre}: ${fmtValor(r.totales[i], c.formato, compacto)}`).join('. ')}>
        {hay && r.columnas.map((c, i) => {
          if (!(pct[i] > 0)) return null;
          const al = alMetrica(i);
          return (
            <button key={c.id} type="button" tabIndex={-1} aria-hidden="true" title={`${c.nombre}: ${texto(pct[i])}`} {...(al ? { 'data-abre': '', onClick: al } : {})}
              style={{ flex: `${pct[i]} 1 0`, background: colorDe(i) }} />
          );
        })}
      </div>
      <div className="gr-prop-ley">
        {r.columnas.map((c, i) => {
          const al = alMetrica(i);
          return (
            <button key={c.id} type="button" className="gr-prop-item" {...(al ? { 'data-abre': '', onClick: al, 'aria-label': `Ver detalle: ${c.nombre}` } : { tabIndex: -1 })}>
              <span className="gr-prop-nom"><span className="gr-punto" style={{ background: colorDe(i) }} />{c.nombre}</span>
              <span className="gr-prop-val">{textoConMuestra(r.totales[i], r.muestraChica?.[i], c.formato, (x) => fmtValor(x, c.formato, compacto))}{hay && <small>{texto(pct[i])}</small>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
