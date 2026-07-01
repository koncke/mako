'use client';

// =============================================================================
// RevenueMensualChart — tendencia mensual con selector de variables
// =============================================================================
// Líneas seleccionables: Sold Revenue / Cash Collected / Ad Spend (eje USD) y
// Cierres / Agendas (eje de conteo, a la derecha). Sirve para ver la evolución
// y comparar inversión vs resultados a lo largo del tiempo.

import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { RevenueMensualPunto } from '@/lib/queries';

type Eje = 'usd' | 'count';
type SerieKey = 'sold_usd' | 'cash_usd' | 'spend_usd' | 'cierres' | 'agendas';

const SERIES: Array<{ key: SerieKey; label: string; color: string; eje: Eje }> = [
  { key: 'sold_usd', label: 'Sold Revenue', color: '#C8870C', eje: 'usd' },
  { key: 'cash_usd', label: 'Cash Collected', color: '#0E8E7E', eje: 'usd' },
  { key: 'spend_usd', label: 'Ad Spend', color: '#3B6FB0', eje: 'usd' },
  { key: 'cierres', label: 'Cierres', color: '#6A4BD8', eje: 'count' },
  { key: 'agendas', label: 'Agendas', color: '#D0504A', eje: 'count' },
];

const fmtUSD0 = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtAxisUSD = (n: number) => (Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
const esUSD = (k: string) => k.endsWith('_usd');

export function RevenueMensualChart({ data }: { data: RevenueMensualPunto[] }) {
  const [sel, setSel] = useState<Set<SerieKey>>(new Set(['sold_usd', 'cash_usd', 'spend_usd']));

  const toggle = (k: SerieKey) =>
    setSel((cur) => {
      const next = new Set(cur);
      if (next.has(k)) { if (next.size > 1) next.delete(k); } else next.add(k);
      return next;
    });

  const activos = SERIES.filter((s) => sel.has(s.key));
  const hayUSD = activos.some((s) => s.eje === 'usd');
  const hayCount = activos.some((s) => s.eje === 'count');

  if (data.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Sin datos mensuales todavía.</p>;
  }

  return (
    <div>
      {/* selector de variables */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {SERIES.map((s) => {
          const on = sel.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: on ? 600 : 500, border: `1px solid ${on ? s.color : 'var(--border)'}`, background: on ? `${s.color}1A` : 'var(--surface)', color: on ? 'var(--ink)' : 'var(--dim)' }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? s.color : 'var(--border-strong)' }} />
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={20} />
            {hayUSD && <YAxis yAxisId="usd" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={52} tickFormatter={fmtAxisUSD} />}
            {hayCount && <YAxis yAxisId="count" orientation="right" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={36} allowDecimals={false} />}
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
              formatter={(val, name, item) => {
                const key = String((item as { dataKey?: string })?.dataKey ?? '');
                const v = typeof val === 'number' ? val : null;
                return [esUSD(key) ? fmtUSD0(v) : (v ?? '—'), name as string] as [string, string];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12.5 }} />
            {activos.map((s) => (
              <Line key={s.key} yAxisId={s.eje} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.4} dot={{ r: 2.5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
