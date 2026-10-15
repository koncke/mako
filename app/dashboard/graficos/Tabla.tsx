'use client';

// =============================================================================
// Tabla — la tabla, la tabla con barras y la tabla con mapa de calor del Dashboard
// =============================================================================
// «Tabla con barras» le ponía una barra de 10 px a CADA celda numérica de CADA columna, del mismo color y cada
// una con su propia escala: en Guiones eran 6 métricas × 50 filas = 300 barras, y en CPA o CPL la barra larga
// era lo MALO pintada igual que el gasto (punto 20: «mucha info, no se entiende nada»). Ahora:
//
//   · UNA sola columna con barra (`columnaConBarra`, lib/graficos-gordo.ts): la elegida (`g.barra`), si no la
//     que ordena; nunca una métrica donde menos es mejor. Va SEGUNDA, pegada al nombre y ancha: el número
//     de 15 px 600 y una barra de 14 px con radio 7, recortada al 100 %.
//   · Las demás métricas, sólo el número (14 px, var(--dim)).
//   · SIN SCROLL DE COSTADO: `table-layout: fixed`, el nombre se corta con «…» y las columnas que no entran se
//     esconden de DERECHA a IZQUIERDA (medido con el ancho real de la tarjeta, `columnasQueEntran`).
//   · Las dimensiones extra (`g.tabla.columnas`: la urgencia de una cuota, el closer de una llamada) van como
//     columnas de texto; las arma el agregador en `FilaResultado.extra`.
//   · En el mapa de calor, una métrica de «menos es mejor» se tiñe de rojo: más alto, peor.
//   · Letra: nada por debajo de 13 px (las cabeceras, en la letra de la hoja y sin mayúsculas en mono).
//   · LA CABECERA VA EN DOS RENGLONES como mucho (`.gr-th`): en una línea, las cohortes y «Clientes por cobrar» decían
//     «Cobrado e…», «Tasa de ci…», «Madurez del m…» (medido con el arnés en las plantillas, 14/10/2026).
//   · ANGOSTA (< 480 px, el celular): las columnas miden menos (ANCHO_ANGOSTA) y las celdas tienen menos aire. Con las
//     de escritorio, a 364 px entraban el nombre y UNA métrica, y en la tabla con barras el nombre quedaba en
//     «Campaña …» al lado de una barra de 200 px.
//   · LAS ACCIONES EN LA FILA (v5, `Grafico.tabla.acciones`: «Marcar cobrada» de un clic con Deshacer): una columna
//     al final, la MISMA del detalle de un número (../entidades/acciones-fila.tsx). La pide `useColumnaAcciones`, que
//     sin su provider (editando, en un link compartido, o una tabla sin acciones) no dibuja nada. Su ancho se
//     descuenta ANTES de decidir qué columnas entran.

import { type KeyboardEvent } from 'react';
import { fmtValor, OTROS, type FilaResultado, type Resultado } from '@/lib/graficos-agregar';
import { columnasQueEntran, textoConMuestra } from '@/lib/graficos-gordo';
import { useMedida } from './medida';
import { useColumnaAcciones } from '../entidades/acciones-fila';
import { iniciales } from '@/lib/graficos-identidad';

export type ColumnaExtra = { id: string; nombre: string };
/** Las dimensiones extra de una fila (`FilaResultado.extra`, las arma el agregador): su texto, o vacío. */
export const extraDe = (f: FilaResultado, id: string): string => f.extra?.[id] ?? '';

function propsFila(clave: string, alFila?: (clave: string) => void) {
  if (!alFila || clave === OTROS) return {};
  return {
    tabIndex: 0, style: { cursor: 'pointer' }, onClick: () => alFila(clave),
    onKeyDown: (ev: KeyboardEvent<HTMLTableRowElement>) => { if (ev.key === 'Enter') { ev.preventDefault(); alFila(clave); } },
  };
}

type Col = { tipo: 'metrica'; i: number } | { tipo: 'extra'; id: string; nombre: string };

const ANCHO = { nombre: 160, barra: 200, numero: 104, extra: 128, acciones: 160 };
// La barra no baja de 140 en angosto: con menos, al lado de su número quedaba un punto y no una barra.
const ANCHO_ANGOSTA = { nombre: 112, barra: 140, numero: 84, extra: 104, acciones: 160 };
/** Por debajo de este ancho la tabla va angosta (el mismo corte que el @container de estilos-html.ts). */
const CORTE_ANGOSTA = 480;

