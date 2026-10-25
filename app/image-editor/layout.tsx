// =============================================================================
// /image-editor — la puerta de la tab, ANTES del loader (25/10/2026)
// =============================================================================
// `app/image-editor/loading.tsx` envuelve a sus páginas (el editor, un diseño y el presentador), y la puerta que todas pasan primero REDIRIGE por dentro:
// sin sesión, al onboarding pendiente, a «no está en tu plan». Un `redirect()` debajo del loader va en el stream (200 + meta
// refresh, no 307) y queda en carrera con la hidratación del router: «Minified React error #310» (tickets #7 y #9,
// docs/hallazgos-infra.md). El layout queda AFUERA del loader: acá sale el 307. Es la MISMA puerta de las páginas, que la
// conservan; como todas las de la carpeta pasan por ella, va sin mirar la ruta.
// Lo vigila tests/redirige-antes-del-loader.test.ts: si una página cambia de puerta, este layout cambia con ella.
// =============================================================================

import type { ReactNode } from 'react';
import { requireEditorImagen } from './acceso';

export default async function ImageEditorLayout({ children }: { children: ReactNode }) {
  await requireEditorImagen();
  return children;
}
