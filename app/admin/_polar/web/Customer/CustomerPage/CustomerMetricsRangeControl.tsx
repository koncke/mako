'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerMetricsRangeControl.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el principio de «All Time» es el de la actividad del negocio (`inicio`, lo manda el server) en vez de
// `getCustomerActivityStart(customer)`.

import { CHART_RANGES, ChartRange, dateRangeToInterval, getChartRangeParams } from '@/app/admin/_polar/web/utils/metrics'
import { SegmentedControl } from '@/app/admin/_polar/orbit'
import { endOfToday, isSameDay, startOfDay } from 'date-fns'
import { useState } from 'react'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

const RANGE_OPTIONS = (
  Object.entries(CHART_RANGES) as [ChartRange, string][]
).map(([value, label]) => ({ value, label }))

const getRangeDates = (range: ChartRange, inicio: string) => {
  const [startDate] = getChartRangeParams(range, `${inicio.slice(0, 10)}T00:00:00`)
  return { startDate: startOfDay(startDate), endDate: endOfToday() }
}

export const CustomerMetricsRangeControl = ({
  inicio,
}: {
  inicio: string
}) => {
  const { startDate, endDate, setRange } = useCustomerMetricsParams(inicio)

  const [selectedRange, setSelectedRange] = useState<ChartRange | null>(null)

  const matchesDates = (range: ChartRange) => {
    const dates = getRangeDates(range, inicio)
    return (
      isSameDay(dates.startDate, startDate) && isSameDay(dates.endDate, endDate)
    )
  }

  // All Time and Today can resolve to the same dates, so prefer the last pick.
  const activeRange =
    selectedRange && matchesDates(selectedRange)
      ? selectedRange
      : (RANGE_OPTIONS.find(({ value }) => matchesDates(value))?.value ??
        'custom')

  const selectRange = (range: ChartRange | 'custom') => {
    if (range === 'custom') return
    setSelectedRange(range)
    const { startDate, endDate } = getRangeDates(range, inicio)
    setRange(startDate, endDate, dateRangeToInterval(startDate, endDate))
  }

  return (
    <SegmentedControl<ChartRange | 'custom'>
      options={RANGE_OPTIONS}
      value={activeRange}
      onChange={selectRange}
    />
  )
}
