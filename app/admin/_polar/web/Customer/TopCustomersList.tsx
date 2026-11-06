'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/TopCustomersList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar pide con `useTopCustomers` (lo que pagó cada cliente en el rango) se suma acá, en el navegador, con
// los pagos que el server leyó de lib/admin-ingresos.ts (`topClientes`, app/admin/_polar/datos/clientes.ts). Mientras no
// se puede contar (en el server, con otro reloj), el «cargando» de Polar.

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistSkeleton,
  ToplistText,
  ToplistValue,
} from '@/app/admin/_polar/web/Customer/Toplist'
import { rutaDeNegocio, topClientes, type DatosTop } from '@/app/admin/_polar/datos/clientes'
import { toISODate } from '@/app/admin/_polar/web/utils/metrics'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { useRouter } from '@/app/_ui/Link'
import { Alert, Avatar } from '@/app/admin/_polar/orbit'
import { TrendingUp } from '@/app/admin/_polar/orbit/icons'
import { useMemo } from 'react'
import { AvisosDeLectura } from './AvisosDeLectura'
import { useEnElNavegador } from './useEnElNavegador'

interface TopCustomersListProps {
  datos: DatosTop | null
  /** El motivo por el que no se pudo leer. */
  error?: string | null
  avisos?: string[]
  start: Date
  end: Date
}

export const TopCustomersList = ({
  datos,
  error,
  avisos,
  start,
  end,
}: TopCustomersListProps) => {
  const router = useRouter()
  const enElNavegador = useEnElNavegador()
  const topCustomers = useMemo(
    () =>
      datos && enElNavegador
        ? topClientes(datos, toISODate(start), toISODate(end), 5)
        : null,
    [datos, enElNavegador, start, end],
  )

  if (error || !datos) {
    return (
      <Alert
        variant="danger"
        title="No pude leer lo que pagó cada negocio"
        description={error ?? undefined}
        actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
      />
    )
  }

  if (!topCustomers) {
    return <ToplistSkeleton rows={5} />
  }

  if (topCustomers.length === 0) {
    return (
      <>
        <AvisosDeLectura avisos={avisos} />
        <EmptyState
          icon={<TrendingUp />}
          title="Sin pagos todavía"
          description="Ningún pago entró en este período."
          fill
        />
      </>
    )
  }

  return (
    <>
      <AvisosDeLectura avisos={avisos} />
      <Toplist>
        {topCustomers.map((customer) => (
          <ToplistItem
            key={customer.clave}
            href={customer.ws != null ? rutaDeNegocio(customer.ws) : undefined}
          >
            <Avatar
              className="h-8 w-8"
              avatar_url={null}
              name={customer.nombre}
            />
            <ToplistText
              primary={customer.nombre}
              secondary={customer.ws == null ? 'Sin cuenta en MaKo' : undefined}
            />
            <ToplistValue
              value={formatCurrency('statistics')(customer.totalCentavos, 'usd')}
              caption={`${customer.pagos} ${
                customer.pagos === 1 ? 'pago' : 'pagos'
              }`}
            />
          </ToplistItem>
        ))}
      </Toplist>
    </>
  )
}
