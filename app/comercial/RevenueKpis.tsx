'use client';

// =============================================================================
// RevenueKpis — 3 cards de Revenue clickeables con pop-up de desglose por lead
// =============================================================================

import { useState, type CSSProperties } from 'react';
import type { RevItem } from '@/lib/pagos';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtDMY = (iso: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };

export type RevCard = { key: string; label: string; value: string; color: string; sub: string; fechaLabel: string; items: RevItem[] };

export function RevenueKpis({ cards }: { cards: RevCard[] }) {
  const [open, setOpen] = useState<RevCard | null>(null);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOpen(c)}
            style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', cursor: 'pointer', fontFamily: SANS, transition: 'border-color .15s, box-shadow .15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.boxShadow = '0 4px 16px rgba(23,21,17,.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{c.label}</span>
              <span style={{ fontSize: 11.5, color: c.color, fontWeight: 600 }}>ver detalle →</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '22px 26px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>{open.label}</div>
                <div style={{ fontWeight: 600, fontSize: 28, color: open.color, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{open.value}</div>
                <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{open.items.length} {open.items.length === 1 ? 'registro' : 'registros'}</div>
              </div>
              <button onClick={() => setOpen(null)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {open.items.length === 0 ? (
                <div style={{ padding: '20px 26px', fontSize: 13.5, color: 'var(--faint)' }}>Sin registros en el período.</div>
              ) : (
                open.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 26px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>{it.detalle ? `${it.detalle} · ` : ''}{open.fechaLabel} {fmtDMY(it.fecha)}</div>
                    </div>
                    <div style={{ flex: 'none', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: open.color }}>{fmtUSD(it.monto)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
