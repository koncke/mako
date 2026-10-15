'use client';

// =============================================================================
// BarrasGordas — las barras horizontales de 1 o 2 métricas, como las piezas de /admin/dev/pricing (Barras)
// =============================================================================
// El rótulo a la izquierda (15 px), la barra GORDA (26 px de alto con radio 8; 16 px cada una si son dos) sobre
// una pista que da la escala sin cuadrícula, y el VALOR al final de cada barra: «toda barra tiene su valor en
// texto al lado» (app/admin/dev/pricing/Piezas.tsx). Sin eje X ni cuadrícula: el número ya lo dice.
//
//   · Cada métrica tiene SU escala (su máximo): con dos formatos (gasto y leads) no se comparan entre sí.
//   · El ancho se RECORTA al 100 % (AGENTS.md: «Una barra de gráfico se recorta al 100%, siempre»); un valor
//     negativo o sin dato no dibuja barra, y el texto lo dice igual.
//   · El color de cada fila: el de su categoría si la dimensión lo declara (`Dimension.colores`), «Otros» en
//     gris, y si no, el de la métrica.
//   · Una fila abre el detalle (clic, Enter o espacio) sólo si `alFila` existe; «Otros» no es una cosa.
//   · El rótulo va en dos renglones como mucho y, en una tarjeta angosta (el celular, < 440 px), ARRIBA de su barra:
//     al lado, en 364 px, los nombres de campaña quedaban en «Campaña de …». El container va en .gr-barras-caja.

import { type KeyboardEvent } from 'react';
import { fmtValor, OTROS, type FilaResultado, type Resultado } from '@/lib/graficos-agregar';

export function BarrasGordas({ filas, columnas, colorDeFila, colorDeMetrica, compacto, alFila }: {
  filas: ReadonlyArray<Pick<FilaResultado, 'clave' | 'etiqueta' | 'valores'>>;
  columnas: Resultado['columnas'];
  /** El color de una fila con UNA métrica (la categoría manda), o null para usar el de la métrica. */
  colorDeFila: (etiqueta: string, i: number) => string | null;
  colorDeMetrica: (j: number) => string;
  compacto: boolean;
  alFila?: (clave: string) => void;
}) {
  const doble = columnas.length > 1;
  const max = columnas.map((_, j) => Math.max(0, ...filas.map((f) => (f.valores[j] != null && Number.isFinite(f.valores[j]) ? (f.valores[j] as number) : 0))));
  return (
    <div className="gr-barras-caja">
      <div className="gr-barras">
        {doble && (
          <div className="gr-barras-leyenda">
            {columnas.map((c, j) => <span key={c.id}><span className="gr-punto" style={{ background: colorDeMetrica(j) }} />{c.nombre}</span>)}
          </div>
        )}
        {filas.map((f, i) => {
          const abre = alFila && f.clave !== OTROS ? () => alFila(f.clave) : null;
          const teclas = abre ? (ev: KeyboardEvent<HTMLDivElement>) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abre(); } } : undefined;
          return (
            <div key={f.clave} className="gr-barras-fila" {...(abre ? { role: 'button', tabIndex: 0, onClick: abre, onKeyDown: teclas, 'aria-label': `Ver detalle: ${f.etiqueta}` } : {})}>
              <span className="gr-barras-rot" title={f.etiqueta}>{f.etiqueta}</span>
              <div className="gr-barras-par">
                {columnas.map((c, j) => {
                  const v = f.valores[j];
                  const pct = v != null && v > 0 && max[j] > 0 ? Math.min(100, (v / max[j]) * 100) : 0;
                  const color = (!doble && colorDeFila(f.etiqueta, i)) || colorDeMetrica(j);
                  return (
                    <div key={c.id} className="gr-barras-linea">
                      <div className={`gr-barras-pista${doble ? ' gr-barras-pista--doble' : ''}`} style={{ background: 'var(--surface-2)' }}>
                        {pct > 0 && <span style={{ width: `${Math.max(1.5, pct)}%`, background: color }} />}
                      </div>
                      <span className={`gr-barras-val${doble && j > 0 ? ' gr-barras-val--chico' : ''}`}>{fmtValor(v, c.formato, compacto)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
