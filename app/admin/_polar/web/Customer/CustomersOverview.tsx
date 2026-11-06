'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: todo llega por props del server (app/admin/(polar)/customers/page.tsx). El rango de arriba mueve el gráfico de
// crecimiento y Top Customers, como en Polar. At Risk no tiene rango (tampoco en Polar), y Cost Drivers es del mes en curso:
// el gasto de IA de MaKo se corta por mes (lib/costos-ia.ts), y su leyenda lo dice. Sin `canReadAnalytics`: entra sólo
// el super admin.

import { ToplistHeader } from '@/app/admin/_polar/web/Customer/Toplist'
import type { PropsOverview } from '@/app/admin/_polar/datos/clientes'
import { ChartRange, getChartRangeParams } from '@/app/admin/_polar/web/utils/metrics'
import { Grid } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useMemo, useState } from 'react'
import { AtRiskList } from './AtRiskList'
import { CustomerGrowthChart } from './CustomerGrowthChart'
import { CustomersPageShell } from './CustomersPageShell'
import { TopCostCustomersList } from './TopCostCustomersList'
import { TopCustomersList } from './TopCustomersList'

export type CustomersOverviewProps = PropsOverview

/** Las columnas de las tres listas (Top Customers, At Risk, Cost Drivers): tantas como entren, de 210 px como mínimo. */
export const COLUMNAS_OVERVIEW = 'repeat(auto-fit, minmax(210px, 1fr))'

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
        <Grid
          // Las columnas dependen del LUGAR que queda, no de la ventana (revisión del Cerebro del 6/11/2026, punto 36): con
          // `xl: repeat(3, …)` cada una medía 248 px a 1536 con la barra de MaKo plegada, 192 con la barra fija y 107 a 1280
          // con la barra fija (unos 64 px para el nombre). Con `auto-fit` y un mínimo de 210 px entran tantas como quepan: a
          // 1440 con la barra plegada el contenedor mide unos 744 px (3 × 216 + 2 × 48 de separación) y siguen siendo tres.
          // Con 240 de mínimo ahí ya caían a dos. Lo fija tests/admin-polar-overview-customers.test.ts.
          templateColumns={COLUMNAS_OVERVIEW}
          gap="3xl"
        >
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader title="Top Customers" caption="Por lo pagado" />
            <TopCustomersList
              datos={top}
              error={topError}
              avisos={topAvisos}
              start={startDate}
              end={endDate}
            />
          </Box>
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader title="At Risk" caption="Atrasados, pausados y sin uso" />
            <AtRiskList atRisk={atRisk} error={atRiskError} avisos={atRiskAvisos} />
          </Box>
          <Box flexDirection="column" rowGap="l">
            <ToplistHeader
              title="Cost Drivers"
              caption={`Gasto de IA de ${mesDeCostos}`}
            />
            <TopCostCustomersList costos={costos} error={costosError} />
          </Box>
        </Grid>
      </Box>
    </CustomersPageShell>
  )
}
