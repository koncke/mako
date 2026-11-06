// =============================================================================
// /calendario — la puerta de la tab, ANTES del loader (25/10/2026)
// =============================================================================
// `app/calendario/loading.tsx` envuelve a la página, y la puerta de la página (lib/tab-access.ts) REDIRIGE por dentro: a «no está
// en tu plan», al onboarding pendiente, a la casa. Un `redirect()` debajo del loader va en el stream (200 + meta refresh, no
// 307) y queda en carrera con la hidratación del router: «Minified React error #310» (tickets #7 y #9,
// docs/hallazgos-infra.md). El layout queda AFUERA del loader: acá sale el 307. La misma puerta y en el mismo orden que la
// página, que conserva la suya; la carpeta tiene una sola página, así que va sin mirar la ruta. Closers y setters pasan desde
// el 6/11/2026: la página les abre sólo «Llamadas».
// Lo vigila tests/redirige-antes-del-loader.test.ts: si la página cambia de puerta, este layout cambia con ella.
// =============================================================================

import type { ReactNode } from 'react';
import { requireRolWs } from '@/lib/tab-access';

export default async function CalendarioLayout({ children }: { children: ReactNode }) {
  await requireRolWs(['closer', 'setter'], { nav: 'calendario' });
  return children;
}
