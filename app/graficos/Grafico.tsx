'use client';

// =============================================================================
// Grafico — dibuja UN gráfico de «Mis gráficos» a partir de lo que devolvió el server
// =============================================================================
// No sabe de fuentes ni de la base: recibe el `Resultado` de lib/graficos-agregar.ts y lo
// pinta según el tipo. Llena la celda de la grilla: el alto lo pone react-grid-layout, así
// que la caja es flex en columna y el área del gráfico estira con `flex: 1; min-height: 0`
// (AGENTS.md: `height: 100%` contra un alto de flex no resuelve en Safari).

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Spinner } from '@/app/_ui';
import type { Grafico as G } from '@/lib/graficos-catalogo';
import { fmtValor, OTROS, type Resultado } from '@/lib/graficos-agregar';

/** Tonos medios: se leen sobre el claro y sobre el oscuro. «Otros» va siempre en gris. */
export const PALETA = ['#3B6FB0', '#C8870C', '#0E8E7E', '#6A4BD8', '#D0504A', '#5B8C2A', '#B04A8C', '#2E8FB8'];
const GRIS = '#8A93A3';
const colorDe = (i: number, etiqueta?: string) => (etiqueta === OTROS ? GRIS : PALETA[i % PALETA.length]);

const TIP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, color: 'var(--ink)' };
const EJE = { fill: 'var(--faint)', fontSize: 11.5 };

export type EstadoDatos = { cargando: boolean; error?: string; resultado?: Resultado };

function vacio(r: Resultado): boolean {
  return !r.filas.length ? r.totales.every((v) => !v) : r.filas.every((f) => f.valores.every((v) => !v));
}

function Mensaje({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: 8 }}>{children}</div>;
}

