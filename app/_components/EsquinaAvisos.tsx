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
//
// ⚠️ PERO UN HIJO VISIBLE SÍ TAPA, y desde el 06/10 la esquina pinta en TODA la app
// (antes «A revisar» sólo salía en /crm). Medido por la revisión de ese día: en
// /chatbot el lienzo llega al borde de la ventana y su «Publicar» vive a 12 px del
// rincón, y en cualquier chat el «Enviar» también — la pastilla les caía encima, y
// como no se cierra, no había forma de publicar sin repegar el Pixel. Dos arreglos:
//   · SUBE cuando la pantalla tiene un control propio en el rincón. El control se
//     declara con `data-esquina-ocupada` y la regla vive en globals.css
//     (`:root:has(...)`): la esquina está en el layout y no puede saber qué pinta
//     cada pantalla, y una pantalla que escribiera en el layout es un global que
//     alguien se olvida de limpiar.
//   · Va DEBAJO de los modales (z 55; los modales de la casa van de 60 para arriba).
//     Con 65 quedaba encima de cinco modales de z 60, incluido el detalle del deal.
// =============================================================================
import type { ReactNode } from 'react';

export function EsquinaAvisos({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 'var(--esquina-abajo, 20px)', zIndex: 55,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      maxHeight: 'calc(100vh - 40px)', pointerEvents: 'none',
    }}>
      {children}
    </div>
  );
}
