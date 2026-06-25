'use client';

// =============================================================================
// ClosingBrowser — UI del Closing Analyst (lista + detalle), data real
// =============================================================================
// Recibe las llamadas de VENTA ya analizadas (closing_analyses, category=venta)
// desde el server. El filtro de closer cambia la lista; seleccionar una llamada
// abre su análisis (SPIN + ejecución, momentos clave, recomendaciones). El botón
// "Sincronizar" dispara /api/closing/sync (trae nuevas de Fathom y las analiza);
// "Re-analizar" re-corre una llamada puntual. Las de entrega de servicio /
// internas / test quedan excluidas y se muestran solo como contador.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { ClosingViewData, ClosingAnalysisRow, DimGroup } from '@/lib/closing';

const MONO = "'Geist Mono', monospace";

// ---- Helpers ---------------------------------------------------------------

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
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
function fmtDur(min: number | null): string {
  return min == null ? '—' : `${min} min`;
}
function firstName(s: string | null | undefined): string {
  return (s ?? '').trim().split(/\s+/)[0] || '—';
}
/** Solo http(s) — evita href javascript:/data: si alguna vez una URL viniera envenenada. */
function isSafeHttpUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

function typeChip(type: string | null): CSSProperties {
  const r2 = type === 'R2';
  return {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    fontFamily: MONO,
    letterSpacing: '.04em',
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

// ---- Componente ------------------------------------------------------------

export function ClosingBrowser({ data, errorMsg }: { data: ClosingViewData; errorMsg: string | null }) {
  const router = useRouter();
  const { calls, counts, lastSync } = data;

  const [closerFilter, setCloserFilter] = useState('todos');
  const [selId, setSelId] = useState<number | null>(calls[0]?.recording_id ?? null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  // -- closers presentes en las llamadas
  const closers = useMemo(() => [...new Set(calls.map((c) => c.closer).filter((c): c is string => !!c))], [calls]);
  const filterDefs = useMemo(
    () => [{ k: 'todos', label: 'Todos' }, ...closers.map((c) => ({ k: c, label: firstName(c) }))],
    [closers],
  );

  // -- visibles + selección efectiva
  const visible = useMemo(
    () => calls.filter((c) => closerFilter === 'todos' || c.closer === closerFilter),
    [calls, closerFilter],
  );
  const sel = useMemo(() => {
    const byId = calls.find((c) => c.recording_id === selId);
    if (byId && (closerFilter === 'todos' || byId.closer === closerFilter)) return byId;
    return visible[0] ?? null;
  }, [calls, selId, closerFilter, visible]);

  // -- KPIs (de la data real)
  const conScore = calls.filter((c) => c.score != null);
  const avg = conScore.length ? conScore.reduce((a, c) => a + (c.score ?? 0), 0) / conScore.length : 0;
  const ganadas = calls.filter((c) => c.outcome_tone === 'good').length;
  const kpis: { label: string; value: string; sub: string; color: string }[] = [
    { label: 'Score promedio', value: conScore.length ? fmtScore(Math.round(avg * 10) / 10) : '—', sub: '/ 10 · llamadas de venta', color: conScore.length ? scoreColor(avg) : 'var(--faint)' },
    { label: 'Llamadas de venta', value: String(counts.ventas), sub: 'R1 + R2 analizadas', color: 'var(--ink)' },
    { label: 'Ganadas', value: String(ganadas), sub: 'cierres / facturando', color: ganadas ? 'var(--good)' : 'var(--faint)' },
    { label: 'Entrega de servicio', value: String(counts.servicio), sub: 'excluidas del análisis', color: 'var(--dim)' },
  ];

  // -- sincronizar (un lote)
  async function sincronizar() {
    setSyncing(true);
    setSyncMsg('Trayendo llamadas de Fathom y analizando…');
    try {
      const r = await fetch('/api/closing/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el sync');
      const restantes = j.restantes ?? 0;
      setSyncMsg(
        `Listo: ${j.ventas} de venta · ${j.servicio} de servicio · ${j.errores} con error.` +
        (restantes > 0 ? ` Quedan ${restantes} por analizar — sincronizá de nuevo o esperá al sync automático.` : ' Todo al día.'),
      );
      router.refresh();
    } catch (e) {
      setSyncMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  // -- re-analizar la llamada seleccionada
  async function reanalizar() {
    if (!sel) return;
    setReanalyzing(true);
    setSyncMsg(null);
    try {
      const r = await fetch('/api/closing/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_id: sel.recording_id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'falló el re-análisis');
      router.refresh();
    } catch (e) {
      setSyncMsg(`Error re-analizando: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReanalyzing(false);
    }
  }

  const conectado = !errorMsg;

  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '30px 36px 22px' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 7 }}>
            <h1 style={{ fontWeight: 600, fontSize: 40, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Closing Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: conectado ? 'var(--good-bg)' : 'var(--bad-bg)', border: '1px solid ' + (conectado ? 'var(--good)' : 'var(--bad)'), color: conectado ? 'var(--good)' : 'var(--bad)', fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? 'var(--good)' : 'var(--bad)' }} />
              {conectado ? 'Fathom conectado' : 'Sin conexión a datos'}
            </span>
          </div>
          <div style={{ fontSize: 14.5, color: 'var(--dim)' }}>
            Review automática del desempeño del closer en cada R1 / R2 — SPIN, propuesta, objeciones y CTA. Las llamadas de entrega de servicio se excluyen.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {filterDefs.map((f) => {
              const active = closerFilter === f.k;
              return (
                <button
                  key={f.k}
                  onClick={() => setCloserFilter(f.k)}
                  style={{
                    padding: '8px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: "'Geist', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    border: '1px solid ' + (active ? 'var(--ink)' : 'var(--border-strong)'),
                    background: active ? 'var(--ink)' : 'var(--surface)', color: active ? 'var(--on-sidebar)' : 'var(--dim)',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
            <button
              onClick={sincronizar}
              disabled={syncing}
              style={{
                padding: '8px 14px', borderRadius: 10, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif",
                fontSize: 13, fontWeight: 600, border: '1px solid var(--accent)',
                background: syncing ? 'var(--surface-2)' : 'var(--accent)', color: syncing ? 'var(--dim)' : '#fff',
                opacity: syncing ? 0.8 : 1,
              }}
            >
              {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
            </button>
          </div>
          {syncMsg && <div style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 460, textAlign: 'right' }}>{syncMsg}</div>}
          {lastSync && !syncMsg && (
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontFamily: MONO }}>Último sync: {fmtFecha(lastSync)}</div>
          )}
        </div>
      </header>

      {/* KPIs */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 9 }}>{k.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 27, fontWeight: 600, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
              <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* ERROR de datos (p.ej. sin Supabase en local) */}
      {errorMsg && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--bad)', marginBottom: 2 }}>No se pudieron leer los análisis</div>
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--dim)' }}>{errorMsg}</div>
        </div>
      )}

      {/* CUERPO */}
      {calls.length === 0 ? (
        <EmptyState counts={counts} hasError={!!errorMsg} syncing={syncing} onSync={sincronizar} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
          {/* LISTA */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: '15px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Llamadas de venta</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 999 }}>{visible.length}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
              {visible.map((c) => {
                const active = sel?.recording_id === c.recording_id;
                return (
                  <div
                    key={c.recording_id}
                    onClick={() => setSelId(c.recording_id)}
                    style={{
                      padding: '12px 13px', borderRadius: 12, cursor: 'pointer',
                      background: active ? 'var(--surface-2)' : 'transparent',
                      border: '1px solid ' + (active ? 'var(--border-strong)' : 'transparent'),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_nombre || c.invitee_email || c.title}</span>
                      <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, fontVariantNumeric: 'tabular-nums', color: '#fff', background: scoreColor(c.score ?? 0) }}>{fmtScore(c.score)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lead_empresa || c.invitee_email || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                      <span style={typeChip(c.tipo)}>{c.tipo ?? '—'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{firstName(c.closer)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)' }}>{fmtFecha(c.call_date)} · {fmtDur(c.duration_min)}</span>
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && (
                <div style={{ padding: 24, fontSize: 13, color: 'var(--faint)', textAlign: 'center' }}>Sin llamadas para este closer.</div>
              )}
            </div>
          </div>

          {/* DETALLE */}
          {sel ? <Detail sel={sel} reanalyzing={reanalyzing} onReanalyze={reanalizar} /> : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }} />
          )}
        </div>
      )}
    </main>
  );
}

// ---- Detalle del análisis --------------------------------------------------

function Detail({ sel, reanalyzing, onReanalyze }: { sel: ClosingAnalysisRow; reanalyzing: boolean; onReanalyze: () => void }) {
  const tone = sel.outcome_tone ?? 'warn';
  const outcomeChip: CSSProperties = {
    display: 'inline-block', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
    background: tone === 'good' ? 'var(--good-bg)' : tone === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)',
    color: tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--bad)',
    border: '1px solid ' + (tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn-fill)' : 'var(--bad)'),
  };
  const dims = sel.dims ?? [];
  const moments = sel.moments ?? [];
  const recs = sel.recs ?? [];

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* cabecera del detalle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={typeChip(sel.tipo)}>{sel.tipo ?? '—'}</span>
            {sel.outcome && <span style={outcomeChip}>{sel.outcome}</span>}
          </div>
          <h2 style={{ fontWeight: 600, fontSize: 24, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{sel.lead_nombre || sel.invitee_email || sel.title}</h2>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 3 }}>
            {sel.lead_empresa || sel.invitee_email || '—'} · Closer: <strong style={{ color: 'var(--ink)' }}>{sel.closer || '—'}</strong> · {fmtFecha(sel.call_date)} · {fmtDur(sel.duration_min)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flex: 'none' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1, color: scoreColor(sel.score ?? 0), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(sel.score)}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>SCORE / 10</div>
          </div>
          <button
            onClick={onReanalyze}
            disabled={reanalyzing}
            style={{ padding: '5px 10px', borderRadius: 8, cursor: reanalyzing ? 'default' : 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: "'Geist', sans-serif", border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)' }}
          >
            {reanalyzing ? 'Re-analizando…' : '↻ Re-analizar'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* resumen */}
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 13, padding: '16px 18px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 9 }}>Resumen del análisis</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)' }}>{sel.summary || 'Sin resumen.'}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 13, flexWrap: 'wrap' }}>
            {isSafeHttpUrl(sel.share_url) && (
              <a href={sel.share_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>▶ Ver grabación en Fathom</a>
            )}
            {sel.lead_id != null && (
              <a href={`/leads/${sel.lead_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--dim)', textDecoration: 'none' }}>Abrir ficha del lead →</a>
            )}
          </div>
        </div>

        {/* dimensiones */}
        {GROUP_DEFS.map((g) => {
          const groupDims = dims.filter((d) => d.g === g.key);
          if (!groupDims.length) return null;
          return (
            <div key={g.key}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {groupDims.map((d, i) => (
                  <div key={d.label + i}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{d.label}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: scoreColor(d.score), fontVariantNumeric: 'tabular-nums' }}>{fmtScore(d.score)} / 10</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: d.score * 10 + '%', background: scoreColor(d.score), borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>{d.note}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* momentos clave */}
        {moments.length > 0 && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 12 }}>Momentos clave de la transcripción</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {moments.map((m, i) => {
                const accent = MO_TONE[m.tone] ?? 'var(--warn)';
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', borderLeft: '3px solid ' + accent }}>
                    <span style={{ flex: 'none', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 7 }}>{m.t || '—'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{m.quote}</div>
                      {m.tag && <div style={{ fontSize: 11.5, fontWeight: 600, color: accent, marginTop: 4 }}>{m.tag}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* recomendaciones */}
        {recs.length > 0 && (
          <div style={{ background: 'rgba(200,135,12,.07)', border: '1px solid rgba(200,135,12,.28)', borderRadius: 13, padding: '16px 18px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A6A09', marginBottom: 12 }}>Coaching · qué mejorar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recs.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 7 }} />
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink)' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Estado vacío ----------------------------------------------------------

function EmptyState({ counts, hasError, syncing, onSync }: { counts: ClosingViewData['counts']; hasError: boolean; syncing: boolean; onSync: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '40px 36px' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
          {hasError ? 'Sin datos disponibles' : 'Todavía no hay llamadas de venta analizadas'}
        </div>
        <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 20 }}>
          {hasError
            ? 'No se pudo conectar a la base de datos (en local faltan las claves de Supabase). En producción, sincronizá para traer y analizar las llamadas de Fathom.'
            : 'Sincronizá para traer las llamadas históricas de Fathom, matchearlas con los leads y analizar las de venta (R1/R2). Las de entrega de servicio se detectan y se excluyen automáticamente.'}
        </div>
        {counts.total > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 20, fontFamily: MONO }}>
            {counts.total} procesadas · {counts.servicio} servicio · {counts.internas} internas · {counts.test} test · {counts.errores} con error
          </div>
        )}
        <button
          onClick={onSync}
          disabled={syncing}
          style={{ padding: '10px 18px', borderRadius: 11, cursor: syncing ? 'default' : 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 600, border: '1px solid var(--accent)', background: syncing ? 'var(--surface-2)' : 'var(--accent)', color: syncing ? 'var(--dim)' : '#fff' }}
        >
          {syncing ? 'Sincronizando…' : '↻ Sincronizar llamadas'}
        </button>
      </div>
    </div>
  );
}
