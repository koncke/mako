'use client';

// =============================================================================
// VueltaAlTelefono — «Volver al teléfono», en la versión de computadora abierta desde un teléfono (20/10/2026)
// =============================================================================
// Martín, desde su Android: «Veo MaKo mobile roto, como si estuviera en desktop, solucionalo». Había tocado una fila
// «En la computadora» (General, de Configuración del negocio): la cookie de vista quedó en `escritorio` por 12 h para
// TODA la app y no había por dónde volver (`cookieVistaMovil` existía y nadie la llamaba).
//
// Lo monta el layout sólo cuando un TELÉFONO ve la versión de computadora por esa cookie (lib/movil-guard.ts →
// `vistaEscritorioEnTelefono`). Va fijo abajo, a la vista sin buscarlo. Borra la cookie y recarga la MISMA URL: el proxy
// la sirve en su versión del teléfono, o, si no tiene, el teléfono dice dónde se usa y lleva a MaKo Mobile.
//
// Con la cookie de UNA pantalla (`global: false`), salir de esa pantalla también vuelve al teléfono. Una navegación
// dentro de la app no recarga el layout raíz (y ése decidió «computadora»), así que al cambiar de ruta se recarga
// entera: el proxy decide de nuevo y sirve la del teléfono.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { cookieVistaMovil } from '@/lib/movil-dispositivo';

export function VueltaAlTelefono({ global }: { global: boolean }) {
  const pathname = usePathname();
  const inicial = useRef(pathname);
  useEffect(() => {
    if (!global && pathname !== inicial.current) window.location.reload();
  }, [global, pathname]);

  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = cookieVistaMovil();
        window.location.replace(window.location.pathname + window.location.search);
      }}
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom))',
        zIndex: 9500, padding: '12px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
        boxShadow: '0 8px 24px rgba(18, 21, 27, .28)', whiteSpace: 'nowrap',
      }}
    >
      Volver al teléfono
    </button>
  );
}
