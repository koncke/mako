'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: todo llega por props del server (app/admin/(polar)/customers/page.tsx). El rango de arriba mueve el gráfico de
// crecimiento y Top Customers, como en Polar. At Risk no tiene rango (tampoco en Polar), y Cost Drivers es del mes en curso:
// el gasto de IA de MaKo se corta por mes (lib/costos-ia.ts), y su leyenda lo dice. Sin `canReadAnalytics`: entra sólo
// el super admin.

import { ToplistHeader } from '@/app/admin/_polar/web/Customer/Toplist'
import type { PropsOverview } from '@/app/admin/_polar/datos/clientes'
import { ChartRange, getChartRangeParams } from '@/app/admin/_polar/web/utils/metrics'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useMemo, useState } from 'react'
import { AtRiskList } from './AtRiskList'
import { CustomerGrowthChart } from './CustomerGrowthChart'
import { CustomersPageShell } from './CustomersPageShell'
import { TopCostCustomersList } from './TopCostCustomersList'
import { TopCustomersList } from './TopCustomersList'

export type CustomersOverviewProps = PropsOverview

export const CustomersOverview = ({
  creados,
  desde,
  top,
  topError,
  topAvisos,
  atRisk,
  atRiskError,
  atRiskAvisos,
  costos,
  costosError,
  mesDeCostos,
}: CustomersOverviewProps) => {
  const [range, setRange] = useState<ChartRange>('30d')
  const [startDate, endDate, interval] = useMemo(
    () => getChartRangeParams(range, desde),
    [range, desde],
  )

  return (
    <CustomersPageShell range={range} onRangeChange={setRange}>
      <Box flexDirection="column" rowGap="4xl">
        <CustomerGrowthChart
          creados={creados}
          start={startDate}
          end={endDate}
          interval={interval}
        />
        {/* MaKo: Polar prende las tres columnas por el ancho de la VENTANA (`xl: '1fr 1fr 1fr'`, ≥ 1280 px). Acá el panel mide
            ~770 px con la ventana a 1440 (la barra de MaKo, la de secciones y la lista de negocios se comen el resto): con tres
            columnas, Cost Drivers salía cortado a la derecha y «At Risk» se partía en dos renglones. Las columnas las decide el
            ancho de la CAJA (`@container`, la regla de la casa: lo que cede por ancho no mira la ventana), y se prenden donde cada
            una tiene lo que tenía en Polar (≥ 896 px de caja, `@4xl`). `min-w-0` en cada columna: un nombre largo se corta con
            «…» en vez de ensanchar la columna. El `gap` es el `3xl` de Polar (48 px). */}
        <div className="@container min-w-0">
          <div className="grid min-w-0 grid-cols-1 gap-12 @4xl:grid-cols-3">
            <Box flexDirection="column" rowGap="l" minWidth={0}>
              <ToplistHeader title="Top Customers" caption="Por lo pagado" />
              <TopCustomersList
                datos={top}
                error={topError}
                avisos={topAvisos}
                start={startDate}
                end={endDate}
              />
            </Box>
            <Box flexDirection="column" rowGap="l" minWidth={0}>
              <ToplistHeader title="At Risk" caption="Atrasados, pausados y sin uso" />
              <AtRiskList atRisk={atRisk} error={atRiskError} avisos={atRiskAvisos} />
            </Box>
            <Box flexDirection="column" rowGap="l" minWidth={0}>
              <ToplistHeader
                title="Cost Drivers"
                caption={`Gasto de IA de ${mesDeCostos}`}
              />
              <TopCostCustomersList costos={costos} error={costosError} />
            </Box>
          </div>
        </div>
      </Box>
    </CustomersPageShell>
  )
}
