'use client';

// =============================================================================
// TendenciasSection — un gráfico grande con selector de métrica (v3 Fase E)
// =============================================================================
// Reemplaza la grilla de ~11 miniaturas por UN solo gráfico de área grande.
// Arriba, un selector de qué métrica ver (agrupado Marketing / Comercial).
// El rango temporal lo da el FILTRO GLOBAL (Fase C) — ya no hay toggle propio.
// El VSL es una métrica más (se eliminó la card "VSL — reproducciones").
// Bajo el gráfico, cuadros de contexto específicos de la métrica elegida.
// =============================================================================

import { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Tendencias, SerieMetrica, FormatoSerie, CuadroContexto } from '@/lib/queries';

function fmt(v: number | null | undefined, f: FormatoSerie): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (f === 'usd') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  if (f === 'pct') return `${v < 10 ? v.toFixed(1) : v.toFixed(0)}%`;
  return new Intl.NumberFormat('es-MX').format(Math.round(v));
}

function fmtCuadro(c: CuadroContexto): string {
  if (c.texto !== undefined) return c.texto;
  return fmt(c.valor, c.formato);
}

export function TendenciasSection({ tendencias }: { tendencias: Tendencias }) {
  const todas = [...tendencias.marketing, ...tendencias.comercial];
  const [sel, setSel] = useState<string>(tendencias.marketing[0]?.key ?? todas[0]?.key ?? '');
  const serie = todas.find((s) => s.key === sel) ?? todas[0];

  if (!serie) {
    return (
      <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
        <p className="text-base mt-2" style={{ color: 'var(--text-pending)' }}>Sin datos en el rango seleccionado.</p>
      </section>
    );
  }

  const datos = tendencias.periodos.map((p, i) => ({ x: p, y: serie.valores[i] }));
  const noNulos = serie.valores.filter((v): v is number => v !== null && Number.isFinite(v));
  const ultimo = noNulos.length > 0 ? noNulos[noNulos.length - 1] : null;
  const previo = noNulos.length > 1 ? noNulos[noNulos.length - 2] : null;
  let variacion: number | null = null;
  if (ultimo !== null && previo !== null && previo !== 0) variacion = ((ultimo - previo) / previo) * 100;
  // Para CPL/CAC, "menos es mejor": invertimos el color de la variación.
  const menosEsMejor = serie.key === 'cpl' || serie.key === 'cac';
  const variacionBuena = variacion === null ? true : menosEsMejor ? variacion <= 0 : variacion >= 0;

  const cuadros = serie.cuadros.filter((c) => c.texto !== undefined || (c.valor !== null && Number.isFinite(c.valor)));
  const granLabel = tendencias.granularidad === 'diario' ? 'por día' : tendencias.granularidad === 'semanal' ? 'por semana' : 'por mes';
  const gid = `tend-grad-${serie.key}`;

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
      <p className="text-base mt-1 mb-4" style={{ color: 'var(--text-dim)' }}>
        Una métrica a la vez · {granLabel} · respeta el filtro de fecha global (cambialo arriba a la derecha para ver más o menos historia).
      </p>

      {/* Selector agrupado */}
      <div className="space-y-2 mb-5">
        <FamiliaSelector titulo="Marketing" series={tendencias.marketing} sel={sel} onSel={setSel} />
        <FamiliaSelector titulo="Comercial" series={tendencias.comercial} sel={sel} onSel={setSel} />
      </div>

      {/* Encabezado: métrica, valor actual grande, variación vs período anterior */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{serie.label}</div>
          <div className="text-[44px] leading-none tabular-nums mt-1" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
            {fmt(ultimo, serie.formato)}
          </div>
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

      {/* Gráfico grande */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-yellow)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-yellow)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: 'var(--text-dim)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={56} tickFormatter={(v: number) => fmt(v, serie.formato)} />
            <Tooltip
              contentStyle={{ background: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'var(--text-dim)' }}
              formatter={(value) => [fmt(typeof value === 'number' ? value : null, serie.formato), serie.label] as [string, string]}
            />
            <Area type="monotone" dataKey="y" stroke="var(--accent-yellow)" strokeWidth={2.5} fill={`url(#${gid})`} connectNulls={false} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cuadros de contexto específicos de la métrica */}
      {cuadros.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {cuadros.map((c) => (
            <div key={c.label} className="rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: '#0f0f0f' }}>
              <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>{c.label}</div>
              <div className="text-[24px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtCuadro(c)}</div>
              {c.hint && <div className="text-sm mt-1" style={{ color: 'var(--text-pending)' }}>{c.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FamiliaSelector({
  titulo, series, sel, onSel,
}: {
  titulo: string; series: SerieMetrica[]; sel: string; onSel: (k: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider w-20 shrink-0" style={{ color: 'var(--text-pending)' }}>{titulo}</span>
      {series.map((s) => {
        const activo = s.key === sel;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSel(s.key)}
            className="px-3 py-1.5 rounded-lg border text-sm"
            style={{
              borderColor: activo ? 'var(--accent-yellow)' : 'var(--card-border)',
              color: activo ? 'var(--accent-yellow)' : 'var(--text-dim)',
              background: activo ? '#1a1a1a' : 'transparent',
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
