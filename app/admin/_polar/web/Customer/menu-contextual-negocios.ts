// =============================================================================
// menu-contextual-negocios — QUÉ ofrece el clic derecho de un negocio en la lista de Admin › Customers (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». La lista de Polar
// (CustomerListSidebar.tsx) no lo tiene; MaKo lo tenía en la lista vieja de Customers (app/customers/menu-contextual-customers.ts,
// borrada con la copia de Polar) y el Cerebro lo pidió de vuelta el 6/11/2026, «sin cambiar lo que se ve». Ofrece lo de la
// ficha sin abrirla, y nada nuevo:
//   · «Ver ficha»: la fila misma (su link);
//   · «Entrar a su cuenta»: el «Entrar a su cuenta» del «⋮» de la ficha (CustomerHeader.tsx), la entrada de siempre a un negocio;
//   · «Administrar»: el «Editar negocio» del mismo «⋮» (nombre, plan, plan a mano), abierto sobre la ficha (`?editar=1`).
// Lo cruza tests/clic-derecho-listas.test.ts.
// =============================================================================

import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual'

export type IdOpcionNegocio = 'ficha' | 'entrar' | 'administrar'

/** El parámetro con el que la ficha abre «Editar negocio» sola (CustomerHeader.tsx lo lee y lo saca de la URL). */
export const PARAM_EDITAR = 'editar'

export function itemsNegocio(): EntradaMenuContextual[] {
  return [
    { id: 'ficha', label: 'Ver ficha', icono: 'ver' },
    null,
    { id: 'entrar', label: 'Entrar a su cuenta', icono: 'cliente' },
    { id: 'administrar', label: 'Administrar', icono: 'configurar' },
  ]
}

/**
 * A dónde lleva cada opción. «Entrar» es la MISMA de la ficha (`/inicio?ws=<n>`, una navegación dura: cambia de cuenta);
 * «Ver ficha» y «Administrar» van a la ficha (`rutaDeNegocio`), la segunda con «Editar negocio» abierto.
 */
export function destinoNegocio(id: IdOpcionNegocio, ws: number, rutaDeNegocio: (ws: number) => string): string {
  if (id === 'entrar') return `/inicio?ws=${ws}`
  if (id === 'administrar') return `${rutaDeNegocio(ws)}?${PARAM_EDITAR}=1`
  return rutaDeNegocio(ws)
}