export function CuerpoGrafico({ g, estado }: { g: G; estado: EstadoDatos }) {
  const r = estado.resultado;
  if (!r) {
    if (estado.error) return <Mensaje>{estado.error}</Mensaje>;
    return <Mensaje><Spinner size={20} /></Mensaje>;
  }
  if (estado.error) return <Mensaje>{estado.error}</Mensaje>;

  if (g.tipo === 'numero') {
    const c = r.columnas[0];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c ? fmtValor(r.totales[0], c.formato) : '—'}
        </div>
      </div>
    );
  }

  if (vacio(r)) return <Mensaje>Sin datos en estas fechas</Mensaje>;

  if (g.tipo === 'tabla') return <Tabla r={r} />;

  const data = r.filas.map((f) => {
    const o: Record<string, string | number | null> = { etiqueta: f.etiqueta };
    r.columnas.forEach((c, i) => { o[c.id] = f.valores[i]; });
    return o;
  });
  const fmtTip = (v: unknown, nombre: unknown) => {
    const c = r.columnas.find((x) => x.nombre === nombre) ?? r.columnas[0];
    return [fmtValor(typeof v === 'number' ? v : null, c.formato), String(nombre)] as [string, string];
  };

  if (g.tipo === 'torta') {
    const c = r.columnas[0];
    const total = r.filas.reduce((s, f) => s + (f.valores[0] ?? 0), 0);
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: '1 1 50%', alignSelf: 'stretch', position: 'relative', minWidth: 90 }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey={c.id} nameKey="etiqueta" innerRadius="55%" outerRadius="92%" paddingAngle={1} isAnimationActive={false} stroke="var(--surface)">
                  {data.map((d, i) => <Cell key={i} fill={colorDe(i, String(d.etiqueta))} />)}
                </Pie>
                <Tooltip contentStyle={TIP} formatter={(v) => [fmtValor(typeof v === 'number' ? v : null, c.formato), c.nombre]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <ul style={{ flex: '1 1 50%', listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, maxHeight: '100%', overflowY: 'auto' }}>
          {r.filas.map((f, i) => (
            <li key={f.clave} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, minWidth: 0 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, flex: 'none', background: colorDe(i, f.etiqueta) }} />
              <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dim)' }} title={f.etiqueta}>{f.etiqueta}</span>
              <span style={{ flex: 'none', marginLeft: 'auto', fontWeight: 600, color: 'var(--ink)' }}>{total ? `${Math.round(((f.valores[0] ?? 0) / total) * 100)}%` : '—'}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Línea y barras: un eje por FORMATO. Plata y conteos en el mismo eje aplastan a uno de los dos.
  const formatos = [...new Set(r.columnas.map((c) => c.formato))].slice(0, 2);
  const ejeDe = (f: string) => (formatos.indexOf(f as never) <= 0 ? 'a' : 'b');
  const tick = (f: string) => (v: number) => fmtValor(v, f as never, true);
  const ejes = formatos.map((f, i) => (
    <YAxis key={f} yAxisId={i === 0 ? 'a' : 'b'} orientation={i === 0 ? 'left' : 'right'} tick={EJE} width={62} tickFormatter={tick(f)} axisLine={false} tickLine={false} />
  ));

  if (g.tipo === 'linea') {
    return (
      <Area>
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" minTickGap={18} axisLine={false} tickLine={false} />
          {ejes}
          <Tooltip contentStyle={TIP} formatter={fmtTip} />
          {r.columnas.map((c, i) => (
            <Line key={c.id} yAxisId={ejeDe(c.formato)} type="monotone" dataKey={c.id} name={c.nombre} stroke={PALETA[i]} strokeWidth={2.2} dot={false} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </Area>
    );
  }

  // Barras. Por categoría van acostadas: los nombres de campaña son largos y en un eje
  // vertical se cortan a tres letras.
  const acostadas = r.clase === 'categoria';
  return (
    <Area>
      <BarChart data={data} layout={acostadas ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" horizontal={!acostadas} vertical={acostadas} />
        {acostadas ? (
          <>
            <YAxis type="category" dataKey="etiqueta" tick={EJE} width={120} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
            <XAxis type="number" tick={EJE} tickFormatter={tick(r.columnas[0].formato)} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="etiqueta" tick={EJE} interval="preserveStartEnd" minTickGap={14} axisLine={false} tickLine={false} />
            {ejes}
          </>
        )}
        <Tooltip contentStyle={TIP} formatter={fmtTip} cursor={{ fill: 'var(--surface-2)' }} />
        {r.columnas.map((c, i) => (
          <Bar key={c.id} {...(acostadas ? {} : { yAxisId: ejeDe(c.formato) })} dataKey={c.id} name={c.nombre} fill={PALETA[i]} radius={acostadas ? [0, 3, 3, 0] : [3, 3, 0, 0]} isAnimationActive={false} maxBarSize={acostadas ? 22 : 40}>
            {r.columnas.length === 1 && data.map((d, j) => <Cell key={j} fill={d.etiqueta === OTROS ? GRIS : PALETA[0]} />)}
          </Bar>
        ))}
      </BarChart>
    </Area>
  );
}

function Area({ children }: { children: React.ReactElement }) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function Tabla({ r }: { r: Resultado }) {
  const th: React.CSSProperties = { textAlign: 'right', fontWeight: 600, fontSize: 11.5, color: 'var(--faint)', padding: '6px 8px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { textAlign: 'right', fontSize: 12.5, padding: '6px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }} />
            {r.columnas.map((c) => <th key={c.id} style={th}>{c.nombre}</th>)}
          </tr>
        </thead>
        <tbody>
          {r.filas.map((f) => (
            <tr key={f.clave}>
              <td style={{ ...td, textAlign: 'left', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--dim)' }} title={f.etiqueta}>{f.etiqueta}</td>
              {f.valores.map((v, i) => <td key={i} style={td}>{fmtValor(v, r.columnas[i].formato)}</td>)}
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: 'left', fontWeight: 600, borderBottom: 'none' }}>Total</td>
            {r.totales.map((v, i) => <td key={i} style={{ ...td, fontWeight: 600, borderBottom: 'none' }}>{fmtValor(v, r.columnas[i].formato)}</td>)}
          </tr>
        </tbody>
      </table>
      {r.fuera > 0 && <p style={{ margin: '6px 8px 0', fontSize: 11.5, color: 'var(--faint)' }}>+{r.fuera} más</p>}
    </div>
  );
}
