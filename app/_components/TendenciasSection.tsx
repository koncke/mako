'use client';

// =============================================================================
// TendenciasSection — hasta 4 métricas, cada una en su gráfico y color
// =============================================================================
// Selector en un desplegable arriba a la derecha: clic en el nombre = ver solo
// esa métrica; el check al final = sumarla para comparar (hasta 4). Cada gráfico
// tiene su color. CAC se excluye (no aplica a línea). Rango: filtro global.

import { useState, type ReactNode } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Tendencias, SerieMetrica, FormatoSerie, CuadroContexto } from '@/lib/queries';

const MAX_SEL = 4;
const SANS = "'Geist', sans-serif";

// Un color por gráfico.
const COLORS = ['#C8870C', '#3B6FB0', '#0E8E7E', '#6A4BD8'];

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

export function TendenciasSection({ tendencias, accion }: { tendencias: Tendencias; accion?: ReactNode }) {
  // CAC excluido de Tendencias.
  const marketing = tendencias.marketing.filter((s) => s.key !== 'cac');
  const comercial = tendencias.comercial.filter((s) => s.key !== 'cac');
  const todas = [...marketing, ...comercial];
  const first = marketing[0]?.key ?? todas[0]?.key ?? '';
  const [sel, setSel] = useState<string[]>(first ? [first] : []);
  const [open, setOpen] = useState(false);

  const seleccionadas = todas.filter((s) => sel.includes(s.key));
  const enCap = sel.length >= MAX_SEL;

  const verSolo = (k: string) => {
    setSel([k]);
    setOpen(false);
  };
  const toggleComparar = (k: string) =>
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
  const colorDe = (k: string) => COLORS[seleccionadas.findIndex((s) => s.key === k) % COLORS.length];

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      {/* Encabezado: título + selector desplegable a la derecha */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>Tendencias</h2>
          {accion}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Métricas <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--dim)' }}>({sel.length})</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
          </button>
          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
              <div style={{ position: 'absolute', right: 0, marginTop: 8, zIndex: 50, width: 320, maxWidth: '88vw', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 20px 50px rgba(23,21,17,.18)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>
                  Clic en el nombre = ver solo esa · check = comparar (hasta {MAX_SEL})
                </div>
                <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
                  <Grupo titulo="Marketing" series={marketing} sel={sel} enCap={enCap} onSolo={verSolo} onToggle={toggleComparar} />
                  <Grupo titulo="Comercial" series={comercial} sel={sel} enCap={enCap} onSolo={verSolo} onToggle={toggleComparar} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 18 }}>
        {seleccionadas.map((s) => (
          <MetricChart key={s.key} serie={s} periodos={tendencias.periodos} color={colorDe(s.key)} compacto={seleccionadas.length > 1} />
        ))}
      </div>
    </section>
  );
}

function Grupo({
  titulo, series, sel, enCap, onSolo, onToggle,
}: {
  titulo: string; series: SerieMetrica[]; sel: string[]; enCap: boolean; onSolo: (k: string) => void; onToggle: (k: string) => void;
}) {
  if (series.length === 0) return null;
  return (
    <div style={{ padding: '6px 4px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--faint)', padding: '4px 8px' }}>{titulo}</div>
      {series.map((s) => {
        const activo = sel.includes(s.key);
        const bloqueado = !activo && enCap;
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '2px 4px 2px 8px', background: activo ? 'var(--surface-2)' : 'transparent' }}>
            <button
              type="button"
              onClick={() => onSolo(s.key)}
              style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14, color: activo ? 'var(--ink)' : 'var(--dim)', fontWeight: activo ? 600 : 500, padding: '8px 0' }}
            >
              {s.label}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', padding: 8, cursor: bloqueado ? 'not-allowed' : 'pointer' }} title={bloqueado ? `Máximo ${4} para comparar` : 'Comparar'}>
              <input
                type="checkbox"
                checked={activo}
                disabled={bloqueado}
                onChange={() => onToggle(s.key)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: bloqueado ? 'not-allowed' : 'pointer' }}
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

function MetricChart({
  serie, periodos, color, compacto,
}: {
  serie: SerieMetrica; periodos: string[]; color: string; compacto: boolean;
}) {
  const datos = periodos.map((p, i) => ({ x: p, y: serie.valores[i] }));
  const noNulos = serie.valores.filter((v): v is number => v !== null && Number.isFinite(v));
  const ultimo = noNulos.length > 0 ? noNulos[noNulos.length - 1] : null;
  const previo = noNulos.length > 1 ? noNulos[noNulos.length - 2] : null;
  let variacion: number | null = null;
  if (ultimo !== null && previo !== null && previo !== 0) variacion = ((ultimo - previo) / previo) * 100;
  const menosEsMejor = serie.key === 'cpl';
  const variacionBuena = variacion === null ? true : menosEsMejor ? variacion <= 0 : variacion >= 0;
  const cuadros = serie.cuadros.filter((c) => c.texto !== undefined || (c.valor !== null && Number.isFinite(c.valor)));
  const gid = `tend-grad-${serie.key}`;

  return (
    <div className="rounded-lg border p-4 md:p-5" style={{ borderColor: 'var(--card-border)', background: 'var(--surface)' }}>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
            <span className="text-sm uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{serie.label}</span>
          </div>
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
                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
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
            <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} connectNulls={false} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recuadros de contexto: SIEMPRE en una sola línea. */}
      {cuadros.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cuadros.length}, minmax(0, 1fr))`, gap: 12, marginTop: 16 }}>
          {cuadros.map((c) => (
            <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--card-border)', background: 'var(--surface-2)', minWidth: 0 }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
              <div className="text-[20px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtCuadro(c)}</div>
              {c.hint && <div className="text-sm mt-1" style={{ color: 'var(--text-pending)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
