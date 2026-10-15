'use client';

// =============================================================================
// Tarjetas — «Tarjetas»: una galería de cosas (guiones, anuncios) en vez de una tabla
// =============================================================================
// Decisión de la v5: «Guiones y Anuncios vuelven a verse como tarjetas». Las viejas
// (scratchpad/old-ScriptsBrowser.tsx:1106-1300, app/marketing/AnuncioCard.tsx) eran la miniatura, el nombre,
// los chips de ángulo y veredicto, dos barras y una línea de números, y el clic abría el anuncio. Acá, sobre
// el mismo `Resultado` que una tabla (una fila = una cosa):
//
//   · La MINIATURA si el conjunto la trae (`FilaResultado.imagen`, la pone el lector de guiones / meta). Sólo
//     una URL https; si no hay, la tarjeta va sin hueco.
//   · El nombre (dos renglones como mucho) y 1-2 CHIPS: los valores de las dimensiones extra del gráfico
//     (`g.tabla.columnas`, en `FilaResultado.extra`).
//   · LA barra de la métrica elegida (`g.barra`, la misma regla que la tabla con barras: nunca una de «menos es
//     mejor»), con su NOMBRE arriba y su número en grande, contra la mayor de la galería. Sin el nombre, «US$395» al
//     lado de una barra no decía de qué era (las otras métricas sí lo decían).
//   · 3-4 números chicos: las otras métricas.
//   · El clic (o Enter) abre el detalle de esa cosa, como una fila de tabla.

import { type KeyboardEvent } from 'react';
import { fmtValor, OTROS, type FilaResultado, type Resultado } from '@/lib/graficos-agregar';
import { textoConMuestra } from '@/lib/graficos-gordo';
import { extraDe } from './Tabla';

/** La miniatura de una fila, si es una URL https (lo demás no se dibuja). */
const imagenDe = (f: FilaResultado): string | null => {
  const v = f.imagen;
  return typeof v === 'string' && /^https:\/\/[^\s"'<>]{4,2000}$/i.test(v) ? v : null;
};

export function Tarjetas({ r, barraEn, chips, color, compacto, alFila }: {
  r: Resultado;
  /** El índice de la métrica con barra, o -1. */
  barraEn: number;
  /** Las dimensiones extra que van como chips (las dos primeras). */
  chips: readonly string[];
  color: string; compacto: boolean;
  alFila?: (clave: string) => void;
}) {
  const conBarra = barraEn >= 0 && barraEn < r.columnas.length;
  const max = conBarra ? Math.max(0, ...r.filas.map((f) => Math.max(0, f.valores[barraEn] ?? 0))) : 0;
  const otras = r.columnas.map((c, i) => ({ c, i })).filter(({ i }) => i !== barraEn).slice(0, 4);
  return (
    <div className="gr-tarjetas">
      {r.filas.map((f) => {
        const abre = alFila && f.clave !== OTROS ? () => alFila(f.clave) : null;
        const teclas = abre ? (ev: KeyboardEvent<HTMLDivElement>) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abre(); } } : undefined;
        const img = imagenDe(f);
        const susChips = chips.slice(0, 2).map((d) => extraDe(f, d)).filter(Boolean);
        const v = conBarra ? f.valores[barraEn] : null;
        const p = conBarra && max > 0 ? Math.min(100, (Math.max(0, v ?? 0) / max) * 100) : 0;
        return (
          <div key={f.clave} className="gr-tarjeta" {...(abre ? { role: 'button', tabIndex: 0, onClick: abre, onKeyDown: teclas, 'aria-label': `Ver detalle: ${f.etiqueta}` } : {})}>
            <div className={`gr-tarjeta-cab${img ? '' : ' gr-tarjeta-cab--sin'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de un tercero (Meta), sin optimizar */}
              {img && <img className="gr-tarjeta-mini" src={img} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer" />}
              <div style={{ minWidth: 0 }}>
                <div className="gr-tarjeta-nom" title={f.etiqueta}>{f.etiqueta}</div>
                {susChips.length > 0 && <div className="gr-tarjeta-chips">{susChips.map((c) => <span key={c} title={c}>{c}</span>)}</div>}
              </div>
            </div>
            {conBarra && (
              <div className="gr-tarjeta-prin">
                <span className="gr-tarjeta-rot" title={r.columnas[barraEn].nombre}>{r.columnas[barraEn].nombre}</span>
                <b className="gr-tarjeta-val">{textoConMuestra(v, f.muestraChica?.[barraEn], r.columnas[barraEn].formato, (x) => fmtValor(x, r.columnas[barraEn].formato, compacto))}</b>
                <span className="gr-pista">{p > 0 && <span style={{ width: `${Math.max(2, p)}%`, background: color }} />}</span>
              </div>
            )}
            {otras.length > 0 && (
              <div className="gr-tarjeta-nums">
                {otras.map(({ c, i }) => <div key={c.id}><span title={c.nombre}>{c.nombre}</span><b>{textoConMuestra(f.valores[i], f.muestraChica?.[i], c.formato, (x) => fmtValor(x, c.formato, compacto))}</b></div>)}
              </div>
            )}
          </div>
        );
      })}
      {r.fuera > 0 && <p className="gr-mas" style={{ gridColumn: '1 / -1' }}>+{r.fuera} más</p>}
    </div>
  );
}
