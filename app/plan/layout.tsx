// =============================================================================
// /plan — el super admin se va a /plan/agencia ANTES del loader (23/10/2026, ticket #7)
// =============================================================================
// app/plan/page.tsx manda al super admin sin impersonar a /plan/agencia. Con el loading.tsx de /plan, ese redirect() va
// adentro del stream (200 + meta refresh, no 307), y en /general eso tiró «Minified React error #310» en el router de Next.
// El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 de siempre y el loader se queda para los demás.
// La decisión es LA MISMA de la página (que la conserva por si se llega navegando desde /plan/agencia, donde este layout no
// se vuelve a dibujar), con la query entera: un link `/plan?tarea=…` no se pierde (tests/plan-filtro-cliente.test.ts).
// Sólo en la ruta exacta /plan: este layout envuelve también a /plan/agencia, /plan/board y /plan/revisar.
//
// LAS OTRAS DOS RUTAS Y LAS PUERTAS (25/10/2026): las puertas de lib/tab-access.ts también redirigen por dentro (a «no está
// en tu plan», al onboarding pendiente), y /plan/agencia y /plan/revisar/<id> redirigen a la vista. Todo eso iba en el
// stream. Cada ruta repite ACÁ lo de su página, en el mismo orden (tests/redirige-antes-del-loader.test.ts lo compara):
//   · /plan: el super admin a /plan/agencia; los demás, la puerta de la tab y el onboarding;
//   · /plan/agencia: quien no es el super admin (o lo es impersonando) vuelve a /plan, con la query;
//   · /plan/revisar/<id>: sin sesión a /inicio, y el onboarding (la pantalla ESCRIBE y llega por un link de WhatsApp).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { estaImpersonando, rutaConWs } from '@/lib/workspace';
import { pedidoActual } from '@/lib/pedido-actual';
import type { QueryDelPedido } from '@/lib/pedido-actual-reglas';

/** La query que viaja con el salto, como la arman las páginas: un valor, o el primero si se repite. */
function queryDe(query: QueryDelPedido): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === 'string') sp.set(k, v);
    else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
  }
  return sp.toString();
}

export default async function PlanLayout({ children }: { children: ReactNode }) {
  const { ruta, query } = await pedidoActual();
  if (ruta === '/plan') {
    const sesion = await getUsuarioActual();
    if (sesion?.rol === 'admin' && !(await estaImpersonando())) {
      const qs = queryDe(query);
      redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : ''}`));
    }
    await requireCapa('todo');
    await guardOnboarding();
  }
  if (ruta === '/plan/agencia') {
    const sesion = await getUsuarioActual();
    if (sesion?.rol !== 'admin' || (await estaImpersonando())) {
      const qs = queryDe(query);
      redirect(await rutaConWs(`/plan${qs ? `?${qs}` : ''}`));
    }
  }
  if (ruta != null && /^\/plan\/revisar\/[^/]+$/.test(ruta)) {
    const sesion = await getUsuarioActual();
    if (!sesion) redirect(await rutaConWs('/inicio'));
    await guardOnboarding();
  }
  return children;
}
