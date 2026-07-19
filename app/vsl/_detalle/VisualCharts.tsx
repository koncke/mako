'use client';

// =============================================================================
// VisualCharts — gráficos REALES de la app (Recharts) para las landings /vsl.
// =============================================================================
// Client islands: replican los charts del dashboard (mismos tipos de Recharts,
// misma estética) con datos falsos + interactividad + animación nativa. El
// dispatcher de Visual.tsx delega acá los tipos `rc*`, pasando el spec entero.

import { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
  RadialBarChart, RadialBar, PolarAngleAxis, FunnelChart, Funnel, LabelList,
} from 'recharts';

type Spec = { type: string; [k: string]: unknown };
const INK = '#12151B', DIM = '#6B7280', BORDER = '#E4E9F2';
const BLUE = '#2F6FED', GREEN = '#1E9E57', AMBER = '#E0890C', RED = '#DC2626', VIOLET = '#7C5CF0';
const SANS = "'Geist', sans-serif";
const toneC = (t: unknown) => ({ blue: BLUE, green: GREEN, amber: AMBER, red: RED, violet: VIOLET } as Record<string, string>)[String(t)] || BLUE;
const arr = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) && v.length ? (v as T[]) : d);
const str = (v: unknown, d = '') => (typeof v === 'string' && v ? v : d);
const cardW = { width: '100%', height: 250 } as const;
const wrap = (children: React.ReactNode) => <div style={{ fontFamily: SANS }}>{children}</div>;
const Cap = ({ children }: { children?: string }) => children ? <div style={{ fontSize: 12, fontWeight: 700, color: INK, margin: '2px 0 10px 4px' }}>{children}</div> : null;
const tip = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontFamily: SANS } as const;

// ── rcRevenue — tendencia con toggles (idéntico al RevenueMensualChart real) ─
const REV_SERIES = [
  { key: 'sold', label: 'Sold Revenue', color: '#C8870C' },
  { key: 'cash', label: 'Cash Collected', color: '#0E8E7E' },
  { key: 'spend', label: 'Ad Spend', color: '#3B6FB0' },
] as const;
type RevKey = typeof REV_SERIES[number]['key'];
const REV_DATA = [
  { label: 'Feb', sold: 22, cash: 14, spend: 6 }, { label: 'Mar', sold: 28, cash: 19, spend: 7 },
  { label: 'Abr', sold: 26, cash: 24, spend: 7 }, { label: 'May', sold: 35, cash: 27, spend: 8 },
  { label: 'Jun', sold: 41, cash: 31, spend: 9 }, { label: 'Jul', sold: 48, cash: 38, spend: 9 },
];
function RevenueTrend() {
  const [sel, setSel] = useState<Set<RevKey>>(new Set(['sold', 'cash', 'spend']));
  const toggle = (k: RevKey) => setSel((c) => { const n = new Set(c); if (n.has(k)) { if (n.size > 1) n.delete(k); } else n.add(k); return n; });
  const activos = REV_SERIES.filter((s) => sel.has(s.key));
  return wrap(<>
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
      {REV_SERIES.map((s) => { const on = sel.has(s.key); return (
        <button key={s.key} type="button" onClick={() => toggle(s.key)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: on ? 600 : 500, border: `1px solid ${on ? s.color : BORDER}`, background: on ? `${s.color}1A` : '#fff', color: on ? INK : DIM }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? s.color : BORDER }} />{s.label}
        </button>); })}
    </div>
    <div style={{ width: '100%', height: 205 }}>
      <ResponsiveContainer>
        <LineChart data={REV_DATA} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis tick={{ fill: DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={34} tickFormatter={(n) => `$${n}k`} />
          <Tooltip contentStyle={tip} formatter={(v, n) => [`$${v}k`, n as string]} />
          <Legend wrapperStyle={{ fontSize: 11.5 }} />
          {activos.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.4} dot={{ r: 2.5 }} animationDuration={900} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </>);
}

// ── rcArea — tendencia de una métrica (área con gradiente, animada) ─────────
function AreaTrend(s: Spec) {
  const data = arr<{ label: string; v: number }>(s.data, [
    { label: 'L', v: 30 }, { label: 'M', v: 42 }, { label: 'M', v: 38 }, { label: 'J', v: 55 }, { label: 'V', v: 61 }, { label: 'S', v: 72 }, { label: 'D', v: 78 },
  ]);
  const c = toneC(s.tone);
  return wrap(<><Cap>{str(s.title, 'Tendencia')}</Cap>
    <div style={cardW}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -20 }}>
          <defs><linearGradient id="rcArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity={0.28} /><stop offset="100%" stopColor={c} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis tick={{ fill: DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tip} />
          <Area type="monotone" dataKey="v" stroke={c} strokeWidth={2.6} fill="url(#rcArea)" animationDuration={1000} />
        </AreaChart>
      </ResponsiveContainer>
    </div></>);
}

