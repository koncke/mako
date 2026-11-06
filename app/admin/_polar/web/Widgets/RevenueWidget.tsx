'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/RevenueWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo que ENTRÓ cada mes (lib/admin-ingresos.ts, `vistaDeIngresos`), los últimos cinco meses, como en Polar. Sus datos
// los lee la portada en el server y llegan por props (Polar los pedía con `useMetrics`). Sin el `WidgetGuard` de Polar: en
// Admin no hay permisos por rol (es sólo del super admin, y lo pregunta la página).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { barrasDeIngresos, mesCorto, mesLargo, type IngresosResumen, type Lectura } from '@/app/admin/_polar/datos/resumen'
import { MonthlyBars } from './MonthlyBars'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

interface RevenueWidgetProps {
  className?: string
  ingresos: Lectura<IngresosResumen>
}

// En inglés, como las demás secciones de Polar (revisión del Cerebro del 6/11/2026, punto 39).
const WIDGET_TITLE = 'Revenue'
const MONTHS = 5

// Whole dollars, then compact from $10K so the month labels stay narrow.
const formatBarValue = (cents: number) => {
  const dollars = Math.round(cents / 100)
  return Math.abs(dollars) >= 10_000
    ? new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'usd',
        currencyDisplay: 'symbol', // MaKo: «US$», nunca «$» a secas
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(dollars)
    : formatCurrency('statistics')(dollars * 100, 'usd')
}

const RevenueWidget = ({ className, ingresos }: RevenueWidgetProps) => {
  const router = useRouter()
  const periods = ingresos.ok ? barrasDeIngresos(ingresos.datos, MONTHS) : []
  const currentMonth = periods.at(-1)
  const current = currentMonth?.centavos ?? 0

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {ingresos.ok ? formatCurrency('statistics')(current, 'usd') : '–'}
          </Text>
          {currentMonth && <Text color="muted">{mesLargo(currentMonth.mes)}</Text>}
        </Box>
      }
      action={<WidgetLink href="/admin/analytics/metrics" />}
      className={className}
    >
      {ingresos.ok ? (
        <Box flexDirection="column" paddingBottom="m">
          <MonthlyBars
            bars={periods.map((period, index) => ({
              key: period.mes,
              label: mesCorto(period.mes),
              value: period.centavos,
              formatted: formatBarValue(period.centavos),
              highlighted: index === periods.length - 1,
              href: period.href,
            }))}
          />
        </Box>
      ) : (
        <WidgetError title="No pude leer tus ingresos" detail={ingresos.error} onRetry={() => router.refresh()} />
      )}
    </WidgetContainer>
  )
}

export default RevenueWidget
