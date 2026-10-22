'use client';

// =============================================================================
// El PDF de una versión de la oferta, adentro del mensaje de MaKo que la manda
// =============================================================================
// Como un documento de WhatsApp: el ícono, el nombre y, al tocarlo, baja ESA versión. Baja por `fetch` (offer-api →
// descargarPdf) para que un error del servidor se diga en el chat y no se descargue un JSON con nombre de PDF.
// Vive aparte de ChatOffer.tsx (22/10/2026, OF4): el chat monta la caja única, que trae su CSS, y tests/offer-pulir-pdf.test.ts
// dibuja esto en node.

import { useState } from 'react';
import { Spinner } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { nombrePdfVersion } from './ayudas';
import { descargarPdf, mensajeDeError } from './offer-api';

export function DocumentoPdf({ sesionId, version, onError, onVer }: { sesionId: number; version: number; onError: (m: string) => void; onVer?: (() => void) | null }) {
  const [bajando, setBajando] = useState(false);
  const bajar = async () => {
    if (bajando) return;
    setBajando(true);
    try { await descargarPdf(sesionId, version); } catch (e) { onError(mensajeDeError(e)); } finally { setBajando(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="of-doc" onClick={() => void bajar()} disabled={bajando} aria-busy={bajando || undefined}
        title="Descargar el PDF" aria-label={`Descargar el PDF de tu oferta, versión ${version}`}>
        <span className="of-doc__icono" aria-hidden>PDF</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="of-doc__nombre">{nombrePdfVersion(version)}</span>
          <span className="of-doc__meta">PDF</span>
        </span>
        <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}>
          {bajando ? <Spinner size={16} /> : <IconoMenu nombre="descargar" size={18} />}
        </span>
      </button>
      {/* «Ver» abre la oferta en una ventana ENCIMA del chat (16/10/2026, Martín en la llamada del 12/10:
          «que jamás se salga el recuadro del chat… de última que haya como una preview de un pop-up»). */}
      {onVer && (
        <button type="button" className="of-doc-ver" onClick={onVer}>
          <IconoMenu nombre="ver" size={15} /> Ver mi oferta
        </button>
      )}
    </div>
  );
}
