// =============================================================================
// /dashboard — la página REDIRIGE acá, ANTES del loader (25/10/2026, React #310)
// =============================================================================
// Es el caso de los tickets #7 y #9 (docs/hallazgos-infra.md): `app/dashboard/loading.tsx` es un Suspense que envuelve a la
// página, y un `redirect()` de ahí adentro no es un 307: va en el stream (200 + meta refresh) y queda en carrera con la
// hidratación del router, que a veces se cae. La página redirige al closer (o al setter) cuyo negocio no compró la capa de
// su hoja. El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 de siempre, y el loader se queda.
// La decisión es la de la página (`sinSuHoja`, ./redireccion.ts), que la conserva por si se llega navegando. La ruta la pone
// el proxy (lib/pedido-actual.ts): un layout no la recibe. En el teléfono /dashboard se reescribe a /m/dashboard, que
// tiene su propio layout: éste es sólo el de la computadora.
// LA PUERTA, SIEMPRE (25/10/2026, chat «Landings»): `requireRolWs` también redirige por dentro (al onboarding pendiente, a
// «no está en tu plan», con el negocio pausado). Pasarla sólo cuando se iba a redirigir dejaba a un cliente con el onboarding
// pendiente yendo a /onboarding desde ADENTRO del loader: el mismo #310. Va primero, como en la página; cuesta lo que ella
// ya pregunta, y no demora al loader más que eso (tests/redirige-antes-del-loader.test.ts cuenta las puertas).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { homeDeCapa, requireRolWs } from '@/lib/tab-access';
import { getCapaActual, getRolWsEfectivo, rutaConWs } from '@/lib/workspace';
import { pedidoActual } from '@/lib/pedido-actual';
import { sinSuHoja } from './redireccion';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // La puerta de la tab, la misma de la página y antes que nada: el destino no se calcula para quien no la tiene.
  await requireRolWs(['closer', 'setter'], { nav: 'graphics' });
  const { ruta } = await pedidoActual();
  if (ruta === '/dashboard') {
    // Cacheados por request: la página los vuelve a pedir sin otra consulta.
    const [rol, capa] = await Promise.all([getRolWsEfectivo(), getCapaActual()]);
    if (sinSuHoja(rol, capa)) redirect(await rutaConWs(homeDeCapa(capa)));
  }
  return children;
}
