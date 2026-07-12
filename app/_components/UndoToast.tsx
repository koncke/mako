'use client';

// =============================================================================
// UndoToast — cartel efímero de "hecho X" con botón Deshacer (ventana 5s)
// =============================================================================
// Extrae el patrón repetido en CrmBoard/CobrarTable/DealDetailsCard: toast fijo
// abajo-centro, oscuro, con "↶ Deshacer" + ✕, que se auto-descarta a los 5s.
// useUndoToast() maneja el estado + el timeout; <UndoToast/> lo pinta.

import { useCallback, useEffect, useRef, useState } from 'react';

const SANS = "'Geist', sans-serif";

export type UndoState = { msg: string; onUndo: () => void } | null;

export function useUndoToast(ms = 5000) {
  const [undo, setUndo] = useState<UndoState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, onUndo: () => void) => setUndo({ msg, onUndo }), []);
  const clear = useCallback(() => setUndo(null), []);
  useEffect(() => {
    if (!undo) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), ms);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [undo, ms]);
  return { undo, show, clear };
}

export function UndoToast({ state, onClose }: { state: UndoState; onClose: () => void }) {
  if (!state) return null;
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 14, background: '#14161B', color: '#F3F5F8', padding: '12px 16px', borderRadius: 12, boxShadow: '0 12px 32px rgba(18,21,27,.35)', fontFamily: SANS, fontSize: 14 }}>
      <span>{state.msg}</span>
      <button type="button" onClick={() => { state.onUndo(); onClose(); }} style={{ background: 'transparent', border: '1px solid rgba(243,245,248,.35)', color: 'var(--primary-weak)', fontWeight: 600, fontSize: 13.5, padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontFamily: SANS }}>↶ Deshacer</button>
      <button type="button" onClick={onClose} aria-label="cerrar" style={{ background: 'transparent', border: 'none', color: 'rgba(243,245,248,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
    </div>
  );
}
