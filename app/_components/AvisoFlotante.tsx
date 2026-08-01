'use client';

// =============================================================================
// AvisoFlotante — el resultado de una acción, abajo a la izquierda
// =============================================================================
// Un aviso que se pinta EN LÍNEA empuja los botones de al lado y descoloca toda
// la barra justo cuando el usuario está mirando el resultado. Va en un portal,
// fijo abajo a la izquierda, sin ocupar espacio en el layout.
//
// Se cierra solo, salvo que el mensaje sea largo (un error con detalle): ahí
// espera a que lo cierren, porque se escribió para ser leído.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const MONO = "'Geist Mono', monospace";

export function AvisoFlotante({ mensaje, tono = 'info', onCerrar }: {
  mensaje: string;
  tono?: 'info' | 'error';
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    // Los mensajes cortos son un acuse de recibo y se van solos. Los largos
    // traen detalle: se quedan hasta que alguien los cierre.
    if (mensaje.length > 90 || tono === 'error') return;
    const t = setTimeout(onCerrar, 5000);
    return () => clearTimeout(t);
  }, [mensaje, tono, onCerrar]);

  if (!montado) return null;

  return createPortal(
    <div
      role="status"
      style={{
        position: 'fixed', left: 18, bottom: 18, zIndex: 4000, maxWidth: 460,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: '#14161B', color: '#F3F0E7',
        border: `1px solid ${tono === 'error' ? 'rgba(229,72,77,.55)' : 'rgba(243,240,231,.18)'}`,
        boxShadow: '0 18px 44px rgba(18,21,27,.4)',
        fontFamily: "'Geist', sans-serif", fontSize: 13, lineHeight: 1.55,
      }}
    >
      <span aria-hidden style={{ flex: 'none', marginTop: 1, color: tono === 'error' ? '#FF9A9D' : 'var(--accent-soft)' }}>
        {tono === 'error' ? '!' : '✦'}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{mensaje}</span>
      <button
        type="button" onClick={onCerrar} aria-label="Cerrar aviso"
        style={{ flex: 'none', border: 0, background: 'transparent', color: 'rgba(243,240,231,.6)', cursor: 'pointer', fontFamily: MONO, fontSize: 13, lineHeight: 1, padding: 2 }}
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
