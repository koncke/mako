// =============================================================================
// menu-contextual-agency — QUÉ ofrece el clic derecho de una cuenta en el Agency Dashboard (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». Una fila del Agency Dashboard (la familia
// de Partners) no tiene «⋯»: tiene su ficha (tocar el nombre) y UN botón a la derecha, que depende de la cuenta. El menú
// ofrece esos dos, y nada más: «Abrir» (la ficha) y el botón que esa fila muestra («Pagar su mes», «Activar renovación» o
// «Inspeccionar»). Cuál botón le toca lo decide `accionDeCuenta`, que usan la fila, la ficha y el menú: una sola regla.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';
import type { CuentaPartner } from '@/lib/partners';

export type AccionCuenta = 'pagar' | 'renovacion' | 'inspeccionar';

/**
 * El botón de una cuenta. Lo que paga la agencia, a la vista (pagar el mes, o autorizar la renovación); lo que paga su
 * cliente lo ve él (su cartel). Si no hay nada que pagar, entrar a la cuenta: aprobada, o cualquiera para el super admin.
 */
export function accionDeCuenta(c: Pick<CuentaPartner, 'cobro' | 'paga' | 'estado'>, superAdmin: boolean): AccionCuenta | null {
  if (c.cobro?.pagar && c.paga === 'agencia') return 'pagar';
  if (c.cobro?.renovacion && !c.cobro.renovacion.activada && c.paga === 'agencia') return 'renovacion';
  if (c.estado === 'aprobado' || superAdmin) return 'inspeccionar';
  return null;
}

export const ROTULO_ACCION_CUENTA: Record<AccionCuenta, string> = {
  pagar: 'Pagar su mes', renovacion: 'Activar renovación', inspeccionar: 'Inspeccionar',
};

export function itemsCuentaAgency(accion: AccionCuenta | null): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [{ id: 'abrir', label: 'Abrir', icono: 'ver' }];
  if (accion) out.push(null, { id: accion, label: ROTULO_ACCION_CUENTA[accion], icono: accion === 'inspeccionar' ? 'cliente' : accion === 'renovacion' ? 'repetir' : 'dinero' });
  return out;
}
