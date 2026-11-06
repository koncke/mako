'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/dashboards/useMetricsFilters.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el rango vive en la URL como en Polar (`start_date`, `end_date`), sin `nuqs`: se lee con `useSearchParams` y se
// escribe con `history.replaceState`, que Next sincroniza con `useSearchParams` sin volver a pedirle la página al server
// (lo que hacía `nuqs` en modo «shallow»). Sin `interval` ni `product_id`: MaKo mide por mes y no reparte por producto
// (docs/relevo/nube-admin-polar.md, «se sacó»). El rango por default son los meses que la vista leyó, no los 30 días de Polar.

import { fromISODate, toISODate } from '@/app/admin/_polar/web/utils/metrics'
import { endOfDay, endOfToday } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

const parseISODate = (value: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = fromISODate(value)
  return isNaN(date.getTime()) ? null : date
}

const escribir = (key: string, date: Date) => {
  const params = new URLSearchParams(window.location.search)
  params.set(key, toISODate(date))
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
}

export function useMetricsFilters(earliestDateISOString: string) {
  const minDate = useMemo(
    () => fromISODate(earliestDateISOString),
    [earliestDateISOString],
  )
  const searchParams = useSearchParams()

  const startDate = useMemo(() => {
    const d = parseISODate(searchParams.get('start_date'))
    return d && d >= minDate ? d : minDate
  }, [searchParams, minDate])
  const endDate = useMemo(() => {
    const d = parseISODate(searchParams.get('end_date'))
    return d ? endOfDay(d) : endOfToday()
  }, [searchParams])

  const setStartDate = useCallback((date: Date) => escribir('start_date', date), [])
  const setEndDate = useCallback((date: Date) => escribir('end_date', date), [])

  return {
    interval: 'month' as const,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    minDate,
  }
}
