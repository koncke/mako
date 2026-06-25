'use client';

// =============================================================================
// ClosingBrowser v3 — Closing Analyst (port del diseño de Claude Design)
// =============================================================================
// Dos vistas conmutables:
//   · Métricas — panorama agregado: KPIs, "hallazgo de la semana" (la dimensión
//     que más decide los cierres), tendencia del score, embudo de conversión,
//     factores influyentes (gap ganadas↔perdidas por dimensión) y los closers.
//     Todo computado en cliente sobre las ventas reales (data.calls).
//   · Llamadas — lista filtrable + detalle por llamada (grabación embebida con
//     deep-link al segundo, dimensiones, momentos, objeciones, transcript anotado).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import type { ClosingViewData, ClosingAnalysisRow, ClosingDim, ClosingEvidence, DimGroup } from '@/lib/closing';

const MONO = "'Geist Mono', monospace";

// ---- helpers de formato ----------------------------------------------------

function scoreColor(s: number): string {
  return s >= 7.5 ? 'var(--good)' : s >= 5 ? 'var(--warn)' : 'var(--bad)';
}
function fmtScore(s: number | null | undefined): string {
  if (s == null) return '—';
  return Number.isInteger(s) ? s + '.0' : String(s);
}
function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}` : '—';
}
function fmtDur(min: number | null): string {
  return min == null ? '—' : `${min} min`;
}
function firstName(s: string | null | undefined): string {
  return (s ?? '').trim().split(/\s+/)[0] || '—';
}
function initials(s: string | null | undefined): string {
  const p = (s ?? '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '—';
}
function mmss(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function isSafeHttpUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}
function embedToken(c: ClosingAnalysisRow): string | null {
  if (c.embed_token) return c.embed_token;
  const m = (c.share_url ?? '').match(/\/share\/([^/?]+)/);
  return m ? m[1] : null;
}

const MO_TONE: Record<string, string> = { good: 'var(--good)', bad: 'var(--bad)', neutral: 'var(--warn)' };
const GROUP_DEFS: { key: DimGroup; label: string }[] = [
  { key: 'spin', label: 'Método SPIN' },
  { key: 'exec', label: 'Ejecución de venta' },
];
const DIMS7 = ['Situación', 'Problema', 'Implicación', 'Necesidad / beneficio', 'Presentación de la propuesta', 'Manejo de objeciones', 'CTA / siguientes pasos'];

// ---- helpers de agregación -------------------------------------------------

function mean(xs: Array<number | null | undefined>): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
const round1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);
function dimScore(c: ClosingAnalysisRow, label: string): number | null {
  return c.dims?.find((d) => d.label === label)?.score ?? null;
}
function weekStart(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
const CLOSER_PAL = ['#C8870C', '#0E8E7E', '#5B6CCF', '#CF4E29', '#7A52C0'];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CLOSER_PAL[h % CLOSER_PAL.length];
}

function Label({ children, color, style }: { children: React.ReactNode; color?: string; style?: CSSProperties }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: color ?? 'var(--dim)', ...style }}>{children}</div>;
}

type SortKey = 'fecha' | 'score' | 'duracion';
type Vista = 'metricas' | 'llamadas';

// ---- principal -------------------------------------------------------------

export function ClosingBrowser({ data, errorMsg }: { data: ClosingViewData; errorMsg: string | null }) {
  const router = useRouter();
  const { calls, counts, kpis, lastSync } = data;

  const [vista, setVista] = useState<Vista>('metricas');
  const [tipoF, setTipoF] = useState<'todos' | 'R1' | 'R2'>('todos');
  const [closerF, setCloserF] = useState('todos');
  const [outcomeF, setOutcomeF] = useState<'todos' | 'good' | 'warn' | 'bad'>('todos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('fecha');
  const [showFilters, setShowFilters] = useState(false);
  const [selId, setSelId] = useState<number | null>(calls[0]?.recording_id ?? null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // -- agregados del panorama (sobre las ventas reales)
  const ag = useMemo(() => {
    const r2 = calls.filter((c) => c.tipo === 'R2');
    const ganadasR2 = r2.filter((c) => c.outcome_tone === 'good').length;
    const cierreRate = r2.length ? Math.round((ganadasR2 / r2.length) * 100) : 0;
    const won = calls.filter((c) => c.outcome_tone === 'good');
    const lost = calls.filter((c) => c.outcome_tone === 'bad');

    // factores: gap ganadas↔perdidas por dimensión
    const dumbbell = DIMS7.map((label) => {
      const w = mean(won.map((c) => dimScore(c, label)));
      const l = mean(lost.map((c) => dimScore(c, label)));
      return { label, won: w, lost: l, team: mean(calls.map((c) => dimScore(c, label))), gap: (w ?? 0) - (l ?? 0) };
    }).sort((a, b) => b.gap - a.gap);

    // tendencia semanal del score
    const buckets = new Map<string, number[]>();
    for (const c of calls) {
      if (c.score == null) continue;
      const wk = weekStart(c.started_at || c.call_date);
      if (!wk) continue;
      (buckets.get(wk) ?? buckets.set(wk, []).get(wk)!).push(c.score);
    }
    const serie = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, ys]) => ({ x, y: mean(ys) ?? 0 }));

    // closers
    const byCloser = new Map<string, ClosingAnalysisRow[]>();
    for (const c of calls) { const k = c.closer ?? '—'; (byCloser.get(k) ?? byCloser.set(k, []).get(k)!).push(c); }
    const closers = [...byCloser.entries()].map(([name, G]) => {
      const weakest = DIMS7.map((l) => ({ l, s: mean(G.map((c) => dimScore(c, l))) })).filter((x) => x.s != null).sort((a, b) => (a.s as number) - (b.s as number))[0];
      return { name, nCalls: G.length, avgScore: round1(mean(G.map((c) => c.score))), ganadas: G.filter((c) => c.outcome_tone === 'good').length, weakest, color: colorFor(name) };
    }).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

    return { r2Count: r2.length, ganadasR2, cierreRate, won, lost, dumbbell, serie, closers,
      funnel: { e1: calls.filter((c) => c.tipo === 'R1').length, e2: r2.length, e3: ganadasR2 } };
  }, [calls]);

  const closers = useMemo(() => [...new Set(calls.map((c) => c.closer).filter((c): c is string => !!c))], [calls]);

  const visible = useMemo(() => {
    const v = calls.filter((c) => {
      if (tipoF !== 'todos' && c.tipo !== tipoF) return false;
      if (closerF !== 'todos' && c.closer !== closerF) return false;
      if (outcomeF !== 'todos' && c.outcome_tone !== outcomeF) return false;
      if (q.trim()) {
        const hay = `${c.lead_nombre ?? ''} ${c.lead_empresa ?? ''} ${c.title ?? ''} ${c.invitee_email ?? ''}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    return v.sort((a, b) => {
      if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'duracion') return (b.duration_min ?? 0) - (a.duration_min ?? 0);
      return (b.call_date ?? '').localeCompare(a.call_date ?? '');
    });
  }, [calls, tipoF, closerF, outcomeF, q, sort]);

  const sel = useMemo(() => {
    const byId = calls.find((c) => c.recording_id === selId);
    if (byId && visible.some((v) => v.recording_id === byId.recording_id)) return byId;
    return visible[0] ?? null;
  }, [calls, selId, visible]);

  async function sincronizar() {
    setSyncing(true); setSyncMsg('Trayendo y analizando llamadas…');
    try {
      const r = await fetch('/api/closing/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      setSyncMsg(`${j.ventas} de venta · ${j.servicio} de servicio${j.restantes > 0 ? ` · quedan ${j.restantes}` : ''}.`);
      router.refresh();
    } catch (e) { setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }
  const verLlamadas = useCallback((opts?: { closer?: string; sort?: SortKey }) => {
    setVista('llamadas'); setTipoF('todos'); setOutcomeF('todos');
    setCloserF(opts?.closer ?? 'todos'); if (opts?.sort) setSort(opts.sort); if (opts?.closer) setShowFilters(true);
  }, []);

  const conectado = !errorMsg;
  const swBtn = (on: boolean): CSSProperties => ({ padding: '8px 15px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: "'Geist', sans-serif", background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 0 0' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', padding: '0 32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 5 }}>
            <h1 style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: conectado ? 'var(--good)' : 'var(--bad)', background: conectado ? 'var(--good-bg)' : 'var(--bad-bg)', border: `1px solid ${conectado ? 'var(--good)' : 'var(--bad)'}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--bad)' }} />{conectado ? 'Fathom' : 'Sin datos'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Desempeño del closer en cada R1 / R2 — análisis con MaKo sobre Fathom × CRM.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <button onClick={sincronizar} disabled={syncing} style={{ padding: '7px 13px', borderRadius: 9, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)' }}>
            {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
          {syncMsg ? <div style={{ fontSize: 11.5, color: 'var(--dim)', maxWidth: 360, textAlign: 'right' }}>{syncMsg}</div>
            : lastSync && <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>sync {fmtFecha(lastSync)}</div>}
        </div>
      </header>

      {/* VIEW SWITCH */}
      <div style={{ padding: '0 32px', marginTop: 16 }}>
        <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <button onClick={() => setVista('metricas')} style={swBtn(vista === 'metricas')}>Métricas</button>
          <button onClick={() => setVista('llamadas')} style={swBtn(vista === 'llamadas')}>Llamadas {calls.length}</button>
        </div>
      </div>

      {/* KPI STRIP — 4 cards */}
      <section style={{ padding: '16px 32px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14 }}>
          <KpiCard label="Score promedio" value={fmtScore(kpis.scorePromedio)} sub={`${kpis.conScore} llamadas analizadas`} color={kpis.scorePromedio != null ? scoreColor(kpis.scorePromedio) : 'var(--faint)'} />
          <KpiCard label="R1 / R2" value={`${fmtScore(kpis.r1Prom)} / ${fmtScore(kpis.r2Prom)}`} sub="diagnóstico / cierre" color="var(--ink)" />
          <KpiCard label="Tasa de cierre" value={ag.r2Count ? `${ag.cierreRate}%` : '—'} sub={`${ag.ganadasR2} ganadas de ${ag.r2Count} R2`} color={ag.cierreRate >= 50 ? 'var(--good)' : 'var(--warn)'} />
          <KpiCard label="Analizadas" value={String(counts.ventas)} sub={`${counts.servicio} de servicio excluidas${counts.pendientes ? ` · ${counts.pendientes} sin analizar` : ''}`} color="var(--ink)" />
        </div>
      </section>

      {errorMsg && (
        <div style={{ margin: '14px 32px 0', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--bad)' }}>No se pudieron leer los análisis</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{errorMsg}</div>
        </div>
      )}

      {/* BODY */}
      {calls.length === 0 ? (
        <EmptyState counts={counts} hasError={!!errorMsg} syncing={syncing} onSync={sincronizar} />
      ) : vista === 'metricas' ? (
        <MetricasView ag={ag} kpis={kpis} counts={counts} onVerLlamadas={verLlamadas} />
      ) : (
        <LlamadasView
          calls={calls} visible={visible} sel={sel} closers={closers}
          q={q} setQ={setQ} tipoF={tipoF} setTipoF={setTipoF} outcomeF={outcomeF} setOutcomeF={setOutcomeF}
          closerF={closerF} setCloserF={setCloserF} sort={sort} setSort={setSort}
          showFilters={showFilters} setShowFilters={setShowFilters} setSelId={setSelId} onRefresh={() => router.refresh()}
        />
      )}
    </main>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '15px 18px' }}>
      <Label style={{ fontSize: 10, letterSpacing: '.08em' }}>{label}</Label>
      <div style={{ fontSize: 30, fontWeight: 600, color, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', marginTop: 7, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}

// ============================================================================
// VISTA MÉTRICAS
// ============================================================================

type Ag = {
  r2Count: number; ganadasR2: number; cierreRate: number;
  won: ClosingAnalysisRow[]; lost: ClosingAnalysisRow[];
  dumbbell: Array<{ label: string; won: number | null; lost: number | null; team: number | null; gap: number }>;
  serie: Array<{ x: string; y: number }>;
  closers: Array<{ name: string; nCalls: number; avgScore: number | null; ganadas: number; weakest?: { l: string; s: number | null }; color: string }>;
  funnel: { e1: number; e2: number; e3: number };
};

const cardBase: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 24px' };

function MetricasView({ ag, kpis, counts, onVerLlamadas }: { ag: Ag; kpis: ClosingViewData['kpis']; counts: ClosingViewData['counts']; onVerLlamadas: (o?: { sort?: SortKey }) => void }) {
  const top = ag.dumbbell[0];
  const hasGap = ag.won.length > 0 && ag.lost.length > 0 && top;
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 32px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HALLAZGO DE LA SEMANA */}
      {hasGap && (
        <div style={{ borderRadius: 20, border: '1px solid rgba(200,135,12,.34)', background: 'linear-gradient(100deg, rgba(200,135,12,.13), rgba(200,135,12,.03))', padding: '24px 28px', display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ borderRight: '1px solid rgba(200,135,12,.3)', paddingRight: 26, minWidth: 110 }}>
            <div style={{ fontSize: 48, fontWeight: 600, color: 'var(--accent)', fontFamily: MONO, lineHeight: 1, letterSpacing: '-0.03em' }}>+{fmtScore(round1(top.gap))}</div>
            <div style={{ fontSize: 11, color: '#9A6A09', fontFamily: MONO, marginTop: 5, maxWidth: 110 }}>GAP GANA↔PIERDE</div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <Label color="#9A6A09" style={{ fontSize: 10 }}>✦ Hallazgo de la semana</Label>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 7, color: 'var(--ink)' }}>{top.label} decide tus cierres</div>
            <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.55, marginTop: 6 }}>
              En las ganadas promedia {fmtScore(round1(top.won))} y en las perdidas {fmtScore(round1(top.lost))} (promedio del equipo {fmtScore(round1(top.team))}). Es la dimensión con mayor brecha entre cerrar y perder — subila y las R2 se ganan.
            </div>
          </div>
          <button onClick={() => onVerLlamadas({ sort: 'score' })} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif", whiteSpace: 'nowrap' }}>Ver las llamadas →</button>
        </div>
      )}

      {/* TENDENCIA + EMBUDO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20 }}>
        <TrendCard serie={ag.serie} />
        <FunnelCard f={ag.funnel} />
      </div>

      {/* FACTORES (dumbbell) */}
      <DumbbellCard rows={ag.dumbbell} lost={ag.lost.length} won={ag.won.length} />

      {/* CLOSERS */}
      <ClosersCard closers={ag.closers} />

      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO, marginTop: 4 }}>
        Análisis automático con MaKo (Opus) sobre Fathom × CRM · {counts.ventas} ventas analizadas · {kpis.conScore} con score.
      </div>
    </div>
  );
}

// -- tendencia (SVG)
function TrendCard({ serie }: { serie: Array<{ x: string; y: number }> }) {
  const W = 620, H = 200, L = 26, R = 16, T = 14, B = 28;
  const n = serie.length;
  const xAt = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const yAt = (v: number) => T + (1 - v / 10) * (H - T - B);
  const pts = serie.map((s, i) => [xAt(i), yAt(s.y)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = n ? `${line} L${xAt(n - 1).toFixed(1)} ${yAt(0)} L${xAt(0).toFixed(1)} ${yAt(0)} Z` : '';
  const half = Math.floor(n / 2);
  const d1 = mean(serie.slice(0, half || 1).map((s) => s.y)) ?? 0;
  const d2 = mean(serie.slice(half).map((s) => s.y)) ?? 0;
  const delta = d2 - d1;
  const dchip = delta > 0.15 ? { t: '↑ mejorando', c: 'var(--good)' } : delta < -0.15 ? { t: '↓ bajando', c: 'var(--bad)' } : { t: '→ estable', c: 'var(--dim)' };
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Tendencia del score</h2>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>Promedio semanal del equipo · escala 0–10</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: dchip.c, fontFamily: MONO }}>{dchip.t}</span>
      </div>
      {n < 2 ? <div style={{ fontSize: 13, color: 'var(--faint)', padding: '28px 0' }}>Pocas semanas para una tendencia.</div> : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 14, display: 'block' }}>
          <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(200,135,12,.26)" /><stop offset="100%" stopColor="rgba(200,135,12,0)" /></linearGradient></defs>
          {[0, 2.5, 5, 7.5, 10].map((v) => (<g key={v}><line x1={L} y1={yAt(v)} x2={W - R} y2={yAt(v)} stroke="#E7E3D9" strokeWidth={1} /><text x={2} y={yAt(v) + 3} fontSize={8.5} fill="#A39E91" fontFamily="monospace">{v}</text></g>))}
          <line x1={L} y1={yAt(7.5)} x2={W - R} y2={yAt(7.5)} stroke="#1C8A54" strokeWidth={1} strokeDasharray="4 4" opacity={0.55} />
          <path d={area} fill="url(#trendFill)" />
          <path d={line} fill="none" stroke="#C8870C" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={4} fill="#fff" stroke="#C8870C" strokeWidth={2.5} />)}
          {serie.map((s, i) => (i % Math.ceil(n / 7) === 0 || i === n - 1) && <text key={i} x={xAt(i)} y={H - 8} fontSize={8.5} fill="#A39E91" fontFamily="monospace" textAnchor="middle">{fmtFecha(s.x)}</text>)}
        </svg>
      )}
    </div>
  );
}

// -- embudo
function FunnelCard({ f }: { f: { e1: number; e2: number; e3: number } }) {
  const max = Math.max(f.e1, 1);
  const rows = [
    { n: f.e1, label: 'Diagnóstico · R1', bg: 'linear-gradient(90deg,#3A352B,#23201A)', drop: null as number | null },
    { n: f.e2, label: 'Avanza a propuesta · R2', bg: 'linear-gradient(90deg,var(--accent-soft),var(--accent))', drop: f.e1 ? 1 - f.e2 / f.e1 : null },
    { n: f.e3, label: 'Cierre ganado', bg: 'linear-gradient(90deg,#2BAE6A,var(--good))', drop: f.e2 ? 1 - f.e3 / f.e2 : null },
  ];
  return (
    <div style={cardBase}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Embudo de conversión</h2>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3, marginBottom: 16 }}>Dónde se caen las oportunidades</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((r, i) => (
          <div key={i}>
            <div style={{ width: '100%' }}>
              <div style={{ height: 46, borderRadius: 11, background: r.bg, width: `${Math.max(16, (r.n / max) * 100)}%`, minWidth: 56, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#fff', fontFamily: MONO }}>{r.n}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{r.label}</span>
              {r.drop != null && <span style={{ fontSize: 12, color: 'var(--bad)', fontFamily: MONO, fontWeight: 600 }}>−{Math.round(r.drop * 100)}%</span>}
            </div>
          </div>
        ))}
      </div>
      {f.e1 > 0 && (
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 13, marginTop: 14 }}>
          La mayor fuga está entre el diagnóstico y la propuesta: {f.e1 - f.e2} de {f.e1} R1 no avanzan a R2. De las que llegan a R2, cierra el {f.e2 ? Math.round((f.e3 / f.e2) * 100) : 0}%.
        </div>
      )}
    </div>
  );
}

// -- dumbbell (factores)
function DumbbellCard({ rows, lost, won }: { rows: Ag['dumbbell']; lost: number; won: number }) {
  if (!won || !lost) {
    return <div style={cardBase}><h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Factores influyentes en el cierre</h2><div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 10 }}>Aún no hay suficientes ganadas y perdidas para comparar.</div></div>;
  }
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Factores influyentes en el cierre</h2>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>Promedio por dimensión: {won} ganadas vs {lost} perdidas</div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontFamily: MONO }}>
          <span style={{ color: 'var(--bad)' }}>● perdidas</span><span style={{ color: 'var(--good)' }}>● ganadas</span>
        </div>
      </div>
      {rows.map((r, i) => {
        const isTop = i < 3;
        const lp = Math.max(0, Math.min(100, (r.lost ?? 0) * 10));
        const wp = Math.max(0, Math.min(100, (r.won ?? 0) * 10));
        const lo = Math.min(lp, wp), hi = Math.max(lp, wp);
        const gc = r.gap >= 4 ? 'var(--bad)' : r.gap >= 3 ? 'var(--warn)' : 'var(--dim)';
        return (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ width: 188, flex: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: isTop ? 600 : 500 }}>{r.label}</span>
              {isTop && <span style={{ fontFamily: MONO, fontSize: 8.5, color: '#9A6A09', background: 'rgba(200,135,12,.12)', padding: '1px 5px', borderRadius: 4, letterSpacing: '.04em' }}>DIFERENCIADOR</span>}
            </div>
            <div style={{ flex: 1, height: 26, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 2, background: 'var(--surface-2)', borderRadius: 999 }} />
              <div style={{ position: 'absolute', top: 11.5, left: `${lo}%`, width: `${hi - lo}%`, height: 3, background: 'linear-gradient(90deg,var(--bad),var(--good))', borderRadius: 999 }} />
              <Dot pct={lp} color="var(--bad)" />
              <Dot pct={wp} color="var(--good)" />
            </div>
            <span style={{ width: 56, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 600, color: gc, fontFamily: MONO }}>+{fmtScore(round1(r.gap))}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingLeft: 200, paddingRight: 56 }}>
        {[0, 5, 10].map((v) => <span key={v} style={{ fontSize: 9, color: 'var(--faint)', fontFamily: MONO }}>{v}</span>)}
      </div>
    </div>
  );
}
function Dot({ pct, color }: { pct: number; color: string }) {
  return <div style={{ position: 'absolute', top: 6.5, left: `calc(${pct}% - 6.5px)`, width: 13, height: 13, borderRadius: '50%', background: color, border: '2px solid var(--surface)', boxShadow: `0 0 0 1px ${color}` }} />;
}

// -- closers
function ClosersCard({ closers }: { closers: Ag['closers'] }) {
  const cols = Math.min(closers.length, 3);
  return (
    <div style={cardBase}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>El equipo de closers</h2>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3, marginBottom: 16 }}>Promedio por persona</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 14 }}>
        {closers.map((c) => (
          <div key={c.name} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: MONO, fontSize: 13 }}>{initials(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstName(c.name)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: c.avgScore != null ? scoreColor(c.avgScore) : 'var(--faint)', fontFamily: MONO, lineHeight: 1 }}>{fmtScore(c.avgScore)}</div>
                <div style={{ fontSize: 9, color: 'var(--faint)', fontFamily: MONO }}>SCORE PROM</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Mini label="Llamadas" value={String(c.nCalls)} />
              <Mini label="Ganadas" value={String(c.ganadas)} color={c.ganadas ? 'var(--good)' : 'var(--ink)'} />
              {c.weakest && <Mini label="Punto débil" value={`${c.weakest.l.split(' ')[0]} ${fmtScore(round1(c.weakest.s))}`} small grow />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Mini({ label, value, color, small, grow }: { label: string; value: string; color?: string; small?: boolean; grow?: boolean }) {
  return (
    <div style={{ flex: grow ? 1.4 : 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px' }}>
      <div style={{ fontSize: small ? 11.5 : 15, fontWeight: 600, color: color ?? 'var(--ink)', fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--faint)', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ============================================================================
// VISTA LLAMADAS (lista + detalle)
// ============================================================================

function LlamadasView(p: {
  calls: ClosingAnalysisRow[]; visible: ClosingAnalysisRow[]; sel: ClosingAnalysisRow | null; closers: string[];
  q: string; setQ: (v: string) => void; tipoF: 'todos' | 'R1' | 'R2'; setTipoF: (v: 'todos' | 'R1' | 'R2') => void;
  outcomeF: 'todos' | 'good' | 'warn' | 'bad'; setOutcomeF: (v: 'todos' | 'good' | 'warn' | 'bad') => void;
  closerF: string; setCloserF: (v: string) => void; sort: SortKey; setSort: (v: SortKey) => void;
  showFilters: boolean; setShowFilters: (v: boolean) => void; setSelId: (v: number) => void; onRefresh: () => void;
}) {
  const { calls, visible, sel, closers } = p;
  const tToggle = (active: boolean): CSSProperties => ({ padding: '4px 9px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: active ? 600 : 500, border: 'none', background: 'transparent', color: active ? 'var(--ink)' : 'var(--faint)' });
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', borderTop: '1px solid var(--border)' }}>
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 10px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <input value={p.q} onChange={(e) => p.setQ(e.target.value)} placeholder="Buscar lead, empresa…" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 2px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {(['todos', 'R1', 'R2'] as const).map((t) => <button key={t} onClick={() => p.setTipoF(t)} style={tToggle(p.tipoF === t)}>{t === 'todos' ? 'Todas' : t}</button>)}
            <div style={{ marginLeft: 'auto' }}>
              <Dropdown value={p.sort} onChange={(v) => p.setSort(v as SortKey)} ariaLabel="Ordenar"
                buttonStyle={{ padding: '4px 8px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--dim)' }}
                options={[{ value: 'fecha', label: 'Fecha' }, { value: 'score', label: 'Score' }, { value: 'duracion', label: 'Duración' }]} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => p.setShowFilters(!p.showFilters)} style={{ fontSize: 11, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Geist', sans-serif" }}>{p.showFilters ? '− Filtros' : '+ Filtros'}</button>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{visible.length} de {calls.length}</span>
          </div>
          {p.showFilters && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['good', 'warn', 'bad'] as const).map((o) => (
                  <button key={o} onClick={() => p.setOutcomeF(p.outcomeF === o ? 'todos' : o)} title={o === 'good' ? 'Buenas' : o === 'bad' ? 'Malas' : 'Medias'}
                    style={{ width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', border: '2px solid ' + (p.outcomeF === o ? MO_TONE[o === 'warn' ? 'neutral' : o] : 'transparent'), background: MO_TONE[o === 'warn' ? 'neutral' : o], padding: 0, opacity: p.outcomeF === 'todos' || p.outcomeF === o ? 1 : 0.3 }} />
                ))}
              </div>
              {closers.length > 1 && (
                <select value={p.closerF} onChange={(e) => p.setCloserF(e.target.value)} style={{ marginLeft: 'auto', padding: '3px 6px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', fontSize: 11.5, color: 'var(--dim)', fontFamily: "'Geist', sans-serif" }}>
                  <option value="todos">Todos los closers</option>
                  {closers.map((c) => <option key={c} value={c}>{firstName(c)}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 8 }}>
          {visible.map((c) => {
            const active = sel?.recording_id === c.recording_id;
            const noTr = c.has_transcript === false;
            return (
              <div key={c.recording_id} onClick={() => p.setSelId(c.recording_id)}
                style={{ padding: '11px 14px', cursor: 'pointer', borderLeft: '2px solid ' + (active ? 'var(--accent)' : 'transparent'), background: active ? 'var(--surface-2)' : 'transparent', opacity: noTr ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                    <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: MO_TONE[c.outcome_tone ?? 'neutral'], alignSelf: 'center' }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_nombre || c.invitee_email || c.title}</span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: c.score != null ? scoreColor(c.score) : 'var(--faint)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{fmtScore(c.score)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, marginLeft: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>{c.tipo ?? '—'}</span> · {c.lead_empresa || c.invitee_email || '—'} · {fmtFecha(c.call_date)}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Nada con estos filtros.</div>}
        </div>
      </div>
      {sel ? <Detail key={sel.recording_id} sel={sel} onRefresh={p.onRefresh} /> : <div />}
    </div>
  );
}

// ---- detalle (sin cambios respecto de v2.1) --------------------------------

type TranscriptLine = { t_seconds: number; speaker: string | null; text: string };
type DetailTab = 'resumen' | 'momentos' | 'transcript';

function Detail({ sel, onRefresh }: { sel: ClosingAnalysisRow; onRefresh: () => void }) {
  const token = embedToken(sel);
  const [seek, setSeek] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const play = useCallback((sec: number) => setSeek(Math.max(0, Math.round(sec))), []);

  async function reanalizar() {
    setReanalyzing(true); setMsg(null);
    try {
      const r = await fetch('/api/closing/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recording_id: sel.recording_id }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló');
      onRefresh();
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setReanalyzing(false); }
  }

  const tone = sel.outcome_tone ?? 'warn';
  const toneColor = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--warn)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, padding: '24px 40px 22px' }}>
        <div style={{ flex: 'none', textAlign: 'center', minWidth: 56 }}>
          <div style={{ fontSize: 48, fontWeight: 600, lineHeight: 1, color: sel.score != null ? scoreColor(sel.score) : 'var(--faint)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(sel.score)}</div>
          <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 2 }}>/ 10</div>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', marginBottom: 5 }}>
            <span style={{ color: 'var(--dim)', textTransform: 'uppercase' }}>{sel.tipo ?? '—'}</span>
            {sel.outcome && <span style={{ color: toneColor, fontWeight: 600 }}> · {sel.outcome}</span>}
            <span style={{ color: 'var(--faint)' }}> · {fmtFecha(sel.call_date)} · {fmtDur(sel.duration_min)}</span>
            {sel.has_transcript === false && <span style={{ color: 'var(--bad)' }}> · sin transcript</span>}
          </div>
          <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)' }}>{sel.lead_nombre || sel.invitee_email || sel.title}</h2>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            {sel.lead_empresa || sel.invitee_email || '—'} · Closer <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{firstName(sel.closer)}</strong>
          </div>
        </div>
        <div style={{ flex: 'none', display: 'flex', gap: 14, alignItems: 'center', paddingTop: 4 }}>
          {sel.lead_id != null && <a href={`/leads/${sel.lead_id}`} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', textDecoration: 'none' }}>Lead →</a>}
          <button onClick={reanalizar} disabled={reanalyzing} title="Re-analizar" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: reanalyzing ? 'default' : 'pointer', padding: 0 }}>{reanalyzing ? '…' : '↻'}</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 40px 48px' }}>
        <Player token={token} seek={seek} shareUrl={sel.share_url} onPlay={play} />
        <div style={{ display: 'flex', gap: 2, marginTop: 22, borderBottom: '1px solid var(--border)' }}>
          {([['resumen', 'Análisis'], ['momentos', `Momentos${sel.moments?.length ? ' · ' + sel.moments.length : ''}`], ['transcript', 'Transcript']] as [DetailTab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 13px', fontSize: 13, fontWeight: 600, fontFamily: "'Geist', sans-serif", cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid ' + (tab === k ? 'var(--accent)' : 'transparent'), color: tab === k ? 'var(--ink)' : 'var(--faint)', marginBottom: -1 }}>{l}</button>
          ))}
        </div>
        <div style={{ paddingTop: 24 }}>
          {msg && <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 12 }}>{msg}</div>}
          {tab === 'resumen' && <ResumenTab sel={sel} onPlay={play} />}
          {tab === 'momentos' && <MomentosTab sel={sel} onPlay={play} />}
          {tab === 'transcript' && <TranscriptTab sel={sel} onPlay={play} />}
        </div>
      </div>
    </div>
  );
}

function Player({ token, seek, shareUrl, onPlay }: { token: string | null; seek: number | null; shareUrl: string | null; onPlay: (s: number) => void }) {
  if (!token) {
    return isSafeHttpUrl(shareUrl)
      ? <a href={shareUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>▶ Ver grabación en Fathom</a>
      : <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin grabación disponible</div>;
  }
  if (seek == null) {
    const thumb = `https://fathom.video/share/${token}/thumbnail`;
    return (
      <div onClick={() => onPlay(0)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onPlay(0); }}
        style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="Grabación" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(23,21,17,.16)' }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.3)' }}>
            <span style={{ marginLeft: 4, borderStyle: 'solid', borderWidth: '9px 0 9px 14px', borderColor: 'transparent transparent transparent var(--ink)' }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
      <iframe key={`${token}-${seek}`} src={`https://fathom.video/embed/${token}?timestamp=${seek}&autoplay=1`} title="Grabación de Fathom" allow="autoplay; fullscreen" allowFullScreen frameBorder={0} style={{ width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}

function TimeBtn({ sec, onPlay, color }: { sec: number | null | undefined; onPlay: (s: number) => void; color?: string }) {
  if (sec == null) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); onPlay(sec); }} title="Reproducir desde acá"
      style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: color ?? 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flex: 'none', whiteSpace: 'nowrap' }}>▶ {mmss(sec)}</button>
  );
}

function ResumenTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const dims = sel.dims ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 720 }}>
      <div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }}>{sel.summary || 'Sin resumen.'}</div>
        {sel.next_step && (
          <div style={{ marginTop: 14, background: 'rgba(200,135,12,.06)', border: '1px solid rgba(200,135,12,.26)', borderRadius: 14, padding: '14px 16px' }}>
            <Label color="var(--accent)" style={{ marginBottom: 5 }}>Próximo paso</Label>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{sel.next_step}</div>
          </div>
        )}
      </div>
      {GROUP_DEFS.map((g) => {
        const gd = dims.filter((d) => d.g === g.key);
        if (!gd.length) return null;
        const gAvg = round1(mean(gd.map((d) => d.score)));
        return (
          <div key={g.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <Label>{g.label}</Label>
              <span style={{ fontFamily: MONO, fontSize: 11, color: gAvg != null ? scoreColor(gAvg) : 'var(--faint)' }}>prom {fmtScore(gAvg)}</span>
            </div>
            <div>{gd.map((d, i) => <DimRow key={d.label + i} d={d} onPlay={onPlay} />)}</div>
          </div>
        );
      })}
      {((sel.strengths?.length ?? 0) > 0 || (sel.weaknesses?.length ?? 0) > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <EvidenceCol title="Fortalezas" items={sel.strengths ?? []} tone="good" onPlay={onPlay} />
          <EvidenceCol title="A mejorar" items={sel.weaknesses ?? []} tone="bad" onPlay={onPlay} />
        </div>
      )}
      {(sel.objections?.length ?? 0) > 0 && (
        <div>
          <Label style={{ marginBottom: 8 }}>Objeciones</Label>
          <div>{sel.objections!.map((o, i) => <ObjectionRow key={i} o={o} onPlay={onPlay} />)}</div>
        </div>
      )}
      {(sel.recs?.length ?? 0) > 0 && (
        <div style={{ background: 'rgba(200,135,12,.06)', border: '1px solid rgba(200,135,12,.24)', borderRadius: 14, padding: '16px 18px' }}>
          <Label color="var(--accent)" style={{ marginBottom: 10 }}>Coaching · qué mejorar</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {sel.recs!.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', marginTop: 8 }} />
                <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DimRow({ d, onPlay }: { d: ClosingDim; onPlay: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const expandable = !!(d.note || d.quote);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => expandable && setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', cursor: expandable ? 'pointer' : 'default' }}>
        <span style={{ width: 152, flex: 'none', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{d.label}</span>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: d.score * 10 + '%', background: scoreColor(d.score), borderRadius: 999 }} />
        </div>
        <span style={{ width: 28, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 600, color: scoreColor(d.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(d.score)}</span>
        <span style={{ width: 12, flex: 'none', fontSize: 10, color: 'var(--faint)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>{expandable ? '›' : ''}</span>
      </div>
      {open && (
        <div style={{ padding: '0 0 14px 168px' }}>
          {d.note && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--dim)' }}>{d.note}</div>}
          {d.quote && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
              <TimeBtn sec={d.t_seconds} onPlay={onPlay} />
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>“{d.quote}”</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceCol({ title, items, tone, onPlay }: { title: string; items: ClosingEvidence[]; tone: 'good' | 'bad'; onPlay: (s: number) => void }) {
  const color = tone === 'good' ? 'var(--good)' : 'var(--bad)';
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, 2);
  return (
    <div>
      <Label color={color} style={{ marginBottom: 10 }}>{title}</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {items.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>—</div>}
        {shown.map((s, i) => {
          const exp = !!(s.quote || s.note);
          const open = openIdx === i;
          return (
            <div key={i}>
              <div onClick={() => exp && setOpenIdx(open ? null : i)} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', cursor: exp ? 'pointer' : 'default' }}>
                <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: color, marginTop: 7 }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45, flex: 1 }}>{s.title}</span>
                <TimeBtn sec={s.t_seconds} onPlay={onPlay} color={color} />
              </div>
              {open && (
                <div style={{ paddingLeft: 14, marginTop: 5 }}>
                  {s.quote && <div style={{ fontSize: 12.5, color: 'var(--dim)', fontStyle: 'italic', lineHeight: 1.5 }}>“{s.quote}”</div>}
                  {s.note && <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.55 }}>{s.note}</div>}
                </div>
              )}
            </div>
          );
        })}
        {items.length > 2 && (
          <button onClick={() => setShowAll((v) => !v)} style={{ alignSelf: 'flex-start', fontSize: 11.5, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Geist', sans-serif" }}>{showAll ? '− menos' : `+ ${items.length - 2} más`}</button>
        )}
      </div>
    </div>
  );
}

function ObjectionRow({ o, onPlay }: { o: NonNullable<ClosingAnalysisRow['objections']>[number]; onPlay: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const color = o.handled ? 'var(--good)' : 'var(--bad)';
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={() => o.note && setOpen((v) => !v)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', cursor: o.note ? 'pointer' : 'default' }}>
        <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color, width: 16, textAlign: 'center' }}>{o.handled ? '✓' : '✕'}</span>
        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: open ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{o.quote}”</span>
        <TimeBtn sec={o.t_seconds} onPlay={onPlay} />
      </div>
      {open && o.note && <div style={{ padding: '0 0 12px 26px', fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{o.note}</div>}
    </div>
  );
}

function MomentosTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const moments = sel.moments ?? [];
  if (!moments.length) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin momentos marcados.</div>;
  return (
    <div style={{ maxWidth: 720 }}>
      {moments.map((m, i) => {
        const accent = MO_TONE[m.tone] ?? 'var(--warn)';
        return (
          <div key={i} onClick={() => m.t_seconds != null && onPlay(m.t_seconds)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderBottom: '1px solid var(--border)', cursor: m.t_seconds != null ? 'pointer' : 'default' }}>
            <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: accent, marginTop: 6 }} />
            <TimeBtn sec={m.t_seconds} onPlay={onPlay} color={accent} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{m.quote}</div>
              {m.tag && <div style={{ fontSize: 11, fontWeight: 600, color: accent, marginTop: 2 }}>{m.tag}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TranscriptTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const [lines, setLines] = useState<TranscriptLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cache = useRef<Map<number, TranscriptLine[]>>(new Map());

  useEffect(() => {
    let alive = true;
    const cached = cache.current.get(sel.recording_id);
    if (cached) { setLines(cached); return; }
    setLoading(true); setErr(null); setLines(null);
    fetch(`/api/closing/transcript?recording_id=${sel.recording_id}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (!j.ok) { setErr(j.error || 'error'); return; } cache.current.set(sel.recording_id, j.lines); setLines(j.lines); })
      .catch((e) => { if (alive) setErr(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [sel.recording_id]);

  const marks = useMemo(() => (sel.annotations ?? []).map((a) => ({ t: a.t_seconds, tone: a.tone, label: a.label })).sort((a, b) => a.t - b.t), [sel.annotations]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando transcript…</div>;
  if (err) return <div style={{ fontSize: 13, color: 'var(--bad)' }}>No se pudo cargar el transcript: {err}</div>;
  if (!lines || !lines.length) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin transcript.</div>;

  const markByLine = new Map<number, { tone: 'good' | 'bad'; label: string }>();
  for (const mk of marks) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < lines.length; i++) { const diff = Math.abs(lines[i].t_seconds - mk.t); if (diff < bestDiff) { bestDiff = diff; best = i; } }
    if (bestDiff <= 30) markByLine.set(best, { tone: mk.tone, label: mk.label });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 760 }}>
      {lines.map((l, i) => {
        const mk = markByLine.get(i);
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 8px', borderRadius: 6, background: mk ? (mk.tone === 'good' ? 'var(--good-bg)' : 'var(--bad-bg)') : 'transparent', borderLeft: '2px solid ' + (mk ? (mk.tone === 'good' ? 'var(--good)' : 'var(--bad)') : 'transparent') }}>
            <button onClick={() => onPlay(l.t_seconds)} title="Reproducir" style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', flex: 'none', paddingTop: 2 }}>{mmss(l.t_seconds)}</button>
            <div style={{ minWidth: 0 }}>
              {mk && <div style={{ fontSize: 10.5, fontWeight: 700, color: mk.tone === 'good' ? 'var(--good)' : 'var(--bad)', marginBottom: 1 }}>{mk.label}</div>}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>{l.speaker || '—'}: </span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{l.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ counts, hasError, syncing, onSync }: { counts: ClosingViewData['counts']; hasError: boolean; syncing: boolean; onSync: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{hasError ? 'Sin datos disponibles' : 'Todavía no hay llamadas de venta analizadas'}</div>
        <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 20 }}>
          {hasError ? 'No se pudo conectar a la base de datos (en local faltan las claves de Supabase). En producción, sincronizá para traer y analizar las llamadas de Fathom.' : 'Sincronizá para traer las llamadas históricas de Fathom, matchearlas con los leads y analizar las de venta. Las de entrega de servicio se excluyen.'}
        </div>
        {counts.total > 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 20, fontFamily: MONO }}>{counts.total} procesadas · {counts.servicio} servicio · {counts.internas} internas · {counts.test} test</div>}
        <button onClick={onSync} disabled={syncing} style={{ padding: '10px 18px', borderRadius: 11, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 600, border: '1px solid var(--accent)', background: syncing ? 'var(--surface-2)' : 'var(--accent)', color: syncing ? 'var(--dim)' : '#fff' }}>{syncing ? 'Sincronizando…' : '↻ Sincronizar llamadas'}</button>
      </div>
    </div>
  );
}
