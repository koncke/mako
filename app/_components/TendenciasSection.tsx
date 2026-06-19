'use client';

// =============================================================================
// TendenciasSection — gráfico de tendencias con selección MÚLTIPLE (comparar)
// =============================================================================
// Una o varias métricas a la vez. Con 1 seleccionada se ve el valor grande +
// variación; con 2+ se superponen las series con leyenda para comparar formas.
// El rango temporal lo da el filtro de fecha global.

import { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Tendencias, SerieMetrica, FormatoSerie } from '@/lib/queries';

const COLORS = ['var(--accent)', '#3B6FB0', '#0E8E7E', '#6A4BD8', '#C7417B', '#B5630A'];

function fmt(v: number | null | undefined, f: FormatoSerie): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (f === 'usd') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  if (f === 'pct') return `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
  return new Intl.NumberFormat('es-MX').format(Math.round(v));
}

export function TendenciasSection({ tendencias }: { tendencias: Tendencias }) {
  const todas = [...tendencias.marketing, ...tendencias.comercial];
  const first = tendencias.marketing[0]?.key ?? todas[0]?.key ?? '';
  const [sel, setSel] = useState<string[]>(first ? [first] : []);

  const seleccionadas = todas.filter((s) => sel.includes(s.key));
  const toggle = (k: string) =>
    setSel((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));

  if (seleccionadas.length === 0) {
    return (
      <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
        <p className="text-base mt-2" style={{ color: 'var(--text-pending)' }}>Sin datos en el rango seleccionado.</p>
      </section>
    );
  }

  const multi = seleccionadas.length > 1;
  const colorDe = (k: string) => COLORS[seleccionadas.findIndex((s) => s.key === k) % COLORS.length];
  const formatoDe = new Map(seleccionadas.map((s) => [s.key, s.formato] as const));
  const labelDe = new Map(seleccionadas.map((s) => [s.key, s.label] as const));

  // Dataset combinado: una fila por período con una clave por serie elegida.
  const datos = tendencias.periodos.map((p, i) => {
    const row: Record<string, string | number | null> = { x: p };
    for (const s of seleccionadas) row[s.key] = s.valores[i];
    return row;
  });

  // Headline (solo con 1 serie)
  const unica = seleccionadas[0];
  const noNulos = unica.valores.filter((v): v is number => v !== null && Number.isFinite(v));
  const ultimo = noNulos.length > 0 ? noNulos[noNulos.length - 1] : null;
  const previo = noNulos.length > 1 ? noNulos[noNulos.length - 2] : null;
  let variacion: number | null = null;
  if (ultimo !== null && previo !== null && previo !== 0) variacion = ((ultimo - previo) / previo) * 100;
  const menosEsMejor = unica.key === 'cpl' || unica.key === 'cac';
  const variacionBuena = variacion === null ? true : menosEsMejor ? variacion <= 0 : variacion >= 0;

  const granLabel = tendencias.granularidad === 'diario' ? 'por día' : tendencias.granularidad === 'semanal' ? 'por semana' : 'por mes';
  const yFmt = unica.formato; // eje Y con el formato de la primera serie

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
      <p className="text-base mt-1 mb-4" style={{ color: 'var(--text-dim)' }}>
        {multi ? 'Compará varias métricas a la vez · ' : 'Una métrica a la vez · '}{granLabel} · tocá las métricas para sumarlas o quitarlas. Respeta el filtro de fecha global.
      </p>

      {/* Selector múltiple */}
      <div className="space-y-2 mb-5">
        <FamiliaSelector titulo="Marketing" series={tendencias.marketing} sel={sel} onToggle={toggle} colorDe={colorDe} />
        <FamiliaSelector titulo="Comercial" series={tendencias.comercial} sel={sel} onToggle={toggle} colorDe={colorDe} />
      </div>

      {/* Encabezado: 1 serie → valor grande + variación; 2+ → leyenda */}
      {!multi ? (
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{unica.label}</div>
            <div className="text-[44px] leading-none tabular-nums mt-1" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>{fmt(ultimo, unica.formato)}</div>
          </div>
          {variacion !== null && (
            <div className="text-right">
              <span className="text-lg tabular-nums" style={{ color: variacionBuena ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(0)}%
              </span>
              <div className="text-sm" style={{ color: 'var(--text-pending)' }}>vs período anterior</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3">
          {seleccionadas.map((s) => {
            const vals = s.valores.filter((v): v is number => v !== null && Number.isFinite(v));
            const last = vals.length ? vals[vals.length - 1] : null;
            return (
              <span key={s.key} className="inline-flex items-center gap-2 text-base">
                <span style={{ width: 11, height: 3, borderRadius: 2, background: colorDe(s.key), display: 'inline-block' }} />
                <span style={{ color: 'var(--text-dim)' }}>{s.label}:</span>
                <strong className="tabular-nums" style={{ color: 'var(--text)' }}>{fmt(last, s.formato)}</strong>
              </span>
            );
          })}
        </div>
      )}

      {/* Gráfico */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {seleccionadas.map((s) => (
                <linearGradient key={s.key} id={`tend-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorDe(s.key)} stopOpacity={multi ? 0.12 : 0.35} />
                  <stop offset="100%" stopColor={colorDe(s.key)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={56} tickFormatter={(v: number) => fmt(v, yFmt)} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'var(--text-dim)' }}
              formatter={(value, name) => {
                const key = String(name);
                return [fmt(typeof value === 'number' ? value : null, formatoDe.get(key) ?? 'num'), labelDe.get(key) ?? key] as [string, string];
              }}
            />
            {seleccionadas.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={colorDe(s.key)}
                strokeWidth={2.5}
                fill={`url(#tend-grad-${s.key})`}
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function FamiliaSelector({
  titulo, series, sel, onToggle, colorDe,
}: {
  titulo: string; series: SerieMetrica[]; sel: string[]; onToggle: (k: string) => void; colorDe: (k: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider w-20 shrink-0" style={{ color: 'var(--text-pending)' }}>{titulo}</span>
      {series.map((s) => {
        const activo = sel.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm"
            style={{
              borderColor: activo ? 'var(--accent-yellow)' : 'var(--card-border)',
              color: activo ? 'var(--text)' : 'var(--text-dim)',
              background: activo ? 'var(--surface-2)' : 'transparent',
            }}
          >
            {activo && <span style={{ width: 9, height: 9, borderRadius: '50%', background: colorDe(s.key), display: 'inline-block' }} />}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
