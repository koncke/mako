// =============================================================================
// El modo simple del editor (la tab Video, 9/11/2026): menos botones en un proyecto de plantilla guiada
// =============================================================================
// Martín, 9/11/2026: «simplificar un poco más la edición de video para que no haya exageradamente tantos botones». Un proyecto
// de plantilla guiada abre así; «Todas las herramientas» (la cabecera del editor) lo deja como siempre, y se recuerda en el
// proyecto (./estado.ts). Qué queda a la vista: ./modo-simple-reglas.ts, en positivo. docs/relevo/nube-tab-video.md §5.
//
// ⚠️ SIN EL MOTOR: el proyecto abierto lo fija la cabecera del editor (`fijarProyectoAbierto`); importar `useEditor` acá le
// sumaba el WASM a la fila de pestañas de la biblioteca, y su test (que la arma con esbuild) dejó de cargar.
// =============================================================================

import { useSyncExternalStore } from 'react';
import { leerGuia, proyectoAbierto, suscribirGuia } from './estado';

/** ¿El proyecto abierto está en modo simple? Sólo un proyecto de plantilla guiada; uno común, siempre completo. */
export function useModoSimple(): boolean {
  return useSyncExternalStore(suscribirGuia, () => {
    const p = proyectoAbierto();
    const g = p ? leerGuia(p) : null;
    return !!g && g.simple;
  }, () => false);
}
