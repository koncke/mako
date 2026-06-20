'use client';

// =============================================================================
// CobrarTable — "A quién cobrarle" (Comercial)
// =============================================================================
// Columna "Vence" separada de "Próxima cuota", marcar la cuota como cobrada
// desde la tabla, y toast "Deshacer" (5s) en cada acción. Ordena por vencimiento
// más cercano arriba; resalta vencidas (rojo · URGENTE) y próximas (ámbar).

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import type { OutstandingLead } from '@/lib/pagos';
import { marcarPagoAction } from '../leads/actions';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const fmtUSD = (n: number | null) => (n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));
const fmtDMY = (iso: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.split('-').map(Number); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };
const diasHasta = (iso: string | null, hoyISO: string): number | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const [hy, hm, hd] = hoyISO.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
};

const th: CSSProperties = { padding: '13px 16px', fontFamily: MONO, fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)', fontWeight: 600 };
const thR: CSSProperties = { ...th, textAlign: 'right' };
const td: CSSProperties = { padding: '13px 14px', fontVariantNumeric: 'tabular-nums' };

export function CobrarTable({ items, total, hoyISO }: { items: OutstandingLead[]; total: number; hoyISO: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [undo, setUndo] = useState<{ pagoId: number; leadId: number; name: string } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  const ordenados = [...items].sort((a, b) => {
    const fa = a.proxima_cuota?.fecha_esperada, fb = b.proxima_cuota?.fecha_esperada;
    if (!fa && !fb) return 0; if (!fa) return 1; if (!fb) return -1;
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });

  const marcar = (it: OutstandingLead) => {
    if (!it.proxima_cuota) return;
    const pagoId = it.proxima_cuota.pago_id;
    // Fecha de pago = vencimiento de la cuota (proxy del ingreso real por período).
    const fecha = it.proxima_cuota.fecha_esperada || hoyISO;
    start(async () => { await marcarPagoAction(pagoId, it.lead_id, true, fecha); router.refresh(); });
    setUndo({ pagoId, leadId: it.lead_id, name: it.lead_nombre });
  };
  const deshacer = () => {
    if (!undo) return;
    const { pagoId, leadId } = undo;
    setUndo(null);
    start(async () => { await marcarPagoAction(pagoId, leadId, false, null); router.refresh(); });
  };

  return (
    <details style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', border: '1px solid var(--bad)', borderRadius: 12, color: 'var(--bad)', fontSize: 14.5, fontWeight: 500 }}>
        <span>Ver a quién cobrarle — {items.length} lead{items.length === 1 ? '' : 's'} · {fmtUSD(total)} pendiente</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)' }}>desplegar ▾</span>
      </summary>
      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              <th style={th}>Lead</th>
              <th style={thR}>Sold Revenue</th>
              <th style={thR}>Cash Collected</th>
              <th style={thR}>Outstanding</th>
              <th style={th}>Próxima cuota</th>
              <th style={th}>Vence</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {ordenados.map((it) => {
              const f = it.proxima_cuota?.fecha_esperada ?? null;
              const dd = diasHasta(f, hoyISO);
              const vencida = dd != null && dd < 0;
              const pronto = dd != null && dd >= 0 && dd <= 5;
              return (
                <tr key={it.lead_id} style={{ borderTop: '1px solid var(--border)', background: vencida ? 'var(--bad-bg)' : 'transparent' }}>
                  <td style={{ padding: '13px 16px' }}><span style={{ color: 'var(--accent)', fontWeight: 500 }}>{it.lead_nombre}</span></td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--ink)' }}>{fmtUSD(it.vendido_usd)}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--good)' }}>{fmtUSD(it.cobrado_usd)}</td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--bad)' }}>{fmtUSD(it.pendiente_usd)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--dim)' }}>{it.proxima_cuota ? `cuota ${it.proxima_cuota.numero} · ${fmtUSD(it.proxima_cuota.monto_usd)}` : '—'}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: vencida ? 'var(--bad)' : 'var(--dim)', fontWeight: vencida ? 700 : 400 }}>
                    {f ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        {(vencida || pronto) && <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: vencida ? 'var(--bad)' : '#E8B007', animation: `${vencida ? 'blinkRed' : 'blinkAmber'} 1.1s infinite` }} />}
                        {vencida ? 'URGENTE · ' : ''}{fmtDMY(f)}{!vencida && pronto ? ` (${dd === 0 ? 'hoy' : `en ${dd}d`})` : ''}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '13px 14px', textAlign: 'right' }}>
                    {it.proxima_cuota && (
                      <button type="button" disabled={pending} onClick={() => marcar(it)} style={{ cursor: pending ? 'wait' : 'pointer', borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--good)', background: 'var(--good-bg)', color: 'var(--good)', fontFamily: SANS, whiteSpace: 'nowrap' }}>Marcar cobrado</button>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
              <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--ink)' }} colSpan={3}>Total pendiente</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: 'var(--bad)' }}>{fmtUSD(total)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>

      {undo && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 14, background: '#171511', color: '#F3F0E7', padding: '12px 16px', borderRadius: 12, boxShadow: '0 12px 32px rgba(23,21,17,.35)', fontFamily: SANS, fontSize: 14 }}>
          <span><strong>{undo.name}</strong> · cuota cobrada</span>
          <button type="button" onClick={deshacer} style={{ background: 'transparent', border: '1px solid rgba(243,240,231,.35)', color: 'var(--accent-soft)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>
          <button type="button" onClick={() => setUndo(null)} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,240,231,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </details>
  );
}
