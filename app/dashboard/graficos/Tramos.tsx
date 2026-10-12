'use client';

// =============================================================================
// Tramos — «Línea de tiempo»: de 2 a 8 métricas como tramos seguidos, con el más largo resaltado
// =============================================================================
// Reemplaza la línea de tiempo del bloque SCL (Formulario → Agenda → R1 → R2 → Confirmó → Primer pago): cada
// métrica es un tramo (en general una razón de días ÷ casos), su ancho es proporcional a lo que dura, y el MÁS
// LARGO va en rojo, que era lo que el bloque decía («el tramo más lento»). Sin dimensión: los valores son los
// totales del período (`Resultado.totales`).
//
//   · Un tramo sin dato («—», p. ej. con menos casos que el mínimo de la razón) ocupa lo mínimo y no compite
//     por ser el más largo.
//   · En una tarjeta angosta (< 520 px) los tramos pasan a ser renglones (nombre, barra, número): ocho tramos
//     de 64 px no entran en fila.
//   · Cada tramo abre lo que hay atrás de su métrica (los leads de ese tramo), si tiene filas atrás.

import { fmtValor, type Resultado } from '@/lib/graficos-agregar';
import { textoConMuestra, tramoMasLargo } from '@/lib/graficos-gordo';

export function Tramos({ r, color, compacto, alMetrica }: {
  r: Resultado; color: string; compacto: boolean;
  alMetrica: (i: number) => (() => void) | null;
}) {
  const largo = tramoMasLargo(r.totales);
  const max = Math.max(0, ...r.totales.map((v) => (v != null && Number.isFinite(v) ? v : 0)));
  return (
    <div className="gr-tramos" role="list">
      {r.columnas.map((c, i) => {
        const v = r.totales[i];
        const peso = v != null && v > 0 && max > 0 ? v / max : 0;
        const al = alMetrica(i);
        const esLargo = i === largo;
        return (
          <button key={c.id} type="button" role="listitem" className={`gr-tramo${esLargo ? ' gr-tramo--largo' : ''}`}
            style={{ flex: `${Math.max(0.35, peso)} 1 0` }} title={c.nombre}
            {...(al ? { 'data-abre': '', onClick: al, 'aria-label': `Ver detalle: ${c.nombre}` } : { tabIndex: -1 })}>
            <span className="gr-tramo-val" title={r.muestraChica?.[i] ? `n = ${r.muestraChica[i]!.den}` : undefined}>{textoConMuestra(v, r.muestraChica?.[i], c.formato, (x) => fmtValor(x, c.formato, compacto))}</span>
            <span className="gr-tramo-pista" style={{ background: esLargo ? 'var(--bad)' : v != null && v > 0 ? color : 'var(--surface-2)', opacity: esLargo ? 1 : 0.85 }} />
            <span className="gr-tramo-nom">{c.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
