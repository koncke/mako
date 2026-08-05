// =============================================================================
// OrigenCard — de dónde vino el lead (presentacional, compartido)
// =============================================================================
// Canal + campaña/conjunto/anuncio en minicards legibles. El comportamiento
// (VSL/landing) vive en ComportamientoCard; acá solo la atribución. Cuando hay un
// anuncio de Meta identificado (meta_ad_id), las minicards son un LINK al Ads
// Manager de MaKo (ruta interna /ads-manager/<ad_id>) que abre el detalle de ese
// anuncio — NO a Meta.

import type { CSSProperties } from 'react';
import Link from 'next/link';
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

function Item({ label, value, color, href }: { label: string; value: string | null; color?: string; href?: string | null }) {
  const inner = (
    <>
      <div style={{ fontSize: 11.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span>{label}</span>
        {href && <span aria-hidden style={{ color: 'var(--primary)', fontWeight: 700 }}>→</span>}
      </div>
      <div style={{ fontSize: 14.5, color: value ? (href ? 'var(--primary)' : (color ?? 'var(--ink)')) : 'var(--faint)', fontWeight: value ? 600 : 400, marginTop: 3, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} title="Abrir en el Ads Manager de MaKo"
        style={{ ...miniCard, display: 'block', textDecoration: 'none', cursor: 'pointer', borderColor: 'var(--primary)', transition: 'background .12s' }}>
        {inner}
      </Link>
    );
  }
  return <div style={miniCard}>{inner}</div>;
}

export function OrigenCard({ lead, vslEng, campana, adNombre }: { lead: Lead; vslEng: VslEngagement; campana: { texto: string | null; tooltip: string | null }; adNombre?: string | null }) {
  void vslEng;
  // Jerarquía de Meta: Campaña → Conjunto (adset) → Anuncio. Mostramos las 3 para
  // saber EXACTAMENTE de qué anuncio vino.
  //
  // OJO: los leads de Calendly (la mayoría de los agendados) NO traen meta_ad_id ni
  // meta_ad_name — el anuncio viaja en `utm_content` (ej. "029.01.g Anuncio" o el id
  // numérico del anuncio). Por eso el anuncio se arma con ese fallback, y el
  // deep-link usa el id numérico venga de meta_ad_id o de utm_content.
  const utmContent = lead.utm_content?.trim() || null;
  const utmEsId = !!utmContent && /^\d{6,}$/.test(utmContent);
  const adId = lead.meta_ad_id ?? (utmEsId ? utmContent : null);
  const anuncioNombre = adNombre ?? lead.meta_ad_name ?? (utmContent && !utmEsId ? utmContent : null);
  const conjunto = lead.meta_adset_name ?? null;
  const hayAnuncio = !!(anuncioNombre || adId);
  const anuncioMostrar = anuncioNombre ?? (adId ? `Anuncio ${adId}` : null);
  const tieneAtribucion = lead.origen_lead || lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name || lead.meta_ad_id || lead.utm_campaign || lead.utm_content || lead.utm_source;

  if (!tieneAtribucion) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen: este lead entró a mano, o antes de que existiera el tracking de campañas. No hay forma de reconstruirlo.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  // Deep-link al Ads Manager de MaKo: /ads-manager/<ad_id> abre el detalle de ese
  // anuncio (con su campaña y conjunto). El id sale de meta_ad_id o del utm_content
  // numérico (Calendly). Si el anuncio solo vino como nombre, no hay a dónde linkear.
  const linkAnuncio = adId ? `/ads-manager/${adId}` : null;
  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Origen del lead</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Item label="Canal de entrada" value={origen.texto} color={origen.color} />
        <Item label="Campaña" value={lead.meta_campaign_name ?? campana.texto} href={linkAnuncio} />
        {conjunto && <Item label="Conjunto (adset)" value={conjunto} href={linkAnuncio} />}
        {hayAnuncio && <Item label="Anuncio" value={anuncioMostrar} href={linkAnuncio} />}
        {lead.utm_source && <Item label="Fuente (UTM)" value={lead.utm_source === 'fb' ? 'Facebook' : lead.utm_source === 'ig' ? 'Instagram' : lead.utm_source} />}
      </div>
      {linkAnuncio && (
        <p style={{ fontSize: 12, color: 'var(--faint)', margin: '12px 0 0', lineHeight: 1.4 }}>
          Tocá la campaña o el anuncio para abrirlo en tu Ads Manager.
        </p>
      )}
    </section>
  );
}
