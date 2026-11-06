'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/TopCostCustomersList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el costo de cada negocio es lo que le costó a MaKo su IA en el mes (`costosPorCliente`,
// app/admin/_polar/datos/clientes.ts, de lib/costos-ia.ts). Si ese mes no se puede repartir por negocio (el gasto de Claude
// con la clave de MaKo se anota siempre en el workspace 1), NO se muestra un número: se dice.

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistText,
  ToplistValue,
} from '@/app/admin/_polar/web/Customer/Toplist'
import { rutaDeNegocio, type VistaCostos } from '@/app/admin/_polar/datos/clientes'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { useRouter } from '@/app/_ui/Link'
import { Alert, Avatar } from '@/app/admin/_polar/orbit'
import { Coins } from '@/app/admin/_polar/orbit/icons'

interface TopCostCustomersListProps {
  costos: VistaCostos | null
  error?: string | null
}

export const TopCostCustomersList = ({
  costos,
  error,
}: TopCostCustomersListProps) => {
  const router = useRouter()

  if (error || !costos) {
    return (
      <Alert
        variant="danger"
        title="No pude leer el gasto de IA"
        description={error ?? undefined}
        actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
      />
    )
  }

  if (!costos.atribuible) {
    return <SinReparto fill />
  }

  const stats = costos.clientes.slice(0, 5)

  if (stats.length === 0) {
    return (
      <EmptyState
        icon={<Coins />}
        title="Sin gasto de IA"
        description="Ningún negocio le costó IA a MaKo este mes."
        fill
      />
    )
  }

  return (
    <Toplist>
      {stats.map((stat) => (
        <ToplistItem key={stat.ws} href={rutaDeNegocio(stat.ws)}>
          <Avatar className="h-8 w-8" avatar_url={null} name={stat.nombre} />
          <ToplistText
            primary={stat.nombre}
            secondary={`${stat.llamadas.toLocaleString('es-AR')} ${
              stat.llamadas === 1 ? 'llamada' : 'llamadas'
            }`}
          />
          <ToplistValue
            value={formatCurrency('subcent')(stat.costoCentavos, 'usd')}
            caption={`${Math.round(stat.share * 100)}% del gasto`}
          />
        </ToplistItem>
      ))}
    </Toplist>
  )
}

/** El estado de un mes que no se puede repartir por negocio: no es un vacío, es «no se puede medir». */
export const SinReparto = ({ fill = false }: { fill?: boolean }) => (
  <EmptyState
    icon={<Coins />}
    title="No se puede repartir por negocio"
    description="El gasto de Claude con la clave de MaKo se anota todo en un mismo negocio: este mes no se sabe cuánto le tocó a cada uno."
    fill={fill}
  />
)
