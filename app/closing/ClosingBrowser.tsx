'use client';

// =============================================================================
// ClosingBrowser v2 — Closing Analyst
// =============================================================================
// Lista filtrable/ordenable de llamadas de venta + panel de detalle con:
//   · grabación de Fathom embebida (thumbnail → player) que SALTA al segundo
//     exacto de cada momento/objeción/línea del transcript;
//   · score + dimensiones SPIN/ejecución con cita de evidencia clicable;
//   · fortalezas / debilidades / objeciones;
//   · timeline de momentos clave;
//   · transcript completo (on-demand) anotado con marcadores buenos/malos.
// Datos reales desde closing_analyses (props del server). Sin transcript ⇒ no
// se promedia (el v1 metía 0s falsos).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { ClosingViewData, ClosingAnalysisRow, ClosingDim, DimGroup } from '@/lib/closing';

const MONO = "'Geist Mono', monospace";

// ---- helpers ---------------------------------------------------------------

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
  return y && m && d ? `${d}/${m}/${y}` : '—';
}
function fmtDur(min: number | null): string {
  return min == null ? '—' : `${min} min`;
}
function firstName(s: string | null | undefined): string {
  return (s ?? '').trim().split(/\s+/)[0] || '—';
}
function mmss(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function isSafeHttpUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}
function embedToken(c: ClosingAnalysisRow): string | null {
  if (c.embed_token) return c.embed_token;
  const m = (c.share_url ?? '').match(/\/share\/([^/?]+)/);
  return m ? m[1] : null;
}

function typeChip(type: string | null): CSSProperties {
  const r2 = type === 'R2';
  return {
    display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
    fontFamily: MONO, letterSpacing: '.04em',
    background: r2 ? 'rgba(28,138,84,.12)' : 'rgba(200,135,12,.12)',
    color: r2 ? 'var(--good)' : '#9A6A09',
    border: '1px solid ' + (r2 ? 'rgba(28,138,84,.28)' : 'rgba(200,135,12,.30)'),
  };
}
const MO_TONE: Record<string, string> = { good: 'var(--good)', bad: 'var(--bad)', neutral: 'var(--warn)' };
const GROUP_DEFS: { key: DimGroup; label: string }[] = [
  { key: 'spin', label: 'Método SPIN' },
  { key: 'exec', label: 'Ejecución de venta' },
];

type SortKey = 'fecha' | 'score' | 'duracion';
type DetailTab = 'resumen' | 'momentos' | 'transcript';

// ---- componente principal --------------------------------------------------

