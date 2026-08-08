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
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Icon } from '../_components/icons';
import type { ClosingViewData, ClosingAnalysisRow, ClosingDim, ClosingEvidence, DimGroup, Tone } from '@/lib/closing';
import { Dropdown } from '../components/Dropdown';

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
const CLOSER_PAL = ['#C8870C', '#0E8E7E', '#5B6CCF', '#CF4E29', '#7A52C0'];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CLOSER_PAL[h % CLOSER_PAL.length];
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(k: string): string { const [y, m] = k.split('-'); return `${MONTHS[+m - 1]} '${y.slice(2)}`; }
function callName(c: ClosingAnalysisRow): string { return c.lead_nombre || c.invitee_email || c.title || '—'; }

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

  // Deep link: /closing?call=<recording_id> abre esa llamada directo (para que MaKo
  // y cualquier link compartido lleven a la entidad, no solo a la tab).
  const sp = useSearchParams();
  useEffect(() => {
    const call = Number(sp.get('call'));
    if (Number.isInteger(call) && call > 0 && calls.some((c) => c.recording_id === call)) {
      setSelId(call); setVista('llamadas');
    }
  }, [sp, calls]);

  // -- agregados del panorama (sobre las ventas reales)
  const ag = useMemo(() => {
    const r2 = calls.filter((c) => c.tipo === 'R2');
    const ganadasR2 = r2.filter((c) => c.outcome_tone === 'good').length;
    const cierreRate = r2.length ? Math.round((ganadasR2 / r2.length) * 100) : 0;
    const won = calls.filter((c) => c.outcome_tone === 'good');
    const lost = calls.filter((c) => c.outcome_tone === 'bad');

    // factores: gap ganadas↔perdidas por dimensión + ejemplos de llamadas reales
    const exForDim = (pool: ClosingAnalysisRow[], label: string, dir: 'desc' | 'asc') => pool
      .map((c) => ({ c, s: dimScore(c, label) }))
      .filter((x): x is { c: ClosingAnalysisRow; s: number } => x.s != null)
      .sort((a, b) => (dir === 'desc' ? b.s - a.s : a.s - b.s))
      .slice(0, 2)
      .map((x) => ({ recording_id: x.c.recording_id, name: callName(x.c), score: x.s, tipo: x.c.tipo }));
    const dumbbell = DIMS7.map((label) => {
      const w = mean(won.map((c) => dimScore(c, label)));
      const l = mean(lost.map((c) => dimScore(c, label)));
      return { label, won: w, lost: l, team: mean(calls.map((c) => dimScore(c, label))), gap: (w ?? 0) - (l ?? 0),
        wonEx: exForDim(won, label, 'desc'), lostEx: exForDim(lost, label, 'asc') };
    }).sort((a, b) => b.gap - a.gap);

    // tendencia MENSUAL del score
    const buckets = new Map<string, number[]>();
    for (const c of calls) {
      if (c.score == null) continue;
      const mk = monthKey(c.started_at || c.call_date);
      if (!mk) continue;
      (buckets.get(mk) ?? buckets.set(mk, []).get(mk)!).push(c.score);
    }
    const serie = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, ys]) => ({ x, label: monthLabel(x), y: round1(mean(ys)) ?? 0, n: ys.length }));

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
  const verLlamadas = useCallback((opts?: { closer?: string; sort?: SortKey; recordingId?: number }) => {
    setVista('llamadas');
    if (opts?.recordingId != null) { setSelId(opts.recordingId); return; } // saltar a una llamada puntual sin tocar filtros
    setTipoF('todos'); setOutcomeF('todos');
    setCloserF(opts?.closer ?? 'todos'); if (opts?.sort) setSort(opts.sort); if (opts?.closer) setShowFilters(true);
  }, []);

  const conectado = !errorMsg;
  const swBtn = (on: boolean): CSSProperties => ({ padding: '8px 15px', fontSize: 13.5, fontWeight: 600, border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: "'Geist', sans-serif", background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--on-sidebar)' : 'var(--dim)' });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 0 0' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', padding: '0 32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="closing" size={34} /></span>
            <h1 style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: conectado ? 'var(--good)' : 'var(--bad)', background: conectado ? 'var(--good-bg)' : 'var(--bad-bg)', border: `1px solid ${conectado ? 'var(--good)' : 'var(--bad)'}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--bad)' }} />{conectado ? 'Fathom' : 'Sin datos'}
            </span>
          </div>
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

type DimEx = { recording_id: number; name: string; score: number; tipo: 'R1' | 'R2' | null };
type Ag = {
  r2Count: number; ganadasR2: number; cierreRate: number;
  won: ClosingAnalysisRow[]; lost: ClosingAnalysisRow[];
  dumbbell: Array<{ label: string; won: number | null; lost: number | null; team: number | null; gap: number; wonEx: DimEx[]; lostEx: DimEx[] }>;
  serie: Array<{ x: string; label: string; y: number; n: number }>;
  closers: Array<{ name: string; nCalls: number; avgScore: number | null; ganadas: number; weakest?: { l: string; s: number | null }; color: string }>;
  funnel: { e1: number; e2: number; e3: number };
};

const cardBase: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 24px' };

type VerLlamadas = (o?: { sort?: SortKey; recordingId?: number; closer?: string }) => void;
function MetricasView({ ag, kpis, counts, onVerLlamadas }: { ag: Ag; kpis: ClosingViewData['kpis']; counts: ClosingViewData['counts']; onVerLlamadas: VerLlamadas }) {
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
          <button onClick={() => onVerLlamadas({ sort: 'score' })} style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Geist', sans-serif", whiteSpace: 'nowrap' }}>Ver las llamadas →</button>
        </div>
      )}

      {/* TENDENCIA + EMBUDO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20 }}>
        <TrendCard serie={ag.serie} />
        <FunnelCard f={ag.funnel} />
      </div>

      {/* FACTORES (dumbbell) */}
      <DumbbellCard rows={ag.dumbbell} lost={ag.lost.length} won={ag.won.length} onVerLlamadas={onVerLlamadas} />

      {/* CLOSERS */}
      <ClosersCard closers={ag.closers} />

      <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO, marginTop: 4 }}>
        Análisis automático con MaKo (Opus) · {counts.ventas} ventas · {kpis.conScore} con score.
      </div>
    </div>
  );
}

// -- tendencia (SVG mensual, con hover por nodo)
function TrendCard({ serie }: { serie: Ag['serie'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 620, H = 200, L = 26, R = 16, T = 14, B = 28;
  const n = serie.length;
  const xAt = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const yAt = (v: number) => T + (1 - v / 10) * (H - T - B);
  const pts = serie.map((s, i) => [xAt(i), yAt(s.y)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = n ? `${line} L${xAt(n - 1).toFixed(1)} ${yAt(0)} L${xAt(0).toFixed(1)} ${yAt(0)} Z` : '';
  const half = Math.floor(n / 2);
  const delta = (mean(serie.slice(half).map((s) => s.y)) ?? 0) - (mean(serie.slice(0, half || 1).map((s) => s.y)) ?? 0);
  const dchip = delta > 0.15 ? { t: '↑ mejorando', c: 'var(--good)' } : delta < -0.15 ? { t: '↓ bajando', c: 'var(--bad)' } : { t: '→ estable', c: 'var(--dim)' };
  const everyN = Math.max(1, Math.ceil(n / 8));
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Tendencia del score</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: dchip.c, fontFamily: MONO }}>{dchip.t}</span>
      </div>
      {n < 2 ? <div style={{ fontSize: 13, color: 'var(--faint)', padding: '28px 0' }}>Pocos meses para una tendencia.</div> : (
        <div style={{ position: 'relative', marginTop: 14 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(200,135,12,.26)" /><stop offset="100%" stopColor="rgba(200,135,12,0)" /></linearGradient></defs>
            {[0, 2.5, 5, 7.5, 10].map((v) => (<g key={v}><line x1={L} y1={yAt(v)} x2={W - R} y2={yAt(v)} stroke="#EAECF1" strokeWidth={1} /><text x={2} y={yAt(v) + 3} fontSize={8.5} fill="#98A0AC" fontFamily="monospace">{v}</text></g>))}
            <line x1={L} y1={yAt(7.5)} x2={W - R} y2={yAt(7.5)} stroke="#1E9E57" strokeWidth={1} strokeDasharray="4 4" opacity={0.55} />
            <path d={area} fill="url(#trendFill)" />
            <path d={line} fill="none" stroke="#C8870C" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && <line x1={pts[hover][0]} y1={T} x2={pts[hover][0]} y2={H - B} stroke="#C8870C" strokeWidth={1} opacity={0.35} />}
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4} fill={hover === i ? '#C8870C' : '#fff'} stroke="#C8870C" strokeWidth={2.5} />)}
            {serie.map((s, i) => (i % everyN === 0 || i === n - 1) && <text key={i} x={xAt(i)} y={H - 8} fontSize={8.5} fill="#98A0AC" fontFamily="monospace" textAnchor="middle">{s.label}</text>)}
            {/* zonas de hover invisibles */}
            {pts.map((p, i) => <rect key={'h' + i} x={p[0] - (W - L - R) / (2 * Math.max(1, n - 1))} y={0} width={(W - L - R) / Math.max(1, n - 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }} />)}
          </svg>
          {hover != null && (
            <div style={{ position: 'absolute', left: `${(pts[hover][0] / W) * 100}%`, top: `${(pts[hover][1] / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 12px))', background: 'var(--ink)', color: 'var(--on-sidebar)', borderRadius: 9, padding: '7px 10px', pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.25)', zIndex: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.06em' }}>{serie[hover].label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO }}>{fmtScore(serie[hover].y)} <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>· {serie[hover].n} {serie[hover].n === 1 ? 'llamada' : 'llamadas'}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- embudo
function FunnelCard({ f }: { f: { e1: number; e2: number; e3: number } }) {
  const max = Math.max(f.e1, 1);
  const rows = [
    { n: f.e1, label: 'Diagnóstico · R1', bg: 'linear-gradient(90deg,#3A3D47,#1E212A)', drop: null as number | null },
    { n: f.e2, label: 'Avanza a propuesta · R2', bg: 'linear-gradient(90deg,var(--accent-soft),var(--accent))', drop: f.e1 ? 1 - f.e2 / f.e1 : null },
    { n: f.e3, label: 'Cierre ganado', bg: 'linear-gradient(90deg,#2BAE6A,var(--good))', drop: f.e2 ? 1 - f.e3 / f.e2 : null },
  ];
  return (
    <div style={cardBase}>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 16px', color: 'var(--ink)' }}>Embudo de conversión</h2>
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

// -- dumbbell (factores) — desplegable con ejemplos reales
function DumbbellCard({ rows, lost, won, onVerLlamadas }: { rows: Ag['dumbbell']; lost: number; won: number; onVerLlamadas: VerLlamadas }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!won || !lost) {
    return <div style={cardBase}><h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--ink)' }}>Factores influyentes en el cierre</h2><div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 10 }}>Aún no hay suficientes ganadas y perdidas para comparar.</div></div>;
  }
  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>Factores influyentes en el cierre</h2>
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontFamily: MONO }}>
          <span style={{ color: 'var(--bad)' }}>● {lost} perdidas</span><span style={{ color: 'var(--good)' }}>● {won} ganadas</span>
        </div>
      </div>
      {rows.map((r, i) => {
        const isTop = i < 3;
        const lp = Math.max(0, Math.min(100, (r.lost ?? 0) * 10));
        const wp = Math.max(0, Math.min(100, (r.won ?? 0) * 10));
        const lo = Math.min(lp, wp), hi = Math.max(lp, wp);
        const gc = r.gap >= 4 ? 'var(--bad)' : r.gap >= 3 ? 'var(--warn)' : 'var(--dim)';
        const isOpen = open === r.label;
        return (
          <div key={r.label} style={{ borderTop: '1px solid var(--border)' }}>
            <div onClick={() => setOpen(isOpen ? null : r.label)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', cursor: 'pointer' }}>
              <div style={{ width: 196, flex: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, flex: 'none', fontSize: 10, color: 'var(--faint)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
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
            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '4px 0 14px 28px' }}>
                <ExampleCol title="Donde brilló (ganadas)" color="var(--good)" avg={r.won} items={r.wonEx} onVerLlamadas={onVerLlamadas} />
                <ExampleCol title="Donde faltó (perdidas)" color="var(--bad)" avg={r.lost} items={r.lostEx} onVerLlamadas={onVerLlamadas} />
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingLeft: 208, paddingRight: 56 }}>
        {[0, 5, 10].map((v) => <span key={v} style={{ fontSize: 9, color: 'var(--faint)', fontFamily: MONO }}>{v}</span>)}
      </div>
    </div>
  );
}
function ExampleCol({ title, color, avg, items, onVerLlamadas }: { title: string; color: string; avg: number | null; items: DimEx[]; onVerLlamadas: VerLlamadas }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
        <Label color={color} style={{ fontSize: 10 }}>{title}</Label>
        <span style={{ fontFamily: MONO, fontSize: 11, color }}>prom {fmtScore(round1(avg))}</span>
      </div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: 'var(--faint)' }}>—</div> : items.map((ex) => (
        <div key={ex.recording_id} onClick={() => onVerLlamadas({ recordingId: ex.recording_id })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(ex.score), fontFamily: MONO, width: 26, flex: 'none' }}>{fmtScore(ex.score)}</span>
          <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{ex.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)', flex: 'none' }}>{ex.tipo ?? ''} →</span>
        </div>
      ))}
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
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 16px', color: 'var(--ink)' }}>El equipo de closers</h2>
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
  const seg = (on: boolean): CSSProperties => ({ padding: '5px 11px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: on ? 600 : 500, border: 'none', borderRadius: 7, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--faint)', boxShadow: on ? '0 1px 2px rgba(0,0,0,.06)' : 'none' });
  const sortB = (on: boolean): CSSProperties => ({ padding: '5px 9px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 11.5, fontWeight: on ? 600 : 500, border: 'none', borderRadius: 7, background: 'transparent', color: on ? 'var(--ink)' : 'var(--faint)' });
  const dotC: Record<string, string> = { good: 'var(--good)', warn: 'var(--warn-fill)', bad: 'var(--bad)' };
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '316px 1fr', borderTop: '1px solid var(--border)' }}>
      <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 11px', display: 'flex', flexDirection: 'column', gap: 11, borderBottom: '1px solid var(--border)' }}>
          <input value={p.q} onChange={(e) => p.setQ(e.target.value)} placeholder="Buscar lead, empresa…" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9 }}>
              {(['todos', 'R1', 'R2'] as const).map((t) => <button key={t} onClick={() => p.setTipoF(t)} style={seg(p.tipoF === t)}>{t === 'todos' ? 'Todas' : t}</button>)}
            </div>
            <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 1, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginRight: 3 }}>orden</span>
              {([['fecha', 'Fecha'], ['score', 'Score'], ['duracion', 'Dur.']] as [SortKey, string][]).map(([k, l]) => <button key={k} onClick={() => p.setSort(k)} style={sortB(p.sort === k)}>{l}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {(['good', 'warn', 'bad'] as const).map((o) => (
                <button key={o} onClick={() => p.setOutcomeF(p.outcomeF === o ? 'todos' : o)} title={o === 'good' ? 'Ganadas / buenas' : o === 'bad' ? 'Perdidas' : 'En proceso'}
                  style={{ width: 15, height: 15, borderRadius: '50%', cursor: 'pointer', padding: 0, background: dotC[o], border: '2px solid ' + (p.outcomeF === o ? 'var(--ink)' : 'transparent'), opacity: p.outcomeF === 'todos' || p.outcomeF === o ? 1 : 0.3 }} />
              ))}
              {closers.length > 1 && (
                <Dropdown
                  value={p.closerF}
                  onChange={p.setCloserF}
                  ariaLabel="Filtrar por closer"
                  buttonStyle={{ padding: '4px 7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 11.5, fontWeight: 600 }}
                  options={[
                    { value: 'todos', label: 'Todos los closers' },
                    ...closers.map((c) => ({ value: c, label: firstName(c) })),
                  ]}
                />
              )}
            </div>
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{visible.length} de {calls.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 0 8px' }}>
          {visible.map((c) => {
            const active = sel?.recording_id === c.recording_id;
            const noTr = c.has_transcript === false;
            return (
              <div key={c.recording_id} onClick={() => p.setSelId(c.recording_id)}
                style={{ display: 'flex', gap: 10, padding: '11px 14px', cursor: 'pointer', borderLeft: '2px solid ' + (active ? 'var(--primary)' : 'transparent'), background: active ? 'var(--surface-2)' : 'transparent', opacity: noTr ? 0.55 : 1 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', marginTop: 6, background: MO_TONE[c.outcome_tone ?? 'neutral'] }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_nombre || c.invitee_email || c.title}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: c.score != null ? scoreColor(c.score) : 'var(--faint)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{fmtScore(c.score)}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>{c.tipo ?? '—'}</span> · {c.lead_empresa || c.invitee_email || '—'} · {fmtFecha(c.call_date)}
                  </div>
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
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // El embed de Fathom NO permite saltar a un segundo por URL/postMessage (lo
  // verificamos en su player). El deep-link confiable es abrir el share en Fathom
  // posicionado en ese segundo (así sí salta).
  const play = useCallback((sec: number) => {
    if (sel.share_url) window.open(`${sel.share_url}?timestamp=${Math.max(0, Math.round(sec))}`, '_blank', 'noopener,noreferrer');
  }, [sel.share_url]);

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
        <div style={{ flex: 'none', display: 'flex', gap: 12, alignItems: 'center', paddingTop: 4 }}>
          {sel.lead_id != null && <a href={`/crm/${sel.lead_id}`} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', textDecoration: 'none' }}>Lead →</a>}
          <button onClick={() => setEditing((e) => !e)} title="Editar / revisar la valoración" style={{ fontSize: 11.5, fontWeight: 600, color: editing ? 'var(--primary)' : 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>{editing ? 'Cerrar' : 'Revisar'}</button>
          <button onClick={reanalizar} disabled={reanalyzing} title="Re-analizar desde cero" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: reanalyzing ? 'default' : 'pointer', padding: 0 }}>{reanalyzing ? '…' : '↻'}</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 40px 48px' }}>
        {/* GRABACIÓN (recuadro fijo) + RESUMEN al costado */}
        {(() => {
          const parts = (sel.summary || '').split(/(?<=[.!?])\s+/);
          const lead = parts[0] || (sel.summary || '');
          const body = parts.slice(1).join(' ');
          const outcomeBadge: CSSProperties = { display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, fontFamily: MONO, letterSpacing: '.03em', color: toneColor, background: tone === 'good' ? 'var(--good-bg)' : tone === 'bad' ? 'var(--bad-bg)' : 'var(--warn-bg)', border: `1px solid ${toneColor}` };
          return (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Player token={token} shareUrl={sel.share_url} dur={fmtDur(sel.duration_min)} />
              <div style={{ flex: 1, minWidth: 262, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                  <Label>Resumen del análisis</Label>
                  {sel.outcome && <span style={outcomeBadge}>{sel.outcome}</span>}
                </div>
                <div style={{ fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.38, color: 'var(--ink)' }}>{lead || 'Sin resumen.'}</div>
                {body && <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--dim)', marginTop: 9 }}>{body}</div>}
              </div>
            </div>
          );
        })()}
        {(sel.edit_history?.length ?? 0) > 0 && <History edits={sel.edit_history!} />}
        {editing ? (
          <ReviseForm sel={sel} onDone={() => { setEditing(false); onRefresh(); }} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 2, marginTop: 22, borderBottom: '1px solid var(--border)' }}>
              {([['resumen', 'Análisis'], ['momentos', `Momentos${sel.moments?.length ? ' · ' + sel.moments.length : ''}`], ['transcript', 'Transcript']] as [DetailTab, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 13px', fontSize: 13, fontWeight: 600, fontFamily: "'Geist', sans-serif", cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid ' + (tab === k ? 'var(--primary)' : 'transparent'), color: tab === k ? 'var(--ink)' : 'var(--faint)', marginBottom: -1 }}>{l}</button>
              ))}
            </div>
            <div style={{ paddingTop: 24 }}>
              {msg && <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 12 }}>{msg}</div>}
              {tab === 'resumen' && <ResumenTab sel={sel} onPlay={play} />}
              {tab === 'momentos' && <MomentosTab sel={sel} onPlay={play} />}
              {tab === 'transcript' && <TranscriptTab sel={sel} onPlay={play} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- revisión humana (editar valoración + re-evaluar con MaKo) --------------

function ReviseForm({ sel, onDone, onCancel }: { sel: ClosingAnalysisRow; onDone: () => void; onCancel: () => void }) {
  const dims = sel.dims ?? [];
  const [scores, setScores] = useState<Record<string, number>>(() => Object.fromEntries(dims.map((d) => [d.label, d.score])));
  const [outcomeTone, setOutcomeTone] = useState<Tone>(sel.outcome_tone ?? 'warn');
  const [outcome, setOutcome] = useState(sel.outcome ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'manual' | 'mako' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const vals = dims.map((d) => scores[d.label]).filter((s) => typeof s === 'number');
  const liveScore = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : sel.score;

  async function send(mode: 'manual' | 'mako') {
    if (mode === 'mako' && !note.trim()) { setErr('Escribí qué viste distinto para que MaKo re-evalúe.'); return; }
    setBusy(mode); setErr(null);
    try {
      const payload = mode === 'mako'
        ? { recording_id: sel.recording_id, mode: 'mako', note: note.trim() }
        : { recording_id: sel.recording_id, mode: 'manual', dims: dims.map((d) => ({ label: d.label, score: scores[d.label] })), outcome, outcome_tone: outcomeTone, note: note.trim() || undefined };
      const r = await fetch('/api/closing/revise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló');
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  const toneOpts: { v: Tone; l: string }[] = [{ v: 'good', l: 'Ganada' }, { v: 'warn', l: 'En proceso' }, { v: 'bad', l: 'Perdida' }];
  return (
    <div style={{ marginTop: 22, border: '1px solid var(--border-strong)', borderRadius: 16, padding: '20px 22px', background: 'var(--surface-2)', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Label color="var(--accent)">Revisar la valoración</Label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>SCORE</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: liveScore != null ? scoreColor(liveScore) : 'var(--faint)', fontFamily: MONO }}>{fmtScore(liveScore)}</span>
        </div>
      </div>
      {dims.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
          {dims.map((d) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 200, flex: 'none', fontSize: 13, color: 'var(--ink)' }}>{d.label}</span>
              <input type="range" min={0} max={10} step={0.5} value={scores[d.label] ?? 0} onChange={(e) => setScores((s) => ({ ...s, [d.label]: Number(e.target.value) }))} style={{ flex: 1, accentColor: 'var(--primary)' }} />
              <span style={{ width: 32, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: MONO, color: scoreColor(scores[d.label] ?? 0) }}>{fmtScore(scores[d.label] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Resultado:</span>
        <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
          {toneOpts.map((t) => <button key={t.v} onClick={() => setOutcomeTone(t.v)} style={{ padding: '5px 10px', fontSize: 12.5, fontWeight: outcomeTone === t.v ? 600 : 500, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: "'Geist', sans-serif", background: outcomeTone === t.v ? 'var(--surface-2)' : 'transparent', color: outcomeTone === t.v ? (t.v === 'good' ? 'var(--good)' : t.v === 'bad' ? 'var(--bad)' : 'var(--warn)') : 'var(--faint)' }}>{t.l}</button>)}
        </div>
        <input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Desenlace (ej. Cierre ganado)" style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif" }} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué viste distinto a lo que dijo la IA? (queda en el historial; obligatorio para re-evaluar con MaKo)" rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", resize: 'vertical', outline: 'none' }} />
      {err && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
        <button onClick={() => send('manual')} disabled={!!busy} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--primary)', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif" }}>{busy === 'manual' ? 'Guardando…' : 'Guardar cambios'}</button>
        <button onClick={() => send('mako')} disabled={!!busy} title="MaKo re-analiza la llamada teniendo en cuenta tu comentario" style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif" }}>{busy === 'mako' ? 'MaKo re-evaluando…' : '✦ Re-evaluar con MaKo'}</button>
        <button onClick={onCancel} disabled={!!busy} style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Geist', sans-serif" }}>Cancelar</button>
      </div>
    </div>
  );
}

function History({ edits }: { edits: NonNullable<ClosingAnalysisRow['edit_history']> }) {
  const [open, setOpen] = useState(false);
  const last = edits[edits.length - 1];
  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Geist', sans-serif" }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
        Revisado {edits.length === 1 ? 'una vez' : `${edits.length} veces`} · último {last.tipo === 'mako' ? 'con MaKo' : 'a mano'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
          {[...edits].reverse().map((e, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: e.tipo === 'mako' ? 'var(--accent)' : 'var(--dim)' }}>{e.tipo === 'mako' ? '✦ MaKo' : '✎ manual'}</span>
              {e.score_antes != null && e.score_despues != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}> · {fmtScore(e.score_antes)}→{fmtScore(e.score_despues)}</span>}
              {e.resumen && <span> · {e.resumen}</span>}
              <span style={{ color: 'var(--faint)' }}> · {fmtFecha(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Player({ token, shareUrl, dur }: { token: string | null; shareUrl: string | null; dur: string }) {
  const [playing, setPlaying] = useState(false);
  const box: CSSProperties = { position: 'relative', width: 420, maxWidth: '100%', aspectRatio: '16 / 9', borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', flex: 'none' };
  if (!token) {
    return isSafeHttpUrl(shareUrl)
      ? <a href={shareUrl} target="_blank" rel="noreferrer" style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>▶ Ver en Fathom</a>
      : <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--faint)', fontSize: 13 }}>Sin grabación</div>;
  }
  if (playing) {
    return <div style={{ ...box, background: '#000' }}><iframe src={`https://fathom.video/embed/${token}?autoplay=1`} title="Grabación de Fathom" allow="autoplay; fullscreen" allowFullScreen frameBorder={0} style={{ width: '100%', height: '100%', border: 0 }} /></div>;
  }
  const thumb = `https://fathom.video/share/${token}/thumbnail`;
  return (
    <div onClick={() => setPlaying(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setPlaying(true); }} style={{ ...box, cursor: 'pointer', background: 'linear-gradient(135deg,#1E212A,#14161B)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="Grabación" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,21,27,.18)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
          <span style={{ marginLeft: 5, borderStyle: 'solid', borderWidth: '10px 0 10px 16px', borderColor: 'transparent transparent transparent var(--ink)' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 10, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: 'rgba(18,21,27,.6)', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF5B53' }} />Fathom</div>
      <div style={{ position: 'absolute', right: 12, bottom: 10, fontFamily: MONO, fontSize: 10.5, color: 'rgba(255,255,255,.85)' }}>{dur}</div>
    </div>
  );
}

function TimeBtn({ sec, onPlay, color }: { sec: number | null | undefined; onPlay: (s: number) => void; color?: string }) {
  if (sec == null) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); onPlay(sec); }} title="Abrir en Fathom desde este minuto"
      style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: color ?? 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flex: 'none', whiteSpace: 'nowrap' }}>▶ {mmss(sec)}</button>
  );
}

function ResumenTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const dims = sel.dims ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 720 }}>
      {sel.next_step && (
        <div style={{ background: 'rgba(200,135,12,.06)', border: '1px solid rgba(200,135,12,.26)', borderRadius: 14, padding: '14px 16px' }}>
          <Label color="var(--accent)" style={{ marginBottom: 5 }}>Próximo paso</Label>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{sel.next_step}</div>
        </div>
      )}
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
        <button onClick={onSync} disabled={syncing} style={{ padding: '10px 18px', borderRadius: 11, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 600, border: '1px solid var(--primary)', background: syncing ? 'var(--surface-2)' : 'var(--primary)', color: syncing ? 'var(--dim)' : '#fff' }}>{syncing ? 'Sincronizando…' : '↻ Sincronizar llamadas'}</button>
      </div>
    </div>
  );
}
