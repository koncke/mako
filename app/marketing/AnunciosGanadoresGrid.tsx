'use client';

// =============================================================================
// AnunciosGanadoresGrid — las cards de "Anuncios ganadores" (tab Marketing),
// clickeables para abrir el detalle del anuncio (mismo modal que /anuncios).
// =============================================================================

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { SenalRecon } from '@/lib/queries';
import { AnuncioCard } from './AnuncioCard';

// El detalle (recharts + mapa) se baja al hacer clic, no en la carga de la tab.
const AdDetalle = dynamic(() => import('./ad-charts').then((m) => m.AdDetalle), { ssr: false });

export function AnunciosGanadoresGrid({ top, desde, hasta }: { top: SenalRecon[]; desde: string; hasta: string }) {
  const [sel, setSel] = useState<SenalRecon | null>(null);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {top.map((s, i) => (
          <div key={s.ad_id} onClick={() => setSel(s)} style={{ cursor: 'pointer' }}>
            <AnuncioCard s={s} rank={i + 1} disableLink />
          </div>
        ))}
      </div>
      {sel && <AdDetalle s={sel} desde={desde} hasta={hasta} onClose={() => setSel(null)} />}
    </>
  );
}
