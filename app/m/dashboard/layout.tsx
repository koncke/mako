// =============================================================================
// /m/dashboard — las dos páginas REDIRIGEN acá, ANTES del loader (25/10/2026, React #310)
// =============================================================================
// Es el caso de los tickets #7 y #9 (docs/hallazgos-infra.md): `./loading.tsx` es un Suspense que envuelve a las dos páginas
// (el Dashboard y una hoja propia, ./[hoja]), y un `redirect()` de ahí adentro no es un 307: va en el stream (200 + meta
// refresh) y queda en carrera con la hidratación del router, que a veces se cae. El layout queda AFUERA del loading.tsx:
// redirigir acá devuelve el 307 de siempre, y el loader se queda. Las vueltas son las de las páginas, que las conservan por
// si se llega navegando:
//   · el Dashboard: el closer (o el setter) cuyo negocio no compró la capa de su hoja → Today (`sinSuHoja`);
//   · una hoja propia: el closer o el setter (no tienen otras), o una hoja que no se abre en el teléfono → el Dashboard
//     (`hojaPropiaDe`, con el informe de `tableroDelPedido`: la página lo reusa y no se lee dos veces).
// Qué página es lo dice la ruta de la URL, que en el teléfono es la de escritorio (`paginaDelPedido`, ./redireccion.ts).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { contextoMovil, requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, puedeVerKey } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { hojaDeRol } from '@/lib/graficos-plantillas';
import { pedidoActual } from '@/lib/pedido-actual';
import { sinSuHoja } from '@/app/dashboard/redireccion';
import { hojaPropiaDe, tableroDelPedido } from './datos';
import { VOLVER_AL_DASHBOARD, paginaDelPedido } from './redireccion';

export default async function DashboardMovilLayout({ children }: { children: ReactNode }) {
  const { ruta, query } = await pedidoActual();
  const cual = paginaDelPedido(ruta, query);
  // Cacheado por request (lib/movil-guard.ts): la página lo vuelve a pedir sin otra consulta. Sin sesión es null y la puerta
  // la hace la página, como siempre.
  const ctx = cual ? await contextoMovil() : null;
  if (cual && ctx) {
    let destino: string | null = null;
    if (cual.pagina === 'dashboard') {
      if (sinSuHoja(ctx.rol, ctx.capa)) destino = HOME_MOVIL;
    } else if (hojaDeRol(ctx.rol)) {
      destino = VOLVER_AL_DASHBOARD;
    } else if (puedeVerKey('graphics', ctx.rol, ctx.capa) && !hojaPropiaDe((await tableroDelPedido()).tablero, cual.id)) {
      // El informe se lee sólo para quien tiene la tab: el destino no se calcula para quien no la tiene.
      destino = VOLVER_AL_DASHBOARD;
    }
    if (destino) {
      // La puerta de la tab, la misma de las páginas. Sólo cuando se va a redirigir: el onboarding y lo de Esencial no están
      // todos cacheados, y la página ya los pregunta.
      await requireMovil({ navKey: 'graphics' });
      redirect(await rutaConWs(destino));
    }
  }
  return children;
}
