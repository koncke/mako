'use client';

// =============================================================================
// ModalShell — el molde de modal de /integraciones
// =============================================================================
// Vivía adentro de app/integraciones/IntegracionesBoard.tsx y salió acá porque el botón
// «Conectar a Claude» de /second-brain tiene que abrir EXACTAMENTE el mismo modal: la
// barra negra al costado con el carrusel, el header fijo y el medio que scrollea.
//
// Se extrajo, no se copió. Dos modales que se ven igual y se mantienen por separado
// dejan de verse igual en el primer cambio, y este molde ya tiene decisiones adentro que
// no se ven a simple vista: el alto FIJO para que no salte entre servicios con distinta
// cantidad de campos, el header pinado para que el ✕ no se vaya con el scroll, y el
// bloqueo del scroll del fondo.
//
// Las clases `.mk-svc-modal` y `.mk-svc-aside` viven en app/globals.css.
// =============================================================================

import { useEffect, type ReactNode, type CSSProperties } from 'react';

export function ModalShell({ w, h, label, onClose, children }: { w: number; h?: number | string; label: string; onClose: () => void; children: ReactNode }) {
  // Bloquea el scroll del fondo mientras el modal está abierto (como el diseño).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,22,27,.5)', display: 'flex', alignItems: h ? 'center' : 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto', animation: 'mkFade .16s ease' }}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} style={{ width: w, maxWidth: '100%', height: h, overflow: h ? 'hidden' : undefined, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 24px 60px rgba(20,22,27,.24)', animation: 'mkPop .2s cubic-bezier(.2,.7,.3,1)' }}>
        {children}
      </div>
    </div>
  );
}

export const closeBtn: CSSProperties = { flex: 'none', width: 30, height: 30, border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--dim)', fontSize: 15, cursor: 'pointer', lineHeight: 1 };
