'use client';

// Solo abre el modal. Vive aparte porque la página es un server component y el
// modal necesita estado; meter 'use client' en la página entera la obligaría a
// mandar el cerebro al browser dos veces.

import { useState } from 'react';
import { ExportarCerebro } from './ExportarCerebro';
import type { Cerebro } from '@/lib/cerebro-modelo';
import { MONO } from '@/app/_ui/tokens';

export function BotonExportar({ cerebro, conteo }: { cerebro: Cerebro; conteo: Record<string, number> }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
          borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
          color: 'var(--ink)', cursor: 'pointer', fontFamily: MONO, fontSize: 11,
          letterSpacing: '.06em', textTransform: 'uppercase',
        }}
      >
        Bajar ↓
      </button>
      {abierto && <ExportarCerebro cerebro={cerebro} conteo={conteo} onClose={() => setAbierto(false)} />}
    </>
  );
}
