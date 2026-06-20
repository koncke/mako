'use client';

// =============================================================================
// RevenueKpis — 3 cards de Revenue clickeables con pop-up de desglose por lead
// =============================================================================
// Hoy es una capa fina sobre el primitivo compartido DesgloseCard
// (app/_components/Desglose.tsx): sólo formatea los RevItem a filas listas.

import type { RevItem } from '@/lib/pagos';
import { DesgloseCard, type DesgloseItem } from '../_components/Desglose';

const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDMY = (iso: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };

export type RevCard = { key: string; label: string; value: string; color: string; sub: string; fechaLabel: string; items: RevItem[] };

export function RevenueKpis({ cards }: { cards: RevCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
      {cards.map((c) => {
        const items: DesgloseItem[] = c.items.map((it) => ({
          nombre: it.nombre,
          valor: fmtUSD(it.monto),
          detalle: `${it.detalle ? `${it.detalle} · ` : ''}${c.fechaLabel} ${fmtDMY(it.fecha)}`,
          leadId: it.leadId,
          focus: 'plan-pagos',
        }));
        return (
          <DesgloseCard
            key={c.key}
            data={{ label: c.label, value: c.value, color: c.color, items }}
            sub={c.sub}
          />
        );
      })}
    </div>
  );
}
