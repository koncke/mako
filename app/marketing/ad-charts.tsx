'use client';

// =============================================================================
// ad-charts — gráficos de Meta compartidos (detalle de anuncio + resumen cuenta)
// =============================================================================
// Extraído de /marketing/anuncios/AnunciosBrowser para reutilizarlo en:
//   - AdDetalle: modal de UN anuncio (datos de /api/ad-insights).
//   - BreakdownCharts: edad/género + plataforma + mapa de México con selector,
//     usado tanto por AdDetalle como por el "resumen de toda la cuenta" de la
//     tab Marketing (datos de /api/account-insights).
// recharts y d3-geo viven SOLO acá → se cargan on-demand (next/dynamic) desde
// la tab Marketing.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { geoMercator, geoPath } from 'd3-geo';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { SenalRecon } from '@/lib/queries';
import { VEREDICTO_BADGE } from './AnuncioCard';
import { MakoButton } from '../_components/ChartIA';

// ── Tipos (shape de /api/ad-insights y /api/account-insights) ──
export type BD = { label: string; impressions: number; reach: number; agendas: number; spend_usd: number };
export type Demo = { age: string; genero: 'H' | 'M' | '?'; impressions: number; reach: number; agendas: number; spend_usd: number };
export type AdInsights = {
  period: {
    ad_name: string | null; impressions: number; reach: number; frequency: number;
    clicks: number; link_clicks: number; ctr: number | null; spend_usd: number; spend_mxn: number;
    cpm_usd: number | null; cpc_usd: number | null; agendas: number; leads: number; landing_views: number;
    video_plays_total: number; video_plays_3s: number; video_2s: number; video_thruplay: number; video_30s: number;
    video_p25: number; video_p50: number; video_p75: number; video_p100: number; video_avg_watch_s: number;
    cost_per_thruplay_usd: number | null;
  };
  daily: Array<{ fecha: string; spend_usd: number; impressions: number; reach: number; clicks: number; link_clicks: number; agendas: number; leads: number; ctr: number; cpm_usd: number }>;
  activity: { primero: string | null; ultimo: string | null; dias_activos: number; gaps: Array<{ desde: string; hasta: string; dias: number }> };
  demograficos: Demo[]; plataformas: BD[]; regiones: BD[];
  transcript: { status: string; tipo: string | null; transcript: string | null; secciones: Array<{ titulo: string; texto: string }> | null; idioma: string | null; duracion_s: number | null; instruccion: string | null } | null;
};

// Lo mínimo que necesita BreakdownCharts (subconjunto de AdInsights).
export type Breakdowns = { demograficos: Demo[]; plataformas: BD[]; regiones: BD[] };

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const GEOURL = 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json';

