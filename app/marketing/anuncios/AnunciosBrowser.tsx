'use client';

// =============================================================================
// AnunciosBrowser — filtro/orden por campaña y adset + modal de detalle
// =============================================================================
// Clic en una card abre un modal con datos EN VIVO de Meta (/api/ad-insights):
// gráfico de línea con selector de métrica, desgloses (edad/género, plataforma,
// regiones en mapa) con selector compartido, línea de tiempo de actividad y
// video. Los totales que ya están en el gráfico no se repiten en cuadros.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { geoMercator, geoPath } from 'd3-geo';
import type { SenalRecon } from '@/lib/queries';
import { AnuncioCard, compararCombo, VEREDICTO_BADGE } from '../AnuncioCard';

type BD = { label: string; impressions: number; reach: number; agendas: number; spend_usd: number };
type Demo = { age: string; genero: 'H' | 'M' | '?'; impressions: number; reach: number; agendas: number; spend_usd: number };
type AdInsights = {
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
  transcript: { status: string; tipo: string | null; transcript: string | null; secciones: Array<{ titulo: string; texto: string }> | null; idioma: string | null; duracion_s: number | null } | null;
};

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const GEOURL = 'https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json';

type Orden = 'agendas' | 'spend' | 'leads' | 'cierres';
const ORDENES: Array<{ key: Orden; label: string }> = [
  { key: 'agendas', label: 'Agendas (Meta)' }, { key: 'spend', label: 'Gasto' },
  { key: 'leads', label: 'Leads' }, { key: 'cierres', label: 'Cierres' },
];

