// =============================================================================
// La esquina de abajo a la derecha: UN lugar, varios avisos apilados
// =============================================================================
// Hasta el 06/10/2026 la esquina era de «A revisar» sola (MakoConfirmGate), con su
// propio `position: fixed`. Al sumar «Actualiza el Pixel», dos piezas fijas en la
// misma esquina se pisan — y la lección ya está pagada: el IaUsageToast se fue el
// 27/09 por taparle la decisión a la tarjeta (ver app/layout.tsx).
//
// Por eso la esquina es un CONTENEDOR y los avisos son hijos en columna: cuando «A
// revisar» se abre, lo de arriba sube con ella y nunca se superponen. «A revisar» va
// último, en el rincón donde Martín ya la conoce.
//
// `pointerEvents: none` en el contenedor y `auto` en cada hijo: la columna vacía no
// puede tragarse los clics de lo que haya debajo. Sin hijos visibles no tapa nada.
// =============================================================================
import type { ReactNode } from 'react';

export function EsquinaAvisos({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 65,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      maxHeight: 'calc(100vh - 40px)', pointerEvents: 'none',
    }}>
      {children}
    </div>
  );
}
