// =============================================================================
// /web-generator — las rutas que REDIRIGEN lo hacen acá, ANTES del loader (24/10/2026, ticket #9)
// =============================================================================
// Ticket #9 (ws 10, 24/10 21:43 ART): «La pantalla «Web Generator» se rompió», «Minified React error #310» al abrir
// /web-generator. Es el mismo caso del ticket #7 (docs/hallazgos-infra.md): `app/web-generator/loading.tsx` es un Suspense
// que envuelve a la página Y a las subrutas, y un `redirect()` de ahí adentro no es un 307: va en el stream (200 + meta
// refresh) y queda en carrera con la hidratación del router, que a veces se cae. `/analizar` y `/crear` (los links viejos)
// redirigen; la página pelada saltaba a la última landing entre el 24/10 y el 11/11, cuando pasó a ser la portada de outliers.
//
// El layout queda AFUERA del loading.tsx: redirigir acá devuelve el 307 de siempre, y el loader se queda para el editor.
// La decisión es la de las páginas (`redireccionDelLayout`, panel-reglas.ts, con test), que la conservan por si se llega
// navegando (este layout envuelve a todas las rutas de la tab y no se vuelve a dibujar entre ellas). La ruta y la query
// las pone el proxy (lib/pedido-actual.ts): un layout no las recibe.
//
// LA PUERTA, SIEMPRE (25/10/2026): `requireRolWs` también redirige por dentro (a «no está en tu plan», al onboarding
// pendiente). Hasta hoy el layout la pasaba sólo en las tres rutas que saltan, y el editor (`/web-generator/<id>`) o el
// Panel (`?panel=1`) de un cliente con el onboarding pendiente redirigían desde adentro del loader. Las cuatro páginas de la
// tab tienen la MISMA puerta: va primero, para todas (tests/redirige-antes-del-loader.test.ts lo vigila).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { rutaConWs } from '@/lib/workspace';
import { esNavegacionDelCliente, pedidoActual } from '@/lib/pedido-actual';
import { destinoAnalizar, destinoCrear, redireccionDelLayout } from './panel-reglas';
import { TooltipsFlotantes } from './editor/TooltipsFlotantes';

export default async function WebGeneratorLayout({ children }: { children: ReactNode }) {
  // La puerta de la tab, la misma de las páginas y antes que nada: el destino no se calcula para quien no la tiene.
  await requireRolWs([], { nav: 'landing-writer' });
  const { ruta, query } = await pedidoActual();
  // ⚠️ Sólo en la CARGA del documento (28/10/2026, Martín: «Cada vez que entro a web generator, hay un bug que aparece
  // todo en blanco, le tengo que dar a refresh»). Entrando por el menú, este redirect viajaba en el nodo del layout, el
  // router lo guardaba y lo volvía a tirar al llegar a /web-generator/<id> (el MISMO layout): renavegaba a la misma URL
  // para siempre, en blanco. Navegando, redirige la página (./page.tsx), cuyo segmento se reemplaza. Regla:
  // lib/pedido-actual.ts, `esNavegacionDelCliente`.
  const cual = redireccionDelLayout(ruta, query);
  if (cual && !(await esNavegacionDelCliente())) {
    if (cual === 'analizar') redirect(await rutaConWs(destinoAnalizar(query)));
    if (cual === 'crear') redirect(await rutaConWs(destinoCrear(query)));
    // (La pelada saltaba a la última landing tocada hasta el 11/11/2026: ahora es la portada de outliers, ./page.tsx.)
  }
  // Los tooltips de toda la tab, encima de todo (editor/TooltipsFlotantes.tsx).
  return <>{children}<TooltipsFlotantes /></>;
}
