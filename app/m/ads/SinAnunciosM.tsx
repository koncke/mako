'use client';

// =============================================================================
// Un funnel sin anuncios EN EL TELÉFONO: la pantalla de siempre con la hoja de MaKo del teléfono (10/11/2026)
// =============================================================================
// Medido en producción (ws 3, 375 px): `SinAnuncios` montaba la estrella de la computadora (MakoEnLaTab), que flotaba encima del
// «CRM» de la barra de abajo y abría el panel de escritorio. En el teléfono, lo que se pide va a la hoja del CoPilot, como en
// MediaBuyerM («Pídele algo a MaKo» → HojaDelCopiloto). Vive acá y no en PlanDelCopiloto.tsx para no cargar el CSS del teléfono en la
// pantalla de la computadora.
// =============================================================================

import { useState } from 'react';
import { SinAnuncios } from '@/app/ads-manager/PlanDelCopiloto';
import type { PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import { HojaDelCopiloto } from './HojaDelCopiloto';

export function SinAnunciosM({ perfil }: { perfil: PerfilCopiloto }) {
  const [hoja, setHoja] = useState<{ pedido: { texto: string; vez: number } } | null>(null);
  return (
    <>
      <SinAnuncios perfil={perfil} onPedir={(texto) => setHoja({ pedido: { texto, vez: Date.now() } })} />
      {hoja && <HojaDelCopiloto pedido={hoja.pedido} pantalla="Marketing CoPilot · teléfono · funnel sin anuncios" onCerrar={() => setHoja(null)} />}
    </>
  );
}
