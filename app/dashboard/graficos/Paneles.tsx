'use client';

// =============================================================================
// Paneles — una métrica por gráfico chico, como la Tendencias vieja que Martín aprobó
// =============================================================================
// Tendencias (gasto en USD + leads, agendas y cierres por día) se dibujaba en UN lienzo con DOS ejes Y: las
// líneas se cruzaban sin significado y, con etiquetas, salían cuatro números por día uno encima del otro (la
// captura del punto 13). La vieja (scratchpad/viejo/app__components_TendenciasSection.tsx) era un gráfico por
// métrica, en dos columnas, con el número grande arriba y sin etiquetas por punto. Eso es esto.
//
// Cuándo se usa lo decide `usaPaneles` (lib/graficos-gordo.ts), CALCULADO: dos formatos o tres métricas. Sin
// campo nuevo, le llega también al informe guardado de Mauricio.
//
//   · El número de cada panel es el TOTAL del período (`Resultado.totales`), no el último valor como la vieja:
//     así coincide con las KPI de la misma hoja. Con «Comparar», el chip contra el período anterior.
//   · Cada panel: su color, el área con trazo gordo y degradado, el Y escondido, tres marcas en X (primera,
//     medio, última) y la etiqueta sólo en el último punto.
//   · El clic en un punto abre el detalle con la métrica de ESE panel.

import { Area, AreaChart, Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import { chipComparar, fmtValor, type Resultado } from '@/lib/graficos-agregar';
import type { Formato } from '@/lib/graficos-catalogo';
import { BARRA, LETRA, MARGEN, textoConMuestra } from '@/lib/graficos-gordo';
import { CapaEtiquetas } from './Etiquetas';
import { AreaMedida } from './medida';
import { puntoActivo, puntosDe } from './puntos';

export type DatosPaneles = { claves: string[]; nombres: string[]; formatos: Formato[]; datos: Array<Record<string, string | number | null>> };

export function Paneles({ r, s, color, comparar, compacto, trazo, radio, halo, columnas, alPunto, idGrafico }: {
  r: Resultado; s: DatosPaneles; color: (i: number) => string; comparar: boolean; compacto: boolean; trazo: number; radio: number; halo: string;
  /** Columnas (en vez de área): los paneles de un gráfico de columnas o de barras. */
  columnas: boolean;
  /** El clic en un punto de un panel: la clave del grupo y la métrica de ese panel. */
  alPunto?: (clave: string, metrica: string) => void;
  idGrafico: string;
}) {
  const n = s.claves.length;
  const ticks = (() => {
    const ets = s.datos.map((d) => String(d.etiqueta));
    if (ets.length <= 3) return ets;
    return [...new Set([ets[0], ets[Math.floor((ets.length - 1) / 2)], ets[ets.length - 1]])];
  })();
  return (
    <div className={`gr-paneles${n === 1 ? ' gr-paneles--uno' : ''}`}>
      {s.claves.map((k, i) => {
        const f = s.formatos[i];
        const total = r.totales[i] ?? null;
        const chip = comparar ? chipComparar(total, r.anterior?.[i] ?? null) : null;
        const gid = `pn-${idGrafico}-${i}`;
        const clic = alPunto
          ? (st: { isTooltipActive?: boolean; activeTooltipIndex?: number | string | null }) => {
            const j = typeof st.activeTooltipIndex === 'number' ? st.activeTooltipIndex : Number(st.activeTooltipIndex ?? NaN);
            const clave = st.isTooltipActive && Number.isInteger(j) ? s.datos[j]?.__clave : null;
            if (typeof clave === 'string' && clave) alPunto(clave, k);
          }
          : undefined;
        return (
          <div key={k} className="gr-panel">
            <div className="gr-panel-cab"><span className="gr-punto" style={{ background: color(i) }} /><span title={s.nombres[i]}>{s.nombres[i]}</span></div>
            <div className="gr-panel-num"><b>{textoConMuestra(total, r.muestraChica?.[i], f, (x) => fmtValor(x, f, compacto))}</b>{chip && <span className="gr-chip" title="Contra el período anterior">{chip}</span>}</div>
            <AreaMedida minAlto={36}>
              {(tam) => {
                if (tam.h < 36) return null;
                const conEje = tam.h >= 70;
                const comun = { width: tam.w, height: tam.h, data: s.datos, margin: { ...MARGEN, top: conEje ? 22 : 6, bottom: 0 }, onClick: clic, cursor: alPunto ? 'pointer' : undefined };
                const ejeX = <XAxis dataKey="etiqueta" ticks={ticks} interval={0} tick={{ fontSize: LETRA.tick, style: { fill: 'var(--dim)' } }} axisLine={false} tickLine={false} hide={!conEje} />;
                const ejeY = <YAxis yAxisId="a" hide domain={[0, 'auto']} />;
                const tip = <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: LETRA.tooltip, color: 'var(--ink)', padding: '8px 12px' }} labelStyle={{ color: 'var(--dim)', fontSize: LETRA.tooltipRotulo }} formatter={(v) => [fmtValor(typeof v === 'number' ? v : null, f, compacto), s.nombres[i]]} />;
                if (columnas) {
                  return (
                    <BarChart {...comun} barCategoryGap={BARRA.separacion}>
                      {ejeX}{ejeY}{tip}
                      <Bar yAxisId="a" dataKey={k} name={s.nombres[i]} fill={color(i)} radius={[radio, radio, 0, 0]} maxBarSize={BARRA.maxVertical} isAnimationActive={false} />
                      {conEje && <CapaEtiquetas datos={s.datos} series={[{ key: k, formato: f, eje: 'a' }]} modo="columnas" fmt={(v, ff) => fmtValor(v, ff, true)} halo={halo} tope={2} />}
                    </BarChart>
                  );
                }
                return (
                  <AreaChart {...comun}>
                    <defs>
                      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color(i)} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={color(i)} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {ejeX}{ejeY}{tip}
                    <Area yAxisId="a" type="monotone" dataKey={k} name={s.nombres[i]} stroke={color(i)} strokeWidth={trazo} strokeLinecap="round" strokeLinejoin="round"
                      fill={`url(#${gid})`} isAnimationActive={false} connectNulls
                      dot={puntosDe(s.datos, k, color(i), halo)} activeDot={puntoActivo(color(i), halo)} />
                    {conEje && <CapaEtiquetas datos={s.datos} series={[{ key: k, formato: f, eje: 'a' }]} modo="series" fmt={(v, ff) => fmtValor(v, ff, true)} halo={halo} tope={1} />}
                  </AreaChart>
                );
              }}
            </AreaMedida>
          </div>
        );
      })}
    </div>
  );
}
