// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/MiniMetricChartBox.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo (6/11/2026): Polar formatea todo lo que no es un número como plata con `statistics`. La ficha de un negocio dibuja acá su
// Profit Margin (un porcentaje, de 0 a 1) y su gasto de IA (centavos con decimales, como lo dice Cost Drivers con `subcent`):
// cada tipo con su formato. Lo escalar y la plata, como Polar.

import { formatHumanFriendlyScalar, formatPercentage } from '@/app/admin/_polar/web/utils/formatters'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/app/admin/_polar/atoms/Card'

export interface MiniMetricBoxProps {
  title?: string
  metric?: schemas['Metric'] | null
  value?: number | null
}

export const MiniMetricChartBox = ({
  title,
  metric,
  value,
}: MiniMetricBoxProps) => {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <span className="dark:text-polar-500 text-gray-500">
          {title ?? metric?.display_name}
        </span>
      </CardHeader>
      <CardContent>
        <h3 className="text-2xl">
          {metric &&
            (metric.type === 'scalar'
              ? formatHumanFriendlyScalar(value ?? 0)
              : metric.type === 'percentage'
                ? formatPercentage(value ?? 0)
                : metric.type === 'currency_sub_cent'
                  ? formatCurrency('subcent')(value ?? 0, 'usd')
                  : formatCurrency('statistics')(value ?? 0, 'usd'))}
        </h3>
      </CardContent>
    </Card>
  )
}
