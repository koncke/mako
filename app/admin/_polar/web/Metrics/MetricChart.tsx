'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/MetricChart.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { ParsedMetricPeriod } from '@/app/admin/_polar/datos/polar-tipos'
import { getFormattedMetricValue, getTimestampFormatter } from '@/app/admin/_polar/web/utils/metrics'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import dynamic from 'next/dynamic'
import { useTheme } from '@/app/admin/_polar/lib/theme'
import { Suspense, useMemo } from 'react'
import type { AxisTick } from 'recharts/types/util/types'

const GenericChart = dynamic(() =>
  import('../Charts/GenericChart').then((m) => m.GenericChart),
)

interface MetricChartProps {
  ref?: React.RefObject<HTMLDivElement | null>
  data: ParsedMetricPeriod[]
  previousData?: ParsedMetricPeriod[]
  interval: schemas['TimeInterval']
  metric: schemas['Metric']
  height?: number
  width?: number
  onDataIndexHover?: (index: number | null) => void
  simple?: boolean
  showYAxis?: boolean
  chartType?: 'line' | 'bar'
  activeCursorIndex?: number | null
}

const MetricChart = ({
  ref,
  data,
  previousData,
  interval,
  metric,
  height,
  width,
  onDataIndexHover,
  simple = false,
  showYAxis = false,
  chartType = 'line',
  activeCursorIndex,
}: MetricChartProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const genericData = useMemo(
    () =>
      data.map((period, index) => ({
        timestamp: period.timestamp.toISOString(),
        current:
          period[metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>],
        ...(previousData && previousData[index]
          ? {
              previous:
                previousData[index][
                  metric.slug as keyof Omit<ParsedMetricPeriod, 'timestamp'>
                ],
            }
          : {}),
      })),
    [data, previousData, metric.slug],
  )

  const series = useMemo(
    () => [
      ...(previousData
        ? [
            {
              key: 'previous',
              label: 'Período anterior',
              color: isDark ? '#383942' : '#ccc',
            },
          ]
        : []),
      {
        key: 'current',
        label: 'Período actual',
        color: '#2563eb',
      },
    ],
    [previousData, isDark],
  )

  const timestampFormatter = useMemo(() => {
    const fmt = getTimestampFormatter(interval)
    return (value: string | Date) =>
      fmt(typeof value === 'string' ? new Date(value) : value)
  }, [interval])

  const valueFormatter = useMemo(
    () => (value: number) => getFormattedMetricValue(metric, value),
    [metric],
  )

  const ticks = useMemo((): AxisTick[] | undefined => {
    if (!simple) return undefined
    return [
      genericData[0]?.timestamp as AxisTick,
      genericData[genericData.length - 1]?.timestamp as AxisTick,
    ].filter((t): t is AxisTick => t !== undefined)
  }, [simple, genericData])

  return (
    <Suspense fallback={<div style={{ height, width: width || '100%' }} />}>
      <GenericChart
        ref={ref}
        data={genericData}
        series={series}
        xAxisKey="timestamp"
        xAxisFormatter={timestampFormatter}
        valueFormatter={valueFormatter}
        height={height}
        width={width}
        showYAxis={showYAxis}
        chartType={chartType}
        onDataIndexHover={onDataIndexHover}
        simple={simple}
        ticks={ticks}
        activeCursorIndex={activeCursorIndex}
      />
    </Suspense>
  )
}

MetricChart.displayName = 'MetricChart'

export default MetricChart
