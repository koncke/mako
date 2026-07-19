'use client';

// =============================================================================
// Pop-up de detalle de una funcionalidad de /vsl.
// =============================================================================
// Reemplaza a las secciones `.mk-deep` que vivían DEBAJO de la grilla (había que
// hacer scroll). Ahora la card de la grilla abre este modal. El estado (qué slug
// está abierto) lo maneja Landing.tsx; acá solo se renderiza y se cablea el
// cierre (backdrop, ✕, Escape) + accesibilidad. Los estilos viven en el CSS
// scopeado de Landing.tsx (clases .mk-modal*).

import { useEffect, useRef } from 'react';
import type { ShowcaseFeature } from './showcase';

function Icon({ f }: { f: ShowcaseFeature }) {
  if (f.star) {
    return (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true">
        <path d={f.icon[0]} fill="#F2B01E" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {f.icon.map((d, i) => (<path key={i} d={d} />))}
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="mk-modal-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
  );
}

export default function FeatureModal({ feature, onClose }: { feature: ShowcaseFeature; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="mk-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mk-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mk-modal-panel">
        <button ref={closeRef} type="button" className="mk-modal-x" onClick={onClose} aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
        </button>

        <div className="mk-modal-scroll">
          <div className="mk-modal-eyebrow">
            <span className="mk-modal-tile"><Icon f={feature} /></span>
            <span className="mk-modal-name">{feature.name}</span>
          </div>

          <h3 id="mk-modal-title" className="mk-modal-hook">{feature.hook}</h3>
          <p className="mk-modal-intro" dangerouslySetInnerHTML={{ __html: feature.intro }} />

          <ul className="mk-modal-points">
            {feature.points.map((p, i) => (
              <li key={i}><Chevron /><span dangerouslySetInnerHTML={{ __html: p }} /></li>
            ))}
          </ul>

          {feature.nota && (
            <div className="mk-modal-nota">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16v.01" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18z" /></svg>
              <span>{feature.nota}</span>
            </div>
          )}
        </div>

        <div className="mk-modal-foot">
          <a href="#beta" className="mk-modal-cta" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
            Agenda tu llamada
          </a>
          <a href={`/vsl/${feature.slug}`} className="mk-modal-more">Ver todo el detalle →</a>
        </div>
      </div>
    </div>
  );
}
