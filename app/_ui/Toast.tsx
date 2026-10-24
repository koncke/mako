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
import { ReportarASoporte } from './ReportarASoporte';
import { esperarPausa, useDeslizarParaCerrar } from './descartar';

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
    // revertir. Sin él, el cartel es solo un acuse y puede irse antes. Un error
    // se queda más: tiene que dar tiempo a leerlo y a tocar «Reportar a Soporte».
    // ⚠️ Y UN TEXTO LARGO TAMBIÉN (24/10/2026): el resumen de un lote («De 221, tu WhatsApp tiene el nombre de… · Faltan 160:
    // vuelve a tocar…») tiene 150 a 250 letras y lo importante va al final; a 3,2 s no se llega a leer. ~60 ms por letra, entre
    // 3,2 y 12 s; un aviso a medias (`warn`) se queda por lo menos 8 s.
    const largo = typeof toast.msg === 'string' ? Math.min(12_000, toast.msg.length * 60) : 0;
    const base = toast.tono === 'bad' ? Math.max(ms, 8000) : toast.tono === 'warn' ? Math.max(ms, 8000) : toast.onUndo ? ms : Math.min(ms, 3200);
    // Mientras se lo mira (el mouse encima o el dedo), no se va (24/10/2026, ./descartar.tsx).
    timer.current = setTimeout(esperarPausa(() => setToast(null)), Math.max(base, largo));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [toast, ms]);
  return { toast, show, clear };
}

export function Toast({ state, onClose }: { state: ToastState; onClose: () => void }) {
  // Se cierra con la ✕ o deslizándolo de costado, y no se va solo mientras se lo mira (24/10/2026, ./descartar.tsx).
  const desliza = useDeslizarParaCerrar(onClose);
  if (!state) return null;
  const t = state.tono ? TONO[state.tono] : null;
  // Con tono `bad` es un error: un aviso (role="alert") con «Reportar a Soporte» (23/10/2026, tests/reportar-a-soporte.test.ts).
  const error = state.tono === 'bad';
  // Centrado, más lo que el dedo lo corre (fuera del objeto de estilos: tests/recorrido.test.ts lee su z-index de ahí).
  const corrido = `translateX(calc(-50% + ${desliza.dx}px))`;
  return (
    <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} {...desliza.props} style={{
      ...desliza.estilo,
      position: 'fixed', left: '50%', bottom: 28, transform: corrido, zIndex: 600,
      // En una ventana angosta el texto va en su renglón y los botones abajo (24/10/2026: antes quedaba una palabra por renglón).
      // `max-content`: con `left: 50%` el ancho disponible es media pantalla, y al poder partirse se encogía a eso.
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', width: 'max-content', maxWidth: 'calc(100vw - 32px)',
      background: 'var(--sidebar)', color: 'var(--on-sidebar)',
      padding: '12px 16px', borderRadius: 'var(--r-md)',
      borderLeft: t ? `3px solid ${t.fill}` : undefined,
      boxShadow: '0 12px 32px rgba(18,21,27,.35)',
      fontFamily: "'Geist', system-ui, sans-serif", fontSize: 'var(--fs-sm)',
      animation: 'mkPop .16s ease',
    }}>
      <span style={{ flex: '1 1 260px', minWidth: 0 }}>{state.msg}</span>
      <ReportarASoporte />
      {state.onUndo && (
        <button type="button" onClick={() => { state.onUndo!(); onClose(); }}
          style={{ flex: 'none', background: 'transparent', border: '1px solid rgba(243,245,248,.35)', color: 'var(--primary-weak)', fontWeight: 600, fontSize: 'var(--fs-sm)', padding: '6px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          ↶ Deshacer
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Cerrar aviso"
        style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 32, height: 32, margin: '-6px -8px -6px 0', background: 'transparent', border: 'none', borderRadius: 'var(--r-sm)', color: 'rgba(243,245,248,.6)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
        ✕
      </button>
    </div>
  );
}
