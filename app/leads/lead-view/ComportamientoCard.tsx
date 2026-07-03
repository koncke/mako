// =============================================================================
// ComportamientoCard — actividad del lead en la landing y el VSL (presentacional)
// =============================================================================
// Visitas a la landing, reproducciones del VSL y retención máxima con semáforo.
// Compartido por el modal (LeadSheet) y la ruta /leads/[id].

import type { CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

export function ComportamientoCard({ visitas, dias, plays, maxPct }: { visitas: number; dias: number; plays: number; maxPct: number | null }) {
  const pctColor = maxPct == null ? 'var(--faint)' : maxPct >= 60 ? 'var(--good)' : maxPct >= 30 ? 'var(--accent)' : 'var(--bad)';
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Comportamiento</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
        <div style={miniCard}>
          <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Visitó la landing</div>
          <div style={{ fontSize: 22, color: visitas ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {visitas || '—'}{visitas ? <span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {visitas === 1 ? 'vez' : 'veces'}</span> : null}
          </div>
          {visitas > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{dias} {dias === 1 ? 'día distinto' : 'días distintos'}</div>}
        </div>
        <div style={miniCard}>
          <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>VSL reproducido</div>
          <div style={{ fontSize: 22, color: plays ? 'var(--ink)' : 'var(--faint)', fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
            {plays || '—'}{plays ? <span style={{ fontSize: 13, color: 'var(--faint)', fontWeight: 500 }}> {plays === 1 ? 'vez' : 'veces'}</span> : null}
          </div>
        </div>
        <div style={miniCard}>
          <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>Retención del VSL</div>
          <div style={{ fontSize: 22, color: pctColor, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{maxPct != null ? maxPct + '%' : '—'}</div>
          {maxPct != null && (
            <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
              <div style={{ width: Math.min(100, maxPct) + '%', height: '100%', background: pctColor }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
