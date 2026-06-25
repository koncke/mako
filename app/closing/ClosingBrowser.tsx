'use client';

// =============================================================================
// ClosingBrowser v2.1 — Closing Analyst (rediseño liviano)
// =============================================================================
// Principio: un solo borde estructural (lista | detalle); todo lo demás se separa
// con aire y jerarquía tipográfica, no con cajas. El veredicto (score + outcome)
// domina arriba; las citas y notas largas viven a un clic (acordeones). Mantiene
// todas las funciones: grabación embebida con deep-link al segundo exacto,
// dimensiones SPIN/ejecución, momentos, objeciones, transcript anotado, coaching,
// filtros y orden.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Dropdown } from '../components/Dropdown';
import type { ClosingViewData, ClosingAnalysisRow, ClosingDim, ClosingEvidence, DimGroup } from '@/lib/closing';

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
  return y && m && d ? `${d}/${m}` : '—';
}
function fmtDur(min: number | null): string {
  return min == null ? '—' : `${min} min`;
}
function firstName(s: string | null | undefined): string {
  return (s ?? '').trim().split(/\s+/)[0] || '—';
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

type SortKey = 'fecha' | 'score' | 'duracion';
type DetailTab = 'resumen' | 'momentos' | 'transcript';

function Label({ children, color, style }: { children: React.ReactNode; color?: string; style?: CSSProperties }) {
  return <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: color ?? 'var(--dim)', ...style }}>{children}</div>;
}

// ---- principal -------------------------------------------------------------

