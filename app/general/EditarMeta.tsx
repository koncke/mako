'use client';

// =============================================================================
// EditarMeta — edición inline de la meta del negocio (rediseño Vista General)
// =============================================================================
// Botón "✎ editar meta" dentro del hero oscuro; abre un popover claro y guarda
// vía la server action existente (setObjetivoAction).

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { setObjetivoAction } from './actions';

const SANS = "'Geist', sans-serif";

export function EditarMeta({
  cierresMeta,
  cashMeta,
  desde,
}: {
  cierresMeta: number | null;
  cashMeta: number | null;
  desde: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cierres, setCierres] = useState(cierresMeta?.toString() ?? '');
  const [cash, setCash] = useState(cashMeta?.toString() ?? '');
  const [d, setD] = useState(desde);

  const guardar = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setObjetivoAction('objetivo_cierres', cierres);
        await setObjetivoAction('objetivo_cash_usd', cash);
        await setObjetivoAction('objetivo_desde', d);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const inputStyle: CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' };
  const label: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--dim)', marginBottom: 5 };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'rgba(243,240,231,.06)', border: '1px solid rgba(243,240,231,.12)', color: 'var(--sidebar-text)', fontSize: 13, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: SANS }}
      >
        ✎ editar meta
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} aria-hidden />
          <div style={{ position: 'absolute', right: 0, marginTop: 8, zIndex: 50, width: 280, maxWidth: '88vw', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', padding: 16, boxShadow: '0 20px 50px rgba(23,21,17,.25)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={label}>Meta de cierres</span>
              <input type="number" min="1" value={cierres} onChange={(e) => setCierres(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <span style={label}>Meta de cash (USD)</span>
              <input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <span style={label}>Acumular desde</span>
              <input type="date" value={d} onChange={(e) => setD(e.target.value)} style={inputStyle} />
            </div>
            {error && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>}
            <button type="button" onClick={guardar} disabled={pending} style={{ padding: '9px', borderRadius: 9, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: pending ? 0.6 : 1 }}>
              {pending ? 'Guardando…' : 'Guardar objetivo'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
