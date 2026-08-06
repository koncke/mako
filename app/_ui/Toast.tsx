'use client';

// =============================================================================
// Toast · Undo — el aviso breve, y el que se puede deshacer
// =============================================================================
// La advertencia del documento, textual: el toast «no sustituye un registro de
// actividad cuando la acción es importante». O sea: un toast es para confirmar
// algo chico y efímero. Si lo que pasó tiene que poder consultarse mañana, va
// al historial (regla de la casa: todo lo que toca MaKo deja rastro), no acá.
//
// Y si la acción se puede revertir, el toast lleva DESHACER. Es más barato y
// más honesto que preguntar «¿estás seguro?» antes de cada cosa: dejás que la
// persona actúe rápido y le dejás la salida puesta cinco segundos.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { TONO, type Tono } from './tokens';

export type ToastState = { msg: ReactNode; tono?: Tono; onUndo?: () => void } | null;

/**
 * Estado + auto-descarte. `show(msg)` para un aviso simple, `show(msg, deshacer)`
 * para uno reversible.
 *
 * `onUndo` es OPCIONAL a propósito: hay avisos que no se pueden deshacer, y
 * ofrecer un «Deshacer» que no deshace nada es peor que no ofrecerlo.
 */
export function useToast(ms = 5000) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: ReactNode, onUndo?: () => void, tono?: Tono) => setToast({ msg, onUndo, tono }), []);
  const clear = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    // Con Deshacer la ventana es la que manda: mientras el cartel está, se puede
    // revertir. Sin él, el cartel es solo un acuse y puede irse antes.
    timer.current = setTimeout(() => setToast(null), toast.onUndo ? ms : Math.min(ms, 3200));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [toast, ms]);
  return { toast, show, clear };
}

export function Toast({ state, onClose }: { state: ToastState; onClose: () => void }) {
  if (!state) return null;
  const t = state.tono ? TONO[state.tono] : null;
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 600,
      display: 'flex', alignItems: 'center', gap: 14, maxWidth: 'calc(100vw - 32px)',
      background: 'var(--sidebar)', color: 'var(--on-sidebar)',
      padding: '12px 16px', borderRadius: 'var(--r-md)',
      borderLeft: t ? `3px solid ${t.fill}` : undefined,
      boxShadow: '0 12px 32px rgba(18,21,27,.35)',
      fontFamily: "'Geist', system-ui, sans-serif", fontSize: 'var(--fs-sm)',
      animation: 'mkPop .16s ease',
    }}>
      <span style={{ minWidth: 0 }}>{state.msg}</span>
      {state.onUndo && (
        <button type="button" onClick={() => { state.onUndo!(); onClose(); }}
          style={{ flex: 'none', background: 'transparent', border: '1px solid rgba(243,245,248,.35)', color: 'var(--primary-weak)', fontWeight: 600, fontSize: 'var(--fs-sm)', padding: '6px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          ↶ Deshacer
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Cerrar aviso"
        style={{ flex: 'none', background: 'transparent', border: 'none', color: 'rgba(243,245,248,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
        ✕
      </button>
    </div>
  );
}
