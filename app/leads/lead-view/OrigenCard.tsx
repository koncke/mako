// =============================================================================
// OrigenCard — de dónde vino el lead (presentacional, compartido)
// =============================================================================
// Canal + campaña/anuncio en minicards legibles. El comportamiento (VSL/landing)
// vive en ComportamientoCard; acá solo la atribución.

import type { CSSProperties } from 'react';
import type { Lead, VslEngagement } from '@/lib/leads';

const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 24px' };
const sectLabel: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const miniCard: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' };

function labelOrigen(origen: string | null): { texto: string; color: string } {
  switch (origen) {
    case 'instant_form': return { texto: 'Instant Form (Meta)', color: 'var(--accent)' };
    case 'calendly': return { texto: 'Calendly', color: 'var(--good)' };
    default: return { texto: 'Orgánico / manual', color: 'var(--dim)' };
  }
}

function Item({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 14.5, color: value ? (color ?? 'var(--ink)') : 'var(--faint)', fontWeight: value ? 600 : 400, marginTop: 3, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  );
}

export function OrigenCard({ lead, vslEng, campana }: { lead: Lead; vslEng: VslEngagement; campana: { texto: string | null; tooltip: string | null } }) {
  void vslEng;
  const tieneAtribucion = lead.origen_lead || lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name || lead.utm_campaign || lead.utm_source;

  if (!tieneAtribucion) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen: este lead entró a mano, o antes de que existiera el tracking de campañas. No hay forma de reconstruirlo.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Origen del lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Item label="Canal de entrada" value={origen.texto} color={origen.color} />
        <Item label="Campaña" value={lead.meta_campaign_name ?? campana.texto} />
        {(lead.meta_ad_name || lead.meta_adset_name) && <Item label="Anuncio" value={lead.meta_ad_name ?? lead.meta_adset_name} />}
        {lead.utm_source && <Item label="Fuente (UTM)" value={lead.utm_source === 'fb' ? 'Facebook' : lead.utm_source === 'ig' ? 'Instagram' : lead.utm_source} />}
      </div>
    </section>
  );
}
