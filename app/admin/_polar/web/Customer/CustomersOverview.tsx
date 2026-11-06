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
          templateColumns={{
            base: '1fr',
            md: '1fr',
            xl: '1fr 1fr 1fr',
          }}
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