// ── rcBar — comparación (barras coloreadas, animadas) ───────────────────────
function BarCmp(s: Spec) {
  const data = arr<{ label: string; v: number; tone?: string }>(s.bars, [
    { label: '18-24', v: 30 }, { label: '25-34', v: 90, tone: 'green' }, { label: '35-44', v: 60 }, { label: '45+', v: 35 },
  ]);
  return wrap(<><Cap>{str(s.title, 'Comparación')}</Cap>
    <div style={cardW}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis tick={{ fill: DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(47,111,237,.05)' }} />
          <Bar dataKey="v" radius={[6, 6, 0, 0]} animationDuration={800}>
            {data.map((b, i) => <Cell key={i} fill={b.tone ? toneC(b.tone) : BLUE} fillOpacity={b.tone ? 1 : 0.82} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div></>);
}

// ── rcRetention — retención del VSL (área + caída marcada) ──────────────────
function Retention(s: Spec) {
  const data = arr<{ label: string; v: number }>(s.data, [
    { label: '0s', v: 100 }, { label: '15s', v: 82 }, { label: '30s', v: 55 }, { label: '1m', v: 48 }, { label: '3m', v: 38 }, { label: '6m', v: 30 }, { label: 'fin', v: 26 },
  ]);
  const drop = str(s.dropLabel, '30s');
  return wrap(<><Cap>{str(s.title, 'Retención del VSL')}</Cap>
    <div style={cardW}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -20 }}>
          <defs><linearGradient id="rcRet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.25} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: DIM, fontSize: 11 }} axisLine={{ stroke: BORDER }} tickLine={false} />
          <YAxis tick={{ fill: DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={30} tickFormatter={(n) => `${n}%`} />
          <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, 'retención']} />
          <ReferenceLine x={drop} stroke={RED} strokeDasharray="4 3" label={{ value: 'se cae acá', fill: RED, fontSize: 11, fontWeight: 700, position: 'top' }} />
          <Area type="monotone" dataKey="v" stroke={BLUE} strokeWidth={2.6} fill="url(#rcRet)" animationDuration={1000} />
        </AreaChart>
      </ResponsiveContainer>
    </div></>);
}

// ── rcGauge — radial (tasa de cierre / health / saldo), animado ─────────────
function GaugeRadial(s: Spec) {
  const val = Math.max(0, Math.min(100, Number(s.value ?? 68)));
  const c = toneC(s.tone ?? (val > 66 ? 'green' : val > 40 ? 'amber' : 'red'));
  const data = [{ name: 'v', value: val, fill: c }];
  return wrap(<><Cap>{str(s.title, '')}</Cap>
    <div style={{ width: '100%', height: 250, position: 'relative' }}>
      <ResponsiveContainer>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} background={{ fill: '#EEF1F6' }} animationDuration={1000} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: c, lineHeight: 1 }}>{str(s.big, `${Math.round(val)}%`)}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: DIM, marginTop: 4 }}>{str(s.label, '')}</div>
      </div>
    </div></>);
}

// ── rcFunnel — embudo real de Recharts (animado) ────────────────────────────
function FunnelChartViz(s: Spec) {
  const stages = arr<{ label: string; value: number; tone?: string }>(s.stages, [
    { label: 'Impresiones', value: 100 }, { label: 'Clicks', value: 62 }, { label: 'Agenda', value: 34 }, { label: 'Calificó', value: 20 }, { label: 'Cierre', value: 11 },
  ]);
  const palette = [BLUE, '#4A80F0', '#6A93F3', VIOLET, GREEN];
  const data = stages.map((st, i) => ({ name: st.label, value: st.value, fill: st.tone ? toneC(st.tone) : palette[i % palette.length] }));
  return wrap(<><Cap>{str(s.title, 'Tu embudo')}</Cap>
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart margin={{ top: 6, right: 90, bottom: 6, left: 6 }}>
          <Tooltip contentStyle={tip} />
          <Funnel dataKey="value" data={data} isAnimationActive animationDuration={900}>
            <LabelList position="right" dataKey="name" stroke="none" fill={INK} fontSize={12} fontFamily={SANS} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div></>);
}

const CHART_REGISTRY: Record<string, (s: Spec) => React.ReactElement> = {
  rcRevenue: RevenueTrend, rcArea: AreaTrend, rcBar: BarCmp, rcRetention: Retention, rcGauge: GaugeRadial, rcFunnel: FunnelChartViz,
};

export function VisualChart({ spec }: { spec: Spec }) {
  const C = CHART_REGISTRY[spec.type];
  return C ? C(spec) : null;
}

export const CHART_TYPES = Object.keys(CHART_REGISTRY);
