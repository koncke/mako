// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/CheckoutStatus/CheckoutStatus.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: un checkout es un cobro de la pasarela SIN pagar: abierto (el link se puede pagar), rechazado (la pasarela dijo que no) o
// anulado. Los de Polar «confirmed» y «succeeded» no van: lo pagado ya es un pedido (Orders).

import { ROTULO_ESTADO_CHECKOUT, type EstadoCheckout } from '@/app/admin/_polar/datos/ventas'
import { Status, type StatusColor } from '@/app/admin/_polar/orbit'

export const CheckoutStatusDisplayTitle: Record<EstadoCheckout, string> = ROTULO_ESTADO_CHECKOUT
export const CheckoutStatusDisplayColor: Record<EstadoCheckout, StatusColor> = { open: 'blue', failed: 'red', expired: 'gray' }

const CheckoutStatus = ({ checkout: { estado } }: { checkout: { estado: EstadoCheckout } }) => {
  return <Status color={CheckoutStatusDisplayColor[estado]} status={CheckoutStatusDisplayTitle[estado]} />
}

export default CheckoutStatus
