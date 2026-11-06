'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/dashboards/ClientPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los grupos de Polar (`METRIC_GROUPS`), cada uno con su título y su grilla de gráficos, en el mismo orden y con el
// mismo link a la sección (`#revenue`, `#subscriptions`…). Cambia de dónde salen los números: Polar pide cada grupo a su API
// cuando la sección se acerca a la pantalla (`useMetrics` + `useHasBeenSeen`); acá la página del server ya trajo los meses y
// llegan por props, así que no hay nada que pedir. Un grupo sin ninguna métrica medida no se dibuja (el `RECURRING_ONLY_GROUPS`
// de Polar, con la regla de MaKo). Los tableros propios de Polar (`useMetricDashboards`) se sacaron: no hay dónde guardarlos.

import { gruposConDatos } from '@/app/admin/_polar/web/utils/metrics'
import { type ParsedMetricsResponse } from '@/app/admin/_polar/datos/polar-tipos'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ReactNode, useMemo } from 'react'
import { MetricGroup } from './MetricGroup'
import { useDeepLinkedSection } from './useDeepLinkedSection'

interface ClientPageProps {
  data: ParsedMetricsResponse
}

const DashboardSection = ({
  id,
  title,
  actions,
  children,
}: {
  id: string
  title: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <Box as="section" id={id} flexDirection="column" rowGap="l">
    <Box alignItems="center" justifyContent="between" columnGap="m">
      <Text as="h2" variant="heading-xs">
        {title}
      </Text>
      {actions}
    </Box>
    {children}
  </Box>
)

export default function ClientPage({ data }: ClientPageProps) {
  const groups = useMemo(() => gruposConDatos(data.metrics), [data.metrics])

  useDeepLinkedSection(groups.map(({ slug }) => slug))

  return (
    <Box flexDirection="column" rowGap="4xl">
      {groups.map((group) => (
        <DashboardSection key={group.slug} id={group.slug} title={group.title}>
          <MetricGroup
            metricKeys={group.metrics}
            data={data}
            interval="month"
          />
        </DashboardSection>
      ))}
    </Box>
  )
}
