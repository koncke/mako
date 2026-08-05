// =============================================================================
// ComportamientoCard — actividad del lead en la landing y el VSL (presentacional)
// =============================================================================
// Visitas a la landing, reproducciones del VSL y retención máxima con semáforo.
// Compartido por el modal (LeadSheet) y la ruta /crm/[id].

import type { CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

export function ComportamientoCard({ visitas, dias, plays, maxPct, tieneVisitor = false }: { visitas: number; dias: number; plays: number; maxPct: number | null; tieneVisitor?: boolean }) {
  const pctColor = maxPct == null ? 'var(--faint)' : maxPct >= 60 ? 'var(--good)' : maxPct >= 30 ? 'var(--accent)' : 'var(--bad)';
  // Sin ningún dato: mensaje claro en vez de tres cuadros con rayas.
  if (!visitas && !plays && maxPct == null) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Comportamiento</div>
        {tieneVisitor ? (
          // Tiene identificador pero NO cruzó con ningún evento. NO afirmamos que
          // "no vio": lo más común es que la landing no haya pasado bien su
          // visitor_id (o que haya visto el VSL desde otro dispositivo/sesión).
          <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>
            Este lead tiene identificador, pero no cruzó con ningún evento de la landing ni del VSL. <b>No quiere decir que no lo haya visto</b>: casi siempre es que la landing no pasó bien su identificador al agendar, o que lo miró desde otro dispositivo. No se puede confirmar la retención.
          </p>
        ) : (
          // Sin visitor_id: entró a mano o por instant form sin pasar por la landing.
          <p style={{ fontSize: 14, color: 'var(--faint)', lineHeight: 1.5 }}>
            Sin tracking para este lead: entró antes de que existiera el tracking del VSL, o llegó por instant form sin pasar por la landing. No hay forma de reconstruirlo.
          </p>
        )}
      </section>
    );
  }
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
          {maxPct != null ? (
            <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
              <div style={{ width: Math.min(100, maxPct) + '%', height: '100%', background: pctColor }} />
            </div>
          ) : plays > 0 ? (
            // Reprodujo pero no llegó ningún hito de avance: NO es "0%", es "sin dato".
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4, lineHeight: 1.35 }}>Reprodujo, sin dato de avance</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
