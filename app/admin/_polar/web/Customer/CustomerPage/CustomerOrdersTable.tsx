'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerOrdersTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los pedidos del negocio son los de Admin › Sales (app/admin/_polar/datos/ventas.ts, `Pedido`): cada pago que entró, a
// mano o por la pasarela, con su recibo y su estado (pagado, devuelto, anulado). Polar muestra el producto y su versión: MaKo no
// ata un pago a un producto, así que va el concepto y el medio. «Ver» lleva a su detalle en Sales.
// ⚠️ La descripción va en UNA línea con «…» (el concepto cede último y el medio primero, ./Widgets/fila.ts): con el
//    `inline-flex` de Polar y un concepto en español («Mensualidad de septiembre»), la columna se partía en tres renglones y el
//    medio de pago se dibujaba ENCIMA de la insignia «Pagado» de la columna de al lado (6/11/2026). Los anchos van en
//    porcentajes (`DataTableColumnMeta`), y en una caja angosta se esconden el estado, la fecha y «Ver» (la descripción ya
//    lleva al pedido, como en Polar): quedan qué y cuánto.

import { rutaDePedido } from '@/app/admin/_polar/datos/cliente'
import { medioEnTexto, ROTULO_ESTADO_PEDIDO, type Pedido } from '@/app/admin/_polar/datos/ventas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Button, DataTable, Status, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import Link from '@/app/_ui/Link'
import { PRINCIPAL, SECUNDARIO } from '@/app/admin/_polar/web/Widgets/fila'

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
            meta: { width: '34%' },
            cell: ({ row: { original } }) => (
              <Link
                href={rutaDePedido(original)}
                key={original.id}
                className="flex min-w-0 items-baseline gap-x-2"
              >
                <Text as="span" truncate style={PRINCIPAL}>
                  {original.concepto || (original.recurrente ? 'Mensualidad' : 'Pago')}
                </Text>
                <Text as="span" variant="caption" color="muted" truncate style={SECUNDARIO}>
                  {medioEnTexto(original.medio)}
                </Text>
              </Link>
            ),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
            meta: { width: '16%', className: 'hidden @md:table-cell' },
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
            meta: { width: '22%' },
            cell: ({ row: { original } }) =>
              original.usd == null ? (
                <Text as="span" color="muted" truncate title="Sin su valor en dólares">
                  Sin su valor en dólares
                </Text>
              ) : (
                <Text as="span" wrap="nowrap">
                  {formatCurrency('compact')(Math.round(original.usd * 100), 'usd')}
                </Text>
              ),
          },
          {
            header: 'Fecha',
            accessorKey: 'fecha',
            meta: { width: '18%', className: 'hidden @lg:table-cell whitespace-nowrap' },
            cell: ({ row: { original } }) => (
              <FormattedDateTime datetime={`${original.fecha}T12:00:00`} />
            ),
          },
          {
            header: '',
            accessorKey: 'action',
            meta: { width: '10%', className: 'hidden @lg:table-cell' },
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
        className="@container text-sm"
      />
    </Box>
  )
}
