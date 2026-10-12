'use client';

// =============================================================================
// Etiquetas — la capa de etiquetas de valor de un gráfico de recharts, SIN que se pisen
// =============================================================================
// Reemplaza al `LabelList` en cada punto (Grafico.tsx, hasta la v4): eran hasta 120 etiquetas de 10,5 px en
// Tendencias, sin halo, cruzadas por las otras series («los datos se chocan, están tan chicos que no se llegan
// a leer», Martín, punto 13). Acá entran SÓLO las que caben sin tocarse (`etiquetasQueEntran`,
// lib/graficos-gordo.ts): el último punto de cada serie y su máximo, cada columna si entran, el total de cada
// pila. En tinta, 15 px 600, con un halo del color de la tarjeta.
//
// Va como un HIJO del gráfico de recharts (3.8): ahí adentro las escalas se leen con `useXAxisScale` /
// `useYAxisScale` / `usePlotArea`, y la capa se dibuja en un `ZIndexLayer` por encima de todo. Es un
// componente aparte a propósito: un hook adentro de CuerpoGrafico después de un `return` es la pantalla en
// blanco de AGENTS.md.

import { DefaultZIndexes, usePlotArea, useXAxisScale, useYAxisScale, ZIndexLayer } from 'recharts';
import type { Formato } from '@/lib/graficos-catalogo';
import {
  candidatosDeColumnas, candidatosDeSeries, etiquetasQueEntran, ETIQUETA, topeDeSeries, type Candidato, type PuntoSerie,
} from '@/lib/graficos-gordo';

export type SerieEtiqueta = { key: string; formato: Formato; eje?: 'a' | 'b' };
type Datos = ReadonlyArray<Record<string, string | number | null>>;

/**
 * `modo`: 'series' (líneas y áreas: último y máximo de cada serie), 'columnas' (una métrica vertical: cada
 * columna si entra), 'pilas' (columnas apiladas: el total arriba de cada pila) o 'pilasH' (barras apiladas:
 * el total al final de cada una). `tope` pisa el de cada modo.
 */
export function CapaEtiquetas({ datos, series, modo, fmt, halo, tope }: {
  datos: Datos; series: readonly SerieEtiqueta[]; modo: 'series' | 'columnas' | 'pilas' | 'pilasH';
  fmt: (v: number, f: Formato) => string; halo: string; tope?: number;
}) {
  const area = usePlotArea();
  const xs = useXAxisScale();
  const ya = useYAxisScale('a');
  const yb = useYAxisScale('b');
  if (!area || !xs || !ya || !series.length || !datos.length) return null;
  const caja = { x: area.x, y: area.y, width: area.width, height: area.height };
  const medio = { position: 'middle' as const };

  let candidatos: Candidato[] = [];
  let topeModo = 12;
  if (modo === 'series') {
    candidatos = candidatosDeSeries(series.map((s) => {
      const y = s.eje === 'b' && yb ? yb : ya;
      return {
        id: s.key,
        puntos: datos.map((d): PuntoSerie => {
          const v = d[s.key];
          if (typeof v !== 'number' || !Number.isFinite(v)) return null;
          const px = xs(d.etiqueta, medio);
          const py = y(v);
          return px == null || py == null ? null : { x: px, y: py, valor: v, texto: fmt(v, s.formato) };
        }),
      };
    }));
    topeModo = topeDeSeries(series.length);
  } else {
    const banda = (area[modo === 'pilasH' ? 'height' : 'width'] / datos.length) * 0.78;
    const barras = datos.map((d, i) => {
      const v = series.reduce((suma, s) => suma + (typeof d[s.key] === 'number' ? (d[s.key] as number) : 0), 0);
      const pCat = modo === 'pilasH' ? ya(d.etiqueta, medio) : xs(d.etiqueta, medio);
      const pVal = modo === 'pilasH' ? xs(v) : ya(v);
      if (pCat == null || pVal == null) return null;
      return modo === 'pilasH'
        ? { id: `b${i}`, x: pVal, y: pCat, ancho: Infinity, valor: v, texto: fmt(v, series[0].formato) }
        : { id: `b${i}`, x: pCat, y: pVal, ancho: Math.min(banda, 56), valor: v, texto: fmt(v, series[0].formato) };
    }).filter((b): b is NonNullable<typeof b> => !!b);
    candidatos = modo === 'pilasH'
      ? barras.filter((b) => b.valor !== 0).map((b) => ({ id: b.id, x: b.x, y: b.y, texto: b.texto, prioridad: 1, valor: b.valor, lado: 'derecha' as const }))
      : candidatosDeColumnas(barras);
  }
  const puestas = etiquetasQueEntran(candidatos, caja, { tope: tope ?? topeModo, porSerie: modo === 'series' ? 2 : Infinity });
  if (!puestas.length) return null;
  return (
    <ZIndexLayer zIndex={DefaultZIndexes.label + 100}>
      <g pointerEvents="none" aria-hidden="true">
        {puestas.map((p) => (
          <text key={p.id} x={p.caja.x + p.caja.w / 2} y={p.caja.y + p.caja.h / 2} textAnchor="middle" dominantBaseline="central"
            fontSize={ETIQUETA.tam} fontWeight={ETIQUETA.peso}
            // En `style` y no como atributo: un var() en un atributo SVG no está garantizado.
            style={{ fill: 'var(--ink)', stroke: halo, strokeWidth: ETIQUETA.halo, paintOrder: 'stroke', strokeLinejoin: 'round', fontVariantNumeric: 'tabular-nums' }}>
            {p.texto}
          </text>
        ))}
      </g>
    </ZIndexLayer>
  );
}
