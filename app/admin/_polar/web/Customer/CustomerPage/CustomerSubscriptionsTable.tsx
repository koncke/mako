'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerSubscriptionsTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las suscripciones del negocio son las de Admin › Sales (app/admin/_polar/datos/ventas.ts, `SuscripcionVenta`): la del
// lead de la plataforma con su historia mes a mes (la misma cuenta que la ficha del lead) o la de la pasarela. Polar muestra el
// producto y su versión: va lo que se vendió (el plan o el concepto) y, sin versiones, nada más. El monto es lo que paga por
// mes, como el `AmountLabel` de Polar. «Ver» lleva a su detalle en Sales.

import { rutaDeSuscripcion } from '@/app/admin/_polar/datos/cliente'
import { ROTULO_ESTADO_SUSCRIPCION, type SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Button, DataTable, Status, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link from '@/app/_ui/Link'
import { PRINCIPAL, SECUNDARIO } from '@/app/admin/_polar/web/Widgets/fila'

interface CustomerSubscriptionsTableProps {
  suscripciones: SuscripcionVenta[]
}

const COLOR_ESTADO: Record<SuscripcionVenta['estado'], 'green' | 'yellow' | 'gray'> = {
  active: 'green', past_due: 'yellow', canceled: 'gray',
}

export const CustomerSubscriptionsTable = ({
  suscripciones,
}: CustomerSubscriptionsTableProps) => {
  return (
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xxs" as="h3">
        Subscriptions
      </Text>
      <DataTable
        data={suscripciones}
        columns={[
          {
            header: 'Producto',
            accessorKey: 'producto',
            // MaKo: en UNA línea con «…», como la descripción de Orders (CustomerOrdersTable.tsx); en una caja angosta se
            // esconde el monto (está en Metrics, arriba) y quedan qué es y cómo está.
            meta: { width: '45%' },
            cell: ({ row: { original } }) => (
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text as="span" truncate style={PRINCIPAL}>
                  {original.producto || 'Suscripción'}
                </Text>
                <Text as="span" variant="caption" color="muted" truncate style={SECUNDARIO}>
                  {original.fuente === 'pasarela' ? 'Por la pasarela' : 'A mano'}
                </Text>
              </Box>
            ),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
            meta: { width: '20%' },
            cell: ({ row: { original } }) => (
              <Status
                size="small"
                color={COLOR_ESTADO[original.estado]}
                status={ROTULO_ESTADO_SUSCRIPCION[original.estado]}
              />
            ),
          },
          {
            header: 'Monto',
            accessorKey: 'mensualidadUsd',
            meta: { width: '21%', className: 'hidden @md:table-cell whitespace-nowrap' },
            cell: ({ row: { original } }) =>
              original.mensualidadUsd != null ? (
                <span>
                  {`${formatCurrency('compact')(Math.round(original.mensualidadUsd * 100), 'usd')} / mes`}
                </span>
              ) : (
                <span>—</span>
              ),
          },
          {
            header: '',
            accessorKey: 'action',
            meta: { width: '14%', className: 'px-1 @md:px-4' },
            cell: ({ row: { original } }) => (
              <Box justifyContent="end">
                <Link href={rutaDeSuscripcion(original)}>
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
