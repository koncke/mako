'use client';

// =============================================================================
// Grafico — dibuja UN componente del Dashboard a partir de lo que devolvió el server
// =============================================================================
// No sabe de fuentes ni de la base: recibe el `Resultado` de lib/graficos-agregar.ts y lo pinta
// según el tipo, con el ESTILO del gráfico (colores, etiquetas, leyenda, ejes, cuadrícula,
// formato). Llena la celda de la grilla: el alto lo pone react-grid-layout, así que la caja es
// flex en columna y el área estira con `flex: 1; min-height: 0` (AGENTS.md: `height: 100%`
// contra un alto de flex no resuelve en Safari).

import type { ReactElement, ReactNode } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, ComposedChart, ScatterChart, Scatter, Treemap, Sankey, FunnelChart, Funnel, LabelList,
} from 'recharts';
import { Spinner } from '@/app/_ui';
import { tipoDe, type Formato, type Grafico as G } from '@/lib/graficos-catalogo';
import { fmtValor, histograma, OTROS, type Resultado } from '@/lib/graficos-agregar';

const GRIS = '#9AA0A6';
const TIP = { background: '#fff', border: '1px solid #dadce0', borderRadius: 4, fontSize: 12.5, color: '#202124', boxShadow: '0 1px 3px rgba(60,64,67,.25)' };
const EJE = { fill: '#5f6368', fontSize: 11.5 };

export type EstadoDatos = { cargando: boolean; error?: string; resultado?: Resultado };

