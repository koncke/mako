'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/metrics/layout.tsx
// (y su page.tsx, que monta ClientPage). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Analytics › Metrics, PURA (todo por props, se captura con datos de ejemplo). En Polar el layout dibuja el
// `DashboardBody` con el rango y las acciones, y cada sección pide sus métricas; acá el layout y la página son uno solo,
// porque el rango (en la URL) recorta en el navegador los meses que ya trajo el server: el encabezado y los gráficos
// necesitan los mismos datos. ⚠️ Éste y el Overview son los ÚNICOS lugares con el gráfico de ingresos (Martín, 6/11/2026).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import ClientPage from '@/app/admin/_polar/web/Metrics/dashboards/ClientPage'
import { DashboardViewActions } from '@/app/admin/_polar/web/Metrics/dashboards/DashboardViewHeader'
import { MetricsHeader } from '@/app/admin/_polar/web/Metrics/dashboards/MetricsHeader'
import { useMetricsFilters } from '@/app/admin/_polar/web/Metrics/dashboards/useMetricsFilters'
import { gruposConDatos } from '@/app/admin/_polar/web/utils/metrics'
import { recortarMetricas } from '@/app/admin/_polar/datos/metricas'
import type { ParsedMetricsResponse } from '@/app/admin/_polar/datos/polar-tipos'
import { Alert } from '@/app/admin/_polar/orbit'
import { useMemo } from 'react'

export interface MetricsPageProps {
  data: ParsedMetricsResponse
  /** El primer mes leído (YYYY-MM-DD): no se puede elegir antes. */
  earliestDateISOString: string
  mesesLeidos: number
  /** Lo que no se pudo leer: los números pueden quedarse cortos. */
  avisos: string[]
}

export default function MetricsPage({
  data,
  earliestDateISOString,
  mesesLeidos,
  avisos,
}: MetricsPageProps) {
  const { startDate, endDate } = useMetricsFilters(earliestDateISOString)
  const recortada = useMemo(
    () => recortarMetricas(data, startDate, endDate),
    [data, startDate, endDate],
  )
  const metricas = useMemo(
    () => gruposConDatos(data.metrics).flatMap((g) => g.metrics),
    [data.metrics],
  )

  const acciones = (className?: string) => (
    <DashboardViewActions
      data={recortada}
      metrics={metricas}
      startDate={startDate}
      endDate={endDate}
      className={className}
    />
  )

  return (
    <DashboardBody
      wide
      title="Metrics"
      titleActions={acciones('md:hidden')}
      header={
        <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-center md:gap-x-6">
          <MetricsHeader
            earliestDateISOString={earliestDateISOString}
            mesesLeidos={mesesLeidos}
          />
          {acciones('hidden md:flex')}
        </div>
      }
    >
      {avisos.length > 0 && (
        <div className="mb-8">
          <Alert
            variant="warning"
            title="No pude leer todo: los números pueden quedarse cortos"
            description={avisos.join(' · ')}
          />
        </div>
      )}
      <ClientPage data={recortada} />
    </DashboardBody>
  )
}
