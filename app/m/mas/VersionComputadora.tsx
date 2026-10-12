'use client';

// =============================================================================
// «Versión de computadora» — la última fila de More
// =============================================================================
// La MISMA salida que tenía /m/cuenta («Abrir la versión completa»): la cookie de vista de
// escritorio (lib/movil-dispositivo.ts, 12 h) y a /inicio, que con esa cookie reparte al
// escritorio y no de vuelta a /m. Con el `?ws=` de la pestaña: un super admin que mira un
// cliente sigue mirando ESE cliente en la computadora.
// =============================================================================

import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { cookieVistaEscritorio } from '@/lib/movil-dispositivo';
import { FilaM } from '../_ui/FilaM';

export function FilaVersionComputadora() {
  const ws = useWs();
  return (
    <FilaM
      navegacion
      icono="computadora"
      titulo="Versión de computadora"
      chevron={false}
      onClick={() => {
        document.cookie = cookieVistaEscritorio();
        window.location.href = conWs('/inicio', ws);
      }}
    />
  );
}