function Mensaje({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#80868b', fontSize: 13, textAlign: 'center', padding: 8 }}>{children}</div>;
}

/** El área del gráfico: estira con flex y le da a recharts una caja con medida. */
function Area0({ children }: { children: ReactElement }) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function vacio(r: Resultado): boolean {
  return !r.filas.length ? r.totales.every((v) => !v) : r.filas.every((f) => f.valores.every((v) => !v));
}

/** Las series de un gráfico de ejes: las métricas, o las columnas del desglose si lo hay. */
function series(r: Resultado): { claves: string[]; nombres: string[]; formatos: Formato[]; datos: Array<Record<string, string | number | null>> } {
  if (r.cruce) {
    const claves = r.cruce.claves.map((_, j) => `c${j}`);
    const datos = r.filas.map((f, i) => {
      const o: Record<string, string | number | null> = { etiqueta: f.etiqueta };
      r.cruce!.celdas[i].forEach((v, j) => { o[`c${j}`] = v; });
      return o;
    });
    return { claves, nombres: r.cruce.claves, formatos: claves.map(() => r.columnas[0].formato), datos };
  }
  const claves = r.columnas.map((c) => c.id);
  const datos = r.filas.map((f) => {
    const o: Record<string, string | number | null> = { etiqueta: f.etiqueta };
    r.columnas.forEach((c, i) => { o[c.id] = f.valores[i]; });
    return o;
  });
  return { claves, nombres: r.columnas.map((c) => c.nombre), formatos: r.columnas.map((c) => c.formato), datos };
}

export function CuerpoGrafico({ g, estado }: { g: G; estado: EstadoDatos }) {
  const r = estado.resultado;
  if (!r) return <Mensaje>{estado.error ?? <Spinner size={20} />}</Mensaje>;
  if (estado.error) return <Mensaje>{estado.error}</Mensaje>;
  const e = g.estilo;
  const c = (i: number, etiqueta?: string) => (etiqueta === OTROS ? GRIS : e.colores[i % e.colores.length]);
  const info = tipoDe(g.tipo);
  const fmt = (v: number | null, f: Formato) => fmtValor(v, f, e.compacto);
  const tick = (f: Formato) => (v: number) => fmtValor(v, f, true);
  const leyenda = e.leyenda === 'no' ? null : (
    <Legend verticalAlign={e.leyenda === 'abajo' ? 'bottom' : e.leyenda === 'derecha' ? 'middle' : 'top'} align={e.leyenda === 'derecha' ? 'right' : 'center'} layout={e.leyenda === 'derecha' ? 'vertical' : 'horizontal'}
      iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#5f6368' }} />
  );

  // ── Cuadros de resultados ──
  if (info?.grupo === 'Cuadro de resultados' || g.tipo === 'serie_sparkline') {
    const col = r.columnas[0];
    const compacto = g.tipo === 'numero_compacto' || e.compacto;
    const tam = g.tipo === 'numero_compacto' ? 24 : 30;
    const grande = (
      <div style={{ fontSize: tam, fontWeight: 400, color: '#202124', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: e.alinear === 'centro' ? 'center' : 'left' }}>
        {col ? fmtValor(r.totales[0], col.formato, compacto) : '—'}
      </div>
    );
    if (g.tipo === 'numero_tendencia' || g.tipo === 'serie_sparkline') {
      const datos = g.tipo === 'serie_sparkline' ? r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] })) : (r.serie ?? []).map((s) => ({ etiqueta: s.etiqueta, valor: s.valor }));
      return (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grande}
          <Area0>
            <LineChart data={datos} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
              <Line type="monotone" dataKey="valor" stroke={c(0)} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Tooltip contentStyle={TIP} formatter={(v) => [fmt(typeof v === 'number' ? v : null, col?.formato ?? 'numero'), col?.nombre ?? '']} labelFormatter={(l) => String(l)} />
            </LineChart>
          </Area0>
        </div>
      );
    }
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>{grande}</div>;
  }

  // ── Bala e indicador: un total contra un objetivo ──
  if (g.tipo === 'bala' || info?.grupo === 'Indicador') {
    const col = r.columnas[0];
    const v = r.totales[0] ?? 0;
    const objetivo = e.objetivo;
    const max = e.maximo ?? (objetivo ? Math.max(objetivo, v) * 1.2 : v ? v * 1.5 : 1);
    if (g.tipo === 'bala') return <Bala v={v} objetivo={objetivo} max={max} color={c(0)} texto={col ? fmtValor(v, col.formato, e.compacto) : '—'} textoObj={objetivo != null && col ? fmtValor(objetivo, col.formato, true) : null} />;
    return <Indicador v={v} max={max} objetivo={objetivo} color={c(0)} rangos={g.tipo === 'indicador_rangos'} texto={col ? fmtValor(v, col.formato, e.compacto) : '—'} />;
  }

  // ── Embudo: cada métrica es un escalón ──
  if (info?.grupo === 'Embudo de conversión') {
    const pasos = r.columnas.map((col, i) => ({ nombre: col.nombre, valor: r.totales[i] ?? 0, formato: col.formato }));
    if (!pasos.some((p) => p.valor)) return <Mensaje>Sin datos en este período</Mensaje>;
    if (g.tipo === 'embudo') {
      return (
        <Area0>
          <FunnelChart>
            <Tooltip contentStyle={TIP} formatter={(v, n) => [fmt(typeof v === 'number' ? v : null, 'numero'), String(n)]} />
            <Funnel dataKey="valor" nameKey="nombre" data={pasos.map((p, i) => ({ ...p, fill: c(i) }))} isAnimationActive={false}>
              <LabelList position="right" fill="#3c4043" stroke="none" dataKey="nombre" fontSize={12} />
              <LabelList position="center" fill="#fff" stroke="none" dataKey="valor" fontSize={12} formatter={(v: unknown) => fmtValor(Number(v), 'numero', true)} />
            </Funnel>
          </FunnelChart>
        </Area0>
      );
    }
    return <EmbudoBarras pasos={pasos} vertical={g.tipo === 'embudo_columnas'} color={c} compacto={e.compacto} />;
  }

  if (vacio(r)) return <Mensaje>Sin datos en este período</Mensaje>;

  // ── Tablas ──
  if (info?.grupo === 'Tabla') return <Tabla r={r} modo={g.tipo === 'tabla_barras' ? 'barras' : g.tipo === 'tabla_calor' ? 'calor' : 'plana'} color={c(0)} total={e.total} compacto={e.compacto} />;
  if (info?.grupo === 'Tabla dinámica') return <Dinamica r={r} modo={g.tipo === 'dinamica_barras' ? 'barras' : g.tipo === 'dinamica_calor' ? 'calor' : 'plana'} color={c(0)} total={e.total} compacto={e.compacto} />;

  // ── Circular ──
  if (info?.grupo === 'Circular') {
    const col = r.columnas[0];
    const datos = r.filas.map((f) => ({ etiqueta: f.etiqueta, valor: f.valores[0] ?? 0 }));
    const total = datos.reduce((s, d) => s + d.valor, 0);
    return (
      <Area0>
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={g.tipo === 'anillo' ? '55%' : 0} outerRadius="85%" isAnimationActive={false} stroke="#fff"
            label={e.etiquetas ? (p: { value?: number }) => `${total ? Math.round(((p.value ?? 0) / total) * 100) : 0}%` : false} labelLine={false}>
            {datos.map((d, i) => <Cell key={i} fill={c(i, d.etiqueta)} />)}
          </Pie>
          <Tooltip contentStyle={TIP} formatter={(v, n) => [`${fmt(typeof v === 'number' ? v : null, col.formato)} · ${total ? Math.round(((Number(v) || 0) / total) * 100) : 0}%`, String(n)]} />
          {leyenda}
        </PieChart>
      </Area0>
    );
  }

  // ── Rectángulos ──
  if (g.tipo === 'rectangulos') {
    const col = r.columnas[0];
    const datos = r.filas.map((f, i) => ({ name: f.etiqueta, size: Math.max(0, f.valores[0] ?? 0), fill: c(i, f.etiqueta) }));
    return (
      <Area0>
        <Treemap data={datos} dataKey="size" nameKey="name" isAnimationActive={false} stroke="#fff"
          content={<CeldaTreemap formato={col.formato} compacto={e.compacto} />} />
      </Area0>
    );
  }

  // ── Sankey: de la dimensión al desglose ──
  if (g.tipo === 'sankey') {
    if (!r.cruce) return <Mensaje>Elige una dimensión de desglose</Mensaje>;
    const izq = r.filas.map((f) => f.etiqueta);
    const der = r.cruce.claves.map((k) => `${k} `);
    const nodes = [...izq, ...der].map((name) => ({ name }));
    const links: Array<{ source: number; target: number; value: number }> = [];
    r.cruce.celdas.forEach((fila, i) => fila.forEach((v, j) => { if (v && v > 0) links.push({ source: i, target: izq.length + j, value: v }); }));
    if (!links.length) return <Mensaje>Sin datos en este período</Mensaje>;
    return (
      <Area0>
        <Sankey data={{ nodes, links }} nodePadding={14} nodeWidth={10} link={{ stroke: c(0), strokeOpacity: 0.25 }} node={<NodoSankey color={c(0)} />} margin={{ top: 8, right: 120, bottom: 8, left: 8 }}>
          <Tooltip contentStyle={TIP} />
        </Sankey>
      </Area0>
    );
  }

  // ── Dispersión y burbujas ──
  if (info?.grupo === 'Dispersión') {
    const [cx, cy, cz] = r.columnas;
    const datos = r.filas.map((f) => ({ etiqueta: f.etiqueta, x: f.valores[0] ?? 0, y: f.valores[1] ?? 0, z: f.valores[2] ?? 1 }));
    return (
      <Area0>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          {e.cuadricula && <CartesianGrid stroke="#e8eaed" />}
          <XAxis type="number" dataKey="x" name={cx.nombre} tick={EJE} tickFormatter={tick(cx.formato)} hide={!e.ejes} />
          <YAxis type="number" dataKey="y" name={cy.nombre} tick={EJE} tickFormatter={tick(cy.formato)} width={58} hide={!e.ejes} />
          {g.tipo === 'burbujas' && <ZAxis type="number" dataKey="z" range={[40, 900]} name={cz?.nombre} />}
          <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: '3 3' }}
            formatter={(v, n) => { const col = [cx, cy, cz].find((x) => x?.nombre === n); return [fmt(typeof v === 'number' ? v : null, col?.formato ?? 'numero'), String(n)]; }}
            labelFormatter={() => ''} />
          <Scatter data={datos} fill={c(0)} isAnimationActive={false}>
            {e.etiquetas && <LabelList dataKey="etiqueta" position="top" fontSize={11} fill="#5f6368" />}
          </Scatter>
        </ScatterChart>
      </Area0>
    );
  }

  // ── Histograma ──
  if (g.tipo === 'histograma') {
    const col = r.columnas[0];
    const franjas = histograma(r.filas.map((f) => f.valores[0] ?? 0)).map((x) => ({ ...x, etiqueta: `${fmtValor(x.desde, col.formato, true)}–${fmtValor(x.hasta, col.formato, true)}` }));
    return (
      <Area0>
        <BarChart data={franjas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
          {e.cuadricula && <CartesianGrid stroke="#e8eaed" vertical={false} />}
          <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" hide={!e.ejes} />
          <YAxis tick={EJE} allowDecimals={false} width={40} hide={!e.ejes} />
          <Tooltip contentStyle={TIP} formatter={(v) => [String(v), 'Cantidad']} />
          <Bar dataKey="cuantos" name="Cantidad" fill={c(0)} isAnimationActive={false}>
            {e.etiquetas && <LabelList dataKey="cuantos" position="top" fontSize={11} fill="#5f6368" />}
          </Bar>
        </BarChart>
      </Area0>
    );
  }

  // ── Cascada ──
  if (g.tipo === 'cascada') {
    const col = r.columnas[0];
    let acum = 0;
    const datos = r.filas.map((f) => {
      const v = f.valores[0] ?? 0;
      const base = v >= 0 ? acum : acum + v;
      acum += v;
      return { etiqueta: f.etiqueta, base, alto: Math.abs(v), v, sube: v >= 0 };
    });
    datos.push({ etiqueta: 'Total', base: 0, alto: Math.abs(acum), v: acum, sube: acum >= 0 });
    return (
      <Area0>
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {e.cuadricula && <CartesianGrid stroke="#e8eaed" vertical={false} />}
          <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" hide={!e.ejes} />
          <YAxis tick={EJE} tickFormatter={tick(col.formato)} width={58} hide={!e.ejes} />
          <Tooltip contentStyle={TIP} formatter={(_v, _n, it) => [fmt((it?.payload as { v?: number })?.v ?? null, col.formato), col.nombre]} />
          <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="alto" stackId="c" isAnimationActive={false}>
            {datos.map((d, i) => <Cell key={i} fill={i === datos.length - 1 ? c(0) : d.sube ? '#34A853' : '#EA4335'} />)}
          </Bar>
        </BarChart>
      </Area0>
    );
  }

  // ── Cronología: cuándo empezó y terminó cada grupo ──
  if (g.tipo === 'cronologia') {
    const dia = (s?: string) => (s ? Math.round(Date.parse(`${s}T12:00:00Z`) / 86_400_000) : 0);
    const filas = r.filas.filter((f) => f.desde);
    if (!filas.length) return <Mensaje>Sin datos en este período</Mensaje>;
    const datos = filas.map((f) => ({ etiqueta: f.etiqueta, rango: [dia(f.desde), dia(f.hasta) + 1] as [number, number] }));
    const fecha = (n: number) => { const d = new Date(n * 86_400_000); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
    return (
      <Area0>
        <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {e.cuadricula && <CartesianGrid stroke="#e8eaed" horizontal={false} />}
          <XAxis type="number" domain={['dataMin', 'dataMax']} tick={EJE} tickFormatter={fecha} hide={!e.ejes} />
          <YAxis type="category" dataKey="etiqueta" tick={EJE} width={130} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
          <Tooltip contentStyle={TIP} formatter={(v) => { const [a, b] = v as [number, number]; return [`${fecha(a)} → ${fecha(b - 1)}`, 'Del … al …']; }} />
          <Bar dataKey="rango" fill={c(0)} isAnimationActive={false} radius={2} />
        </BarChart>
      </Area0>
    );
  }

  // ── Ejes: series, líneas, áreas, columnas, barras y combinados ──
  const s = series(r);
  const formatos = [...new Set(s.formatos)].slice(0, 2);
  const eje = (f: Formato) => (formatos.indexOf(f) <= 0 ? 'a' : 'b');
  const ejesY = formatos.map((f, i) => (
    <YAxis key={f} yAxisId={i === 0 ? 'a' : 'b'} orientation={i === 0 ? 'left' : 'right'} tick={EJE} width={60} tickFormatter={tick(f)} axisLine={false} tickLine={false} hide={!e.ejes} />
  ));
  const fmtTip = (v: unknown, nombre: unknown) => {
    const i = s.nombres.indexOf(String(nombre));
    return [fmt(typeof v === 'number' ? v : null, s.formatos[Math.max(0, i)] ?? 'numero'), String(nombre)] as [string, string];
  };
  const etiquetas = (k: string, i: number) => (e.etiquetas ? <LabelList dataKey={k} position="top" fontSize={10.5} fill="#5f6368" formatter={(v: unknown) => fmtValor(Number(v), s.formatos[i], true)} /> : null);
  const grilla = e.cuadricula ? <CartesianGrid stroke="#e8eaed" vertical={false} /> : null;
  const ejeX = <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" minTickGap={14} axisLine={false} tickLine={false} hide={!e.ejes} />;
  const cien = g.tipo.endsWith('_100');
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ejesY100 = <YAxis yAxisId="a" tick={EJE} width={44} tickFormatter={pct} axisLine={false} tickLine={false} hide={!e.ejes} />;

  if (info?.grupo === 'Serie temporal' || g.tipo === 'lineas' || g.tipo === 'lineas_suaves') {
    const curva = g.tipo === 'serie_suave' || g.tipo === 'lineas_suaves' ? 'monotone' : 'linear';
    return (
      <Area0>
        <LineChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          {grilla}{ejeX}{ejesY}
          <Tooltip contentStyle={TIP} formatter={fmtTip} />
          {leyenda}
          {s.claves.map((k, i) => (
            <Line key={k} yAxisId={eje(s.formatos[i])} type={curva} dataKey={k} name={s.nombres[i]} stroke={c(i, s.nombres[i])} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls>
              {etiquetas(k, i)}
            </Line>
          ))}
        </LineChart>
      </Area0>
    );
  }

  if (info?.grupo === 'Áreas') {
    const apilada = g.tipo !== 'area';
    return (
      <Area0>
        <AreaChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} stackOffset={cien ? 'expand' : 'none'}>
          {grilla}{ejeX}{cien ? ejesY100 : ejesY}
          <Tooltip contentStyle={TIP} formatter={fmtTip} />
          {leyenda}
          {s.claves.map((k, i) => (
            <Area key={k} yAxisId={cien ? 'a' : eje(s.formatos[i])} type="monotone" dataKey={k} name={s.nombres[i]} stackId={apilada ? 'a' : undefined}
              stroke={c(i, s.nombres[i])} fill={c(i, s.nombres[i])} fillOpacity={apilada ? 0.7 : 0.25} isAnimationActive={false} connectNulls />
          ))}
        </AreaChart>
      </Area0>
    );
  }

  if (g.tipo === 'combinado' || g.tipo === 'combinado_apilado') {
    // Las métricas en columnas y la última en línea (con su propio eje si es de otro formato).
    const nBarras = g.tipo === 'combinado' ? 1 : Math.max(1, s.claves.length - 1);
    return (
      <Area0>
        <ComposedChart data={s.datos} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          {grilla}{ejeX}{ejesY}
          <Tooltip contentStyle={TIP} formatter={fmtTip} />
          {leyenda}
          {s.claves.map((k, i) => (i < nBarras ? (
            <Bar key={k} yAxisId={eje(s.formatos[i])} dataKey={k} name={s.nombres[i]} fill={c(i)} stackId={g.tipo === 'combinado_apilado' ? 'a' : undefined} isAnimationActive={false} maxBarSize={40}>{etiquetas(k, i)}</Bar>
          ) : (
            <Line key={k} yAxisId={eje(s.formatos[i])} type="monotone" dataKey={k} name={s.nombres[i]} stroke={c(i)} strokeWidth={2} dot={false} isAnimationActive={false}>{etiquetas(k, i)}</Line>
          )))}
        </ComposedChart>
      </Area0>
    );
  }

  // Columnas y barras (sueltas, apiladas o al 100%).
  const horizontal = g.tipo.startsWith('barras');
  const apilada = g.tipo.includes('apiladas') || cien;
  const unaSola = s.claves.length === 1 && !r.cruce;
  return (
    <Area0>
      <BarChart data={s.datos} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} stackOffset={cien ? 'expand' : 'none'}>
        {e.cuadricula && <CartesianGrid stroke="#e8eaed" horizontal={!horizontal} vertical={horizontal} />}
        {horizontal ? (
          <>
            <YAxis type="category" dataKey="etiqueta" tick={EJE} width={130} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} hide={!e.ejes} />
            <XAxis type="number" tick={EJE} tickFormatter={cien ? pct : tick(s.formatos[0])} axisLine={false} tickLine={false} hide={!e.ejes} />
          </>
        ) : (
          <>{ejeX}{cien ? ejesY100 : ejesY}</>
        )}
        <Tooltip contentStyle={TIP} formatter={fmtTip} cursor={{ fill: '#f1f3f4' }} />
        {!unaSola && leyenda}
        {s.claves.map((k, i) => (
          <Bar key={k} {...(horizontal ? {} : { yAxisId: cien ? 'a' : eje(s.formatos[i]) })} dataKey={k} name={s.nombres[i]} fill={c(i, s.nombres[i])} stackId={apilada ? 'a' : undefined}
            isAnimationActive={false} maxBarSize={horizontal ? 24 : 44}>
            {unaSola && s.datos.map((d, j) => <Cell key={j} fill={d.etiqueta === OTROS ? GRIS : c(0)} />)}
            {e.etiquetas && <LabelList dataKey={k} position={apilada ? 'center' : horizontal ? 'right' : 'top'} fontSize={10.5} fill={apilada ? '#fff' : '#5f6368'} formatter={(v: unknown) => (cien ? '' : fmtValor(Number(v), s.formatos[i], true))} />}
          </Bar>
        ))}
      </BarChart>
    </Area0>
  );
}

