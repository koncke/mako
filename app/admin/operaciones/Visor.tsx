'use client';

// =============================================================================
// El visor de una foto o un PDF del Ops Center, a pantalla completa (17/10/2026)
// =============================================================================
// Lo usan la caja (lo adjuntado antes de mandar, AdjuntosCaja.tsx) y la burbuja ya enviada (FotosEnviadas.tsx).
// ⚠️ SIN IMPORTAR CSS: lo dibuja el hilo, que se dibuja en los tests (en node un `.css` no carga). Sus clases (`co-ver`)
//    están en centro.css, que importa quien monta la pantalla.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';
import { useAtrasCierra } from './atras';

/** El visor de una foto o un PDF, a pantalla completa (antes de mandar y en la burbuja ya enviada). Escape, tocar afuera,
 *  la ✕ o el «atrás» lo cierran; el «atrás» cierra SÓLO el visor, no la conversación (atras.ts). */
export function Visor({ url, nombre, tipo, onCerrar }: { url: string; nombre: string; tipo: 'image' | 'document'; onCerrar: () => void }) {
  useAtrasCierra(true, onCerrar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [onCerrar]);
  // En un portal: adentro de la hoja del teléfono (que se mueve con `transform`) un `position: fixed` queda encerrado en ella.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="co-ver" role="dialog" aria-modal="true" aria-label={nombre} onClick={onCerrar}>
      <div className="co-ver__marco" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="co-ver__cerrar" onClick={onCerrar} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        {tipo === 'image'
          // eslint-disable-next-line @next/next/no-img-element -- la vista previa local (blob:)
          ? <img className="co-ver__img" src={url} alt={nombre} />
          : <iframe className="co-ver__pdf" src={url} title={nombre} />}
      </div>
    </div>,
    document.body,
  );
}
