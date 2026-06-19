'use client';

// =============================================================================
// TendenciasSection — hasta 4 métricas, cada una en su propio gráfico
// =============================================================================
// Sin superposición: se eligen hasta 4 métricas y se muestran en una grilla
// (1 a lo ancho, 2 lado a lado, 3-4 en 2×2). Cada gráfico trae su valor grande,
// su variación y sus recuadros de contexto. CAC se excluye (tiene su propio
// gráfico aparte). El rango temporal lo da el filtro de fecha global.

import { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Tendencias, SerieMetrica, FormatoSerie, CuadroContexto } from '@/lib/queries';

const MAX_SEL = 4;

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
  // CAC se excluye de Tendencias (se muestra en su propio gráfico).
  const marketing = tendencias.marketing.filter((s) => s.key !== 'cac');
  const comercial = tendencias.comercial.filter((s) => s.key !== 'cac');
  const todas = [...marketing, ...comercial];
  const first = marketing[0]?.key ?? todas[0]?.key ?? '';
  const [sel, setSel] = useState<string[]>(first ? [first] : []);

  const seleccionadas = todas.filter((s) => sel.includes(s.key));
  const enCap = sel.length >= MAX_SEL;
  const toggle = (k: string) =>
    setSel((cur) => {
      if (cur.includes(k)) return cur.length > 1 ? cur.filter((x) => x !== k) : cur;
      if (cur.length >= MAX_SEL) return cur;
      return [...cur, k];
    });

  if (seleccionadas.length === 0) {
    return (
      <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
      </section>
    );
  }

  const cols = seleccionadas.length === 1 ? '1fr' : '1fr 1fr';

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <h2 className="text-[28px] mb-4" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>

      <div className="space-y-2 mb-5">
        <FamiliaSelector titulo="Marketing" series={marketing} sel={sel} enCap={enCap} onToggle={toggle} />
        <FamiliaSelector titulo="Comercial" series={comercial} sel={sel} enCap={enCap} onToggle={toggle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 18 }}>
        {seleccionadas.map((s) => (
          <MetricChart key={s.key} serie={s} periodos={tendencias.periodos} granularidad={tendencias.granularidad} compacto={seleccionadas.length > 1} />
        ))}
      </div>
    </section>
  );
}

function MetricChart({
  serie, periodos, granularidad, compacto,
}: {
  serie: SerieMetrica; periodos: string[]; granularidad: Tendencias['granularidad']; compacto: boolean;
}) {
  const datos = periodos.map((p, i) => ({ x: p, y: serie.valores[i] }));
  const noNulos = serie.valores.filter((v): v is number => v !== null && Number.isFinite(v));
  const ultimo = noNulos.length > 0 ? noNulos[noNulos.length - 1] : null;
  const previo = noNulos.length > 1 ? noNulos[noNulos.length - 2] : null;
  let variacion: number | null = null;
  if (ultimo !== null && previo !== null && previo !== 0) variacion = ((ultimo - previo) / previo) * 100;
  const menosEsMejor = serie.key === 'cpl' || serie.key === 'cac';
  const variacionBuena = variacion === null ? true : menosEsMejor ? variacion <= 0 : variacion >= 0;
  const cuadros = serie.cuadros.filter((c) => c.texto !== undefined || (c.valor !== null && Number.isFinite(c.valor)));
  const gid = `tend-grad-${serie.key}`;

  return (
    <div className="rounded-lg border p-4 md:p-5" style={{ borderColor: 'var(--card-border)', background: 'var(--surface)' }}>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
        <div>
          <div className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{serie.label}</div>
          <div className="leading-none tabular-nums mt-1" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: compacto ? 32 : 44 }}>
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

      <div style={{ width: '100%', height: compacto ? 200 : 300 }}>
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
            <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 12 }} width={52} tickFormatter={(v: number) => fmt(v, serie.formato)} />
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'var(--text-dim)' }}
              formatter={(value) => [fmt(typeof value === 'number' ? value : null, serie.formato), serie.label] as [string, string]}
            />
            <Area type="monotone" dataKey="y" stroke="var(--accent-yellow)" strokeWidth={2.5} fill={`url(#${gid})`} connectNulls={false} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {cuadros.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {cuadros.map((c) => (
            <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--card-border)', background: 'var(--surface-2)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)' }}>{c.label}</div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtCuadro(c)}</div>
              {c.hint && <div className="text-sm mt-1" style={{ color: 'var(--text-pending)' }}>{c.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FamiliaSelector({
  titulo, series, sel, enCap, onToggle,
}: {
  titulo: string; series: SerieMetrica[]; sel: string[]; enCap: boolean; onToggle: (k: string) => void;
}) {
  if (series.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider w-20 shrink-0" style={{ color: 'var(--text-pending)' }}>{titulo}</span>
      {series.map((s) => {
        const activo = sel.includes(s.key);
        const bloqueado = !activo && enCap;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            disabled={bloqueado}
            className="px-3 py-1.5 rounded-lg border text-sm"
            style={{
              borderColor: activo ? 'var(--accent-yellow)' : 'var(--card-border)',
              color: activo ? 'var(--accent-yellow)' : 'var(--text-dim)',
              background: activo ? 'var(--surface-2)' : 'transparent',
              opacity: bloqueado ? 0.4 : 1,
              cursor: bloqueado ? 'not-allowed' : 'pointer',
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
