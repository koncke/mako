// =============================================================================
// AnuncioCard — tarjeta de anuncio ganador (compartida)
// =============================================================================
// La usan el panel "Anuncios ganadores" (top en /marketing) y la vista completa
// (/marketing/anuncios). Aquí también vivirá la miniatura/preview del creativo.

import type { CSSProperties } from 'react';
import type { SenalRecon, ReconVeredicto } from '@/lib/queries';

const MONO = "'Geist Mono', monospace";

function fmtUSD(n: number | null | undefined, decimals?: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const dec = decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);
}

export const VEREDICTO_BADGE: Record<ReconVeredicto, { label: string; bg: string; color: string }> = {
  validada: { label: 'Validada — escalar', bg: 'var(--good)', color: '#fff' },
  falso_positivo: { label: 'Falso positivo', bg: 'var(--warn-bg)', color: 'var(--warn)' },
  apagar: { label: 'Apagar', bg: 'var(--bad-bg)', color: 'var(--bad)' },
  explorando: { label: 'Explorando', bg: 'var(--surface-2)', color: 'var(--dim)' },
  pausada: { label: 'Pausada', bg: 'var(--surface-2)', color: 'var(--faint)' },
};

export function tieneSenal(s: SenalRecon): boolean {
  return s.leads > 0 || s.agendas > 0 || s.spend_usd > 0;
}

export function compararCombo(a: SenalRecon, b: SenalRecon): number {
  if (b.agendas !== a.agendas) return b.agendas - a.agendas;
  if (b.cierres !== a.cierres) return b.cierres - a.cierres;
  return b.leads - a.leads;
}

export function AnuncioCard({ s, rank, disableLink = false }: { s: SenalRecon; rank: number; disableLink?: boolean }) {
  const v = VEREDICTO_BADGE[s.veredicto];
  const validada = s.veredicto === 'validada';
  const pct = Math.min((s.leads / Math.max(s.meta_leads, 1)) * 100, 100);
  const metaOk = s.leads >= s.meta_leads;
  const barColor = metaOk ? 'var(--good)' : 'var(--warn-fill)';
  const ritmoTexto = s.ritmo === 'verde' ? '✓ ritmo' : s.ritmo === 'cruz' ? '✗ ritmo' : '· ritmo';
  const ritmoColor = s.ritmo === 'verde' ? 'var(--good)' : 'var(--dim)';
  const agendaColor = s.agendas > 0 ? 'var(--good)' : 'var(--faint)';

  const cardStyle: CSSProperties = {
    display: 'flex',
    border: `1px solid ${validada ? 'var(--good)' : 'var(--border)'}`,
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--surface)',
    ...(validada ? { boxShadow: '0 0 0 1px var(--good)' } : {}),
  };

  const hasThumb = !!s.ad_thumbnail_url;
  // disableLink: la card se usa dentro de un contenedor clickeable (abre modal);
  // el enlace a Meta vive en el modal para no competir con el clic.
  const hasLink = !disableLink && !!s.ad_permalink && !s.ad_creative_sin_enlace;
  const boxStyle: CSSProperties = { width: 96, flex: 'none', aspectRatio: '9 / 16', position: 'relative', overflow: 'hidden', background: 'var(--surface-2)', display: 'block' };
  const rankBadge = (
    <span style={{ position: 'absolute', top: 10, left: 10, zIndex: 2, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#F3F0E7', background: 'rgba(23,21,17,.78)', padding: '2px 7px', borderRadius: 6 }}>#{String(rank).padStart(2, '0')}</span>
  );
  const thumbInner = (
    <>
      {rankBadge}
      {hasThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.ad_thumbnail_url!} alt={s.ad_name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,var(--surface-2) 0 11px,var(--border) 11px 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(26,24,19,.4)" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="M21 15l-5-5L5 21" /></svg>
        </div>
      )}
      {hasLink && (
        <span style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2, width: 20, height: 20, borderRadius: 6, background: 'rgba(23,21,17,.72)', color: '#F3F0E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>↗</span>
      )}
    </>
  );

  return (
    <div style={cardStyle}>
      {hasLink ? (
        <a href={s.ad_permalink!} target="_blank" rel="noopener noreferrer" title="Abrir anuncio en Facebook/Instagram" style={{ ...boxStyle, cursor: 'pointer', textDecoration: 'none' }}>{thumbInner}</a>
      ) : (
        <div title={hasThumb ? 'Sin enlace disponible (anuncio de stories o dinámico)' : undefined} style={boxStyle}>{thumbInner}</div>
      )}
      <div style={{ flex: 1, minWidth: 0, padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.ad_name}</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: validada ? 'var(--good)' : 'var(--dim)', marginTop: 4 }}>
            {fmtUSD(s.spend_usd, 0)} · {s.dias_corriendo}d · <span style={{ color: ritmoColor }}>{ritmoTexto}</span>
          </div>
        </div>
        <span style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: v.bg, color: v.color }}>{v.label}</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 'auto' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>
              <span>Intención</span>
              <span style={{ fontFamily: MONO, color: 'var(--ink)' }}>{s.leads} / {s.meta_leads}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: 26, lineHeight: 0.9, color: agendaColor, fontVariantNumeric: 'tabular-nums' }}>{s.agendas}</div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{s.agendas === 1 ? 'agenda' : 'agendas'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
