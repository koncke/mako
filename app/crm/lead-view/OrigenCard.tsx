// =============================================================================
// OrigenCard — de dónde vino el lead (presentacional, compartido)
// =============================================================================
// Dos bloques, no una grilla suelta de tarjetas iguales:
//   1. CÓMO ENTRÓ — canal + fuente, dos columnas parejas.
//   2. DE QUÉ ANUNCIO — la jerarquía real de Meta (Campaña › Conjunto › Anuncio)
//      en UNA sola tarjeta, con un único "Abrir en Ads Manager →".
// Antes eran 4-5 minicards en un auto-fit: con 4 quedaba una huérfana sola en la
// segunda fila, y la jerarquía (que campaña, conjunto y anuncio son el MISMO
// camino, no tres datos independientes) no se leía por ningún lado.
//
// El link va al Ads Manager de MaKo (/ads-manager/<ad_id>), no a Meta. El ad_id lo
// resuelve el server (adIdDeLead en lib/queries): puede venir en meta_ad_id, en un
// utm_content numérico, o por el NOMBRE del anuncio en utm_content — el caso de la
// mayoría de los leads de Calendly.

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

function Item({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <div style={miniCard}>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{label}</div>
      <div style={{ fontSize: 14.5, color: value ? (color ?? 'var(--ink)') : 'var(--faint)', fontWeight: value ? 600 : 400, marginTop: 3, wordBreak: 'break-word' }}>{value ?? '—'}</div>
    </div>
  );
}

/** Un escalón de la jerarquía de Meta. El último (el anuncio) va destacado. */
function Nivel({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0' }}>
      <span style={{ ...sectLabel, flex: 'none', width: 78, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: fuerte ? 15 : 13.5, fontWeight: fuerte ? 650 : 500, color: fuerte ? 'var(--ink)' : 'var(--dim)', lineHeight: 1.4, wordBreak: 'break-word' }}>{valor}</span>
    </div>
  );
}

export function OrigenCard({ lead, vslEng, campana, adNombre, adId }: {
  lead: Lead; vslEng: VslEngagement;
  campana: { texto: string | null; tooltip: string | null };
  adNombre?: string | null;
  /** ad_id ya resuelto por el server; habilita el deep-link al Ads Manager. */
  adId?: string | null;
}) {
  void vslEng;
  const utmContent = lead.utm_content?.trim() || null;
  const utmEsId = !!utmContent && /^\d{6,}$/.test(utmContent);
  const campanaTexto = lead.meta_campaign_name ?? campana.texto;
  const conjunto = lead.meta_adset_name ?? null;
  const anuncio = adNombre ?? lead.meta_ad_name ?? (utmContent && !utmEsId ? utmContent : null) ?? (adId ? `Anuncio ${adId}` : null);
  const hayRuta = !!(campanaTexto || conjunto || anuncio);
  const tieneAtribucion = lead.origen_lead || hayRuta || lead.utm_campaign || lead.utm_source || lead.utm_content;

  if (!tieneAtribucion) {
    return (
      <section style={card}>
        <div style={{ ...sectLabel, marginBottom: 10 }}>Origen del lead</div>
        <p style={{ fontSize: 14, color: 'var(--faint)' }}>Sin datos de origen: este lead entró a mano, o antes de que existiera el tracking de campañas. No hay forma de reconstruirlo.</p>
      </section>
    );
  }

  const origen = labelOrigen(lead.origen_lead);
  const fuente = lead.utm_source ? (lead.utm_source === 'fb' ? 'Facebook' : lead.utm_source === 'ig' ? 'Instagram' : lead.utm_source) : null;
  const href = adId ? `/ads-manager/${adId}` : null;

  return (
    <section style={card}>
      <div style={{ ...sectLabel, marginBottom: 14 }}>Origen del lead</div>

      {/* Cómo entró: dos columnas parejas, nunca una huérfana. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <Item label="Canal de entrada" value={origen.texto} color={origen.color} />
        <Item label="Fuente" value={fuente} />
      </div>

      {/* De qué anuncio: la jerarquía completa en UNA tarjeta. */}
      {hayRuta && (
        <div style={{ ...miniCard, marginTop: 12, padding: '15px 17px', borderColor: href ? 'var(--primary)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 600 }}>De qué anuncio vino</span>
            {href && (
              <Link href={href} title="Abrir este anuncio en tu Ads Manager"
                style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Abrir en Ads Manager →
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {campanaTexto && <Nivel label="Campaña" valor={campanaTexto} />}
            {conjunto && <Nivel label="Conjunto" valor={conjunto} />}
            {anuncio && <Nivel label="Anuncio" valor={anuncio} fuerte />}
          </div>
          {!href && anuncio && (
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.45 }}>
              No pude identificar el anuncio exacto en tu cuenta (el nombre no es único o todavía no sincronizó), así que no puedo abrirlo directo.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
