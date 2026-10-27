// =============================================================================
// menu-contextual-offer — QUÉ ofrece el clic derecho de «Tu oferta» en Offer (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». En Offer la lista a la vista es «Tu
// oferta»: las piezas del marco, con sus dos botones abajo (PiezasRail.tsx → `Acciones`). El clic derecho en cualquier
// lugar de esa tarjeta (y mantenerla presionada) ofrece esos MISMOS dos, con el mismo rótulo, y nada más: una pieza no
// tiene acciones propias. Sin ninguno de los dos (faltan piezas y no hay oferta armada), no hay menú.
//
// ⚠️ EL SELECTOR DE ARRIBA (los funnels, las ofertas y sus conversaciones) NO tiene clic derecho: es el `Dropdown` de la casa
//    (SelectorFunnel.tsx), y darle un menú propio a sus renglones es cambiar el desplegable de toda la app. Anotado en
//    docs/hallazgos-ui.md.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';
import type { AccionesPiezas } from './PiezasRail';

export type IdOpcionTuOferta = 'armar' | 'ver';

export function itemsTuOferta(a: Pick<AccionesPiezas, 'puedeConcluir' | 'hayConclusion' | 'etiquetaArmar' | 'ocupado'>): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [];
  // El mismo rótulo que el botón («Armar mi oferta» o el de actualizar el PDF), y apagado mientras MaKo contesta (como él).
  if (a.puedeConcluir) out.push({ id: 'armar', label: a.etiquetaArmar, icono: 'mako', deshabilitado: a.ocupado });
  if (a.hayConclusion) out.push({ id: 'ver', label: 'Ver mi oferta', icono: 'ver' });
  return out;
}
