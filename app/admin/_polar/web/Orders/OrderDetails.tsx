'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Orders/OrderDetails.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Product» es el concepto del pago (MaKo no ata un pago a un producto del catálogo); «Invoice number» es el número del
// recibo; «Billing reason» dice si es de una suscripción (con el link a ella) o un pago suelto. Sin «Discount»: MaKo no guarda
// descuentos de un pago. ⚠️ La ruta de la suscripción la busca el server (`suscripcionDelPedido`, sales/[id]/page.tsx): armar
// `l-<lead>` desde el cliente daba 404 o abría otra (revisión del Cerebro del 6/11/2026, punto 19). Sin ruta, sin enlace.

import type { Pedido } from '@/app/admin/_polar/datos/ventas'
import { motivoDePedido } from '@/app/admin/_polar/datos/ventas'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { ArrowUpRight as ArrowUpRightIcon } from '@/app/admin/_polar/orbit/icons'
import Link from '@/app/_ui/Link'
import { OrderStatus } from './OrderStatus'
import { DetailCell, DetailGrid } from './OrderSection'

export const OrderDetails = ({ order, suscripcion = null }: { order: Pedido; suscripcion?: string | null }) => {
  return (
    <DetailGrid>
      <DetailCell label="Concepto" value={order.concepto ?? undefined} />
      <DetailCell
        label="Fecha"
        value={
          <Text variant="body" as="span">
            <FormattedDateTime
              locale="es-AR"
              dateStyle="medium"
              datetime={`${order.fecha}T12:00:00`}
            />
          </Text>
        }
      />
      <DetailCell label="Estado" value={<OrderStatus status={order.estado} />} />
      <DetailCell
        label="Recibo"
        value={
          order.recibo
            ? `N.º ${String(order.recibo.numero).padStart(4, '0')}`
            : undefined
        }
      />
      <DetailCell
        label="Motivo"
        value={
          suscripcion ? (
            <Link href={suscripcion}>
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
                maxWidth="100%"
              >
                <Text as="span" variant="body" truncate>
                  {motivoDePedido(order)}
                </Text>
                <Box as="span" display="inline-flex" flexShrink={0}>
                  <ArrowUpRightIcon size={16} />
                </Box>
              </Box>
            </Link>
          ) : (
            motivoDePedido(order)
          )
        }
      />
    </DetailGrid>
  )
}
