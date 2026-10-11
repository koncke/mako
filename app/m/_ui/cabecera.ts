// =============================================================================
// La cabecera POR DEFECTO de cada ruta de /m (lógica pura, con test)
// =============================================================================
// El header vive en el layout y el layout no sabe en qué página está: no se
// re-ejecuta al navegar. Así que el header (cliente) lee el pathname y pregunta
// acá qué dibujar. Una página que necesite otra cosa (el nombre de un lead, una
// acción propia) lo pisa con <CabeceraM>.
//
// La regla, del documento (docs/diseno-mako-mobile.md):
//   · en la RAÍZ de cada destino: el título (Today, Inbox, MaKo, CRM, Plan);
//   · en una subpantalla: «‹ Padre» con destino FIJO, nunca `router.back()`.
//     El destino de «Volver» es una propiedad de la PANTALLA, no del camino
//     (AGENTS.md): en iOS standalone el gesto de volver no está garantizado, y
//     un link que llegó por push no tiene historial detrás.
//
// Los nombres salen de lib/movil-rutas.ts (DESTINOS_MOVIL): una cosa, un lugar.
// =============================================================================

import { DESTINOS_MOVIL, HOME_MOVIL, esRutaMovil } from '@/lib/movil-rutas';

export type PadreM = { href: string; label: string };
export type CabeceraPorDefecto = { titulo: string; padre: PadreM | null };

/** El perfil de /m: avisos, instalar, tema y la salida. Mismo nombre que en escritorio. */
export const RUTA_CUENTA = '/m/cuenta';
export const TITULO_CUENTA = 'Perfil';
/** La pantalla de onboarding pendiente: sin barra y sin «volver». */
export const RUTA_CONFIGURAR = '/m/configurar';

const HOY = DESTINOS_MOVIL.find((d) => d.href === HOME_MOVIL)!;

function limpia(pathname: string | null | undefined): string {
  return (pathname ?? '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

export function cabeceraPorRuta(pathname: string | null | undefined): CabeceraPorDefecto {
  const p = limpia(pathname);
  if (!esRutaMovil(p)) return { titulo: 'MaKo', padre: null };

  const raiz = DESTINOS_MOVIL.find((d) => d.href === p);
  if (raiz) return { titulo: raiz.label, padre: null };

  if (p === RUTA_CONFIGURAR) return { titulo: 'MaKo', padre: null };
  if (p === RUTA_CUENTA) return { titulo: TITULO_CUENTA, padre: { href: HOY.href, label: HOY.label } };
  if (p.startsWith(RUTA_CUENTA + '/')) return { titulo: '', padre: { href: RUTA_CUENTA, label: TITULO_CUENTA } };

  // Una subpantalla de un destino (/m/crm/123, /m/inbox/x): vuelve a la raíz del destino.
  const dueno = DESTINOS_MOVIL.find((d) => p.startsWith(d.href + '/'));
  if (dueno) return { titulo: '', padre: { href: dueno.href, label: dueno.label } };

  // Una ruta de /m que nadie declaró: vuelve a la home, que siempre existe.
  return { titulo: '', padre: { href: HOY.href, label: HOY.label } };
}

/** ¿Hay barra inferior en esta ruta? En /m/configurar no: todos sus destinos rebotan ahí. */
export function llevaBarra(pathname: string | null | undefined): boolean {
  return limpia(pathname) !== RUTA_CONFIGURAR;
}

/** Cuántos segmentos tiene la ruta: navegar a una MÁS profunda anima; volver, no. */
export function profundidad(pathname: string | null | undefined): number {
  return limpia(pathname).split('/').filter(Boolean).length;
}
