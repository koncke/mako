// =============================================================================
// OrigenCard — de dónde vino el lead y si vio el VSL (presentacional, compartido)
// =============================================================================
// Extraído de /leads/[id]/page.tsx para usarlo también en el modal (LeadSheet).
// Sin hooks: sirve como server o client component.

import type { CSSProperties } from 'react';
import type { Lead, VslEngagement } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

function labelOrigen(origen: string | null): { texto: string; color: string } {
  switch (origen) {
    case 'instant_form': return { texto: 'Instant Form (Meta)', color: 'var(--accent)' };
    case 'calendly': return { texto: 'Calendly', color: 'var(--good)' };
    default: return { texto: 'Orgánico / manual', color: 'var(--dim)' };
  }
}

export function OrigenCard({ lead, vslEng, campana }: { lead: Lead; vslEng: VslEngagement; campana: { texto: string | null; tooltip: string | null } }) {
  const tieneAtribucion = lead.origen_lead || lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name || lead.utm_campaign || lead.utm_source;
  const tieneComportamiento = lead.visitor_id !== null;
  const vio = vslEng.plays > 0;
  const agendoSinVerVsl = lead.fecha_agenda !== null && tieneComportamiento && !vio;

  if (!tieneAtribucion && !tieneComportamiento) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 8 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen. Lead anterior al tracking, manual, o llegó sin UTMs ni instant form.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  const filas: Array<{ label: string; value: string | null }> = [
    { label: 'Campaña', value: lead.meta_campaign_name ?? campana.texto },
    { label: 'Adset (Meta)', value: lead.meta_adset_name },
    { label: 'Anuncio (Meta)', value: lead.meta_ad_name },
    { label: 'UTM source', value: lead.utm_source },
  ].filter((f) => f.value);

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 16 }}>Origen del lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 22 }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>Atribución</div>
          <div style={{ fontSize: 16, color: origen.color, fontWeight: 600, marginBottom: 10 }}>{origen.texto}</div>
          {filas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filas.map((f) => (
                <div key={f.label} style={{ fontSize: 14 }}>
                  <span style={{ color: 'var(--dim)' }}>{f.label}: </span>
                  <span style={{ color: 'var(--ink)' }}>{f.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin campaña ni UTMs registrados.</p>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>Comportamiento</div>
          {tieneComportamiento ? (
            <>
              <div style={{ fontSize: 16, marginBottom: 8 }}>
                <span style={{ color: 'var(--dim)' }}>Vio el VSL: </span>
                <span style={{ color: vio ? 'var(--good)' : 'var(--bad)', fontWeight: 600 }}>
                  {vio ? (vslEng.max_pct !== null ? `Sí — hasta el ${vslEng.max_pct}%` : `Sí — ${vslEng.plays} ${vslEng.plays === 1 ? 'vez' : 'veces'}`) : 'No'}
                </span>
              </div>
              {agendoSinVerVsl && (
                <div style={{ borderRadius: 11, padding: '12px 14px', marginTop: 8, background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-fill)', fontSize: 13.5, lineHeight: 1.5 }}>
                  Agendó sin ver el VSL — se saltó el filtro. Probablemente llegue a R1 con menos contexto: dedicá 5 min extra a explicar el modelo antes de calificar.
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin tracking de visitante (agendó antes del tracking del VSL, o llegó por instant form sin pasar por la landing).</p>
          )}
        </div>
      </div>
    </section>
  );
}
