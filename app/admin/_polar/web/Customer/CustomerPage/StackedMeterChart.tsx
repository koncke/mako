'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Meter/StackedMeterChart.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: vive al lado de Usage (MaKo no tiene la sección de medidores de Polar: Products › Meters). Las fechas, en español.

import { getTimestampFormatter } from '@/app/admin/_polar/web/utils/metrics'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '@/app/admin/_polar/ui/chart'
import { useTheme } from '@/app/admin/_polar/lib/theme'
import { useMemo } from 'react'
import type { GenericChartSeries } from '@/app/admin/_polar/web/Charts/GenericChart'

interface StackedMeterChartProps {
  data: Record<string, number | string>[]
  series: GenericChartSeries[]
  interval: schemas['TimeInterval']
  height?: number
}

const StackedMeterChart = ({
  data,
  series,
  interval,
  height = 250,
}: StackedMeterChartProps) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const config = useMemo(
    () =>
      series.reduce(
        (acc, s) => {
          acc[s.key] = { label: s.label, color: s.color }
          return acc
        },
        {} as Record<string, { label: string; color: string }>,
      ),
    [series],
  )

  const timestampFormatter = useMemo(() => {
    const fmt = getTimestampFormatter(interval, 'es-AR')
    return (value: string) => fmt(new Date(value))
  }, [interval])

  return (
    <ChartContainer style={{ height, width: '100%' }} config={config}>
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 24, top: 24, bottom: 0 }}
      >
        <CartesianGrid
          horizontal={false}
          vertical={true}
          stroke={isDark ? '#222225' : '#ccc'}
          strokeDasharray="6 6"
          syncWithTicks={true}
        />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="equidistantPreserveStart"
          tickFormatter={timestampFormatter}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={4} width="auto" />
        <Tooltip
          cursor={false}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const entries = payload.filter((e) => (e.value as number) > 0)
            if (!entries.length) return null

            return (
              <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                <p className="text-foreground mb-1.5 font-medium">
                  {timestampFormatter(label as string)}
                </p>
                <div className="flex flex-col gap-1">
                  {entries.map((entry) => {
                    const s = series.find((s) => s.key === entry.dataKey)
                    return (
                      <div
                        key={entry.dataKey as string}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: entry.fill as string }}
                        />
                        <span className="text-muted-foreground">
                          {s?.label ?? (entry.dataKey as string)}
                        </span>
                        <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                          {entry.value as number}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            stackId="stack"
            maxBarSize={8}
            radius={0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export default StackedMeterChart
