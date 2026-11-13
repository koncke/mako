'use client';

// =============================================================================
// «Nuevo chat», el «+» flotante de la lista de chats, como el de WhatsApp (13/11/2026, el prototipo aprobado)
// =============================================================================
// Las medidas y el lugar de BotonFlotanteM (app/m/_ui, abajo a la derecha, en `#m-pie`), en verde y sin .module.css: los tests dibujan
// ChatClienteM con esbuild, que no arma un CSS de módulo (tests/grupos-ops-pantalla.test.ts). El estilo vive en ./chat-wa.css.

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/app/_components/icons';

export function NuevoChatFlotante({ onClick }: { onClick: () => void }) {
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setCapa(document.getElementById('m-pie')); }, []);
  return (
    <>
      {/* Su lugar al final de la lista: el último chat no queda debajo del «+». */}
      <div className="m-ops-hueco" aria-hidden />
      {capa && createPortal(
        <button type="button" className="m-ops-fab" aria-label="Nuevo chat" onClick={onClick}><Icon name="plus" size={26} /></button>,
        capa,
      )}
    </>
  );
}