export function Tabla({ r, modo, barraEn, color, menosEsMejor, extras, total, compacto, alFila, personas = false }: {
  r: Resultado; modo: 'plana' | 'barras' | 'calor';
  /** El índice de la métrica con barra (modo 'barras'), o -1 = sin barra. */
  barraEn: number;
  color: string;
  menosEsMejor: (i: number) => boolean;
  extras: readonly ColumnaExtra[];
  total: boolean; compacto: boolean; alFila?: (clave: string) => void;
  /** Sobre una portada, una lista de personas: el nombre lleva el avatar con sus iniciales. */
  personas?: boolean;
}) {
  const [ref, tam] = useMedida<HTMLDivElement>();
  const acciones = useColumnaAcciones();
  const conBarra = modo === 'barras' && barraEn >= 0 && barraEn < r.columnas.length;
  // El orden: el nombre, la de la barra (segunda), las extras, el resto de las métricas.
  const resto: Col[] = [
    ...extras.map((e): Col => ({ tipo: 'extra', id: e.id, nombre: e.nombre })),
    ...r.columnas.map((_, i): Col => ({ tipo: 'metrica', i })).filter((c) => !(conBarra && c.tipo === 'metrica' && c.i === barraEn)),
  ];
  const A = tam && tam.w < CORTE_ANGOSTA ? ANCHO_ANGOSTA : ANCHO;
  const ancho = Math.max(0, (tam?.w ?? 0) - (acciones ? A.acciones : 0));
  const anchoBarra = conBarra ? Math.min(360, Math.max(A.barra, Math.round(ancho * 0.34))) : 0;
  const entran = ancho ? columnasQueEntran(ancho, resto.length, { nombre: A.nombre, barra: anchoBarra, numero: A.numero }) : resto.length;
  const visibles = resto.slice(0, entran);
  const max = r.columnas.map((_, i) => Math.max(0, ...r.filas.map((f) => Math.abs(f.valores[i] ?? 0))));
  const celda = (f: FilaResultado, c: Col) => {
    if (c.tipo === 'extra') { const v = extraDe(f, c.id); return <td key={c.id} className="gr-extra" title={v}>{v}</td>; }
    const v = f.valores[c.i];
    const texto = textoConMuestra(v, f.muestraChica?.[c.i], r.columnas[c.i].formato, (x) => fmtValor(x, r.columnas[c.i].formato, compacto));
    if (modo === 'calor') {
      const p = max[c.i] ? Math.abs(v ?? 0) / max[c.i] : 0;
      const tinta = menosEsMejor(c.i) ? 'var(--bad)' : color;
      return <td key={c.i} style={{ background: `color-mix(in srgb, ${tinta} ${Math.round(p * 55)}%, transparent)`, color: 'var(--ink)' }}>{texto}</td>;
    }
    return <td key={c.i}>{texto}</td>;
  };
  return (
    <div className="gr-tabla" ref={ref}>
      <table>
        <colgroup>
          <col />
          {conBarra && <col style={{ width: anchoBarra }} />}
          {visibles.map((c) => <col key={c.tipo === 'extra' ? c.id : c.i} style={{ width: c.tipo === 'extra' ? A.extra : A.numero }} />)}
          {acciones && <col style={{ width: A.acciones }} />}
        </colgroup>
        <thead>
          <tr>
            <th className="gr-izq" />
            {conBarra && <th className="gr-izq" title={r.columnas[barraEn].nombre}><span className="gr-th">{r.columnas[barraEn].nombre}</span></th>}
            {visibles.map((c) => (c.tipo === 'extra'
              ? <th key={c.id} className="gr-izq" title={c.nombre}><span className="gr-th">{c.nombre}</span></th>
              : <th key={c.i} title={r.columnas[c.i].nombre}><span className="gr-th">{r.columnas[c.i].nombre}</span></th>))}
            {acciones && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {r.filas.map((f) => {
            const v = conBarra ? f.valores[barraEn] : null;
            const p = conBarra && max[barraEn] ? Math.min(100, (Math.max(0, v ?? 0) / max[barraEn]) * 100) : 0;
            return (
              <tr key={f.clave} {...propsFila(f.clave, alFila)}>
                <td className="gr-izq gr-nombre" title={f.etiqueta}>{personas && f.clave !== OTROS && <span className="gr-avatar" aria-hidden>{iniciales(f.etiqueta)}</span>}{f.etiqueta}</td>
                {conBarra && (
                  <td className="gr-izq">
                    <span className="gr-celda-barra">
                      <span className="gr-num">{textoConMuestra(v, f.muestraChica?.[barraEn], r.columnas[barraEn].formato, (x) => fmtValor(x, r.columnas[barraEn].formato, compacto))}</span>
                      <span className="gr-pista">{p > 0 && <span style={{ width: `${Math.max(2, p)}%`, background: f.clave === OTROS ? 'var(--border-strong)' : color }} />}</span>
                    </span>
                  </td>
                )}
                {visibles.map((c) => celda(f, c))}
                {acciones && <td>{acciones.de(f)}</td>}
              </tr>
            );
          })}
          {total && (
            <tr className="gr-total">
              <td className="gr-izq">Total</td>
              {conBarra && <td className="gr-izq">{textoConMuestra(r.totales[barraEn], r.muestraChica?.[barraEn], r.columnas[barraEn].formato, (x) => fmtValor(x, r.columnas[barraEn].formato, compacto))}</td>}
              {visibles.map((c) => (c.tipo === 'extra' ? <td key={c.id} /> : <td key={c.i}>{textoConMuestra(r.totales[c.i], r.muestraChica?.[c.i], r.columnas[c.i].formato, (x) => fmtValor(x, r.columnas[c.i].formato, compacto))}</td>))}
              {acciones && <td />}
            </tr>
          )}
        </tbody>
      </table>
      {r.fuera > 0 && <p className="gr-mas">+{r.fuera} más</p>}
      {acciones?.nodo}
    </div>
  );
}
