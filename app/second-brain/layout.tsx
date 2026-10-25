// =============================================================================
// /second-brain — quien opera MaKo se va al Ops Center ANTES del loader (23/10/2026, ticket #7)
// =============================================================================
// app/second-brain/page.tsx manda a quien opera (el super admin sin mirar a un cliente) al grafo dentro del Ops Center. Con
// el loading.tsx de /second-brain, ese redirect() va adentro del stream (200 + meta refresh, no 307), y en /general eso tiró
// «Minified React error #310» en el router de Next. El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 y
// el loader se queda para el cliente, que sí ve esta pantalla. La decisión es LA MISMA de la página (`quienOpera`, que lee
// la base: por eso no va en el proxy), y la página la conserva.
// LA PUERTA TAMBIÉN (25/10/2026): `requireRolWs` redirige por dentro (a «no está en tu plan», al onboarding pendiente), y
// también iba en el stream. Va primero, como en la página (la carpeta tiene una sola página: sin mirar la ruta).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { quienOpera } from '@/lib/second-brain-opera';
import { rutaDelSecondBrainEnOpsCenter } from '@/lib/ops-center-ruta';
import { pedidoActual } from '@/lib/pedido-actual';

export default async function SecondBrainLayout({ children }: { children: ReactNode }) {
  await requireRolWs(['closer', 'setter'], { nav: 'mako' });
  const { ruta, query } = await pedidoActual();
  if (ruta === '/second-brain' && (await quienOpera())) redirect(await rutaConWs(rutaDelSecondBrainEnOpsCenter(query)));
  return children;
}