// ── Piezas propias ─────────────────────────────────────────────────────────────────────────

function Tabla({ r, modo, color, total, compacto }: { r: Resultado; modo: 'plana' | 'barras' | 'calor'; color: string; total: boolean; compacto: boolean }) {
  const max = r.columnas.map((_, i) => Math.max(0, ...r.filas.map((f) => Math.abs(f.valores[i] ?? 0))));
  return (
    <div className="lk-tabla">
      <table>
        <thead>
          <tr><th className="lk-tabla-izq" />{r.columnas.map((c) => <th key={c.id}>{c.nombre}</th>)}</tr>
        </thead>
        <tbody>
          {r.filas.map((f) => (
            <tr key={f.clave}>
              <td className="lk-tabla-izq" title={f.etiqueta}>{f.etiqueta}</td>
              {f.valores.map((v, i) => {
                const p = max[i] ? Math.abs(v ?? 0) / max[i] : 0;
                if (modo === 'barras') {
                  // Como en Looker: el número y, a su derecha, la barra. Encima del número no se lee.
                  return (
                    <td key={i} className="lk-tabla-barra">
                      <span className="lk-celda-barra">
                        <span className="lk-celda-num">{fmtValor(v, r.columnas[i].formato, compacto)}</span>
                        <span className="lk-celda-pista"><span style={{ width: `${Math.min(100, p * 100)}%`, background: color }} /></span>
                      </span>
                    </td>
                  );
                }
                return <td key={i} style={modo === 'calor' ? { background: `${color}${Math.round(p * 0.85 * 255).toString(16).padStart(2, '0')}` } : undefined}>{fmtValor(v, r.columnas[i].formato, compacto)}</td>;
              })}
            </tr>
          ))}
          {total && (
            <tr className="lk-tabla-total">
              <td className="lk-tabla-izq">Total general</td>
              {r.totales.map((v, i) => <td key={i}>{fmtValor(v, r.columnas[i].formato, compacto)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      {r.fuera > 0 && <p className="lk-tabla-mas">+{r.fuera} más</p>}
    </div>
  );
}

function Dinamica({ r, modo, color, total, compacto }: { r: Resultado; modo: 'plana' | 'barras' | 'calor'; color: string; total: boolean; compacto: boolean }) {
  if (!r.cruce) return <Mensaje>Elige una dimensión de columna</Mensaje>;
  const f0 = r.columnas[0].formato;
  const todos = r.cruce.celdas.flat().map((v) => Math.abs(v ?? 0));
  const max = Math.max(0, ...todos);
  const totCol = r.cruce.claves.map((_, j) => r.cruce!.celdas.reduce((s, fila) => s + (fila[j] ?? 0), 0));
  return (
    <div className="lk-tabla">
      <table>
        <thead>
          <tr><th className="lk-tabla-izq">{r.columnas[0].nombre}</th>{r.cruce.claves.map((k) => <th key={k}>{k}</th>)}<th>Total</th></tr>
        </thead>
        <tbody>
          {r.filas.map((f, i) => (
            <tr key={f.clave}>
              <td className="lk-tabla-izq" title={f.etiqueta}>{f.etiqueta}</td>
              {r.cruce!.celdas[i].map((v, j) => {
                const p = max ? Math.abs(v ?? 0) / max : 0;
                if (modo === 'barras') {
                  return <td key={j} className="lk-tabla-barra"><span className="lk-celda-barra"><span className="lk-celda-num">{v ? fmtValor(v, f0, compacto) : ''}</span><span className="lk-celda-pista"><span style={{ width: `${p * 100}%`, background: color }} /></span></span></td>;
                }
                return <td key={j} style={modo === 'calor' ? { background: `${color}${Math.round(p * 0.85 * 255).toString(16).padStart(2, '0')}` } : undefined}>{v ? fmtValor(v, f0, compacto) : ''}</td>;
              })}
              <td className="lk-tabla-fuerte">{fmtValor(f.valores[0], f0, compacto)}</td>
            </tr>
          ))}
          {total && (
            <tr className="lk-tabla-total">
              <td className="lk-tabla-izq">Total general</td>
              {totCol.map((v, j) => <td key={j}>{fmtValor(v, f0, compacto)}</td>)}
              <td>{fmtValor(r.totales[0], f0, compacto)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Bala({ v, objetivo, max, color, texto, textoObj }: { v: number; objetivo: number | null; max: number; color: string; texto: string; textoObj: string | null }) {
  const p = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
      <div style={{ fontSize: 22, color: '#202124' }}>{texto}{textoObj && <span style={{ fontSize: 13, color: '#5f6368' }}> de {textoObj}</span>}</div>
      <div style={{ position: 'relative', height: 22, background: '#e8eaed', borderRadius: 2 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: p(max * 0.66), background: '#dadce0' }} />
        <div style={{ position: 'absolute', left: 0, top: 6, height: 10, width: p(v), background: color }} />
        {objetivo != null && <div style={{ position: 'absolute', top: 2, bottom: 2, width: 3, left: p(objetivo), background: '#202124' }} />}
      </div>
    </div>
  );
}

function Indicador({ v, max, objetivo, color, rangos, texto }: { v: number; max: number; objetivo: number | null; color: string; rangos: boolean; texto: string }) {
  const ang = (x: number) => Math.PI * (1 - Math.min(1, Math.max(0, x / max)));
  const pt = (a: number, rr: number) => [100 + rr * Math.cos(a), 100 - rr * Math.sin(a)];
  const arco = (a0: number, a1: number, rr: number) => { const [x0, y0] = pt(a0, rr); const [x1, y1] = pt(a1, rr); return `M ${x0} ${y0} A ${rr} ${rr} 0 0 1 ${x1} ${y1}`; };
  const [nx, ny] = pt(ang(v), 62);
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 200 116" style={{ width: '100%', maxHeight: '100%' }} role="img" aria-label={texto}>
        {rangos ? (
          <>
            <path d={arco(Math.PI, Math.PI * 2 / 3, 80)} stroke="#EA4335" strokeWidth={22} fill="none" />
            <path d={arco(Math.PI * 2 / 3, Math.PI / 3, 80)} stroke="#FBBC04" strokeWidth={22} fill="none" />
            <path d={arco(Math.PI / 3, 0, 80)} stroke="#34A853" strokeWidth={22} fill="none" />
            <line x1={100} y1={100} x2={nx} y2={ny} stroke="#202124" strokeWidth={3} strokeLinecap="round" />
            <circle cx={100} cy={100} r={5} fill="#202124" />
          </>
        ) : (
          <>
            <path d={arco(Math.PI, 0, 80)} stroke="#e8eaed" strokeWidth={22} fill="none" />
            <path d={arco(Math.PI, ang(v), 80)} stroke={color} strokeWidth={22} fill="none" />
          </>
        )}
        {objetivo != null && (() => { const [a, b] = pt(ang(objetivo), 94); const [c2, d] = pt(ang(objetivo), 66); return <line x1={a} y1={b} x2={c2} y2={d} stroke="#202124" strokeWidth={2.5} />; })()}
        <text x={100} y={rangos ? 86 : 96} textAnchor="middle" fontSize={20} fill="#202124">{texto}</text>
      </svg>
    </div>
  );
}

function EmbudoBarras({ pasos, vertical, color, compacto }: { pasos: Array<{ nombre: string; valor: number; formato: Formato }>; vertical: boolean; color: (i: number) => string; compacto: boolean }) {
  const max = Math.max(1, ...pasos.map((p) => p.valor));
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: 8, justifyContent: 'center', alignItems: vertical ? 'flex-end' : 'stretch', overflow: 'hidden' }}>
      {pasos.map((p, i) => {
        const conv = i > 0 && pasos[i - 1].valor ? Math.round((p.valor / pasos[i - 1].valor) * 100) : null;
        const tam = `${Math.max(2, (p.valor / max) * 100)}%`;
        return vertical ? (
          <div key={p.nombre} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: '#202124' }}>{fmtValor(p.valor, p.formato, compacto)}</span>
            <div style={{ width: '70%', height: tam, background: color(i), borderRadius: '2px 2px 0 0' }} />
            <span style={{ fontSize: 11.5, color: '#5f6368', textAlign: 'center' }}>{p.nombre}{conv != null ? ` · ${conv}%` : ''}</span>
          </div>
        ) : (
          <div key={p.nombre} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 30%) 1fr', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12.5, color: '#3c4043', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: tam, background: color(i), color: '#fff', fontSize: 12, padding: '6px 8px', textAlign: 'center', borderRadius: 2, whiteSpace: 'nowrap' }}>
                {fmtValor(p.valor, p.formato, compacto)}{conv != null ? ` · ${conv}%` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type CeldaProps = { x?: number; y?: number; width?: number; height?: number; name?: string; size?: number; fill?: string; formato: Formato; compacto: boolean };
function CeldaTreemap({ x = 0, y = 0, width = 0, height = 0, name, size, fill, formato, compacto }: CeldaProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
      {width > 60 && height > 28 && (
        <>
          <text x={x + 6} y={y + 16} fontSize={12} fill="#fff">{String(name ?? '').slice(0, Math.floor(width / 7))}</text>
          <text x={x + 6} y={y + 31} fontSize={11.5} fill="#fff" opacity={0.9}>{fmtValor(size ?? 0, formato, compacto || true)}</text>
        </>
      )}
    </g>
  );
}

type NodoProps = { x?: number; y?: number; width?: number; height?: number; payload?: { name?: string }; color: string };
function NodoSankey({ x = 0, y = 0, width = 0, height = 0, payload, color }: NodoProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} />
      <text x={x + width + 6} y={y + height / 2 + 4} fontSize={11.5} fill="#3c4043">{String(payload?.name ?? '').trim().slice(0, 24)}</text>
    </g>
  );
}
