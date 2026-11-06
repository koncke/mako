'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/subscriptions/[id]/SubscriptionsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la suscripción llega armada por el server. «Update Subscription» de Polar abre un modal para cambiar el plan; en MaKo una
// suscripción a mano se cambia en la ficha del lead (los cambios de monto, los cortes y las vueltas viven ahí, mig 0401), así que
// el botón lleva a la ficha. Lo que se sacó: el preview de cargos por uso (metros), los asientos y los campos personalizados.

import Link from '@/app/_ui/Link'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import SubscriptionActionsMenu from '@/app/admin/_polar/web/Subscriptions/SubscriptionActionsMenu'
import { SubscriptionDetailsGrid } from '@/app/admin/_polar/web/Subscriptions/SubscriptionDetailsGrid'
import SubscriptionInvoicePreview from '@/app/admin/_polar/web/Subscriptions/SubscriptionInvoicePreview'
import SubscriptionOrdersSection from '@/app/admin/_polar/web/Subscriptions/SubscriptionOrdersSection'
import { OrderCustomerContext } from '@/app/admin/_polar/web/Orders/OrderCustomerContext'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import type { SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { Button, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import React from 'react'

interface ClientPageProps {
  subscription: SuscripcionVenta
  hoy: string
  plataforma: number | null
  avisos: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({ subscription, hoy, plataforma, avisos }) => {
  const ficha = subscription.cliente.leadId != null && plataforma != null ? `/crm/${subscription.cliente.leadId}?ws=${plataforma}` : null
  return (
    <DashboardBody
      title={
        <Box alignItems="center" columnGap="l">
          <Text variant="heading-xs" as="h2">
            Suscripción
          </Text>
        </Box>
      }
      className="gap-y-16"
      header={
        <Box alignItems="center" columnGap="l">
          {ficha && subscription.fuente === 'manual' && (
            <Link href={ficha}>
              <Button type="button">Cambiar en el CRM</Button>
            </Link>
          )}
          <SubscriptionActionsMenu subscription={subscription} />
        </Box>
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none"
      contextViewTitle="Cliente"
      contextView={<OrderCustomerContext customer={subscription.cliente} plataforma={plataforma} />}
    >
      <AvisosDeLectura avisos={avisos} />

      <SubscriptionDetailsGrid subscription={subscription} hoy={hoy} />

      <SubscriptionInvoicePreview subscription={subscription} hoy={hoy} />

      <SubscriptionOrdersSection subscription={subscription} hoy={hoy} />

      <Box flexDirection="column" rowGap="l" display={{ base: 'flex', md: 'none' }}>
        <Text variant="heading-xs" as="h3">
          Cliente
        </Text>
        <OrderCustomerContext customer={subscription.cliente} plataforma={plataforma} />
      </Box>
    </DashboardBody>
  )
}

export default ClientPage
