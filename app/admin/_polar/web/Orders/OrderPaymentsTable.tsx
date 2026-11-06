'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/OrderPaymentsTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Payment attempts» son los pagos que entraron por este pedido: los del recibo (un recibo puede juntar varios: medio,
// referencia y comprobante) o, si el pago no tiene recibo, el pago mismo. Sin «Status» ni el motivo de un rechazo: acá sólo hay
// lo que entró (un intento rechazado de la pasarela vive en Checkouts).

import type { Pedido } from '@/app/admin/_polar/datos/ventas'
import { medioEnTexto } from '@/app/admin/_polar/datos/ventas'
import { DataTable, Text } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { montoEnTexto, usdEnTexto } from './montos'
import { OrderSection } from './OrderSection'

type Fila = {
  id: string
  fecha: string
  medio: string | null
  referencia: string | null
  monto: string
  de: string | null
  comprobante: string | null
}

export const filasDePagos = (order: Pedido): Fila[] =>
  order.recibo
    ? order.recibo.pagos
        .filter((p) => !p.anulado)
        .map((p) => ({
          id: String(p.id),
          fecha: p.fecha,
          medio: p.medio,
          referencia: p.referencia,
          monto: montoEnTexto(p.monto, p.moneda),
          de: p.de,
          comprobante: p.comprobante ? `/api/admin/recibos/${order.recibo?.id}/comprobante/${p.id}` : null,
        }))
    : [
        {
          id: order.id,
          fecha: `${order.fecha}T12:00:00`,
          medio: order.medio,
          referencia: null,
          monto: usdEnTexto(order.usd),
          de: null,
          comprobante: null,
        },
      ]

export const OrderPaymentsTable = ({ order }: { order: Pedido }) => {
  return (
    <OrderSection title="Pagos">
      <DataTable
        isLoading={false}
        columns={[
          {
            accessorKey: 'fecha',
            header: 'Fecha',
            cell: ({ row: { original } }) => (
              <FormattedDateTime
                locale="es-AR"
                dateStyle="medium"
                resolution={order.recibo ? 'time' : 'day'}
                datetime={original.fecha}
              />
            ),
          },
          {
            accessorKey: 'medio',
            header: 'Medio',
            cell: ({ row: { original } }) => (
              <span>
                {medioEnTexto(original.medio)}
                {original.de && (
                  <span className="dark:text-polar-500 ml-2 text-gray-500">
                    {original.de}
                  </span>
                )}
              </span>
            ),
          },
          {
            accessorKey: 'referencia',
            header: 'Referencia',
            cell: ({ row: { original } }) =>
              original.referencia ? (
                <Text as="span" monospace truncate>
                  {original.referencia}
                </Text>
              ) : (
                '—'
              ),
          },
          {
            accessorKey: 'monto',
            header: 'Monto',
            cell: ({ row: { original } }) => (
              <Text as="span" tabularNums>
                {original.monto}
              </Text>
            ),
          },
          {
            accessorKey: 'comprobante',
            header: '',
            cell: ({ row: { original } }) =>
              original.comprobante ? (
                <div className="flex justify-end">
                  <a
                    href={original.comprobante}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    Ver el comprobante
                  </a>
                </div>
              ) : null,
          },
        ]}
        data={filasDePagos(order)}
      />
    </OrderSection>
  )
}
