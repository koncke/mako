'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/useCustomerMetricsParams.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: Polar guarda el rango en la URL con `nuqs` (`useDateRange` de utils/date, `useQueryState('interval')`); acá con
// useSearchParams para leer y `cambiarQuery` (web/Customer/useClientSidePagination.ts) para escribir. Los mismos parámetros:
// startDate, endDate (YYYY-MM-DD) e interval, y viajan entre las subpáginas (CustomerSubnav). El principio por defecto es el de
// la actividad del negocio (su alta, o su primer pago si fue antes), que el server manda como `inicio`.
// ⚠️ EL RANGO NO VA AL SERVER (punto 32 de docs/admin/revision-cerebro-6-11.md): la ficha llega entera y lo que el rango
//    recorta se recorta en el navegador (ninguna page.tsx de la ficha lee la query). Con `router.replace` cada clic volvía a
//    leer la ficha entera; ahora es `history.replaceState`, como el `shallow` de nuqs que usa Polar.

import { dateRangeToInterval } from '@/app/admin/_polar/web/utils/metrics'
import type { TimeInterval } from '@/app/admin/_polar/datos/polar-tipos'
import { diaDeParam, diaLocal } from '@/app/admin/_polar/datos/cliente'
import { cambiarQuery } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { endOfToday, startOfDay } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export const CUSTOMER_METRICS_QUERY_PARAMS = [
  'startDate',
  'endDate',
  'interval',
]

const INTERVALOS: TimeInterval[] = ['hour', 'day', 'week', 'month', 'year']

const desdeDia = (dia: string) => {
  const [y, m, d] = dia.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Date range and interval for the customer detail pages, backed by query
 * params so the selection survives navigation between the subroutes.
 */
export const useCustomerMetricsParams = (inicio: string) => {
  const searchParams = useSearchParams()

  const startParam = diaDeParam(searchParams.get('startDate'))
  const endParam = diaDeParam(searchParams.get('endDate'))
  const intervalParam = searchParams.get('interval')

  const startDate = useMemo(
    () => startOfDay(desdeDia(startParam ?? inicio.slice(0, 10))),
    [startParam, inicio],
  )
  const endDate = useMemo(
    () => (endParam ? new Date(desdeDia(endParam).setHours(23, 59, 59, 999)) : endOfToday()),
    [endParam],
  )

  const escribir = useCallback((cambios: Record<string, string | null>) => cambiarQuery(cambios), [])

  const setRange = useCallback(
    (start: Date, end: Date, interval: TimeInterval) =>
      escribir({ startDate: diaLocal(start), endDate: diaLocal(end), interval }),
    [escribir],
  )

  // MaKo: Polar valida el intervalo con `getNextValidInterval` (IntervalPicker); acá, uno de la lista o el que toca al rango.
  const interval: TimeInterval =
    intervalParam && (INTERVALOS as string[]).includes(intervalParam)
      ? (intervalParam as TimeInterval)
      : dateRangeToInterval(startDate, endDate)

  const dateRange = useMemo(
    () => ({ startDate, endDate }),
    [startDate, endDate],
  )

  return {
    startDate,
    endDate,
    setRange,
    interval,
    dateRange,
    /** Los días del rango, para filtrar lo que se registra por día (YYYY-MM-DD). */
    desde: diaLocal(startDate),
    hasta: diaLocal(endDate),
  }
}