export function ClosingBrowser({ data, errorMsg }: { data: ClosingViewData; errorMsg: string | null }) {
  const router = useRouter();
  const { calls, counts, kpis, lastSync } = data;

  const [tipoF, setTipoF] = useState<'todos' | 'R1' | 'R2'>('todos');
  const [closerF, setCloserF] = useState('todos');
  const [outcomeF, setOutcomeF] = useState<'todos' | 'good' | 'warn' | 'bad'>('todos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('fecha');
  const [selId, setSelId] = useState<number | null>(calls[0]?.recording_id ?? null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const closers = useMemo(() => [...new Set(calls.map((c) => c.closer).filter((c): c is string => !!c))], [calls]);

  const visible = useMemo(() => {
    let v = calls.filter((c) => {
      if (tipoF !== 'todos' && c.tipo !== tipoF) return false;
      if (closerF !== 'todos' && c.closer !== closerF) return false;
      if (outcomeF !== 'todos' && c.outcome_tone !== outcomeF) return false;
      if (q.trim()) {
        const hay = `${c.lead_nombre ?? ''} ${c.lead_empresa ?? ''} ${c.title ?? ''} ${c.invitee_email ?? ''}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
    v = [...v].sort((a, b) => {
      if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'duracion') return (b.duration_min ?? 0) - (a.duration_min ?? 0);
      return (b.call_date ?? '').localeCompare(a.call_date ?? '');
    });
    return v;
  }, [calls, tipoF, closerF, outcomeF, q, sort]);

  const sel = useMemo(() => {
    const byId = calls.find((c) => c.recording_id === selId);
    if (byId && visible.some((v) => v.recording_id === byId.recording_id)) return byId;
    return visible[0] ?? null;
  }, [calls, selId, visible]);

  async function sincronizar() {
    setSyncing(true); setSyncMsg('Trayendo y analizando llamadas de Fathom…');
    try {
      const r = await fetch('/api/closing/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      setSyncMsg(`Listo: ${j.ventas} de venta · ${j.servicio} de servicio${j.restantes > 0 ? ` · quedan ${j.restantes}` : ''}.`);
      router.refresh();
    } catch (e) { setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSyncing(false); }
  }

  const conectado = !errorMsg;
  const chip = (active: boolean): CSSProperties => ({
    padding: '6px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600,
    border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'),
    background: active ? 'var(--ink)' : 'var(--surface)', color: active ? 'var(--on-sidebar)' : 'var(--dim)',
  });

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '26px 32px 18px' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontWeight: 600, fontSize: 36, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: conectado ? 'var(--good-bg)' : 'var(--bad-bg)', border: '1px solid ' + (conectado ? 'var(--good)' : 'var(--bad)'), color: conectado ? 'var(--good)' : 'var(--bad)', fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--bad)' }} />{conectado ? 'Fathom conectado' : 'Sin conexión a datos'}
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--dim)' }}>Desempeño del closer en cada R1 / R2 — grabación, SPIN, objeciones, transcript anotado. Entrega de servicio excluida.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={sincronizar} disabled={syncing} style={{ padding: '8px 14px', borderRadius: 10, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, border: '1px solid var(--accent)', background: syncing ? 'var(--surface-2)' : 'var(--accent)', color: syncing ? 'var(--dim)' : '#fff' }}>
            {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
          {syncMsg ? <div style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 420, textAlign: 'right' }}>{syncMsg}</div>
            : lastSync && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>Último sync: {fmtFecha(lastSync)}</div>}
        </div>
      </header>

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
        <Kpi label="Score promedio" value={kpis.scorePromedio != null ? fmtScore(kpis.scorePromedio) : '—'} sub={`${kpis.conScore} llamadas con transcript`} color={kpis.scorePromedio != null ? scoreColor(kpis.scorePromedio) : 'var(--faint)'} />
        <Kpi label="R1 · diagnóstico" value={kpis.r1Prom != null ? fmtScore(kpis.r1Prom) : '—'} sub="score promedio" color={kpis.r1Prom != null ? scoreColor(kpis.r1Prom) : 'var(--faint)'} />
        <Kpi label="R2 · cierre" value={kpis.r2Prom != null ? fmtScore(kpis.r2Prom) : '—'} sub="score promedio" color={kpis.r2Prom != null ? scoreColor(kpis.r2Prom) : 'var(--faint)'} />
        <Kpi label="Ganadas" value={String(kpis.ganadas)} sub={`de ${counts.ventas} de venta`} color={kpis.ganadas ? 'var(--good)' : 'var(--faint)'} />
        <Kpi label="Servicio excluido" value={String(counts.servicio)} sub={counts.pendientes ? `${counts.pendientes} sin transcript` : 'no son venta'} color="var(--dim)" />
      </section>

      {errorMsg && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, padding: '14px 18px', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--bad)', marginBottom: 2 }}>No se pudieron leer los análisis</div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)' }}>{errorMsg}</div>
        </div>
      )}

      {calls.length === 0 ? (
        <EmptyState counts={counts} hasError={!!errorMsg} syncing={syncing} onSync={sincronizar} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
          {/* LISTA + FILTROS */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 13px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead, empresa…" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif" }} />
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['todos', 'R1', 'R2'] as const).map((t) => <button key={t} onClick={() => setTipoF(t)} style={chip(tipoF === t)}>{t === 'todos' ? 'Todas' : t}</button>)}
                {(['todos', 'good', 'warn', 'bad'] as const).map((o) => o !== 'todos' && (
                  <button key={o} onClick={() => setOutcomeF(outcomeF === o ? 'todos' : o)} style={{ ...chip(outcomeF === o), borderColor: outcomeF === o ? MO_TONE[o === 'warn' ? 'neutral' : o] : 'var(--border-strong)' }} title={o === 'good' ? 'Ganadas/buenas' : o === 'bad' ? 'Malas/perdidas' : 'Medias'}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: MO_TONE[o === 'warn' ? 'neutral' : o], display: 'inline-block' }} />
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                {closers.length > 1 && (
                  <select value={closerF} onChange={(e) => setCloserF(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '5px 7px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12, color: 'var(--dim)', fontFamily: "'Geist', sans-serif" }}>
                    <option value="todos">Todos los closers</option>
                    {closers.map((c) => <option key={c} value={c}>{firstName(c)}</option>)}
                  </select>
                )}
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ padding: '5px 7px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 12, color: 'var(--dim)', fontFamily: "'Geist', sans-serif" }}>
                  <option value="fecha">↓ Fecha</option>
                  <option value="score">↓ Score</option>
                  <option value="duracion">↓ Duración</option>
                </select>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{visible.length} de {calls.length} llamadas</div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 7 }}>
              {visible.map((c) => {
                const active = sel?.recording_id === c.recording_id;
                return (
                  <div key={c.recording_id} onClick={() => setSelId(c.recording_id)} style={{ padding: '11px 12px', borderRadius: 11, cursor: 'pointer', background: active ? 'var(--surface-2)' : 'transparent', border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent') }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_nombre || c.invitee_email || c.title}</span>
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#fff', background: c.score != null ? scoreColor(c.score) : 'var(--faint)' }}>{fmtScore(c.score)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_empresa || c.invitee_email || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <span style={typeChip(c.tipo)}>{c.tipo ?? '—'}</span>
                      {c.has_transcript === false && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--bad)' }}>sin transcript</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--faint)' }}>{fmtFecha(c.call_date)} · {fmtDur(c.duration_min)}</span>
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Nada con estos filtros.</div>}
            </div>
          </div>

          {/* DETALLE */}
          {sel ? <Detail key={sel.recording_id} sel={sel} onRefresh={() => router.refresh()} /> : <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }} />}
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 15px' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ---- detalle ---------------------------------------------------------------

type TranscriptLine = { t_seconds: number; speaker: string | null; text: string };

function Detail({ sel, onRefresh }: { sel: ClosingAnalysisRow; onRefresh: () => void }) {
  const token = embedToken(sel);
  const [seek, setSeek] = useState<number | null>(null);     // segundo a reproducir (null = thumbnail)
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const play = useCallback((sec: number) => { setSeek(Math.max(0, Math.round(sec))); }, []);

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
  const outcomeChip: CSSProperties = {
    display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
    background: tone === 'good' ? 'var(--good-bg)' : tone === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)',
    color: tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--bad)',
    border: '1px solid ' + (tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn-fill)' : 'var(--bad)'),
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={typeChip(sel.tipo)}>{sel.tipo ?? '—'}</span>
            {sel.outcome && <span style={outcomeChip}>{sel.outcome}</span>}
            {sel.has_transcript === false && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--bad)' }}>análisis sin transcript</span>}
          </div>
          <h2 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{sel.lead_nombre || sel.invitee_email || sel.title}</h2>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 3 }}>
            {sel.lead_empresa || sel.invitee_email || '—'} · Closer: <strong style={{ color: 'var(--ink)' }}>{sel.closer || '—'}</strong> · {fmtFecha(sel.call_date)} · {fmtDur(sel.duration_min)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1, color: sel.score != null ? scoreColor(sel.score) : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>{fmtScore(sel.score)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: MONO }}>SCORE / 10</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {sel.lead_id != null && <a href={`/leads/${sel.lead_id}`} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '4px 9px' }}>Lead →</a>}
            <button onClick={reanalizar} disabled={reanalyzing} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '4px 9px', cursor: reanalyzing ? 'default' : 'pointer' }}>{reanalyzing ? '…' : '↻'}</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* GRABACIÓN */}
        <div style={{ padding: '16px 22px 0' }}>
          <Player token={token} seek={seek} shareUrl={sel.share_url} onPlay={play} />
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 22px 0', borderBottom: '1px solid var(--border)' }}>
          {([['resumen', 'Análisis'], ['momentos', `Momentos${sel.moments?.length ? ' · ' + sel.moments.length : ''}`], ['transcript', 'Transcript']] as [DetailTab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, fontFamily: "'Geist', sans-serif", cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid ' + (tab === k ? 'var(--accent)' : 'transparent'), color: tab === k ? 'var(--ink)' : 'var(--dim)' }}>{l}</button>
          ))}
        </div>

        <div style={{ padding: '18px 22px 24px' }}>
          {msg && <div style={{ fontSize: 12, color: 'var(--bad)', marginBottom: 10 }}>{msg}</div>}
          {tab === 'resumen' && <ResumenTab sel={sel} onPlay={play} />}
          {tab === 'momentos' && <MomentosTab sel={sel} onPlay={play} />}
          {tab === 'transcript' && <TranscriptTab sel={sel} onPlay={play} />}
        </div>
      </div>
    </div>
  );
}

// ---- player embebido -------------------------------------------------------

function Player({ token, seek, shareUrl, onPlay }: { token: string | null; seek: number | null; shareUrl: string | null; onPlay: (s: number) => void }) {
  if (!token) {
    return isSafeHttpUrl(shareUrl)
      ? <a href={shareUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: 18, border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--accent)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>▶ Ver grabación en Fathom</a>
      : <div style={{ padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--faint)', fontSize: 13, textAlign: 'center' }}>Sin grabación disponible</div>;
  }
  if (seek == null) {
    const thumb = `https://fathom.video/share/${token}/thumbnail`;
    return (
      <div onClick={() => onPlay(0)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onPlay(0); }}
        style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="Grabación" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(23,21,17,.18)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.3)' }}>
            <span style={{ marginLeft: 4, borderStyle: 'solid', borderWidth: '10px 0 10px 16px', borderColor: 'transparent transparent transparent var(--ink)' }} />
          </div>
          <span style={{ position: 'absolute', bottom: 10, fontSize: 11, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>Reproducir grabación</span>
        </div>
      </div>
    );
  }
  const src = `https://fathom.video/embed/${token}?timestamp=${seek}&autoplay=1`;
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
      <iframe key={`${token}-${seek}`} src={src} title="Grabación de Fathom" allow="autoplay; fullscreen" allowFullScreen frameBorder={0} style={{ width: '100%', height: '100%', border: 0 }} />
    </div>
  );
}

// ---- tab: resumen / análisis ----------------------------------------------

function TimeBtn({ sec, onPlay, color }: { sec: number | null | undefined; onPlay: (s: number) => void; color?: string }) {
  if (sec == null) return null;
  return (
    <button onClick={() => onPlay(sec)} title="Reproducir desde acá" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: color ?? 'var(--accent)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', flex: 'none' }}>▶ {mmss(sec)}</button>
  );
}

function ResumenTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const dims = sel.dims ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* resumen + next step */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <Label>Resumen del análisis</Label>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', marginTop: 8 }}>{sel.summary || 'Sin resumen.'}</div>
        {sel.next_step && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink)' }}><strong style={{ color: 'var(--accent)' }}>Próximo paso:</strong> {sel.next_step}</div>}
      </div>

      {/* dimensiones */}
      {GROUP_DEFS.map((g) => {
        const gd = dims.filter((d) => d.g === g.key);
        if (!gd.length) return null;
        return (
          <div key={g.key}>
            <Label>{g.label}</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              {gd.map((d, i) => <DimRow key={d.label + i} d={d} onPlay={onPlay} />)}
            </div>
          </div>
        );
      })}

      {/* fortalezas / debilidades */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <EvidenceCol title="Fortalezas" items={sel.strengths ?? []} tone="good" onPlay={onPlay} />
        <EvidenceCol title="A mejorar" items={sel.weaknesses ?? []} tone="bad" onPlay={onPlay} />
      </div>

      {/* objeciones */}
      {(sel.objections?.length ?? 0) > 0 && (
        <div>
          <Label>Objeciones</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {sel.objections!.map((o, i) => (
              <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', borderLeft: '3px solid ' + (o.handled ? 'var(--good)' : 'var(--bad)') }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: o.handled ? 'var(--good)' : 'var(--bad)' }}>{o.handled ? 'MANEJADA' : 'SIN RESOLVER'}</span>
                  <TimeBtn sec={o.t_seconds} onPlay={onPlay} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>“{o.quote}”</div>
                {o.note && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4 }}>{o.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* coaching */}
      {(sel.recs?.length ?? 0) > 0 && (
        <div style={{ background: 'rgba(200,135,12,.07)', border: '1px solid rgba(200,135,12,.28)', borderRadius: 12, padding: '14px 16px' }}>
          <Label color="#9A6A09">Coaching · qué mejorar</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
            {sel.recs!.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 7 }} />
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DimRow({ d, onPlay }: { d: ClosingDim; onPlay: (s: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor(d.score), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(d.score)} / 10</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: d.score * 10 + '%', background: scoreColor(d.score), borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 5, lineHeight: 1.5 }}>{d.note}</div>
      {d.quote && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 10px' }}>
          <TimeBtn sec={d.t_seconds} onPlay={onPlay} />
          <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45, fontStyle: 'italic' }}>“{d.quote}”</span>
        </div>
      )}
    </div>
  );
}

function EvidenceCol({ title, items, tone, onPlay }: { title: string; items: ClosingAnalysisRow['strengths']; tone: 'good' | 'bad'; onPlay: (s: number) => void }) {
  const color = tone === 'good' ? 'var(--good)' : 'var(--bad)';
  return (
    <div>
      <Label color={color}>{title}</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {(items ?? []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>—</div>}
        {(items ?? []).map((s, i) => (
          <div key={i} style={{ borderLeft: '3px solid ' + color, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</span>
              <TimeBtn sec={s.t_seconds} onPlay={onPlay} color={color} />
            </div>
            {s.quote && <div style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', lineHeight: 1.45 }}>“{s.quote}”</div>}
            {s.note && <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 4, lineHeight: 1.45 }}>{s.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- tab: momentos ---------------------------------------------------------

function MomentosTab({ sel, onPlay }: { sel: ClosingAnalysisRow; onPlay: (s: number) => void }) {
  const moments = sel.moments ?? [];
  if (!moments.length) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin momentos marcados.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {moments.map((m, i) => {
        const accent = MO_TONE[m.tone] ?? 'var(--warn)';
        return (
          <div key={i} onClick={() => m.t_seconds != null && onPlay(m.t_seconds)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '11px 13px', borderLeft: '3px solid ' + accent, cursor: m.t_seconds != null ? 'pointer' : 'default' }}>
            <TimeBtn sec={m.t_seconds} onPlay={onPlay} color={accent} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>{m.quote}</div>
              {m.tag && <div style={{ fontSize: 11.5, fontWeight: 600, color: accent, marginTop: 3 }}>{m.tag}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- tab: transcript (on-demand + anotado) ---------------------------------

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

  // marcadores por t_seconds (del análisis): para resaltar la línea más cercana
  const marks = useMemo(() => {
    const arr = (sel.annotations ?? []).map((a) => ({ t: a.t_seconds, tone: a.tone, label: a.label }));
    return arr.sort((a, b) => a.t - b.t);
  }, [sel.annotations]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando transcript…</div>;
  if (err) return <div style={{ fontSize: 13, color: 'var(--bad)' }}>No se pudo cargar el transcript: {err}</div>;
  if (!lines || !lines.length) return <div style={{ fontSize: 13, color: 'var(--faint)' }}>Sin transcript.</div>;

  // para cada marcador, encontrar el índice de línea con t_seconds más cercano (>=)
  const markByLine = new Map<number, { tone: 'good' | 'bad'; label: string }>();
  for (const mk of marks) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < lines.length; i++) {
      const diff = Math.abs(lines[i].t_seconds - mk.t);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    if (bestDiff <= 30) markByLine.set(best, { tone: mk.tone, label: mk.label });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 11.5, color: 'var(--dim)' }}>
        <span style={{ fontFamily: MONO }}>{lines.length} líneas</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--good)' }} /> buen momento</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bad)' }} /> a mejorar</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lines.map((l, i) => {
          const mk = markByLine.get(i);
          return (
            <div key={i} id={`tl-${i}`} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '5px 8px', borderRadius: 7, background: mk ? (mk.tone === 'good' ? 'var(--good-bg)' : 'var(--bad-bg)') : 'transparent', borderLeft: mk ? '3px solid ' + (mk.tone === 'good' ? 'var(--good)' : 'var(--bad)') : '3px solid transparent' }}>
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
    </div>
  );
}

// ---- misc ------------------------------------------------------------------

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: color ?? 'var(--dim)' }}>{children}</div>;
}

function EmptyState({ counts, hasError, syncing, onSync }: { counts: ClosingViewData['counts']; hasError: boolean; syncing: boolean; onSync: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '40px 36px' }}>
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
