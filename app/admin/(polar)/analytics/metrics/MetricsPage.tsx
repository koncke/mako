'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/metrics/layout.tsx
// (y su page.tsx, que monta ClientPage). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Analytics › Metrics, PURA (todo por props, se captura con datos de ejemplo). En Polar el layout dibuja el
// `DashboardBody` con el rango y las acciones, y cada sección pide sus métricas; acá el layout y la página son uno solo,
// porque el rango (en la URL) recorta en el navegador los meses que ya trajo el server: el encabezado y los gráficos
// necesitan los mismos datos. ⚠️ Éste y el Overview son los ÚNICOS lugares con el gráfico de ingresos (Martín, 6/11/2026).
// ⚠️ Los períodos (`Date`) se arman ACÁ, en el navegador (`propsDeMetricas`, con `useMemo` como Overview): del server llegan los
//    meses como texto. Armados en el server (UTC), noviembre se dibujaba «oct» en Argentina (punto 5, revisión del 6/11/2026).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import ClientPage from '@/app/admin/_polar/web/Metrics/dashboards/ClientPage'
import { DashboardViewActions } from '@/app/admin/_polar/web/Metrics/dashboards/DashboardViewHeader'
import { MetricsHeader } from '@/app/admin/_polar/web/Metrics/dashboards/MetricsHeader'
import { useMetricsFilters } from '@/app/admin/_polar/web/Metrics/dashboards/useMetricsFilters'
import { gruposConDatos } from '@/app/admin/_polar/web/utils/metrics'
import { propsDeMetricas, recortarMetricas, type VistaDeMetricas } from '@/app/admin/_polar/datos/metricas'
import { Alert } from '@/app/admin/_polar/orbit'
import { useMemo } from 'react'

export interface MetricsPageProps {
  /** Los meses y los pagos como texto: las fechas se arman acá. `avisos`: lo que no se pudo leer. */
  vista: VistaDeMetricas
}

export default function MetricsPage({ vista }: MetricsPageProps) {
  const { data, earliestDateISOString, mesesLeidos, avisos } = useMemo(
    () => propsDeMetricas(vista),
    [vista],
  )
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
            soporte
            title="Puede faltar algo"
            description={avisos.join(' · ')}
          />
        </div>
      )}
      <ClientPage data={recortada} />
    </DashboardBody>
  )
}
