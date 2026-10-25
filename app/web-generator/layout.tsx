// =============================================================================
// /web-generator — las rutas que REDIRIGEN lo hacen acá, ANTES del loader (25/10/2026, ticket #9)
// =============================================================================
// Ticket #9 (ws 10, 24/10 21:43 ART): «La pantalla «Web Generator» se rompió», «Minified React error #310» al abrir
// /web-generator. Es el mismo caso del ticket #7 (docs/hallazgos-infra.md): `app/web-generator/loading.tsx` es un Suspense
// que envuelve a la página Y a las subrutas, y un `redirect()` de ahí adentro no es un 307: va en el stream (200 + meta
// refresh) y queda en carrera con la hidratación del router, que a veces se cae. Desde el 24/10 la página pelada salta a
// la última landing (page.tsx); `/analizar` y `/crear` (los links viejos) redirigían desde antes.
//
// El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 de siempre, y el loader se queda para el editor.
// La decisión es la de las páginas (`redireccionDelLayout`, panel-reglas.ts, con test), que la conservan por si se llega
// navegando (este layout envuelve a todas las rutas de la tab y no se vuelve a dibujar entre ellas). La ruta y la query
// las pone el proxy (lib/pedido-actual.ts): un layout no las recibe.
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { pedidoActual } from '@/lib/pedido-actual';
import { listar } from '@/lib/editor-landing/server';
import { destinoAnalizar, destinoCrear, landingMasReciente, redireccionDelLayout } from './panel-reglas';

export default async function WebGeneratorLayout({ children }: { children: ReactNode }) {
  const { ruta, query } = await pedidoActual();
  const cual = redireccionDelLayout(ruta, query);
  if (cual) {
    // La puerta de la tab, la misma de las páginas: el destino no se calcula para quien no la tiene.
    await requireRolWs([], { nav: 'landing-writer' });
    if (cual === 'analizar') redirect(await rutaConWs(destinoAnalizar(query)));
    if (cual === 'crear') redirect(await rutaConWs(destinoCrear(query)));
    // La pelada: la última landing tocada. Una lista que no se pudo leer no salta: la página dice el error.
    const r = await listar().catch(() => null);
    const ultima = r?.ok ? landingMasReciente(r.docs) : null;
    if (ultima) redirect(await rutaConWs(`/web-generator/${ultima.id}`));
  }
  return children;
}
