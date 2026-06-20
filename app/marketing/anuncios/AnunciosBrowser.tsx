'use client';

// =============================================================================
// AnunciosBrowser — filtro/orden por campaña y adset + modal de detalle
// =============================================================================
// Por defecto muestra TODOS los anuncios con señal, ordenados (ranking). Se
// puede filtrar por campaña y/o adset, y cambiar el criterio de orden. Clic en
// una card abre un modal con toda la info del anuncio (estilo ficha del CRM).

import { useMemo, useState, type CSSProperties } from 'react';
import type { SenalRecon } from '@/lib/queries';
import { AnuncioCard, compararCombo, VEREDICTO_BADGE } from '../AnuncioCard';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Orden = 'agendas' | 'spend' | 'leads' | 'cierres';
const ORDENES: Array<{ key: Orden; label: string }> = [
  { key: 'agendas', label: 'Agendas (Meta)' },
  { key: 'spend', label: 'Gasto' },
  { key: 'leads', label: 'Leads' },
  { key: 'cierres', label: 'Cierres' },
];

const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`);
const fmtFecha = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))); };

const selStyle: CSSProperties = { padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', outline: 'none', maxWidth: 280 };
const lblStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };

export function AnunciosBrowser({ senales }: { senales: SenalRecon[] }) {
  const [campana, setCampana] = useState('all');
  const [adset, setAdset] = useState('all');
  const [orden, setOrden] = useState<Orden>('agendas');
  const [sel, setSel] = useState<SenalRecon | null>(null);

  const campanas = useMemo(
    () => [...new Set(senales.map((s) => s.campana ?? 'Sin campaña'))].sort((a, b) => a.localeCompare(b)),
    [senales],
  );
  const adsets = useMemo(() => {
    const pool = campana === 'all' ? senales : senales.filter((s) => (s.campana ?? 'Sin campaña') === campana);
    return [...new Set(pool.map((s) => s.adset_name ?? 'Sin adset'))].sort((a, b) => a.localeCompare(b));
  }, [senales, campana]);

  const lista = useMemo(() => {
    let l = senales;
    if (campana !== 'all') l = l.filter((s) => (s.campana ?? 'Sin campaña') === campana);
    if (adset !== 'all') l = l.filter((s) => (s.adset_name ?? 'Sin adset') === adset);
    const cmp: Record<Orden, (a: SenalRecon, b: SenalRecon) => number> = {
      agendas: (a, b) => b.agendas - a.agendas || compararCombo(a, b),
      spend: (a, b) => b.spend_usd - a.spend_usd,
      leads: (a, b) => b.leads - a.leads,
      cierres: (a, b) => b.cierres - a.cierres || b.agendas - a.agendas,
    };
    return [...l].sort(cmp[orden]);
  }, [senales, campana, adset, orden]);

  const onCampana = (v: string) => { setCampana(v); setAdset('all'); };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <label style={lblStyle}>Campaña</label>
          <select value={campana} onChange={(e) => onCampana(e.target.value)} style={selStyle}>
            <option value="all">Todas las campañas</option>
            {campanas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lblStyle}>Adset</label>
          <select value={adset} onChange={(e) => setAdset(e.target.value)} style={selStyle}>
            <option value="all">Todos los adsets</option>
            {adsets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label style={lblStyle}>Ordenar por</label>
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} style={selStyle}>
            {ORDENES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)' }}>{lista.length} anuncio{lista.length === 1 ? '' : 's'}</div>
        {(campana !== 'all' || adset !== 'all') && (
          <button type="button" onClick={() => { setCampana('all'); setAdset('all'); }} style={{ padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, cursor: 'pointer' }}>✕ Limpiar</button>
        )}
      </div>

      {lista.length === 0 ? (
        <p style={{ fontSize: 14.5, color: 'var(--faint)' }}>Sin anuncios para este filtro.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {lista.map((s, i) => (
            <div key={s.ad_id} onClick={() => setSel(s)} style={{ cursor: 'pointer' }}>
              <AnuncioCard s={s} rank={i + 1} disableLink />
            </div>
          ))}
        </div>
      )}

      {sel && <AdDetalle s={sel} onClose={() => setSel(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de detalle del anuncio (estilo ficha del CRM)
// ─────────────────────────────────────────────────────────────────────────────

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 };

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--ink)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function AdDetalle({ s, onClose }: { s: SenalRecon; onClose: () => void }) {
  const v = VEREDICTO_BADGE[s.veredicto];
  const ritmoTxt = s.ritmo === 'verde' ? '✓ a ritmo' : s.ritmo === 'cruz' ? '✗ sin ritmo' : '· sin datos';
  const hasLink = !!s.ad_permalink && !s.ad_creative_sin_enlace;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: v.bg, color: v.color }}>{v.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)' }}>{s.dias_corriendo}d con gasto · {ritmoTxt}</span>
            </div>
            <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.15 }}>{s.ad_name}</h2>
            <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 4 }}>{s.campana ?? 'Sin campaña'} · {s.adset_name ?? 'Sin adset'}</div>
          </div>
          <button onClick={onClose} style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 17, cursor: 'pointer', fontFamily: SANS }}>✕</button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* preview + enlace */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 120, flex: 'none', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {s.ad_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.ad_thumbnail_url} alt={s.ad_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 12 }}>Sin preview</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hasLink ? (
                <a href={s.ad_permalink!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 11, background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>↗ Reproducir en Meta</a>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Sin enlace al post (stories / Audience Network / dinámico).</span>
              )}
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', wordBreak: 'break-all' }}>ad_id: {s.ad_id}</div>
            </div>
          </div>

          {/* resultados (downstream) */}
          <div>
            <div style={sectLabel}>Resultados</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <Stat label="Agendas (Meta)" value={fmtNum(s.agendas)} color={s.agendas > 0 ? 'var(--good)' : undefined} />
              <Stat label="Cierres (CRM)" value={fmtNum(s.cierres)} />
              <Stat label="Cash (CRM)" value={fmtUSD(s.cash_usd, 0)} />
              <Stat label="Leads (forms)" value={fmtNum(s.leads)} />
            </div>
          </div>

          {/* inversión */}
          <div>
            <div style={sectLabel}>Inversión</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              <Stat label="Gasto" value={fmtUSD(s.spend_usd, 0)} />
              <Stat label="CPL" value={fmtUSD(s.cpl_usd)} />
              <Stat label="Días con gasto" value={fmtNum(s.dias_corriendo)} />
              <Stat label="Frecuencia" value={s.frequency != null ? s.frequency.toFixed(2) : '—'} />
            </div>
          </div>

          {/* diagnóstico de consumo */}
          <div>
            <div style={sectLabel}>Diagnóstico de consumo (creativo)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <Stat label="Hook rate (3s)" value={fmtPct(s.hook_rate)} />
              <Stat label="Hold rate (thru)" value={fmtPct(s.hold_rate)} />
              <Stat label="CTR de link" value={fmtPct(s.ctr_link)} />
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '8px 2px 0' }}>Hook/Hold/CTR son para mejorar el creativo, no para decidir escalado.</p>
          </div>

          {/* ritmo de presupuesto */}
          {s.ritmo_dias.length > 0 && (
            <div style={card}>
              <div style={sectLabel}>Ritmo de presupuesto (últimos días)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.ritmo_dias.map((d) => (
                  <div key={d.fecha} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--dim)' }}>{fmtFecha(d.fecha)}</span>
                    <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{fmtUSD(d.spend_usd)} / {fmtUSD(d.budget_usd)}</span>
                    <span style={{ color: d.ok ? 'var(--good)' : 'var(--dim)', fontWeight: 600 }}>{d.ok ? '✓' : '·'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
