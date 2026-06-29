// =============================================================================
// JourneyTimeline — línea de tiempo del recorrido del lead (presentacional)
// =============================================================================
// Sin hooks ni 'use client': se usa tanto en el modal (cliente) como en la
// ruta /leads/[id] (servidor). Recibe los pasos ya armados por buildJourney.

import type { JourneyState, JourneyStep } from '@/lib/journey';

const SANS = "'Geist', sans-serif";

function tone(s: JourneyState): { dot: string; ring: string; filled: boolean; label: string } {
  switch (s) {
    case 'done': return { dot: 'var(--good)', ring: 'var(--good-bg)', filled: true, label: 'var(--ink)' };
    case 'failed': return { dot: 'var(--bad)', ring: 'var(--bad-bg)', filled: true, label: 'var(--ink)' };
    case 'lost': return { dot: 'var(--bad)', ring: 'var(--bad-bg)', filled: true, label: 'var(--ink)' };
    case 'pending': return { dot: 'var(--warn-fill)', ring: 'var(--warn-bg)', filled: true, label: 'var(--ink)' };
    default: return { dot: 'var(--faint)', ring: 'transparent', filled: false, label: 'var(--dim)' };
  }
}

export function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((st, i) => {
        const t = tone(st.state);
        const last = i === steps.length - 1;
        const connDone = st.state === 'done' || st.state === 'failed';
        return (
          <div key={st.key} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.filled ? t.dot : 'var(--surface)', border: t.filled ? `3px solid ${t.ring}` : '2px solid var(--border-strong)', boxSizing: 'border-box', flex: 'none', marginTop: 2 }} />
              {!last && <span style={{ width: 2, flex: 1, minHeight: 24, background: connDone ? 'var(--good-bg)' : 'var(--border)', marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 18, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: t.label, fontFamily: SANS }}>{st.label}</span>
                {st.date && <span style={{ fontSize: 12.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums', fontFamily: SANS }}>{st.date}</span>}
              </div>
              {st.sub && <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2, fontFamily: SANS }}>{st.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
