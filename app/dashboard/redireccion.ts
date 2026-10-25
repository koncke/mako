// =============================================================================
// /dashboard — la decisión de REDIRIGIR, la misma en el layout y en la página (25/10/2026, React #310)
// =============================================================================
// app/dashboard/loading.tsx es un Suspense que envuelve a la página: un `redirect()` de ahí adentro no es un 307, va en el
// stream (200 + meta refresh) y queda en carrera con la hidratación del router, que a veces se cae con «Minified React error
// #310» (tickets #7 y #9, docs/hallazgos-infra.md). Por eso redirige el layout (./layout.tsx), que queda AFUERA del loader;
// la página conserva su redirect para cuando se llega navegando (el layout no se vuelve a dibujar). La usa también el
// teléfono (app/m/dashboard). Sin `server-only`: la leen el layout, las páginas y el test.
// =============================================================================

import { tabEnCapa } from '@/lib/capas';
import { hojaDeRol } from '@/lib/graficos-plantillas';

/** El closer (o el setter) ve SÓLO su hoja: si su negocio no compró la capa que esa hoja pide, el Dashboard no es para él. */
export function sinSuHoja(rol: unknown, capa: string | null | undefined): boolean {
  const u = hojaDeRol(rol);
  return !!u && !tabEnCapa(u.capa, capa);
}
