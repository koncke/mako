'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/CustomerPage/CustomerOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el mismo orden (Metrics, Details, Subscriptions, Orders), con el Timeline de Polar (components/Customer/CustomerTimeline,
// que Polar monta en el panel de un pedido o una suscripción) entre Metrics y Details: es lo que pasó en el negocio, y la
// decisión de Martín para la ficha. Se sacaron CustomerPaymentsTable (en MaKo un pago ES un pedido: serían dos tablas iguales)
// y CustomerBenefitGrantsTable (MaKo no tiene beneficios).

import type {
  AltaNegocio,
  ComputadoraNegocio,
  ConexionNegocio,
  EventoNegocio,
  NegocioCabecera,
} from '@/app/admin/_polar/datos/cliente'
import type { Pedido, SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { rutaDeFicha } from '@/app/admin/_polar/datos/cliente'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { CustomerTimeline } from '../CustomerTimeline'
import { CustomerDetailsSection } from './CustomerDetailsSection'
import { CustomerMetricsOverview } from './CustomerMetricsOverview'
import { CustomerOrdersTable } from './CustomerOrdersTable'
import { CustomerSubscriptionsTable } from './CustomerSubscriptionsTable'

export interface CustomerOverviewProps {
  negocio: NegocioCabecera
  alta: AltaNegocio
  inicio: string
  pedidos: Pedido[]
  mrrUsd: number | null
  suscripciones: SuscripcionVenta[]
  conexiones: ConexionNegocio[] | null
  computadoras: ComputadoraNegocio[] | null
  eventos: EventoNegocio[]
}

export const CustomerOverview = ({
  negocio,
  alta,
  inicio,
  pedidos,
  mrrUsd,
  suscripciones,
  conexiones,
  computadoras,
  eventos,
}: CustomerOverviewProps) => {
  return (
    <Box flexDirection="column" rowGap="5xl">
      <CustomerMetricsOverview pedidos={pedidos} mrrUsd={mrrUsd} inicio={inicio} />
      <CustomerTimeline eventos={eventos} viewAllHref={rutaDeFicha(negocio.ws, 'events')} />
      <CustomerDetailsSection
        negocio={negocio}
        alta={alta}
        conexiones={conexiones}
        computadoras={computadoras}
      />
      <CustomerSubscriptionsTable suscripciones={suscripciones} />
      <CustomerOrdersTable pedidos={pedidos} />
    </Box>
  )
}
