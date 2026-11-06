'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/CustomerGrowthChart.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar pide con `useCustomerGrowth` se cuenta acá, en el navegador, con la fecha de alta de cada negocio
// (`crecimientoDeClientes`, app/admin/_polar/datos/clientes.ts). Es cuántos negocios hay, NO cuánto facturan: el
// gráfico de ingresos vive en Overview y en Analytics (Martín, 6/11/2026).

import MetricChart from '@/app/admin/_polar/web/Metrics/MetricChart'
import { crecimientoDeClientes } from '@/app/admin/_polar/datos/clientes'
import type { ParsedMetricPeriod, schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { formatHumanFriendlyScalar } from '@/app/admin/_polar/web/utils/formatters'
import { SegmentedControl, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useMemo, useState } from 'react'
import { useEnElNavegador } from './useEnElNavegador'

type GrowthView = 'new_customers' | 'total_customers'

/** La forma de `schemas['Metric']` con el slug de esta vista (el catálogo de MaKo, datos/metricas.ts, es el de plata). */
type GrowthMetric = { slug: GrowthView; display_name: string; type: 'scalar' }

const GROWTH_METRICS: Record<GrowthView, GrowthMetric> = {
  new_customers: {
    slug: 'new_customers',
    display_name: 'Negocios nuevos',
    type: 'scalar',
  },
  total_customers: {
    slug: 'total_customers',
    display_name: 'Negocios en total',
    type: 'scalar',
  },
}

interface CustomerGrowthChartProps {
  /** La fecha de alta (ISO) de cada negocio. */
  creados: readonly string[]
  start: Date
  end: Date
  interval: schemas['TimeInterval']
}

export const CustomerGrowthChart = ({
  creados,
  start,
  end,
  interval,
}: CustomerGrowthChartProps) => {
  const [view, setView] = useState<GrowthView>('new_customers')
  // Los períodos se cuentan con el reloj y la zona del navegador (como Polar): hasta entonces, lo de «cargando».
  const enElNavegador = useEnElNavegador()
  const growth = useMemo(
    () => (enElNavegador ? crecimientoDeClientes(creados, start, end, interval) : []),
    [enElNavegador, creados, start, end, interval],
  )

  // Polar también lo castea: el período de crecimiento no es uno de métricas de plata, y MetricChart sólo lee
  // `period[metric.slug]`.
  const periods = growth as unknown as ParsedMetricPeriod[]

  const headlineValue = useMemo(() => {
    if (growth.length === 0) {
      return 0
    }
    return view === 'new_customers'
      ? growth.reduce((sum, period) => sum + period.new_customers, 0)
      : growth[growth.length - 1].total_customers
  }, [growth, view])

  return (
    <Box
      flexDirection="column"
      rowGap="xl"
      padding="xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        justifyContent="between"
        gap="l"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">{GROWTH_METRICS[view].display_name}</Text>
          <Text variant="heading-xs" as="p">
            {formatHumanFriendlyScalar(headlineValue)}
          </Text>
        </Box>
        <Box alignItems="start">
          <SegmentedControl<GrowthView>
            options={[
              { value: 'new_customers', label: 'Nuevos' },
              { value: 'total_customers', label: 'Total' },
            ]}
            value={view}
            onChange={setView}
          />
        </Box>
      </Box>
      {!enElNavegador ? (
        <div className="animate-pulse">
          <Box
            height={240}
            borderRadius="m"
            backgroundColor="background-card"
          />
        </div>
      ) : (
        <MetricChart
          data={periods}
          interval={interval}
          // El slug de esta vista no está en el catálogo de plata (ver GrowthMetric): la misma forma, otro slug.
          metric={GROWTH_METRICS[view] as unknown as schemas['Metric']}
          chartType={view === 'new_customers' ? 'bar' : 'line'}
          height={240}
          showYAxis
        />
      )}
    </Box>
  )
}
