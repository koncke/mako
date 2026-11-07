'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el mismo orden (Metrics, Details, Subscriptions, Orders), con el Timeline de Polar (components/Customer/CustomerTimeline,
// que Polar monta en el panel de un pedido o una suscripción) entre Metrics y Details: es lo que pasó en el negocio, y la
// decisión de Martín para la ficha. Sus eventos son los de Analytics › Events filtrados por el negocio, y «Ver todos» abre esa
// pantalla (`rutaDeEventosDelNegocio`, como Polar). Se sacaron CustomerPaymentsTable (en MaKo un pago ES un pedido: serían dos tablas iguales)
// y CustomerBenefitGrantsTable (MaKo no tiene beneficios).

import type {
  AltaNegocio,
  ComputadorasDeLaFicha,
  ConexionNegocio,
  NegocioCabecera,
} from '@/app/admin/_polar/datos/cliente'
import type { CostoDelNegocio } from '@/app/admin/_polar/datos/clientes'
import type { EventoDeTimeline } from '@/app/admin/_polar/datos/eventos'
import type { Pedido, SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { rutaDeEventosDelNegocio } from '@/app/admin/_polar/datos/cliente'
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
  costo: CostoDelNegocio | null
  suscripciones: SuscripcionVenta[]
  conexiones: ConexionNegocio[] | null
  computadoras: ComputadorasDeLaFicha
  eventos: EventoDeTimeline[]
}

export const CustomerOverview = ({
  negocio,
  alta,
  inicio,
  pedidos,
  costo,
  suscripciones,
  conexiones,
  computadoras,
  eventos,
}: CustomerOverviewProps) => {
  return (
    <Box flexDirection="column" rowGap="5xl">
      <CustomerMetricsOverview pedidos={pedidos} costo={costo} inicio={inicio} />
      <CustomerTimeline eventos={eventos} viewAllHref={rutaDeEventosDelNegocio(negocio.ws)} />
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
