// =============================================================================
// menu-contextual-integraciones — QUÉ ofrece el clic derecho de una tarjeta de Integraciones (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». Una tarjeta de /integraciones no tiene
// «⋯»: toda la tarjeta abre su modal, y adentro están las acciones de esa conexión (cada una distinta: quitar una agenda,
// reconectar Google, el saldo de una IA). El menú ofrece eso mismo, abrirla, con el nombre de lo que va a pasar:
// «Conectar» si todavía no está, «Abrir» si ya está. Llevar al menú lo de adentro del modal sería una segunda copia de
// cada conexión.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';

export function itemsIntegracion(conectada: boolean): EntradaMenuContextual[] {
  return [conectada
    ? { id: 'abrir', label: 'Abrir', icono: 'ver' }
    : { id: 'abrir', label: 'Conectar', icono: 'enchufe' }];
}