const fmtUSD = (n: number | null | undefined, d?: number) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = d ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
};
const fmtNum = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX').format(Math.round(n)));
const fmtPct = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n < 10 ? n.toFixed(1) : n.toFixed(0)}%`);
const fmtFecha = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))); };
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

const selStyle: CSSProperties = { padding: '10px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 500, cursor: 'pointer', outline: 'none', maxWidth: 280 };
const lblStyle: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 6, display: 'block' };

export function AnunciosBrowser({ senales, desde, hasta }: { senales: SenalRecon[]; desde: string; hasta: string }) {
  const [campana, setCampana] = useState('all');
  const [adset, setAdset] = useState('all');
  const [orden, setOrden] = useState<Orden>('agendas');
  const [sel, setSel] = useState<SenalRecon | null>(null);

  const campanas = useMemo(() => [...new Set(senales.map((s) => s.campana ?? 'Sin campaña'))].sort((a, b) => a.localeCompare(b)), [senales]);
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

  const onCampana = (val: string) => { setCampana(val); setAdset('all'); };

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

      {sel && <AdDetalle s={sel} desde={desde} hasta={hasta} onClose={() => setSel(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
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

function AdDetalle({ s, desde, hasta, onClose }: { s: SenalRecon; desde: string; hasta: string; onClose: () => void }) {
  const v = VEREDICTO_BADGE[s.veredicto];
  const ritmoTxt = s.ritmo === 'verde' ? '✓ a ritmo' : s.ritmo === 'cruz' ? '✗ sin ritmo' : '· sin datos';
  const hasLink = !!s.ad_permalink && !s.ad_creative_sin_enlace;

  const [data, setData] = useState<AdInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [met, setMet] = useState<MetKey>('spend_usd');
  const [bdMet, setBdMet] = useState<BdKey>('impressions');

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    fetch(`/api/ad-insights?ad_id=${encodeURIComponent(s.ad_id)}&desde=${desde}&hasta=${hasta}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else setData(j); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [s.ad_id, desde, hasta]);

  const p = data?.period;
  const metricaActiva = METRICAS.find((m) => m.key === met)!;
  const bdActiva = BD_METRICAS.find((m) => m.key === bdMet)!;
  const totalMetrica = useMemo(() => {
    if (!data || !p) return null;
    if (metricaActiva.modo === 'reach') return p.reach;
    if (metricaActiva.modo === 'ctr') return p.ctr;
    if (metricaActiva.modo === 'cpm') return p.cpm_usd;
    return data.daily.reduce((acc, d) => acc + (d[met] as number), 0);
  }, [data, p, met, metricaActiva]);

  const demoData = useMemo(() => {
    if (!data) return [];
    const byAge = new Map<string, { age: string; Hombres: number; Mujeres: number }>();
    for (const d of data.demograficos) {
      const a = byAge.get(d.age) ?? { age: d.age, Hombres: 0, Mujeres: 0 };
      if (d.genero === 'H') a.Hombres += d[bdMet] as number;
      else if (d.genero === 'M') a.Mujeres += d[bdMet] as number;
      byAge.set(d.age, a);
    }
    return AGE_ORDER.filter((a) => byAge.has(a)).map((a) => byAge.get(a)!);
  }, [data, bdMet]);

  const platData = useMemo(() => (data ? data.plataformas.map((x) => ({ label: x.label, val: x[bdMet] as number })) : []), [data, bdMet]);

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

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
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

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* preview + enlace */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 110, flex: 'none', aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {s.ad_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.ad_thumbnail_url} alt={s.ad_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 12 }}>Sin preview</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
              {hasLink ? (
                <a href={s.ad_permalink!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 11, background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>↗ Reproducir en Meta</a>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>Sin enlace al post (stories / Audience Network / dinámico).</span>
              )}
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', wordBreak: 'break-all' }}>ad_id: {s.ad_id}</div>
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
                  <div style={{ marginBottom: 12 }}><Pills opts={METRICAS} val={met} onPick={setMet} /></div>
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

              {/* eficiencia + CRM (sin repetir lo del gráfico) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                <Stat label="Frecuencia" value={p.frequency ? p.frequency.toFixed(2) : '—'} />
                <Stat label="CPC" value={fmtUSD(p.cpc_usd)} />
                <Stat label="CPL" value={fmtUSD(p.leads > 0 ? p.spend_usd / p.leads : null)} />
                <Stat label="Vistas landing" value={fmtNum(p.landing_views)} />
                <Stat label="Cierres (CRM)" value={fmtNum(s.cierres)} />
                <Stat label="Cash (CRM)" value={fmtUSD(s.cash_usd, 0)} />
              </div>

              {/* selector compartido de desglose */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={sectLabel}>Desgloses por</span>
                <Pills opts={BD_METRICAS} val={bdMet} onPick={setBdMet} />
              </div>

              {/* edad/género + plataforma */}
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

              {/* regiones: mapa + lista */}
              {data.regiones.length > 0 && (
                <div style={card}>
                  <div style={sectLabel}>Regiones / estados · {bdActiva.label}</div>
                  <MexicoMap regiones={data.regiones} metric={bdMet} fmt={bdActiva.fmt} />
                  <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '10px 2px 0' }}>Meta no expone ciudad en la API de anuncios; el nivel más fino es región/estado.</p>
                </div>
              )}

              {/* video: primero el gráfico, luego los cuadros (sin ceros) */}
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
                  <span style={sectLabel}>{data.transcript?.tipo === 'imagen' ? 'Lectura de la imagen' : 'Transcripción'}{data.transcript?.idioma ? ` · ${data.transcript.idioma}` : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--faint)' }}>▾ ver</span>
                </summary>
                <div style={{ marginTop: 12 }}>
                  {data.transcript?.status === 'ok' ? (
                    data.transcript.secciones && data.transcript.secciones.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {data.transcript.secciones.map((sec, i) => (
                          <div key={i}>
                            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 3 }}>{sec.titulo}</div>
                            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{sec.texto}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 260, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{data.transcript.transcript}</div>
                    )
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--faint)' }}>{txtTranscript(data.transcript?.status)}</div>
                  )}
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

  // Lista top (siempre visible, también si el mapa falla).
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
