'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerSubscriptionsTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las suscripciones del negocio son las de Admin › Sales (app/admin/_polar/datos/ventas.ts, `SuscripcionVenta`): la del
// lead de la plataforma con su historia mes a mes (la misma cuenta que la ficha del lead) o la de la pasarela. Polar muestra el
// producto y su versión: va lo que se vendió (el plan o el concepto) y, sin versiones, nada más. El monto es lo que paga por
// mes, como el `AmountLabel` de Polar. «Ver» lleva a su detalle en Sales. «Próxima» y «Debe» (punto 27 de la revisión del
// 6/11/2026): cuándo le toca pagar y lo que debe hoy, los mismos campos que el detalle en Sales (`renovacion`, `deudaUsd`).

import { rutaDeSuscripcion } from '@/app/admin/_polar/datos/cliente'
import { ROTULO_ESTADO_SUSCRIPCION, type SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Button, DataTable, Status, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link from '@/app/_ui/Link'
import { usdEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { fechaCorta } from '@/app/admin/_polar/web/Subscriptions/SubscriptionStatus'

interface CustomerSubscriptionsTableProps {
  suscripciones: SuscripcionVenta[]
  /** El día de hoy (YYYY-MM-DD): una fecha de este año va sin el año, como en Sales. */
  hoy: string
}

const COLOR_ESTADO: Record<SuscripcionVenta['estado'], 'green' | 'yellow' | 'gray'> = {
  active: 'green', past_due: 'yellow', canceled: 'gray',
}

export const CustomerSubscriptionsTable = ({
  suscripciones,
  hoy,
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
            cell: ({ row: { original } }) => (
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
              >
                {original.producto || 'Suscripción'}
                <Text as="span" variant="caption" color="muted">
                  {original.fuente === 'pasarela' ? 'Por la pasarela' : 'A mano'}
                </Text>
              </Box>
            ),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
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
            header: 'Próxima',
            accessorKey: 'renovacion',
            cell: ({ row: { original } }) =>
              original.renovacion ? (
                <Text as="span" tabularNums>
                  {fechaCorta(original.renovacion, hoy)}
                </Text>
              ) : (
                <span>—</span>
              ),
          },
          {
            header: 'Debe',
            accessorKey: 'deudaUsd',
            cell: ({ row: { original } }) =>
              original.deudaUsd > 0 ? (
                <Text as="span" color="danger">
                  {usdEnTexto(original.deudaUsd, 'compact')}
                </Text>
              ) : (
                <span>—</span>
              ),
          },
          {
            header: '',
            accessorKey: 'action',
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
        className="text-sm"
      />
    </Box>
  )
}
