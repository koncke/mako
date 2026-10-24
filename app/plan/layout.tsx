// =============================================================================
// /plan — el super admin se va a /plan/agencia ANTES del loader (23/10/2026, ticket #7)
// =============================================================================
// app/plan/page.tsx manda al super admin sin impersonar a /plan/agencia. Con el loading.tsx de /plan, ese redirect() va
// adentro del stream (200 + meta refresh, no 307), y en /general eso tiró «Minified React error #310» en el router de Next.
// El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 de siempre y el loader se queda para los demás.
// La decisión es LA MISMA de la página (que la conserva por si se llega navegando desde /plan/agencia, donde este layout no
// se vuelve a dibujar), con la query entera: un link `/plan?tarea=…` no se pierde (tests/plan-filtro-cliente.test.ts).
// Sólo en la ruta exacta /plan: este layout envuelve también a /plan/agencia, /plan/board y /plan/revisar.
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando, rutaConWs } from '@/lib/workspace';
import { pedidoActual } from '@/lib/pedido-actual';

export default async function PlanLayout({ children }: { children: ReactNode }) {
  const { ruta, query } = await pedidoActual();
  if (ruta === '/plan') {
    const sesion = await getUsuarioActual();
    if (sesion?.rol === 'admin' && !(await estaImpersonando())) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (typeof v === 'string') sp.set(k, v);
        else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
      }
      const qs = sp.toString();
      redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : ''}`));
    }
  }
  return children;
}
