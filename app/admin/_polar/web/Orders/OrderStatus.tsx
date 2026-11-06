// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/OrderStatus.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: los estados que MaKo llena (lo pagado entra pagado; el recibo dice si se devolvió o se anuló). Los de Polar que MaKo no
// tiene (draft, pending) no están: lo que no se pagó vive en Checkouts.

import { ROTULO_ESTADO_PEDIDO, type EstadoPedido } from '@/app/admin/_polar/datos/ventas'
import { Status, type StatusColor } from '@/app/admin/_polar/orbit'

export const OrderStatusDisplayTitle: Record<EstadoPedido, string> = ROTULO_ESTADO_PEDIDO

const OrderStatusDisplayColor: Record<EstadoPedido, StatusColor> = {
  paid: 'green',
  refunded: 'purple',
  partially_refunded: 'purple',
  void: 'red',
}

export const OrderStatus = ({
  status,
  size,
}: {
  status: EstadoPedido
  size?: 'small' | 'medium'
}) => {
  return (
    <Status
      color={OrderStatusDisplayColor[status]}
      status={OrderStatusDisplayTitle[status]}
      size={size}
    />
  )
}
