'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Metrics/dashboards/MetricsHeader.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: queda el rango. Se sacaron el `IntervalPicker` (MaKo mide por mes: un selector con una sola opción posible no
// decide nada) y el `ProductSelect` (los ingresos no se reparten por producto). Los rangos que se ofrecen son los que un
// dato mensual puede contestar (`rangosMensuales`).

import DateRangePicker from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import { rangosMensuales } from '@/app/admin/_polar/datos/metricas'
import { useCallback, useMemo } from 'react'
import { useMetricsFilters } from './useMetricsFilters'

interface MetricsHeaderProps {
  earliestDateISOString: string
  /** Cuántos meses leyó la vista (el rango «todos»). */
  mesesLeidos: number
}

export function MetricsHeader({
  earliestDateISOString,
  mesesLeidos,
}: MetricsHeaderProps) {
  const { startDate, setStartDate, endDate, setEndDate, minDate } =
    useMetricsFilters(earliestDateISOString)

  const dateRange = useMemo(
    () => ({ from: startDate, to: endDate }),
    [startDate, endDate],
  )

  const intervals = useMemo(
    () => rangosMensuales(minDate, new Date(), mesesLeidos),
    [minDate, mesesLeidos],
  )

  const onDateChange = useCallback(
    (dateRange: { from: Date; to: Date }) => {
      setStartDate(dateRange.from)
      setEndDate(dateRange.to)
    },
    [setStartDate, setEndDate],
  )

  return (
    <div className="flex flex-col items-center gap-2 lg:flex-row">
      <div className="w-full lg:w-auto">
        <DateRangePicker
          date={dateRange}
          onDateChange={onDateChange}
          minDate={minDate}
          intervals={intervals}
          className="w-full"
        />
      </div>
    </div>
  )
}
