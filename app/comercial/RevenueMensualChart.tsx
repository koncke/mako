'use client';

// =============================================================================
// RevenueMensualChart — línea de ingresos (cerrado / cobrado) vs gasto en ads
// =============================================================================
// Evolución mes a mes para comparar inversión vs resultados a lo largo del tiempo.

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { RevenueMensualPunto } from '@/lib/queries';

const fmtUSD0 = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtAxis = (n: number) => (Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);

const SERIES = [
  { key: 'sold_usd', label: 'Cerrado', color: '#C8870C' },
  { key: 'cash_usd', label: 'Cobrado', color: '#0E8E7E' },
  { key: 'spend_usd', label: 'Gasto en ads', color: '#3B6FB0' },
] as const;

export function RevenueMensualChart({ data }: { data: RevenueMensualPunto[] }) {
  if (data.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Sin datos mensuales todavía.</p>;
  }
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={52} tickFormatter={fmtAxis} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
            formatter={(val, name) => [fmtUSD0(typeof val === 'number' ? val : null), name as string] as [string, string]}
          />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          {SERIES.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.4} dot={{ r: 2.5 }} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
