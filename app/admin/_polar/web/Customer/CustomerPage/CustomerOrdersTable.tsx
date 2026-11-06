'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerOrdersTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los pedidos del negocio son los de Admin › Sales (app/admin/_polar/datos/ventas.ts, `Pedido`): cada pago que entró, a
// mano o por la pasarela, con su recibo y su estado (pagado, devuelto, anulado). Polar muestra el producto y su versión: MaKo no
// ata un pago a un producto, así que va el concepto y el medio. «Ver» lleva a su detalle en Sales.

import { rutaDePedido } from '@/app/admin/_polar/datos/cliente'
import { medioEnTexto, ROTULO_ESTADO_PEDIDO, type Pedido } from '@/app/admin/_polar/datos/ventas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Button, DataTable, Status, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import Link from '@/app/_ui/Link'

interface CustomerOrdersTableProps {
  pedidos: Pedido[]
}

const COLOR_ESTADO: Record<Pedido['estado'], 'green' | 'yellow' | 'gray' | 'red'> = {
  paid: 'green', partially_refunded: 'yellow', refunded: 'gray', void: 'red',
}

export const CustomerOrdersTable = ({ pedidos }: CustomerOrdersTableProps) => {
  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Orders
      </Text>
      <DataTable
        data={pedidos}
        columns={[
          {
            header: 'Descripción',
            accessorKey: 'concepto',
            cell: ({ row: { original } }) => (
              <Link href={rutaDePedido(original)} key={original.id}>
                {/* El medio va debajo del concepto: en línea, con la columna angosta de la ficha, se dibujaba encima del estado
                    («TransferePagado», capturas del 6/11/2026). */}
                <Box as="span" display="flex" flexDirection="column">
                  {original.concepto || (original.recurrente ? 'Mensualidad' : 'Pago')}
                  <Text as="span" variant="caption" color="muted">
                    {medioEnTexto(original.medio)}
                  </Text>
                </Box>
              </Link>
            ),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
            cell: ({ row: { original } }) => (
              <Status
                size="small"
                color={COLOR_ESTADO[original.estado]}
                status={ROTULO_ESTADO_PEDIDO[original.estado]}
              />
            ),
          },
          {
            header: 'Monto',
            accessorKey: 'usd',
            cell: ({ row: { original } }) =>
              original.usd == null
                ? 'Sin su valor en dólares'
                : formatCurrency('compact')(Math.round(original.usd * 100), 'usd'),
          },
          {
            header: 'Fecha',
            accessorKey: 'fecha',
            cell: ({ row: { original } }) => (
              <FormattedDateTime datetime={`${original.fecha}T12:00:00`} />
            ),
          },
          {
            header: '',
            accessorKey: 'action',
            size: 70,
            cell: ({ row: { original } }) => (
              <Box justifyContent="end">
                <Link href={rutaDePedido(original)}>
                  <Button variant="secondary" size="sm">
                    Ver
                  </Button>
                </Link>
              </Box>
            ),
          },
        ]}
        isLoading={false}
        className="text-sm"
      />
    </Box>
  )
}
