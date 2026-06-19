'use client';

// =============================================================================
// CacChart — CAC por mes (barras). CAC no va en Tendencias (gráfico de línea no
// le sirve: depende de cierres, que son escasos por día). Acá se ve por mes.
// =============================================================================

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { CACMensualEntry } from '@/lib/queries';

const MONO = "'Geist Mono', monospace";

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function CacChart({ data }: { data: CACMensualEntry[] }) {
  const filas = data.map((d) => ({ mes: fmtMes(d.mes), cac: Math.round(d.cac_usd), pagos: d.primeros_pagos, spend: d.spend_usd }));
  const ultimo = filas.length ? filas[filas.length - 1] : null;

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, color: 'var(--ink)' }}>CAC por mes</h2>
        {ultimo && (
          <div className="text-right">
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{ultimo.mes}</div>
            <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)' }}>{fmtUSD(ultimo.cac)}</div>
          </div>
        )}
      </div>

      {filas.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--faint)', margin: 0 }}>Aún sin meses con primer pago para calcular CAC.</p>
      ) : (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={filas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: 'var(--dim)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--dim)', fontSize: 12 }} width={56} tickFormatter={(v: number) => fmtUSD(v)} />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: 'var(--dim)' }}
                formatter={(value, name) => {
                  if (name === 'cac') return [fmtUSD(typeof value === 'number' ? value : null), 'CAC'] as [string, string];
                  return [String(value), name === 'pagos' ? 'Primeros pagos' : String(name)] as [string, string];
                }}
              />
              <Bar dataKey="cac" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {filas.map((_, i) => (
                  <Cell key={i} fill={i === filas.length - 1 ? 'var(--accent)' : 'var(--accent-soft)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
