// =============================================================================
// InsightsCard — lo que las llamadas de Fathom dicen del lead (Closing Analyst)
// =============================================================================
// Por reunión analizada: score, resultado, resumen, próximo paso, dolor y
// situación del prospecto (dims SPIN) y objeciones. La data ya vive en
// closing_analyses (matcheada por lead_id); acá solo se muestra.

import type { CSSProperties } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

export type LeadInsight = {
  recording_id: number;
  share_url: string | null;
  started_at: string | null;
  tipo: string | null;          // 'R1' | 'R2' | otro
  score: number | null;
  outcome: string | null;
  outcome_tone: string | null;  // 'positivo' | 'negativo' | ...
  summary: string | null;
  next_step: string | null;
  dims: Array<{ label?: string; note?: string; quote?: string }> | null;
  objections: Array<{ quote?: string; handled?: boolean; note?: string }> | null;
  closer: string | null;
  duration_min: number | null;
};

const toneColor = (t: string | null) => (t === 'positivo' ? 'var(--good)' : t === 'negativo' ? 'var(--bad)' : 'var(--dim)');

export function InsightsCard({ insights }: { insights: LeadInsight[] }) {
  if (!insights.length) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Insights de las llamadas</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>
          Sin llamadas analizadas todavía. Cuando Fathom grabe una reunión con este lead, el análisis (dolor, situación, objeciones, resultado) aparece acá solo.
        </p>
      </section>
    );
  }

  return (
    <>
      {insights.map((a) => {
        const dims = Array.isArray(a.dims) ? a.dims : [];
        const dolor = dims.find((d) => /problema|dolor/i.test(d.label ?? ''));
        const situacion = dims.find((d) => /situaci/i.test(d.label ?? ''));
        const objections = Array.isArray(a.objections) ? a.objections : [];
        return (
          <section key={a.recording_id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--ink)' }}>{a.tipo || 'Llamada'}</span>
                <span style={{ fontSize: 13, color: 'var(--dim)' }}>{a.started_at ? fmtDDMMYYYY(a.started_at) : ''}{a.duration_min ? ` · ${Math.round(a.duration_min)} min` : ''}{a.closer ? ` · ${a.closer}` : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {a.score != null && <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: a.score >= 7 ? 'var(--good)' : a.score >= 4 ? 'var(--warn)' : 'var(--bad)' }}>{a.score}/10</span>}
                {a.outcome && <span style={{ fontSize: 12.5, fontWeight: 600, color: toneColor(a.outcome_tone) }}>{a.outcome}</span>}
              </div>
            </div>

            {a.summary && <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 12px' }}>{a.summary}</p>}

            {(situacion?.note || dolor?.note) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 12 }}>
                {situacion?.note && (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 4 }}>Situación del negocio</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{situacion.note}</div>
                    {situacion.quote && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', marginTop: 6 }}>&ldquo;{situacion.quote}&rdquo;</div>}
                  </div>
                )}
                {dolor?.note && (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 4 }}>Dolor principal</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>{dolor.note}</div>
                    {dolor.quote && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', marginTop: 6 }}>&ldquo;{dolor.quote}&rdquo;</div>}
                  </div>
                )}
              </div>
            )}

            {objections.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>Objeciones</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {objections.map((o, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
                      <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, color: o.handled ? 'var(--good)' : 'var(--bad)', background: o.handled ? 'var(--good-bg)' : 'var(--bad-bg)' }}>{o.handled ? 'Manejada' : 'Sin manejar'}</span>
                      <span style={{ color: 'var(--ink)' }}>{o.note || o.quote}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              {a.next_step ? <div style={{ fontSize: 13, color: 'var(--dim)' }}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>Próximo paso:</span> {a.next_step}</div> : <span />}
              {a.share_url && <a href={a.share_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>Ver grabación →</a>}
            </div>
          </section>
        );
      })}
    </>
  );
}