export const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`);
const fmtFecha = (iso: string) => fmtDDMMYYYY(iso);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const diasEntre = (a: string, b: string) => { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000); };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const txtTranscript = (status?: string) => {
  switch (status) {
    case 'sin_video': return 'Este anuncio no tiene video.';
    case 'muy_grande': return 'El video supera 25 MB (límite de transcripción).';
    case 'error': return 'No se pudo transcribir (se reintenta en la próxima corrida).';
    default: return 'Pendiente — se transcribe automáticamente.';
  }
};

const card: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 };

type MetKey = 'spend_usd' | 'impressions' | 'reach' | 'link_clicks' | 'agendas' | 'leads' | 'ctr' | 'cpm_usd';
const METRICAS: Array<{ key: MetKey; label: string; fmt: (n: number | null) => string; modo: 'sum' | 'reach' | 'ctr' | 'cpm' }> = [
  { key: 'spend_usd', label: 'Gasto', fmt: (n) => fmtUSD(n, 0), modo: 'sum' },
  { key: 'impressions', label: 'Impresiones', fmt: fmtNum, modo: 'sum' },
  { key: 'reach', label: 'Alcance', fmt: fmtNum, modo: 'reach' },
  { key: 'link_clicks', label: 'Clics enlace', fmt: fmtNum, modo: 'sum' },
  { key: 'agendas', label: 'Agendas', fmt: fmtNum, modo: 'sum' },
  { key: 'leads', label: 'Leads', fmt: fmtNum, modo: 'sum' },
  { key: 'ctr', label: 'CTR', fmt: (n) => fmtPct(n), modo: 'ctr' },
  { key: 'cpm_usd', label: 'CPM', fmt: (n) => fmtUSD(n), modo: 'cpm' },
];

type BdKey = 'impressions' | 'reach' | 'agendas' | 'spend_usd';
const BD_METRICAS: Array<{ key: BdKey; label: string; fmt: (n: number) => string }> = [
  { key: 'impressions', label: 'Impresiones', fmt: (n) => fmtNum(n) },
  { key: 'reach', label: 'Alcance', fmt: (n) => fmtNum(n) },
  { key: 'agendas', label: 'Agendas', fmt: (n) => fmtNum(n) },
  { key: 'spend_usd', label: 'Gasto', fmt: (n) => fmtUSD(n, 0) },
];

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--ink)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function Pills<T extends string>({ opts, val, onPick }: { opts: Array<{ key: T; label: string }>; val: T; onPick: (k: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opts.map((o) => {
        const on = o.key === val;
        return <button key={o.key} type="button" onClick={() => onPick(o.key)} style={{ padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS, fontSize: 12.5, fontWeight: on ? 600 : 500, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'), background: on ? 'rgba(200,135,12,.10)' : 'var(--surface)', color: on ? '#9A6A09' : 'var(--dim)' }}>{o.label}</button>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BreakdownCharts — edad/género + plataforma + mapa, con selector compartido.
// Reutilizable: un anuncio (AdDetalle) o la cuenta entera (resumen Marketing).
// ─────────────────────────────────────────────────────────────────────────────
export function BreakdownCharts({ demograficos, plataformas, regiones }: Breakdowns) {
  const [bdMet, setBdMet] = useState<BdKey>('impressions');
  const bdActiva = BD_METRICAS.find((m) => m.key === bdMet)!;

  const demoData = useMemo(() => {
    const byAge = new Map<string, { age: string; Hombres: number; Mujeres: number }>();
    for (const d of demograficos) {
      const a = byAge.get(d.age) ?? { age: d.age, Hombres: 0, Mujeres: 0 };
      if (d.genero === 'H') a.Hombres += d[bdMet] as number;
      else if (d.genero === 'M') a.Mujeres += d[bdMet] as number;
      byAge.set(d.age, a);
    }
    return AGE_ORDER.filter((a) => byAge.has(a)).map((a) => byAge.get(a)!);
  }, [demograficos, bdMet]);

  const platData = useMemo(() => plataformas.map((x) => ({ label: x.label, val: x[bdMet] as number })), [plataformas, bdMet]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={sectLabel}>Desgloses por</span>
        <Pills opts={BD_METRICAS} val={bdMet} onPick={setBdMet} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
        {demoData.length > 0 && (
          <div style={card}>
            <div style={sectLabel}>Edad y género · {bdActiva.label}</div>
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={demoData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="age" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={46} tickFormatter={(n: number) => bdActiva.fmt(n)} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} formatter={(val2, name) => [bdActiva.fmt(typeof val2 === 'number' ? val2 : 0), name as string] as [string, string]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Hombres" fill="#6A4BD8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Mujeres" fill="#0E8E7E" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {platData.length > 0 && (
          <div style={card}>
            <div style={sectLabel}>Plataforma · {bdActiva.label}</div>
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={platData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={46} tickFormatter={(n: number) => bdActiva.fmt(n)} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} formatter={(val2) => [bdActiva.fmt(typeof val2 === 'number' ? val2 : 0), bdActiva.label] as [string, string]} />
                  <Bar dataKey="val" fill="#C8870C" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {regiones.length > 0 && (
        <div style={card}>
          <div style={sectLabel}>Regiones / estados · {bdActiva.label}</div>
          <MexicoMap regiones={regiones} metric={bdMet} fmt={bdActiva.fmt} />
          <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 2px 0' }}>Meta no expone ciudad en la API de anuncios; el nivel más fino es región/estado.</p>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdDetalle — modal de UN anuncio (datos en vivo de Meta vía /api/ad-insights).
// ─────────────────────────────────────────────────────────────────────────────
export function AdDetalle({ s, desde, hasta, onClose }: { s: SenalRecon; desde: string; hasta: string; onClose: () => void }) {
  const v = VEREDICTO_BADGE[s.veredicto];
  const ritmoTxt = s.ritmo === 'verde' ? '✓ a ritmo' : s.ritmo === 'cruz' ? '✗ sin ritmo' : '· sin datos';
  const hasLink = !!s.ad_permalink && !s.ad_creative_sin_enlace;

  const [data, setData] = useState<AdInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [met, setMet] = useState<MetKey>('spend_usd');
  const [regen, setRegen] = useState<AdInsights['transcript']>(null);
  const [instruccion, setInstruccion] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenErr, setRegenErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null); setRegen(null); setInstruccion(''); setRegenErr(null);
    fetch(`/api/ad-insights?ad_id=${encodeURIComponent(s.ad_id)}&desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else { setData(j); setInstruccion(j.transcript?.instruccion ?? ''); } })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [s.ad_id, desde, hasta]);

  const regenerar = async () => {
    setRegenLoading(true); setRegenErr(null);
    try {
      const r = await fetch('/api/regenerate-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad_id: s.ad_id, instruccion }) });
      const j = await r.json();
      if (j.error) setRegenErr(j.error); else setRegen(j);
    } catch (e) { setRegenErr(String(e)); }
    finally { setRegenLoading(false); }
  };
  const tr = regen ?? data?.transcript ?? null;

  const p = data?.period;
  const metricaActiva = METRICAS.find((m) => m.key === met)!;
  const totalMetrica = useMemo(() => {
    if (!data || !p) return null;
    if (metricaActiva.modo === 'reach') return p.reach;
    if (metricaActiva.modo === 'ctr') return p.ctr;
    if (metricaActiva.modo === 'cpm') return p.cpm_usd;
    return data.daily.reduce((acc, d) => acc + (d[met] as number), 0);
  }, [data, p, met, metricaActiva]);

  const retencion = p && p.video_plays_3s > 0 ? [
    { etapa: '3s', pct: 100 }, { etapa: '25%', pct: (p.video_p25 / p.video_plays_3s) * 100 },
    { etapa: '50%', pct: (p.video_p50 / p.video_plays_3s) * 100 }, { etapa: '75%', pct: (p.video_p75 / p.video_plays_3s) * 100 },
    { etapa: '100%', pct: (p.video_p100 / p.video_plays_3s) * 100 },
  ] : [];

  const vcards: Array<{ label: string; value: string }> = [];
  if (p) {
    const add = (label: string, raw: number, value: string) => { if (raw > 0) vcards.push({ label, value }); };
    add('Reproducciones', p.video_plays_total || p.video_plays_3s, fmtNum(p.video_plays_total || p.video_plays_3s));
    add('Plays 2s cont.', p.video_2s, fmtNum(p.video_2s));
    add('Plays 3s', p.video_plays_3s, fmtNum(p.video_plays_3s));
    add('ThruPlays', p.video_thruplay, fmtNum(p.video_thruplay));
    add('Plays 30s', p.video_30s, fmtNum(p.video_30s));
    add('Vieron 100%', p.video_p100, fmtNum(p.video_p100));
    add('Tiempo medio', p.video_avg_watch_s, mmss(p.video_avg_watch_s));
    add('Costo/ThruPlay', p.video_thruplay, fmtUSD(p.cost_per_thruplay_usd));
  }

  // Contexto para MaKo: números del anuncio + lectura del creativo (si la hay).
  const ctxAd = data && p ? [
    `Detalle del anuncio "${s.ad_name}" (Meta). Período ${fmtFecha(desde)} → ${fmtFecha(hasta)}.`,
    `Campaña: ${s.campana ?? '—'} · Adset: ${s.adset_name ?? '—'} · Veredicto: ${v.label} · ${s.dias_corriendo} días con gasto · ${ritmoTxt}`,
    `Gasto ${fmtUSD(p.spend_usd, 0)} · Impresiones ${fmtNum(p.impressions)} · Alcance ${fmtNum(p.reach)} · Frecuencia ${p.frequency ? p.frequency.toFixed(2) : '—'}`,
    `Clics enlace ${fmtNum(p.link_clicks)} · CTR ${fmtPct(p.ctr)} · CPC ${fmtUSD(p.cpc_usd)} · CPM ${fmtUSD(p.cpm_usd)}`,
    `Leads ${fmtNum(p.leads)} · Vistas landing ${fmtNum(p.landing_views)} · Agendas ${fmtNum(p.agendas)} · CPL ${fmtUSD(p.leads > 0 ? p.spend_usd / p.leads : null)}`,
    `CRM — Cierres ${s.cierres} · Cash ${fmtUSD(s.cash_usd, 0)}`,
    p.video_plays_3s > 0 ? `Video — Plays 3s ${fmtNum(p.video_plays_3s)} · ThruPlays ${fmtNum(p.video_thruplay)} · Vieron 100% ${fmtNum(p.video_p100)} · Tiempo medio ${mmss(p.video_avg_watch_s)} · Costo/ThruPlay ${fmtUSD(p.cost_per_thruplay_usd)}` : 'Sin video.',
    tr?.status === 'ok' ? `Lectura del creativo:\n${(tr.secciones && tr.secciones.length ? tr.secciones.map((x) => `${x.titulo}: ${x.texto}`).join('\n') : tr.transcript ?? '').slice(0, 2500)}` : '',
  ].filter(Boolean).join('\n') : '';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 1040, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
            {data && p && <MakoButton chartKey={`marketing-ad-${s.ad_id}`} titulo={s.ad_name ?? 'Anuncio'} contexto={ctxAd} sugerencias={['¿Apago este anuncio o lo escalo?', '¿Por qué no convierte?', '¿Qué dice el creativo vs los números?', '¿Qué le cambiarías?']} />}
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 17, cursor: 'pointer', fontFamily: SANS }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* preview del creativo */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            {(() => {
              const thumb = (
                <div style={{ width: 132, flex: 'none', aspectRatio: '9 / 16', borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', position: 'relative', boxShadow: '0 8px 22px rgba(23,21,17,.16)' }}>
                  {s.ad_thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.ad_thumbnail_url} alt={s.ad_name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 12 }}>Sin preview</div>
                  )}
                  {hasLink && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(23,21,17,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, paddingLeft: 3 }}>▶</div>
                    </div>
                  )}
                </div>
              );
              return hasLink ? (
                <a href={s.ad_permalink!} target="_blank" rel="noopener noreferrer" title="Reproducir en Meta" style={{ display: 'block', flex: 'none' }}>{thumb}</a>
              ) : thumb;
            })()}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Creativo</div>
              {hasLink ? (
                <a href={s.ad_permalink!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '11px 18px', borderRadius: 11, background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 12px rgba(240,198,10,.3)' }}>↗ Reproducir en Meta</a>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Sin enlace al post (stories / Audience Network / dinámico).</span>
              )}
              <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', alignSelf: 'flex-start', wordBreak: 'break-all' }}>ad_id · {s.ad_id}</span>
            </div>
          </div>

          {err && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px', color: 'var(--bad)', fontSize: 13 }}>No se pudo cargar de Meta: {err}</div>}
          {!data && !err && <div style={{ fontSize: 13.5, color: 'var(--faint)', padding: '8px 0' }}>Cargando datos de Meta…</div>}

          {data && p && (
            <>
              {/* actividad */}
              <div style={card}>
                <div style={{ ...sectLabel, marginBottom: 10 }}>Actividad</div>
                <Timeline activity={data.activity} />
              </div>

              {/* gráfico con selector de métrica */}
              {data.daily.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Pills opts={METRICAS} val={met} onPick={setMet} />
                  <MakoButton chartKey={`marketing-ad-${s.ad_id}`} titulo={s.ad_name ?? 'Anuncio'} contexto={ctxAd} sugerencias={['¿Apago este anuncio o lo escalo?', '¿Por qué no convierte?', '¿Qué dice el creativo vs los números?', '¿Qué le cambiarías?']} />
                </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 28, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{metricaActiva.fmt(totalMetrica)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>{metricaActiva.label} {metricaActiva.modo === 'sum' ? 'total' : 'del período'}</span>
                  </div>
                  <div style={{ width: '100%', height: 210 }}>
                    <ResponsiveContainer>
                      <AreaChart data={data.daily} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <defs><linearGradient id="adMet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8870C" stopOpacity={0.32} /><stop offset="100%" stopColor="#C8870C" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                        <XAxis dataKey="fecha" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickFormatter={fmtFecha} interval="preserveStartEnd" minTickGap={28} />
                        <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={50} tickFormatter={(n: number) => metricaActiva.fmt(n)} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} labelFormatter={(l) => fmtFecha(String(l))} formatter={(val2) => [metricaActiva.fmt(typeof val2 === 'number' ? val2 : null), metricaActiva.label] as [string, string]} />
                        <Area type="monotone" dataKey={met} stroke="#C8870C" strokeWidth={2.2} fill="url(#adMet)" dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* eficiencia + CRM */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <Stat label="Frecuencia" value={p.frequency ? p.frequency.toFixed(2) : '—'} />
                <Stat label="CPC" value={fmtUSD(p.cpc_usd)} />
                <Stat label="CPL" value={fmtUSD(p.leads > 0 ? p.spend_usd / p.leads : null)} />
                <Stat label="Vistas landing" value={fmtNum(p.landing_views)} />
                <Stat label="Cierres (CRM)" value={fmtNum(s.cierres)} />
                <Stat label="Cash (CRM)" value={fmtUSD(s.cash_usd, 0)} />
              </div>

              {/* desgloses (edad/género + plataforma + mapa) */}
              <BreakdownCharts demograficos={data.demograficos} plataformas={data.plataformas} regiones={data.regiones} />

              {/* video: retención + cuadros */}
              {p.video_plays_3s > 0 && (
                <div>
                  <div style={sectLabel}>Video · retención (% de plays de 3s)</div>
                  <div style={{ ...card, marginBottom: 12 }}>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <AreaChart data={retencion} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                          <XAxis dataKey="etapa" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                          <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} width={40} tickFormatter={(n: number) => `${Math.round(n)}%`} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 13 }} formatter={(val2) => [`${(typeof val2 === 'number' ? val2 : 0).toFixed(1)}%`, 'Retención'] as [string, string]} />
                          <Area type="monotone" dataKey="pct" stroke="#6A4BD8" strokeWidth={2.2} fill="#6A4BD8" fillOpacity={0.16} dot={{ r: 3 }} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {vcards.map((c) => <Stat key={c.label} label={c.label} value={c.value} />)}
                  </div>
                </div>
              )}

              {/* transcripción (desplegable) */}
              <details style={card}>
                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={sectLabel}>{tr?.tipo === 'imagen' ? 'Lectura de la imagen' : 'Transcripción'}{tr?.idioma ? ` · ${tr.idioma}` : ''}{regen ? ' · regenerada' : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>▾ ver</span>
                </summary>
                <div style={{ marginTop: 12 }}>
                  {regenLoading ? (
                    <div style={{ fontSize: 13, color: 'var(--faint)' }}>Regenerando con OpenAI…</div>
                  ) : tr?.status === 'ok' ? (
                    tr.secciones && tr.secciones.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {tr.secciones.map((sec, i) => (
                          <div key={i}>
                            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 3 }}>{sec.titulo}</div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{sec.texto}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 260, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{tr.transcript}</div>
                    )
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--faint)' }}>{txtTranscript(tr?.status)}</div>
                  )}
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      value={instruccion}
                      onChange={(e) => setInstruccion(e.target.value)}
                      placeholder="Instrucción para OpenAI (opcional): ej. 'el producto se llama X', 'corrige los nombres', 'enfócate en la oferta'…"
                      style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' }}
                    />
                    <button type="button" onClick={regenerar} disabled={regenLoading} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: regenLoading ? 'wait' : 'pointer', opacity: regenLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}>{regenLoading ? 'Regenerando…' : '↻ Re-generar'}</button>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>Vuelve a transcribir/estructurar este anuncio (video o imagen) aplicando tu instrucción. Guarda el resultado.</div>
                  {regenErr && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 6 }}>Error: {regenErr}</div>}
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Línea de tiempo de actividad (barra activa con bloques rayados = pausas).
function Timeline({ activity }: { activity: AdInsights['activity'] }) {
  if (!activity.primero || !activity.ultimo) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin gasto en el período.</div>;
  const span = Math.max(diasEntre(activity.primero, activity.ultimo) + 1, 1);
  return (
    <div>
      <div style={{ position: 'relative', height: 26, borderRadius: 7, background: 'var(--good)', overflow: 'hidden', border: '1px solid var(--border)' }} title={`Activo ${fmtFecha(activity.primero)} → ${fmtFecha(activity.ultimo)}`}>
        {activity.gaps.map((g) => {
          const left = (diasEntre(activity.primero!, g.desde) / span) * 100;
          const width = (g.dias / span) * 100;
          return <div key={g.desde} title={`Inactivo ${fmtFecha(g.desde)}${g.dias > 1 ? `–${fmtFecha(g.hasta)}` : ''} (${g.dias}d)`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, background: 'repeating-linear-gradient(45deg,var(--surface-2) 0 5px,var(--border) 5px 6px)' }} />;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>
        <span>{fmtFecha(activity.primero)}</span>
        <span>{activity.dias_activos} días con gasto · {activity.gaps.length} pausa{activity.gaps.length === 1 ? '' : 's'}</span>
        <span>{fmtFecha(activity.ultimo)}</span>
      </div>
    </div>
  );
}

// Mapa coroplético de México (d3-geo) coloreado por la métrica seleccionada.
type GeoFeature = { type: string; properties: Record<string, unknown>; geometry: unknown };
function MexicoMap({ regiones, metric, fmt }: { regiones: BD[]; metric: BdKey; fmt: (n: number) => string }) {
  const [features, setFeatures] = useState<GeoFeature[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ name: string; val: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(GEOURL)
      .then((r) => r.json())
      .then((j) => { if (alive) setFeatures(j.features ?? null); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const valByNorm = useMemo(() => new Map(regiones.map((r) => [norm(r.label), r[metric] as number])), [regiones, metric]);
  const max = Math.max(...regiones.map((r) => r[metric] as number), 1);
  const valueFor = (rawName: string): number => {
    const n = norm(rawName);
    if (valByNorm.has(n)) return valByNorm.get(n)!;
    for (const [k, val] of valByNorm) if (k.startsWith(n) || n.startsWith(k)) return val;
    return 0;
  };
  const nameOf = (f: GeoFeature) => String(f.properties.name ?? f.properties.NAME_1 ?? f.properties.ESTADO ?? f.properties.estado ?? '—');

  const W = 640, H = 360;
  const path = useMemo(() => {
    if (!features) return null;
    const fc = { type: 'FeatureCollection', features } as unknown as Parameters<ReturnType<typeof geoMercator>['fitSize']>[1];
    const proj = geoMercator().fitSize([W, H], fc);
    return geoPath(proj);
  }, [features]);

  const top = [...regiones].sort((a, b) => (b[metric] as number) - (a[metric] as number)).slice(0, 6);
  const topList = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {top.map((r) => (
        <span key={r.label} style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px' }}>{r.label}: {fmt(r[metric] as number)}</span>
      ))}
    </div>
  );

  if (failed) return <div>{topList}</div>;
  if (!features || !path) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando mapa…{topList}</div>;

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {features.map((f, i) => {
          const name = nameOf(f);
          const val = valueFor(name);
          const t = max > 0 ? val / max : 0;
          const fill = val > 0 ? `rgba(200,135,12,${(0.14 + t * 0.78).toFixed(3)})` : 'var(--surface-2)';
          return (
            <path
              key={i}
              d={path(f as unknown as Parameters<typeof path>[0]) ?? undefined}
              fill={fill}
              stroke="var(--border)"
              strokeWidth={0.5}
              onMouseMove={(e) => { const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ name, val, x: e.clientX - rect.left, y: e.clientY - rect.top }); }}
            />
          );
        })}
      </svg>
      {hover && (
        <div style={{ position: 'absolute', left: Math.min(hover.x + 12, W - 140), top: hover.y + 12, pointerEvents: 'none', background: 'var(--surface)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, color: 'var(--ink)', boxShadow: '0 6px 20px rgba(23,21,17,.18)', whiteSpace: 'nowrap' }}>
          <b>{hover.name}</b>: {fmt(hover.val)}
        </div>
      )}
      {topList}
    </div>
  );
}
