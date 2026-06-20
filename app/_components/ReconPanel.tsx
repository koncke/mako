'use client';

// =============================================================================
// ReconPanel — "Anuncios Ganadores" (v3 Fase F, antes "Recon — señales")
// =============================================================================
// Ranking COMBO (decisión de Martin/Jan): se ORDENA por agendas (calidad del
// lead downstream) pero se muestran AMBAS señales — intención (instant forms,
// la señal de validación de la oferta de Jan) y agendas — conservando el
// veredicto de Jan (intención + ritmo). No reemplaza la metodología; la
// complementa con la calidad downstream.
//
// Top 5 por defecto + "Ver más". Hook/hold/CTR son CONSUMO (arreglar el
// creativo), van colapsados.
// =============================================================================

import { useState } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { SenalRecon, ReconVeredicto, RitmoEstado } from '@/lib/queries';

const TOP_N = 5;

function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`;
}

const VEREDICTO: Record<ReconVeredicto, { label: string; bg: string; color: string }> = {
  validada: { label: 'Validada — escalar vertical', bg: 'rgba(40,167,69,0.15)', color: 'var(--accent-green)' },
  falso_positivo: { label: 'Falso positivo — bolitas de nieve', bg: 'rgba(240,198,10,0.15)', color: 'var(--accent-yellow)' },
  apagar: { label: 'Apagar — sin intención', bg: 'rgba(255,107,53,0.15)', color: 'var(--accent-orange)' },
  explorando: { label: 'Explorando', bg: '#1a1a1a', color: 'var(--text-dim)' },
  pausada: { label: 'Pausada', bg: '#1a1a1a', color: 'var(--text-pending)' },
};

// Un anuncio tiene señal si dio algún form, alguna agenda, o gastó en el rango.
// Los que no tienen NINGUNA (0 leads, 0 agendas, sin spend) nunca van al top.
function tieneSenal(s: SenalRecon): boolean {
  return s.leads > 0 || s.agendas > 0 || s.spend_usd > 0;
}

// Ranking COMBO (Fase F PASO 3): agendas DESC → cierres → leads (intención).
function compararCombo(a: SenalRecon, b: SenalRecon): number {
  if (b.agendas !== a.agendas) return b.agendas - a.agendas;
  if (b.cierres !== a.cierres) return b.cierres - a.cierres;
  return b.leads - a.leads;
}

export function ReconPanel({ senales }: { senales: SenalRecon[] }) {
  const [verTodos, setVerTodos] = useState(false);

  // Con señal arriba (ordenados por combo); sin señal siempre al final.
  const conSenal = senales.filter(tieneSenal).sort(compararCombo);
  const sinSenal = senales.filter((s) => !tieneSenal(s));
  const top = conSenal.slice(0, TOP_N);
  const resto = [...conSenal.slice(TOP_N), ...sinSenal];

  return (
    <section className="rounded-xl border p-6 md:p-8" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <h2 className="text-[28px]" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
        Anuncios Ganadores
      </h2>
      <p className="text-base mt-1 mb-5" style={{ color: 'var(--text-dim)' }}>
        Top {TOP_N} por agendas (la calidad del lead), mostrando también la intención
        (≥{senales[0]?.meta_leads ?? 10} instant forms, la señal de validación de Jan). Últimos 14 días.
      </p>

      {senales.length === 0 ? (
        <p className="text-base" style={{ color: 'var(--text-pending)' }}>
          Aún sin anuncios con gasto en el rango. Cuando el cron traiga datos a nivel anuncio, aparecen acá.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {top.map((s, i) => <ReconFila key={s.ad_id} s={s} rank={i + 1} />)}
          </div>

          {resto.length > 0 && (
            <>
              {verTodos && (
                <div className="space-y-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                  {resto.map((s, i) => <ReconFila key={s.ad_id} s={s} rank={TOP_N + i + 1} />)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setVerTodos((x) => !x)}
                className="mt-4 px-4 py-2 rounded-lg border text-base"
                style={{ borderColor: 'var(--card-border)', color: 'var(--accent-yellow)' }}
              >
                {verTodos ? 'Ver menos' : `Ver más (${resto.length})`}
              </button>
            </>
          )}
        </>
      )}

      <div className="mt-6 pt-4 border-t text-sm space-y-1" style={{ borderColor: 'var(--card-border)', color: 'var(--text-pending)' }}>
        <p><strong style={{ color: 'var(--text-dim)' }}>Agendas:</strong> criterio de orden — un anuncio con pocos forms pero muchas agendas es más ganador que uno con muchos forms y cero agendas.</p>
        <p><strong style={{ color: 'var(--text-dim)' }}>Intención:</strong> instant forms con teléfono verificado. ≥10 por oferta = la gente quiere lo que ofrecés.</p>
        <p><strong style={{ color: 'var(--text-dim)' }}>Ritmo:</strong> el adset gasta su techo (≥99%) 3 días seguidos = Meta encuentra a quién mostrarlo. Intención sin ritmo = no escalar vertical, hacer réplicas (bolitas de nieve).</p>
      </div>
    </section>
  );
}

function RitmoSignal({ ritmo, dias }: { ritmo: RitmoEstado; dias: SenalRecon['ritmo_dias'] }) {
  if (ritmo === 'sin_datos') {
    return <span className="text-sm" style={{ color: 'var(--text-pending)' }} title="Se llenan con el cron diario">esperando presupuestos</span>;
  }
  const det = dias.map((d) => `${fmtDDMMYYYY(d.fecha)}: ${fmtUSD(d.spend_usd)}/${fmtUSD(d.budget_usd)} ${d.ok ? '✓' : '✗'}`).join('\n');
  return (
    <span className="text-base font-semibold" style={{ color: ritmo === 'verde' ? 'var(--accent-green)' : 'var(--accent-orange)' }} title={det}>
      {ritmo === 'verde' ? '✓ ritmo' : '✗ ritmo'}
    </span>
  );
}

function ReconFila({ s, rank }: { s: SenalRecon; rank: number }) {
  const [abierto, setAbierto] = useState(false);
  const v = VEREDICTO[s.veredicto];
  const pct = Math.min((s.leads / s.meta_leads) * 100, 100);
  const tieneDownstream = s.cierres > 0 || s.cash_usd > 0;

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--card-border)', background: '#0f0f0f' }}>
      <button type="button" onClick={() => setAbierto((x) => !x)} className="w-full text-left p-4 flex flex-col md:flex-row md:items-center gap-3">
        {/* rank + nombre + spend */}
        <div className="md:w-[24%] min-w-0 flex items-center gap-2">
          <span className="text-sm tabular-nums shrink-0" style={{ color: 'var(--text-pending)' }}>#{rank}</span>
          <div className="min-w-0">
            <div className="text-base font-medium truncate" title={s.ad_name}>{s.ad_name}</div>
            <div className="text-sm" style={{ color: 'var(--text-dim)' }}>{fmtUSD(s.spend_usd)} · {s.dias_corriendo}d</div>
          </div>
        </div>

        {/* intención */}
        <div className="md:w-[22%]">
          <div className="flex items-center justify-between text-sm mb-1">
            <span style={{ color: 'var(--text-dim)' }}>Intención</span>
            <span className="tabular-nums">{s.leads} de {s.meta_leads}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.leads >= s.meta_leads ? 'var(--accent-green)' : 'var(--accent-yellow)' }} />
          </div>
        </div>

        {/* agendas — destacado (criterio de orden) + cierres/cash */}
        <div className="md:w-[16%]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[22px] leading-none tabular-nums font-semibold" style={{ color: s.agendas > 0 ? 'var(--accent-green)' : 'var(--text-pending)' }}>
              {s.agendas}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>agenda{s.agendas === 1 ? '' : 's'}</span>
          </div>
          {tieneDownstream && (
            <div className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {s.cierres} cierre{s.cierres === 1 ? '' : 's'}{s.cash_usd > 0 ? ` · ${fmtUSD(s.cash_usd)}` : ''}
            </div>
          )}
        </div>

        {/* ritmo */}
        <div className="md:w-[10%]"><RitmoSignal ritmo={s.ritmo} dias={s.ritmo_dias} /></div>

        {/* veredicto */}
        <div className="md:w-[22%]">
          <span className="inline-block px-2.5 py-1 rounded-full text-sm font-medium" style={{ background: v.bg, color: v.color }}>{v.label}</span>
        </div>

        {/* chevron */}
        <div className="md:w-[6%] text-right text-sm" style={{ color: 'var(--text-dim)' }}>
          {abierto ? '▴' : '▾'}
        </div>
      </button>

      {abierto && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-pending)' }}>
            Consumo — solo para arreglar el creativo, no para decidir
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm" style={{ color: 'var(--text-dim)' }}>
            <span>Hook rate: <strong style={{ color: 'var(--text)' }}>{fmtPct(s.hook_rate)}</strong></span>
            <span>Hold rate: <strong style={{ color: 'var(--text)' }}>{fmtPct(s.hold_rate)}</strong></span>
            <span>CTR link: <strong style={{ color: 'var(--text)' }}>{fmtPct(s.ctr_link)}</strong></span>
            <span>CPL: <strong style={{ color: 'var(--text)' }}>{fmtUSD(s.cpl_usd)}</strong></span>
            <span>Frequency: <strong style={{ color: 'var(--text)' }}>{s.frequency !== null ? s.frequency.toFixed(1) : '—'}</strong></span>
          </div>
          {s.campana && <p className="text-sm mt-2" style={{ color: 'var(--text-pending)' }}>{s.campana} · {s.adset_name ?? 'adset'}</p>}
        </div>
      )}
    </div>
  );
}
