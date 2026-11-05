// =============================================================================
// menu-contextual-customers — QUÉ ofrece el clic derecho de un cliente en Customers (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». Una fila de Customers no tiene «⋯»: lo que
// se puede hacer con un cliente está en su FICHA (el panel de la derecha), y el menú ofrece eso mismo sin abrirla: verla,
// «Entrar a su cuenta» y «Administrar» (plan, equipo y acceso). Nada nuevo: los dos destinos son los links de la ficha
// (`Ficha`, CustomersApp.tsx), y tests/clic-derecho-listas.test.ts los cruza.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';

export type IdOpcionCliente = 'ficha' | 'entrar' | 'administrar';

export function itemsCliente(): EntradaMenuContextual[] {
  return [
    { id: 'ficha', label: 'Ver ficha', icono: 'ver' },
    null,
    { id: 'entrar', label: 'Entrar a su cuenta', icono: 'cliente' },
    { id: 'administrar', label: 'Administrar', icono: 'configurar' },
  ];
}

/** A dónde va cada link (los mismos de la ficha). «Entrar» es una navegación dura: cambia de cuenta. */
export function destinoCliente(id: 'entrar' | 'administrar', ws: number): string {
  return id === 'entrar' ? `/inicio?ws=${ws}` : `/admin?tab=accounts&cuenta=${ws}`;
}
