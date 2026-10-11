// La lista de lo que el código de Offer todavía no aplica del marco (pendientes.ts).
// Sin 'use client': se dibuja en el servidor.

import { Tag, MONO } from '@/app/_ui';
import { PENDIENTES_OFFER, QUIEN_DECIDE, type QuienDecide } from './pendientes';

const COLOR: Record<QuienDecide, string> = { codigo: 'var(--primary)', marco: 'var(--dim)', martin: 'var(--warn)' };

export function ListaPendientes() {
  if (!PENDIENTES_OFFER.length) return null;
  return (
    <section style={{ marginBottom: 'var(--sect-gap)' }}>
      <h2 style={{ fontSize: 'var(--fs-sect)', fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
        Lo que el código todavía no aplica <span style={{ fontFamily: MONO, fontSize: 'var(--fs-sm)', color: 'var(--faint)', fontWeight: 500 }}>{PENDIENTES_OFFER.length}</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {PENDIENTES_OFFER.map((p) => (
          <div key={p.tema} style={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 14px', alignItems: 'baseline',
            padding: '11px 0', borderTop: '1px solid var(--border)',
          }}>
            <strong style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.tema}</strong>
            <span><Tag color={COLOR[p.decide]}>{QUIEN_DECIDE[p.decide]}</Tag></span>
            <span style={{ gridColumn: '1 / -1', color: 'var(--dim)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--ink)' }}>Marco:</span> {p.marco}
            </span>
            <span style={{ gridColumn: '1 / -1', color: 'var(--dim)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--ink)' }}>Hoy:</span> {p.hoy}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
