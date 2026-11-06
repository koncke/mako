'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/TopCostCustomersList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el costo de cada negocio es lo que le costó a MaKo su IA en el mes (`costosPorCliente`,
// app/admin/_polar/datos/clientes.ts, de lib/costos-ia.ts). Claude con la clave de MaKo no es de ningún negocio: va en una
// línea aparte, debajo (`LineasSinReparto`), y lo de antes del 1/11/2026 también. Un mes entero de antes de esa fecha no se
// reparte (todo Claude quedaba en un solo negocio): NO se muestra un número, se dice (`SinReparto`).

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  Toplist,
  ToplistItem,
  ToplistText,
  ToplistValue,
} from '@/app/admin/_polar/web/Customer/Toplist'
import { REPARTO_DESDE_TXT, rutaDeNegocio, type VistaCostos } from '@/app/admin/_polar/datos/clientes'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { useRouter } from '@/app/_ui/Link'
import { Alert, Avatar, Text } from '@/app/admin/_polar/orbit'
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
      <>
        <EmptyState
          icon={<Coins />}
          title="Sin gasto de IA"
          description="Ningún negocio le costó IA a MaKo este mes."
          fill
        />
        <LineasSinReparto costos={costos} />
      </>
    )
  }

  return (
    <>
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
      <LineasSinReparto costos={costos} />
    </>
  )
}

/** Lo que no se reparte por negocio, en una línea cada cosa: Claude con la clave de MaKo y lo de antes del 1/11/2026. */
export const LineasSinReparto = ({ costos }: { costos: Pick<VistaCostos, 'deMako' | 'antes'> }) => {
  const usd = (c: number) => formatCurrency('subcent')(c, 'usd')
  if (!costos.deMako && !costos.antes) return null
  return (
    <div className="flex flex-col gap-1 pt-2">
      {costos.deMako && (
        <Text variant="caption" color="muted">
          Claude con la clave de MaKo: {usd(costos.deMako.costoCentavos)}, no se reparte
        </Text>
      )}
      {costos.antes && (
        <Text variant="caption" color="muted">
          Antes del {REPARTO_DESDE_TXT}: {usd(costos.antes.costoCentavos)}, no se reparte
        </Text>
      )}
    </div>
  )
}

/** El estado de un mes entero de antes del 1/11/2026: no es un vacío, es «no se puede medir». */
export const SinReparto = ({ fill = false }: { fill?: boolean }) => (
  <EmptyState
    icon={<Coins />}
    title="No se puede repartir este mes"
    description="Ese mes el gasto de Claude quedó anotado en un solo negocio."
    fill={fill}
  />
)
