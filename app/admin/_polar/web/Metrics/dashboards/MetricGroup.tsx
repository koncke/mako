'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/dashboards/MetricGroup.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la grilla es siempre de dos columnas (sin la de tres de Polar desde 2xl) y el último gráfico va ancho si quedaría solo
// (`celdaAncha`): con los grupos de MaKo, de una a ocho métricas, la de tres dejaba celdas vacías al ancho de Martín.

import MetricChartBox from '@/app/admin/_polar/web/Metrics/MetricChartBox'
import { celdaAncha } from '@/app/admin/_polar/web/utils/metrics'
import type { ParsedMetricsResponse, schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface MetricGroupProps {
  data?: ParsedMetricsResponse
  metricKeys: (keyof schemas['Metrics'])[]
  interval: schemas['TimeInterval']
  loading?: boolean
  context?: string
}

export function MetricGroup({
  metricKeys,
  data,
  interval,
  loading,
  context,
}: MetricGroupProps) {
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = useState<number | null>(
    null,
  )
  // Track which chart owns the current hover so adjacent charts can't clear it
  const activeHoverKey = useRef<string | null>(null)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
        <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-2">
          {metricKeys.map((metricKey, index) => (
            <MetricChartBox
              key={String(metricKey)}
              data={data}
              interval={interval}
              metric={metricKey}
              height={200}
              chartType="line"
              loading={loading}
              context={context}
              hoveredPeriodIndex={hoveredPeriodIndex}
              onHoverPeriodChange={(period) => {
                if (period !== null) {
                  activeHoverKey.current = String(metricKey)
                  setHoveredPeriodIndex(period)
                } else if (activeHoverKey.current === String(metricKey)) {
                  activeHoverKey.current = null
                  setHoveredPeriodIndex(null)
                }
              }}
              className={twMerge(
                'rounded-none! bg-transparent dark:bg-transparent',
                celdaAncha(index, metricKeys.length) && 'lg:col-span-2',
                'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 shadow-none',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