export function ClosingBrowser({ data, errorMsg }: { data: ClosingViewData; errorMsg: string | null }) {
  const router = useRouter();
  const { calls, counts, kpis, lastSync } = data;

  const [tipoF, setTipoF] = useState<'todos' | 'R1' | 'R2'>('todos');
  const [closerF, setCloserF] = useState('todos');
  const [outcomeF, setOutcomeF] = useState<'todos' | 'good' | 'warn' | 'bad'>('todos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('fecha');
  const [showFilters, setShowFilters] = useState(false);
  const [selId, setSelId] = useState<number | null>(calls[0]?.recording_id ?? null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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

  const conectado = !errorMsg;
  const tToggle = (active: boolean): CSSProperties => ({
    padding: '4px 9px', cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: active ? 600 : 500,
    border: 'none', background: 'transparent', color: active ? 'var(--ink)' : 'var(--faint)',
  });

  const subParts = [
    `${counts.servicio} de servicio excluidas`,
    counts.pendientes ? `${counts.pendientes} sin analizar` : null,
  ].filter(Boolean).join(' · ');

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '28px 0 0' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', padding: '0 32px', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 5 }}>
            <h1 style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: conectado ? 'var(--good)' : 'var(--bad)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--bad)' }} />{conectado ? 'Fathom' : 'Sin datos'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Desempeño del closer en cada R1 / R2{subParts ? ` · ${subParts}` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <button onClick={sincronizar} disabled={syncing} style={{ padding: '7px 13px', borderRadius: 9, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)' }}>
            {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
          {syncMsg ? <div style={{ fontSize: 11.5, color: 'var(--dim)', maxWidth: 360, textAlign: 'right' }}>{syncMsg}</div>
            : lastSync && <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>sync {fmtFecha(lastSync)}</div>}
        </div>
      </header>

      {/* KPIs — cifras sin caja */}
      <section style={{ display: 'flex', padding: '0 32px', marginBottom: 24 }}>
        <Kpi label="Score promedio" value={kpis.scorePromedio != null ? fmtScore(kpis.scorePromedio) : '—'} sub={`${kpis.conScore} llamadas`} color={kpis.scorePromedio != null ? scoreColor(kpis.scorePromedio) : 'var(--faint)'} first />
        <Kpi label="R1 / R2" value={`${fmtScore(kpis.r1Prom)} / ${fmtScore(kpis.r2Prom)}`} sub="diagnóstico / cierre" color="var(--ink)" />
        <Kpi label="Ganadas" value={String(kpis.ganadas)} sub={`de ${counts.ventas} de venta`} color={kpis.ganadas ? 'var(--good)' : 'var(--faint)'} />
      </section>

      {errorMsg && (
        <div style={{ margin: '0 32px 16px', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--bad)' }}>No se pudieron leer los análisis</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{errorMsg}</div>
        </div>
      )}

      {calls.length === 0 ? (
        <EmptyState counts={counts} hasError={!!errorMsg} syncing={syncing} onSync={sincronizar} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', borderTop: '1px solid var(--border)' }}>
          {/* LISTA */}
          <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 10px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead, empresa…" style={{ width: '100%', boxSizing: 'border-box', padding: '6px 2px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--ink)', fontFamily: "'Geist', sans-serif", outline: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {(['todos', 'R1', 'R2'] as const).map((t) => <button key={t} onClick={() => setTipoF(t)} style={tToggle(tipoF === t)}>{t === 'todos' ? 'Todas' : t}</button>)}
                <div style={{ marginLeft: 'auto' }}>
                  <Dropdown value={sort} onChange={(v) => setSort(v as SortKey)} ariaLabel="Ordenar"
                    buttonStyle={{ padding: '4px 8px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--dim)' }}
                    options={[{ value: 'fecha', label: 'Fecha' }, { value: 'score', label: 'Score' }, { value: 'duracion', label: 'Duración' }]} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={() => setShowFilters((s) => !s)} style={{ fontSize: 11, color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: "'Geist', sans-serif" }}>{showFilters ? '− Filtros' : '+ Filtros'}</button>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{visible.length} de {calls.length}</span>
              </div>
              {showFilters && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {(['good', 'warn', 'bad'] as const).map((o) => (
                      <button key={o} onClick={() => setOutcomeF(outcomeF === o ? 'todos' : o)} title={o === 'good' ? 'Buenas' : o === 'bad' ? 'Malas' : 'Medias'}
                        style={{ width: 16, height: 16, borderRadius: '50%', cursor: 'pointer', border: '2px solid ' + (outcomeF === o ? MO_TONE[o === 'warn' ? 'neutral' : o] : 'transparent'), background: MO_TONE[o === 'warn' ? 'neutral' : o], padding: 0, opacity: outcomeF === 'todos' || outcomeF === o ? 1 : 0.3 }} />
                    ))}
                  </div>
                  {closers.length > 1 && (
                    <select value={closerF} onChange={(e) => setCloserF(e.target.value)} style={{ marginLeft: 'auto', padding: '3px 6px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', fontSize: 11.5, color: 'var(--dim)', fontFamily: "'Geist', sans-serif" }}>
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
                  <div key={c.recording_id} onClick={() => setSelId(c.recording_id)}
                    style={{ padding: '11px 14px 11px 14px', cursor: 'pointer', borderLeft: '2px solid ' + (active ? 'var(--accent)' : 'transparent'), background: active ? 'var(--surface-2)' : 'transparent', opacity: noTr ? 0.55 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_nombre || c.invitee_email || c.title}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                        {noTr && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bad)' }} />}
                        <span style={{ fontSize: 14, fontWeight: 700, color: c.score != null ? scoreColor(c.score) : 'var(--faint)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtScore(c.score)}</span>
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>{c.tipo ?? '—'}</span> · {c.lead_empresa || c.invitee_email || '—'} · {fmtFecha(c.call_date)}
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && <div style={{ padding: 24, fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Nada con estos filtros.</div>}
            </div>
          </div>

          {/* DETALLE */}
          {sel ? <Detail key={sel.recording_id} sel={sel} onRefresh={() => router.refresh()} /> : <div />}
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value, sub, color, first }: { label: string; value: string; sub: string; color: string; first?: boolean }) {
  return (
    <div style={{ paddingLeft: first ? 0 : 40, marginLeft: first ? 0 : 40, borderLeft: first ? 'none' : '1px solid var(--border)' }}>
      <Label style={{ fontSize: 10, letterSpacing: '.08em' }}>{label}</Label>
      <div style={{ fontSize: 32, fontWeight: 600, color, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', marginTop: 6, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ---- detalle ---------------------------------------------------------------

type TranscriptLine = { t_seconds: number; speaker: string | null; text: string };

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
      {/* VEREDICTO */}
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
        {/* GRABACIÓN */}
        <Player token={token} seek={seek} shareUrl={sel.share_url} onPlay={play} />

        {/* TABS */}
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

// ---- player ----------------------------------------------------------------

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

// ---- tab: análisis ---------------------------------------------------------

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
      {/* resumen */}
      <div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink)' }}>{sel.summary || 'Sin resumen.'}</div>
        {sel.next_step && <div style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}><Label color="var(--accent)" style={{ display: 'inline' }}>Próximo paso · </Label>{sel.next_step}</div>}
      </div>

      {/* dimensiones */}
      {GROUP_DEFS.map((g) => {
        const gd = dims.filter((d) => d.g === g.key);
        if (!gd.length) return null;
        return (
          <div key={g.key}>
            <Label style={{ marginBottom: 4 }}>{g.label}</Label>
            <div>{gd.map((d, i) => <DimRow key={d.label + i} d={d} onPlay={onPlay} />)}</div>
          </div>
        );
      })}

      {/* fortalezas / debilidades */}
      {((sel.strengths?.length ?? 0) > 0 || (sel.weaknesses?.length ?? 0) > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <EvidenceCol title="Fortalezas" items={sel.strengths ?? []} tone="good" onPlay={onPlay} />
          <EvidenceCol title="A mejorar" items={sel.weaknesses ?? []} tone="bad" onPlay={onPlay} />
        </div>
      )}

      {/* objeciones */}
      {(sel.objections?.length ?? 0) > 0 && (
        <div>
          <Label style={{ marginBottom: 8 }}>Objeciones</Label>
          <div>{sel.objections!.map((o, i) => <ObjectionRow key={i} o={o} onPlay={onPlay} />)}</div>
        </div>
      )}

      {/* coaching */}
      {(sel.recs?.length ?? 0) > 0 && (
        <div>
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
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
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

// ---- tab: momentos ---------------------------------------------------------

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

// ---- tab: transcript -------------------------------------------------------

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

// ---- vacío -----------------------------------------------------------------

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
